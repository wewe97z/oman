import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { getServerSecretKey } from './auth';
import { addSystemLog, searchArticles } from './db';
import { AIChatResponse, AICitation, AISettingsPublic } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SECURE_SETTINGS_FILE = path.join(DATA_DIR, 'secure-settings.json');

interface StoredEncryptedSettings {
  encryptedApiKey?: string;
  iv?: string;
  authTag?: string;
  modelName: string;
  enableWebSearch: boolean;
  maxOutputTokens: number;
  maxInputChars: number;
  rateLimitPerMinute: number;
  lastTestedAt: string | null;
  lastTestStatus: 'untested' | 'ok' | 'error';
  lastTestMessage: string;
}

// عداد محدد الطلبات في الذاكرة لحماية الحصة المجانية والتكاليف
const requestTimestamps: number[] = [];

function encryptSecret(plainText: string): { encrypted: string; iv: string; authTag: string } {
  const key = getServerSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptSecret(encrypted: string, iv: string, authTag: string): string | null {
  try {
    const key = getServerSecretKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function readRawStoredSettings(): StoredEncryptedSettings {
  const defaults: StoredEncryptedSettings = {
    modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    enableWebSearch: process.env.GEMINI_ENABLE_WEB_SEARCH === 'true',
    maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS || 1536),
    maxInputChars: 1500,
    rateLimitPerMinute: Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 15),
    lastTestedAt: null,
    lastTestStatus: 'untested',
    lastTestMessage: 'لم يتم إجراء اختبار اتصال بعد.',
  };

  try {
    if (fs.existsSync(SECURE_SETTINGS_FILE)) {
      const parsed = JSON.parse(
        fs.readFileSync(SECURE_SETTINGS_FILE, 'utf8')
      ) as Partial<StoredEncryptedSettings>;
      return {
        ...defaults,
        ...parsed,
      };
    }
  } catch {
    // ignore corrupt file and return defaults
  }
  return defaults;
}

function writeRawStoredSettings(settings: StoredEncryptedSettings): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(SECURE_SETTINGS_FILE, JSON.stringify(settings, null, 2), {
    mode: 0o600,
  });
}

/**
 * استرجاع المفتاح الفعلي على الخادم فقط (لا يُصدّر أبداً للواجهة الأمامية)
 */
function resolveServerApiKey(): {
  key: string | null;
  source: 'env' | 'server_encrypted_store' | 'none';
} {
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey && envKey.length >= 15) {
    return { key: envKey, source: 'env' };
  }

  const stored = readRawStoredSettings();
  if (stored.encryptedApiKey && stored.iv && stored.authTag) {
    const decrypted = decryptSecret(stored.encryptedApiKey, stored.iv, stored.authTag);
    if (decrypted && decrypted.trim().length >= 15) {
      return { key: decrypted.trim(), source: 'server_encrypted_store' };
    }
  }

  return { key: null, source: 'none' };
}

/**
 * إرجاع حالة إعدادات الذكاء الاصطناعي العامة للواجهة دون كشف المفتاح السري مطلقاً
 */
export function getPublicAISettings(): AISettingsPublic {
  const stored = readRawStoredSettings();
  const resolved = resolveServerApiKey();

  return {
    hasApiKey: Boolean(resolved.key),
    keySource: resolved.source,
    maskedKeyHint: resolved.key
      ? resolved.source === 'env'
        ? 'مُعيّن عبر متغير البيئة السري (GEMINI_API_KEY)'
        : 'مُخزّن ومُشفّر بأمان على الخادم (AES-256-GCM)'
      : 'غير مُعيّن (يلزم إعداد مفتاح API)',
    modelName: stored.modelName || 'gemini-2.5-flash',
    enableWebSearch: Boolean(stored.enableWebSearch),
    maxOutputTokens: Number(stored.maxOutputTokens || 1536),
    maxInputChars: Number(stored.maxInputChars || 1500),
    rateLimitPerMinute: Number(stored.rateLimitPerMinute || 15),
    lastTestedAt: stored.lastTestedAt,
    lastTestStatus: stored.lastTestStatus,
    lastTestMessage: stored.lastTestMessage,
  };
}

/**
 * تحديث إعدادات Gemini API من لوحة الإدارة بطريقة آمنة ومشفرة على الخادم
 */
export function updateAISettings(input: {
  apiKey?: string;
  clearSavedKey?: boolean;
  modelName?: string;
  enableWebSearch?: boolean;
  maxOutputTokens?: number;
  maxInputChars?: number;
  rateLimitPerMinute?: number;
}): AISettingsPublic {
  const current = readRawStoredSettings();

  if (input.clearSavedKey) {
    delete current.encryptedApiKey;
    delete current.iv;
    delete current.authTag;
    addSystemLog('security', 'gemini', 'تم مسح مفتاح Gemini API المخزن على الخادم بناءً على طلب المدير', '');
  } else if (input.apiKey && input.apiKey.trim().length > 0) {
    const encrypted = encryptSecret(input.apiKey.trim());
    current.encryptedApiKey = encrypted.encrypted;
    current.iv = encrypted.iv;
    current.authTag = encrypted.authTag;
    addSystemLog('security', 'gemini', 'تم تحديث وتشفير مفتاح Gemini API في مخزن الخادم الآمن', '');
  }

  if (input.modelName && input.modelName.trim()) {
    current.modelName = input.modelName.trim();
  }
  if (typeof input.enableWebSearch === 'boolean') {
    current.enableWebSearch = input.enableWebSearch;
  }
  if (input.maxOutputTokens !== undefined) {
    current.maxOutputTokens = Math.min(4096, Math.max(256, Number(input.maxOutputTokens)));
  }
  if (input.maxInputChars !== undefined) {
    current.maxInputChars = Math.min(4000, Math.max(200, Number(input.maxInputChars)));
  }
  if (input.rateLimitPerMinute !== undefined) {
    current.rateLimitPerMinute = Math.min(60, Math.max(2, Number(input.rateLimitPerMinute)));
  }

  writeRawStoredSettings(current);
  return getPublicAISettings();
}

/**
 * اختبار الاتصال بنموذج Gemini المحدد دون كشف المفتاح
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  status: 'ok' | 'error';
  message: string;
  modelName: string;
}> {
  const stored = readRawStoredSettings();
  const resolved = resolveServerApiKey();
  const now = new Date().toISOString();

  if (!resolved.key) {
    stored.lastTestedAt = now;
    stored.lastTestStatus = 'error';
    stored.lastTestMessage = 'يلزم إعداد مفتاح Gemini API أولاً (من متغير البيئة GEMINI_API_KEY أو من لوحة الإدارة).';
    writeRawStoredSettings(stored);
    return {
      ok: false,
      status: 'error',
      message: stored.lastTestMessage,
      modelName: stored.modelName,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: resolved.key });
    const response = await ai.models.generateContent({
      model: stored.modelName,
      contents: 'أجب بكلمة واحدة بالعربية فقط: هل الاتصال ناجح؟',
      config: {
        maxOutputTokens: 32,
        temperature: 0.1,
      },
    });

    const text = (response.text || '').trim();
    stored.lastTestedAt = now;
    stored.lastTestStatus = 'ok';
    stored.lastTestMessage = `الاتصال بالنموذج (${stored.modelName}) ناجح واستجاب الخادم: «${text.slice(0, 40)}»`;
    writeRawStoredSettings(stored);
    addSystemLog('info', 'gemini', `نجح اختبار الاتصال بنموذج Gemini (${stored.modelName})`, '');

    return {
      ok: true,
      status: 'ok',
      message: stored.lastTestMessage,
      modelName: stored.modelName,
    };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let friendly = 'تعذر الاتصال بخدمة Gemini API. يرجى التحقق من صلاحية المفتاح أو اسم النموذج.';
    if (/API_KEY_INVALID|invalid api key|400|403/i.test(rawMsg)) {
      friendly = 'مفتاح Gemini API غير صالح أو غير مفعل لهذا النموذج.';
    } else if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMsg)) {
      friendly = 'تم استنفاد الحصة المجانية المؤقتة (Quota Exceeded / 429). يرجى الانتظار قليلاً أو مراجعة حدود حسابك في Google AI Studio.';
    } else if (/not found|404/i.test(rawMsg)) {
      friendly = `اسم النموذج (${stored.modelName}) غير متاح حالياً في حسابك. جرب gemini-2.5-flash أو gemini-2.0-flash.`;
    }

    stored.lastTestedAt = now;
    stored.lastTestStatus = 'error';
    stored.lastTestMessage = friendly;
    writeRawStoredSettings(stored);
    addSystemLog('error', 'gemini', 'فشل اختبار الاتصال بنموذج Gemini', friendly);

    return {
      ok: false,
      status: 'error',
      message: friendly,
      modelName: stored.modelName,
    };
  }
}

/**
 * تشغيل المساعد الموسوعي الذكي (اسأل الموسوعة العُمانية) بآلية RAG + Google Search Grounding الاختياري
 */
export async function askOmaniEncyclopediaAI(input: {
  question: string;
  allowWebSearchOverride?: boolean;
}): Promise<AIChatResponse> {
  const settings = getPublicAISettings();
  const rawQuestion = (input.question || '').trim();

  if (!rawQuestion) {
    return {
      answer: 'يرجى كتابة سؤالك حول سلطنة عُمان (تاريخها، محافظاتها، قلاعها، أعلامها، أو تراثها).',
      answerOrigin: 'insufficient_info',
      encyclopediaSection: '',
      webSearchSection: null,
      encyclopediaCitations: [],
      webCitations: [],
      modelUsed: settings.modelName,
      webSearchUsed: false,
    };
  }

  if (rawQuestion.length > settings.maxInputChars) {
    return {
      answer: `رسالتك تتجاوز الحد الأقصى المسموح به (${settings.maxInputChars} حرفاً) لحماية موارد النظام. يرجى اختصار السؤال والمحاولة مجدداً.`,
      answerOrigin: 'insufficient_info',
      encyclopediaSection: '',
      webSearchSection: null,
      encyclopediaCitations: [],
      webCitations: [],
      modelUsed: settings.modelName,
      webSearchUsed: false,
      errorType: 'rate_limited',
    };
  }

  // 1. البحث أولاً في قاعدة بيانات الموسوعة العُمانية (RAG Retrieval)
  const dbSearch = searchArticles({
    query: rawQuestion,
    status: 'all_public',
    limit: 4,
  });

  const encyclopediaCitations: AICitation[] = dbSearch.hits.map((hit) => ({
    title: hit.article.title,
    url: hit.article.sourceUrl || `/articles/${hit.article.slug}`,
    publisher: hit.article.authorOrPublisher,
    origin: 'encyclopedia_db',
    articleSlug: hit.article.slug,
    snippet: hit.snippet.replace(/<[^>]+>/g, ''),
  }));

  const resolvedKey = resolveServerApiKey();

  // إذا لم يكن مفتاح Gemini API مضافاً، نعرض رسالة عربية مهذبة وبسيطة مع تقديم المعلومة الموثقة من الموسوعة إن وُجدت دون أي تفاصيل تقنية
  if (!resolvedKey.key) {
    const ragFallbackSummary =
      dbSearch.hits.length > 0
        ? dbSearch.hits
            .map(
              (h) =>
                `• ${h.article.title}:\n${h.article.summary}\n(المصدر: ${h.article.authorOrPublisher})`
            )
            .join('\n\n')
        : 'عذراً، المساعد الذكي غير مفعّل حالياً، ولم يُعثر على مقالات مطابقة مباشرة لهذا السؤال في الموسوعة.';

    return {
      answer:
        dbSearch.hits.length > 0
          ? ragFallbackSummary
          : 'عذراً، المساعد الذكي غير مفعّل حالياً. يمكنك تصفح مقالات الموسوعة أو استخدام محرك البحث.',
      answerOrigin: 'encyclopedia_only',
      encyclopediaSection: ragFallbackSummary,
      webSearchSection: null,
      encyclopediaCitations,
      webCitations: [],
      modelUsed: settings.modelName,
      webSearchUsed: false,
      requiresSetup: true,
      errorType: 'missing_key',
    };
  }

  // 2. فحص حدود الطلبات في الدقيقة (Rate Limiting)
  const nowMs = Date.now();
  while (requestTimestamps.length > 0 && nowMs - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= settings.rateLimitPerMinute) {
    return {
      answer: 'يرجى الانتظار لحظات قليلة قبل إرسال سؤال جديد ثم إعادة المحاولة.',
      answerOrigin: 'insufficient_info',
      encyclopediaSection: '',
      webSearchSection: null,
      encyclopediaCitations,
      webCitations: [],
      modelUsed: settings.modelName,
      webSearchUsed: false,
      errorType: 'rate_limited',
    };
  }
  requestTimestamps.push(nowMs);

  // 3. تجهيز مقاطع RAG المسترجعة من الموسوعة لتمريرها إلى Gemini
  const ragContextBlocks = dbSearch.hits
    .map(
      (hit, i) =>
        `[مقطع موسوعي رقم ${i + 1}]
العنوان: ${hit.article.title}
التصنيف: ${hit.article.categoryName || hit.article.subcategory}
طبيعة المعلومة: ${
          hit.article.factClassification === 'confirmed_fact'
            ? 'حقيقة تاريخية/علمية موثقة'
            : 'رواية تاريخية مع توضيح السياق'
        }
الجهة الناشرة والمصدر: ${hit.article.authorOrPublisher} (${hit.article.sourceUrl})
تاريخ آخر تحقق: ${hit.article.lastVerifiedAt}
النص الكامل للمقطع:
${hit.article.content}`
    )
    .join('\n\n---\n\n');

  const shouldUseWebSearch =
    settings.enableWebSearch &&
    (input.allowWebSearchOverride !== false) &&
    (dbSearch.hits.length === 0 || dbSearch.hits[0].score < 25 || input.allowWebSearchOverride === true);

  const systemInstruction = `1. أنت المساعد الذكي الرسمي لـ «الموسوعة العُمانية الرقمية الذكية».
2. مهمتك تقديم إجابات عربية فصيحة، واضحة، مباشرة، وموثوقة عن سلطنة عُمان وتاريخها وجغرافيتها وتراثها وشخصياتها وثقافتها ومؤسساتها.
3. اعتمد أولًا على مقالات ومصادر قاعدة بيانات الموسوعة المسترجعة لك في السياق (RAG).
4. إذا وُجدت المعلومة في قاعدة بيانات الموسوعة، فاعتمد عليها واذكر اسم المقال أو المصدر المرتبط بها.
5. إذا لم تكفِ قاعدة البيانات وكان البحث الخارجي مفعّلًا، فاستخدم نتائج البحث الموثوقة فقط وميّزها عن محتوى الموسوعة الداخلي.
6. إذا لم تتوفر معلومات كافية وموثقة في الموسوعة أو البحث، فقل بوضوح إن المعلومة غير متوفرة أو غير مؤكدة، ولا تخمّن ولا تختلق أي معلومة أو مصدر أو تاريخ أو اسم.
7. قاعدة صارمة جدًا بخصوص الأسماء: حافظ على الأسماء كما هي تمامًا دون تغيير أو تحريف أو تبديل أو تصحيح عشوائي، ويشمل ذلك أسماء الأشخاص، العلماء، السلاطين، الأئمة، القبائل، العائلات، الولايات، المحافظات، القرى، القلاع، الحصون، الأفلاج، الجبال، الأودية، الكتب، والمؤسسات.
8. إذا سأل المستخدم عن اسم علم أو مكان أو قبيلة أو شخصية، فاكتب الاسم بنفس الرسم الوارد في المصادر الموثوقة أو في سؤال المستخدم ما لم يكن هناك نص موثق يوضح صيغة الاسم المعتمدة.
9. لا تدمج بين شخصيتين متشابهتين في الاسم، ولا تنسب أعمال شخص إلى آخر، وإذا وُجد تشابه في الأسماء فاذكر ذلك بوضوح.
10. لا تغيّر الألقاب أو الكنى أو النسب أو التسميات العُمانية المحلية من تلقاء نفسك.
11. لا تخترع روابط أو مراجع أو أسماء كتب أو باحثين غير موجودين في السياق أو نتائج البحث الفعلية.
12. ميّز بهدوء ووضوح بين الحقيقة التاريخية الموثقة والرواية المتداولة أو المختلف فيها.
13. اجعل الإجابة مرتبة وسهلة القراءة للمستخدم العادي، وتجنب الإطالة غير الضرورية أو المقدمات الإنشائية الطويلة.
14. لا تعرض للمستخدم تفاصيل تقنية داخلية عن النظام أو قاعدة البيانات أو آلية عمل النموذج.
15. أجب باللغة العربية الطبيعية الواضحة المناسبة للقارئ العام والباحث.`;

  const promptContent = `سؤال المستخدم: "${rawQuestion}"

${
  dbSearch.hits.length > 0
    ? `المقاطع المسترجعة من قاعدة بيانات الموسوعة العُمانية (${dbSearch.hits.length} مقالات ذات صلة):\n\n${ragContextBlocks}`
    : `تنبيه: لم يُعثر على مقالات مطابقة مباشرة لهذا السؤال داخل قاعدة بيانات الموسوعة المحلية حالياً.`
}

المطلوب:
أجب باللغة العربية الفصيحة المباشرة والواضحة وفق قواعد النظام أعلاه، مع الحفاظ التام على رسم الأسماء والأماكن والأعلام كما وردت في المصادر الموثوقة أو في سؤال المستخدم:
${
  shouldUseWebSearch
    ? '- إذا استخدمت أداة بحث الويب لتكملة معلومات غير متوفرة في مقاطع الموسوعة، افصلها تحت عنوان فرعي واضح: «معلومات إضافية من بحث الويب».'
    : '- التزم حصرياً بما ورد في مقاطع الموسوعة المرفقة أعلاه.'
}`;

  try {
    const ai = new GoogleGenAI({ apiKey: resolvedKey.key });
    const response = await ai.models.generateContent({
      model: settings.modelName,
      contents: promptContent,
      config: {
        systemInstruction,
        maxOutputTokens: settings.maxOutputTokens,
        temperature: 0.2,
        ...(shouldUseWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
      },
    });

    const fullText = (response.text || '').trim();

    // استخراج بيانات الاستشهادات الرسمية من واجهة Google Search Grounding إن وُجدت فعلاً
    // دون تخمين أي روابط من نص النموذج
    const webCitations: AICitation[] = [];
    const candidate = response.candidates?.[0] as
      | {
          groundingMetadata?: {
            groundingChunks?: Array<{
              web?: { uri?: string; title?: string };
            }>;
          };
        }
      | undefined;

    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    for (const chunk of groundingChunks) {
      if (chunk.web?.uri) {
        webCitations.push({
          title: chunk.web.title || 'مصدر ويب مسترجع عبر Google Search Grounding',
          url: chunk.web.uri,
          publisher: chunk.web.title || 'بحث الويب المباشر',
          origin: 'google_search',
        });
      }
    }

    // فصل قسم الموسوعة عن قسم بحث الويب إن وُجد عنوان الفصل
    let encyclopediaSection = fullText;
    let webSearchSection: string | null = null;

    const splitMarkers = ['معلومات إضافية من بحث الويب', 'من بحث الويب:'];
    for (const marker of splitMarkers) {
      const idx = fullText.indexOf(marker);
      if (idx !== -1) {
        encyclopediaSection = fullText.slice(0, idx).trim();
        webSearchSection = fullText.slice(idx).trim();
        break;
      }
    }

    const answerOrigin: AIChatResponse['answerOrigin'] =
      dbSearch.hits.length > 0 && webCitations.length > 0
        ? 'hybrid_encyclopedia_and_web'
        : dbSearch.hits.length > 0
        ? 'encyclopedia_only'
        : webCitations.length > 0
        ? 'web_grounding'
        : 'insufficient_info';

    return {
      answer: fullText,
      answerOrigin,
      encyclopediaSection,
      webSearchSection,
      encyclopediaCitations,
      webCitations,
      modelUsed: settings.modelName,
      webSearchUsed: webCitations.length > 0 || shouldUseWebSearch,
    };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    let errorType: AIChatResponse['errorType'] = 'network_error';
    let userMessage = 'عذراً، تعذر إتمام الإجابة الذكية حالياً. يرجى المحاولة مرة أخرى بعد قليل.';

    if (/API_KEY_INVALID|invalid api key|400|403/i.test(rawMsg)) {
      errorType = 'invalid_key';
      userMessage = 'عذراً، المساعد الذكي غير مفعّل حالياً.';
    } else if (/429|RESOURCE_EXHAUSTED|quota/i.test(rawMsg)) {
      errorType = 'quota_exceeded';
      userMessage = 'المساعد الذكي مشغول حالياً. يرجى الانتظار دقيقة واحدة ثم المحاولة مرة أخرى.';
    }

    addSystemLog('error', 'gemini', 'خطأ أثناء توليد إجابة المساعد الذكي', rawMsg);

    const fallbackEncyclopedia =
      dbSearch.hits.length > 0
        ? dbSearch.hits
            .map((h) => `• ${h.article.title}: ${h.article.summary}`)
            .join('\n\n')
        : '';

    return {
      answer: fallbackEncyclopedia || userMessage,
      answerOrigin: dbSearch.hits.length > 0 ? 'encyclopedia_only' : 'insufficient_info',
      encyclopediaSection: fallbackEncyclopedia,
      webSearchSection: null,
      encyclopediaCitations,
      webCitations: [],
      modelUsed: settings.modelName,
      webSearchUsed: false,
      errorType,
    };
  }
}
