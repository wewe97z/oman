import { NextRequest, NextResponse } from 'next/server';
import {
  getArticleBySlugOrId,
  listImportJobs,
  saveArticle,
  stopAllRunningImportJobs,
} from '@/lib/db';
import {
  discoverAndImportOmaniTopicBatch,
  extractCleanArticleFromHtml,
  finalizeArticleImport,
  importFromUrl,
} from '@/lib/importer';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'يلزم تسجيل الدخول للاطلاع على سجل مهام الاستيراد.' },
      { status: 401 }
    );
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }
  return NextResponse.json({ jobs: listImportJobs(60) });
}

export async function POST(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'يلزم تسجيل الدخول لتشغيل مهام الاستيراد أو إيقافها.' },
      { status: 401 }
    );
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }

  const canPublish = admin.role === 'owner' || Boolean(admin.permissions?.canPublishArticles);

  try {
    const body = await req.json();
    const action = body.action || 'url_fetch';

    // 1. إيقاف المهام الجارية
    if (action === 'stop_all') {
      const count = stopAllRunningImportJobs();
      return NextResponse.json({
        ok: true,
        message: `تم إيقاف ${count} من مهام الاستيراد الجارية.`,
        jobs: listImportJobs(60),
      });
    }

    // 2. استيراد صفحة عبر رابط URL مباشر
    if (action === 'url_fetch') {
      const url = String(body.url || '').trim();
      if (!url) {
        return NextResponse.json({ error: 'يرجى إدخال رابط URL صالح للاستيراد.' }, { status: 400 });
      }
      const res = await importFromUrl({
        url,
        autoPublish: canPublish && Boolean(body.autoPublish),
        customSourceName: body.publisherName ? String(body.publisherName).trim() : undefined,
        customSourceType: body.sourceType,
      });
      return NextResponse.json({
        ...res,
        jobs: listImportJobs(60),
      });
    }

    // 3. البحث والاستيراد التلقائي على دفعات صغيرة حول موضوع عُماني
    if (action === 'topic_discovery') {
      const topicQuery = String(body.topicQuery || 'تاريخ ومعالم سلطنة عمان').trim();
      const maxBatchSize = Number(body.maxBatchSize || 3);
      const res = await discoverAndImportOmaniTopicBatch({
        topicQuery,
        maxBatchSize,
      });
      return NextResponse.json({
        ...res,
        jobs: listImportJobs(60),
      });
    }

    // 4. استيراد ملف نصي/JSON أو نص موثق يختاره المدير (بديل للمواقع المقيدة أو غير المتصلة)
    if (action === 'manual_file') {
      const title = String(body.title || '').trim();
      const content = String(body.content || '').trim();
      const sourceUrl = String(body.sourceUrl || '').trim();
      const publisherName = String(body.publisherName || '').trim();

      if (!title || content.length < 60 || !sourceUrl) {
        return NextResponse.json(
          {
            error:
              'يرجى توفير عنوان المقال، النص الموسوعي (60 حرفاً على الأقل)، ورابط المصدر أو المرجع الموثق.',
          },
          { status: 400 }
        );
      }

      const res = finalizeArticleImport({
        title,
        content,
        sourceUrl,
        publisherName: publisherName || 'مصدر موثق مضاف من إدارة المحتوى',
        publishedDate: body.publishedDate,
        licenseNotice: body.licenseNotice,
        sourceType: body.sourceType || 'official_omani',
        autoPublish: canPublish && Boolean(body.autoPublish),
      });

      return NextResponse.json({
        ...res,
        jobs: listImportJobs(60),
      });
    }

    // 5. إعادة جلب وتحديث معلومات مقال موجود من رابطه الأصلي
    if (action === 'refresh_article') {
      const articleId = String(body.articleId || '');
      const existing = getArticleBySlugOrId(articleId, { includeNonPublished: true });
      if (!existing) {
        return NextResponse.json({ error: 'المقال غير موجود.' }, { status: 404 });
      }

      const today = new Date().toISOString().slice(0, 10);
      let updatedContent = existing.content;
      let refreshNote = `تم التحقق من المصدر وتحديث تاريخ المراجعة (${today})`;

      if (existing.sourceUrl && existing.sourceUrl.startsWith('http')) {
        try {
          const response = await fetch(existing.sourceUrl, {
            headers: { 'User-Agent': 'OmaniDigitalEncyclopedia/1.0 (+VerificationRefresh)' },
          });
          if (response.ok) {
            const html = await response.text();
            const extracted = extractCleanArticleFromHtml(html, existing.sourceUrl);
            if (extracted.cleanedText && extracted.cleanedText.length > existing.content.length * 0.8) {
              updatedContent = extracted.cleanedText;
              refreshNote = `إعادة جلب ناجحة وتحديث النص وتاريخ التحقق من الرابط الأصلي (${today})`;
            }
          }
        } catch {
          refreshNote = `تم تحديث تاريخ المراجعة التحريرية (${today})؛ الرابط الأصلي محفوظ للمرجعية`;
        }
      }

      const saved = saveArticle(
        {
          id: existing.id,
          slug: existing.slug,
          title: existing.title,
          summary: existing.summary,
          content: updatedContent,
          categoryId: existing.categoryId,
          subcategory: existing.subcategory,
          volumeId: existing.volumeId,
          keywords: existing.keywords,
          authorOrPublisher: existing.authorOrPublisher,
          sourceId: existing.sourceId,
          sourceUrl: existing.sourceUrl,
          references: existing.references,
          publishedAt: existing.publishedAt,
          lastVerifiedAt: today,
          status: existing.status === 'needs_update' ? 'verified' : existing.status,
          factClassification: existing.factClassification,
          licenseInfo: existing.licenseInfo,
          images: existing.images,
        },
        admin.displayName,
        refreshNote
      );

      return NextResponse.json({
        ok: true,
        article: saved,
        message: refreshNote,
      });
    }

    return NextResponse.json({ error: 'إجراء استيراد غير معروف' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تنفيذ عملية الاستيراد', details: String(err) },
      { status: 500 }
    );
  }
}
