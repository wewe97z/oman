import * as cheerio from 'cheerio';
import {
  addSystemLog,
  createImportJob,
  getSources,
  listArticles,
  saveArticle,
  updateImportJob,
  upsertSource,
} from './db';
import {
  autoAnalyzeArabicArticle,
  computeContentHash,
  computeTextSimilarity,
  normalizeArabic,
} from './arabic';
import { Article, ImportJob, Source } from './types';

// سجل احترام معدلات الطلب (Rate Limiting & Politeness per domain)
const domainLastRequestMap = new Map<string, number>();
const MIN_DELAY_BETWEEN_REQUESTS_MS = 2500;

async function waitForDomainPoliteness(hostname: string): Promise<void> {
  const lastTime = domainLastRequestMap.get(hostname) || 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed < MIN_DELAY_BETWEEN_REQUESTS_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_BETWEEN_REQUESTS_MS - elapsed));
  }
  domainLastRequestMap.set(hostname, Date.now());
}

/**
 * فحص ملف robots.txt للموقع المستهدف للتأكد من عدم حظر الجلب الآلي للمسار المطلوب
 * التزاماً بعدم تجاوز قيود الوصول أو شروط المواقع.
 */
async function checkRobotsTxtAllowed(targetUrl: URL): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const robotsUrl = `${targetUrl.protocol}//${targetUrl.host}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'OmaniDigitalEncyclopediaBot/1.0 (+Academic-Cultural-Research; Respects-Robots)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { allowed: true };
    }

    const txt = await res.text();
    const lines = txt.split(/\r?\n/);
    let appliesToWildcard = false;

    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      if (/^user-agent:\s*\*/i.test(line)) {
        appliesToWildcard = true;
      } else if (/^user-agent:/i.test(line)) {
        appliesToWildcard = false;
      } else if (appliesToWildcard && /^disallow:\s*(.+)/i.test(line)) {
        const match = line.match(/^disallow:\s*(.+)/i);
        const disallowedPath = match ? match[1].trim() : '';
        if (disallowedPath === '/') {
          return {
            allowed: false,
            reason: 'ملف robots.txt الخاص بالموقع يمنع الزحف الآلي العام (Disallow: /). احتراماً لشروط الموقع تم إيقاف الجلب الآلي، ويمكنك استخدام الإدخال الموثق أو رفع ملف نصي مرخص.',
          };
        }
        if (disallowedPath.length > 1 && targetUrl.pathname.startsWith(disallowedPath)) {
          return {
            allowed: false,
            reason: `المسار (${disallowedPath}) مقيد في ملف robots.txt الخاص بالموقع المصدر.`,
          };
        }
      }
    }
    return { allowed: true };
  } catch {
    // في حال عدم وجود ملف robots.txt أو تعذر قراءته، نتابع مع فحص استجابة الصفحة نفسها
    return { allowed: true };
  }
}

/**
 * تنظيف HTML واستخراج العنوان والنص الموسوعي والتاريخ واسم الجهة الناشرة
 * مع إزالة القوائم الجانبية والإعلانات والتذييل والسكربتات
 */
export function extractCleanArticleFromHtml(
  html: string,
  pageUrl: string
): {
  title: string;
  cleanedText: string;
  publishedDate: string;
  publisherName: string;
  licenseNotice: string;
  requiresLoginOrBlocked: boolean;
} {
  const $ = cheerio.load(html);

  // التحقق من وجود شاشات تسجيل دخول أو حماية تمنع الوصول العام
  const pageTitleRaw = ($('title').first().text() || '').trim();
  if (
    /تسجيل الدخول|login|sign in|access denied|cloudflare|captcha|403 forbidden/i.test(pageTitleRaw) &&
    $('input[type="password"]').length > 0
  ) {
    return {
      title: pageTitleRaw,
      cleanedText: '',
      publishedDate: '',
      publisherName: '',
      licenseNotice: '',
      requiresLoginOrBlocked: true,
    };
  }

  // استخراج البيانات الوصفية قبل إزالة الرأس
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const h1Title = $('article h1, main h1, h1').first().text().trim();
  const title = (h1Title || ogTitle || pageTitleRaw || 'مقال مستورد حول سلطنة عُمان')
    .replace(/\s+/g, ' ')
    .trim();

  const ogSiteName =
    $('meta[property="og:site_name"]').attr('content')?.trim() ||
    $('meta[name="publisher"]').attr('content')?.trim() ||
    $('meta[name="author"]').attr('content')?.trim() ||
    '';

  const metaDate =
    $('meta[property="article:published_time"]').attr('content')?.trim() ||
    $('meta[name="date"]').attr('content')?.trim() ||
    $('time[datetime]').first().attr('datetime')?.trim() ||
    '';

  const licenseText =
    $('meta[name="copyright"]').attr('content')?.trim() ||
    $('a[rel="license"]').first().text().trim() ||
    'محفوظ الحقوق للجهة الناشرة الأصلية — استخلاص وتوثيق مرجعي مع الرابط الأصلي';

  // إزالة جميع عناصر القوائم، الإعلانات، الترويسات، التذييلات، النماذج، والسكربتات
  $(
    'script, style, noscript, iframe, svg, nav, header, footer, aside, form, button, ' +
      '.menu, .navbar, .nav, .sidebar, .footer, .header, .ads, .advertisement, .cookie, ' +
      '.share, .social, .comments, .related, .breadcrumb, [role="navigation"], [role="banner"], [role="contentinfo"]'
  ).remove();

  // اختيار حاوية المحتوى الرئيسي
  let contentRoot = $('article, main, [role="main"], .article-content, .post-content, .entry-content, #content').first();
  if (contentRoot.length === 0) {
    contentRoot = $('body');
  }

  const paragraphs: string[] = [];
  contentRoot.find('h2, h3, p, li').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    // تجاهل العناصر القصيرة جداً التي تكون غالباً أزراراً أو روابط قائمة
    if (txt.length >= 40 || (tag?.startsWith('h') && txt.length >= 10)) {
      if (!paragraphs.includes(txt)) {
        paragraphs.push(txt);
      }
    }
  });

  let cleanedText = paragraphs.join('\n\n');
  if (cleanedText.length < 120) {
    cleanedText = contentRoot
      .text()
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 45)
      .join('\n\n');
  }

  let hostname = '';
  try {
    hostname = new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    hostname = pageUrl;
  }

  return {
    title,
    cleanedText: cleanedText.slice(0, 12000).trim(),
    publishedDate: metaDate ? metaDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    publisherName: ogSiteName || hostname,
    licenseNotice: licenseText,
    requiresLoginOrBlocked: false,
  };
}

/**
 * استيراد محتوى صفحة واحدة عبر رابط URL مع التحقق من المصدر، واكتشاف التكرار، والتصنيف التلقائي
 */
export async function importFromUrl(input: {
  url: string;
  autoPublish?: boolean;
  customSourceName?: string;
  customSourceType?: Source['sourceType'];
}): Promise<{
  ok: boolean;
  job: ImportJob;
  article?: Article;
  duplicateOf?: Article;
  error?: string;
}> {
  const rawUrl = input.url.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('الرابط يجب أن يبدأ بـ http أو https');
    }
  } catch {
    const failedJob = createImportJob({
      jobType: 'url_fetch',
      targetUrlOrQuery: rawUrl,
    });
    const updated = updateImportJob(failedJob.id, {
      status: 'failed',
      errorReasonCode: 'INVALID_URL',
      errorMessage: 'صيغة الرابط المدخل غير صالحة. يرجى إدخال رابط كامل يبدأ بـ https://',
      itemsProcessed: 1,
      itemsFailed: 1,
    })!;
    return { ok: false, job: updated, error: updated.errorMessage };
  }

  const job = createImportJob({
    jobType: 'url_fetch',
    targetUrlOrQuery: parsedUrl.toString(),
  });

  try {
    // 1. فحص robots.txt واحترام حدود الطلبات
    const robotsCheck = await checkRobotsTxtAllowed(parsedUrl);
    if (!robotsCheck.allowed) {
      const updated = updateImportJob(job.id, {
        status: 'failed',
        errorReasonCode: 'ROBOTS_DISALLOWED',
        errorMessage: robotsCheck.reason || 'الموقع لا يسمح بالجلب الآلي في robots.txt',
        itemsProcessed: 1,
        itemsFailed: 1,
      })!;
      return { ok: false, job: updated, error: updated.errorMessage };
    }

    await waitForDomainPoliteness(parsedUrl.hostname);

    // 2. جلب الصفحة مع مهلة زمنية محددة
    const controller = new AbortController();
    const timeoutMs = Number(process.env.IMPORT_REQUEST_TIMEOUT_MS || 10000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OmaniDigitalEncyclopedia/1.0; +CulturalResearch)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 401 || response.status === 403) {
      const updated = updateImportJob(job.id, {
        status: 'failed',
        errorReasonCode: `HTTP_${response.status}_PROTECTED`,
        errorMessage: `الموقع المصدر يفرض قيود وصول أو تسجيل دخول (HTTP ${response.status}). النظام يلتزم بعدم تجاوز الحماية. يمكنك إضافة المادة يدوياً أو عبر ملف نصي مرخص.`,
        itemsProcessed: 1,
        itemsFailed: 1,
      })!;
      return { ok: false, job: updated, error: updated.errorMessage };
    }

    if (!response.ok) {
      const updated = updateImportJob(job.id, {
        status: 'failed',
        errorReasonCode: `HTTP_${response.status}`,
        errorMessage: `تعذر جلب الصفحة من المصدر: أعاد الخادم حالة HTTP ${response.status}`,
        itemsProcessed: 1,
        itemsFailed: 1,
      })!;
      return { ok: false, job: updated, error: updated.errorMessage };
    }

    const html = await response.text();
    const extracted = extractCleanArticleFromHtml(html, parsedUrl.toString());

    if (extracted.requiresLoginOrBlocked) {
      const updated = updateImportJob(job.id, {
        status: 'failed',
        errorReasonCode: 'AUTH_WALL_DETECTED',
        errorMessage: 'الصفحة تتطلب تسجيل دخول أو تحقق حماية. لا يقوم النظام بتجاوز بوابات الدخول.',
        itemsProcessed: 1,
        itemsFailed: 1,
      })!;
      return { ok: false, job: updated, error: updated.errorMessage };
    }

    if (!extracted.cleanedText || extracted.cleanedText.length < 100) {
      const updated = updateImportJob(job.id, {
        status: 'failed',
        errorReasonCode: 'INSUFFICIENT_TEXT',
        errorMessage:
          'لم يُعثر على نص موسوعي كافٍ في الصفحة (قد تعتمد الصفحة كلياً على العرض التفاعلي في المتصفح). يمكنك استخدام استيراد النص المباشر أو الملف.',
        extractedTitle: extracted.title,
        publisherName: extracted.publisherName,
        itemsProcessed: 1,
        itemsFailed: 1,
      })!;
      return { ok: false, job: updated, error: updated.errorMessage };
    }

    return finalizeArticleImport({
      jobId: job.id,
      title: extracted.title,
      content: extracted.cleanedText,
      sourceUrl: parsedUrl.toString(),
      publisherName: input.customSourceName || extracted.publisherName,
      publishedDate: extracted.publishedDate,
      licenseNotice: extracted.licenseNotice,
      sourceType: input.customSourceType,
      autoPublish: input.autoPublish,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const updated = updateImportJob(job.id, {
      status: 'failed',
      errorReasonCode: 'NETWORK_OR_TIMEOUT',
      errorMessage: `تعذر الاتصال بالرابط الخارجي (${errMsg}). إذا كانت بيئة الخادم مقيدة الاتصال بالإنترنت لبعض النطاقات، يمكنك استخدام أداة استيراد الملفات/النصوص الموثقة أدناه.`,
      itemsProcessed: 1,
      itemsFailed: 1,
    })!;
    addSystemLog('error', 'importer', `فشل استيراد الرابط: ${rawUrl}`, errMsg);
    return { ok: false, job: updated, error: updated.errorMessage };
  }
}

/**
 * إتمام حفظ المقال المستورد بعد فحص التكرار، وتوثيق المصدر، والتصنيف التلقائي، واقتراح الملخص والكلمات المفتاحية
 */
export function finalizeArticleImport(params: {
  jobId?: string;
  title: string;
  content: string;
  sourceUrl: string;
  publisherName: string;
  publishedDate?: string;
  licenseNotice?: string;
  sourceType?: Source['sourceType'];
  autoPublish?: boolean;
}): {
  ok: boolean;
  job: ImportJob;
  article?: Article;
  duplicateOf?: Article;
  error?: string;
} {
  const job = params.jobId
    ? updateImportJob(params.jobId, { status: 'running' })!
    : createImportJob({
        jobType: 'manual_file',
        targetUrlOrQuery: params.sourceUrl || params.title,
      });

  // 1. فحص المقالات المكررة قبل الحفظ
  const existingArticles = listArticles({ status: 'all', limit: 500 });
  const incomingHash = computeContentHash(params.content);
  const incomingTitleNorm = normalizeArabic(params.title);

  for (const existing of existingArticles) {
    const similarity = computeTextSimilarity(existing.content, params.content);
    if (
      existing.contentHash === incomingHash ||
      existing.titleNormalized === incomingTitleNorm ||
      similarity >= 0.65
    ) {
      const updated = updateImportJob(job.id, {
        status: 'duplicate_skipped',
        extractedTitle: params.title,
        publisherName: params.publisherName,
        createdArticleId: existing.id,
        errorReasonCode: 'DUPLICATE_DETECTED',
        errorMessage: `تم اكتشاف مقال مطابق أو شديد التشابه في قاعدة البيانات بعنوان: «${existing.title}» (نسبة التشابه: ${Math.round(
          Math.max(similarity, existing.contentHash === incomingHash ? 1 : 0.9) * 100
        )}%). تم منع التكرار تلقائياً.`,
        itemsProcessed: 1,
        itemsFailed: 0,
      })!;
      return {
        ok: false,
        job: updated,
        duplicateOf: existing,
        error: updated.errorMessage,
      };
    }
  }

  // 2. التحقق من المصدر أو تسجيله في جدول المصادر
  let domain = 'manual-source.om';
  try {
    domain = new URL(params.sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = 'verified-import.om';
  }

  const allSources = getSources();
  let matchedSource = allSources.find(
    (s) => s.url === params.sourceUrl || s.domain === domain
  );

  const detectedSourceType: Source['sourceType'] =
    params.sourceType ||
    (domain.endsWith('.gov.om') || domain.includes('omaninfo.om') || domain.includes('oman2040.om')
      ? 'official_omani'
      : domain.endsWith('.edu.om')
      ? 'academic_omani'
      : domain.endsWith('.om')
      ? 'cultural_omani'
      : 'international');

  if (!matchedSource && params.sourceUrl) {
    matchedSource = upsertSource({
      name: params.publisherName || `مصدر: ${domain}`,
      url: params.sourceUrl,
      sourceType: detectedSourceType,
      publisher: params.publisherName || domain,
      trustLevel: domain.endsWith('.om') ? 'high' : 'review_required',
      licenseInfo:
        params.licenseNotice ||
        'استشهاد مرجعي موثق مع حفظ الحقوق للجهة الناشرة الأصلية',
      allowedScraping: true,
    });
  }

  // 3. التصنيف التلقائي واقتراح الملخص والكلمات المفتاحية العربية
  const analysis = autoAnalyzeArabicArticle(params.title, params.content);
  const today = new Date().toISOString().slice(0, 10);

  const initialStatus: Article['status'] = params.autoPublish
    ? 'published'
    : matchedSource?.trustLevel === 'high'
    ? 'verified'
    : 'under_review';

  const savedArticle = saveArticle(
    {
      title: params.title,
      summary: analysis.summary,
      content: params.content,
      categoryId: analysis.categoryId,
      subcategory: analysis.subcategory,
      volumeId: 'vol-01',
      keywords: analysis.keywords,
      authorOrPublisher: params.publisherName || matchedSource?.publisher || 'مصدر موثق',
      sourceId: matchedSource?.id || null,
      sourceUrl: params.sourceUrl,
      references: [
        {
          title: params.title,
          url: params.sourceUrl,
          publisher: params.publisherName || matchedSource?.publisher || domain,
          accessDate: today,
          sourceType: detectedSourceType,
        },
      ],
      publishedAt: params.publishedDate || today,
      lastVerifiedAt: today,
      status: initialStatus,
      factClassification: 'confirmed_fact',
      licenseInfo:
        params.licenseNotice ||
        'مادة موسوعية مستخلصة وموثقة بالمصدر الأصلي وفق ضوابط الاستشهاد العلمي',
    },
    'وحدة الاستيراد الذكي',
    `استيراد وتصنيف تلقائي من المصدر: ${params.sourceUrl}`
  );

  const updatedJob = updateImportJob(job.id, {
    status: 'completed',
    extractedTitle: savedArticle.title,
    publisherName: savedArticle.authorOrPublisher,
    createdArticleId: savedArticle.id,
    itemsProcessed: 1,
    itemsSucceeded: 1,
    itemsFailed: 0,
  })!;

  return {
    ok: true,
    job: updatedJob,
    article: savedArticle,
  };
}

/**
 * البحث التلقائي عن صفحات عربية موثوقة ذات صلة بموضوع عُماني (عبر واجهة ويكيبيديا العربية المفتوحة والمرخصة CC BY-SA 4.0 + المصادر الرسمية المسجلة)
 * واستيرادها على دفعات صغيرة مع احترام حدود الطلبات
 */
export async function discoverAndImportOmaniTopicBatch(input: {
  topicQuery: string;
  maxBatchSize?: number;
}): Promise<{
  ok: boolean;
  job: ImportJob;
  importedArticles: Article[];
  skippedDuplicates: string[];
  errors: string[];
}> {
  const batchSize = Math.min(5, Math.max(1, input.maxBatchSize || 3));
  const query = input.topicQuery.trim() || 'سلطنة عمان';

  const job = createImportJob({
    jobType: 'topic_discovery',
    targetUrlOrQuery: `بحث واستيراد دفعة صغيرة حول: ${query} (الحد الأقصى: ${batchSize})`,
  });

  const importedArticles: Article[] = [];
  const skippedDuplicates: string[] = [];
  const errors: string[] = [];

  try {
    // استخدام واجهة البحث المفتوحة والمرخصة قانونياً (MediaWiki API - CC BY-SA 4.0) مع حصر البحث بموضوعات سلطنة عُمان
    const searchUrl = new URL('https://ar.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', `${query} سلطنة عمان`);
    searchUrl.searchParams.set('srlimit', String(batchSize));
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    await waitForDomainPoliteness('ar.wikipedia.org');

    const searchRes = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'OmaniDigitalEncyclopedia/1.0 (Cultural Encyclopedia; Respectful Batch Importer)',
      },
    });

    if (!searchRes.ok) {
      throw new Error(`HTTP ${searchRes.status} أثناء البحث في الفهرس المفتوح`);
    }

    const searchJson = (await searchRes.json()) as {
      query?: { search?: Array<{ title: string; pageid: number }> };
    };
    const results = searchJson.query?.search || [];

    if (results.length === 0) {
      const updated = updateImportJob(job.id, {
        status: 'completed',
        errorMessage: 'لم يتم العثور على صفحات جديدة مطابقة لعبارة البحث.',
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
      })!;
      return { ok: true, job: updated, importedArticles, skippedDuplicates, errors };
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of results.slice(0, batchSize)) {
      processed++;
      try {
        await new Promise((r) => setTimeout(r, 800)); // احترام معدل الطلبات بين كل عنصر في الدفعة
        const extractUrl = new URL('https://ar.wikipedia.org/w/api.php');
        extractUrl.searchParams.set('action', 'query');
        extractUrl.searchParams.set('prop', 'extracts|info');
        extractUrl.searchParams.set('explaintext', '1');
        extractUrl.searchParams.set('inprop', 'url');
        extractUrl.searchParams.set('pageids', String(item.pageid));
        extractUrl.searchParams.set('format', 'json');

        const pageRes = await fetch(extractUrl.toString(), {
          headers: {
            'User-Agent': 'OmaniDigitalEncyclopedia/1.0 (Cultural Encyclopedia)',
          },
        });
        const pageJson = (await pageRes.json()) as {
          query?: {
            pages?: Record<
              string,
              { title?: string; extract?: string; fullurl?: string; touched?: string }
            >;
          };
        };

        const pageObj = pageJson.query?.pages?.[String(item.pageid)];
        const extractText = (pageObj?.extract || '').trim();
        const fullUrl =
          pageObj?.fullurl ||
          `https://ar.wikipedia.org/wiki/${encodeURIComponent(item.title)}`;

        if (extractText.length < 120) {
          failed++;
          errors.push(`المقال «${item.title}» قصير جداً ولا يصلح مادة موسوعية.`);
          continue;
        }

        const res = finalizeArticleImport({
          title: pageObj?.title || item.title,
          content: extractText.slice(0, 6000),
          sourceUrl: fullUrl,
          publisherName: 'الموسوعة الحرة (مرخصة تحت المشاع الإبداعي CC BY-SA 4.0 — مصدر دولي مفتوح)',
          publishedDate: pageObj?.touched ? pageObj.touched.slice(0, 10) : undefined,
          licenseNotice: 'Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) مع الإحالة للرابط الأصلي',
          sourceType: 'international',
          autoPublish: false, // يوضع قيد المراجعة للتدقيق ومقارنته بالمصادر العُمانية الرسمية
        });

        if (res.ok && res.article) {
          succeeded++;
          importedArticles.push(res.article);
        } else if (res.duplicateOf) {
          skippedDuplicates.push(item.title);
        } else {
          failed++;
          if (res.error) errors.push(res.error);
        }
      } catch (e: unknown) {
        failed++;
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    const updated = updateImportJob(job.id, {
      status: 'completed',
      extractedTitle:
        importedArticles.map((a) => a.title).join(' ، ') ||
        `اكتملت الدفعة (${skippedDuplicates.length} مكرر)`,
      publisherName: 'بحث واستيراد دفعات صغيرة (CC BY-SA 4.0)',
      createdArticleId: importedArticles[0]?.id || null,
      errorMessage: errors.join(' | '),
      itemsProcessed: processed,
      itemsSucceeded: succeeded,
      itemsFailed: failed,
    })!;

    return {
      ok: true,
      job: updated,
      importedArticles,
      skippedDuplicates,
      errors,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const updated = updateImportJob(job.id, {
      status: 'failed',
      errorReasonCode: 'BATCH_DISCOVERY_ERROR',
      errorMessage: `تعذر إتمام البحث الخارجي المباشر (${msg}). يمكنك دائماً إضافة الروابط أو الملفات الموثقة يدوياً.`,
      itemsProcessed: 1,
      itemsFailed: 1,
    })!;
    return {
      ok: false,
      job: updated,
      importedArticles,
      skippedDuplicates,
      errors: [updated.errorMessage],
    };
  }
}
