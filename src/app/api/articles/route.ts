import { NextRequest, NextResponse } from 'next/server';
import {
  deleteArticle,
  getArticleBySlugOrId,
  listArticles,
  saveArticle,
} from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { ArticleStatus, FactClassification } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slugOrId = sp.get('slug') || sp.get('id');
  const admin = getAuthenticatedAdmin();

  if (slugOrId) {
    const article = getArticleBySlugOrId(slugOrId, {
      includeNonPublished: Boolean(admin),
      incrementViews: sp.get('view') === '1',
    });
    if (!article) {
      return NextResponse.json({ error: 'المقال غير موجود أو غير منشور بعد' }, { status: 404 });
    }
    if (!admin) {
      delete article.revisions;
    }
    return NextResponse.json({ article });
  }

  const requestedStatus = (sp.get('status') as ArticleStatus | 'all_public' | 'all') || 'all_public';
  const effectiveStatus = !admin ? 'all_public' : requestedStatus;

  const articles = listArticles({
    categoryId: sp.get('categoryId') || undefined,
    sourceId: sp.get('sourceId') || undefined,
    volumeId: sp.get('volumeId') || undefined,
    status: effectiveStatus,
    limit: Number(sp.get('limit') || 100),
  });

  return NextResponse.json({ articles });
}

export async function POST(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول لإضافة أو تعديل المقالات.' }, { status: 401 });
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً قبل إضافة أو تعديل المقالات.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!body.title || !body.content || !body.categoryId) {
      return NextResponse.json(
        { error: 'العنوان، النص الموسوعي، والتصنيف حقول إلزامية.' },
        { status: 400 }
      );
    }

    const canPublish = admin.role === 'owner' || Boolean(admin.permissions?.canPublishArticles);
    let requestedStatus = (body.status as ArticleStatus) || 'under_review';
    if (!canPublish && (requestedStatus === 'published' || requestedStatus === 'verified')) {
      const existing = body.id ? getArticleBySlugOrId(String(body.id), { includeNonPublished: true }) : null;
      if (existing && (existing.status === 'published' || existing.status === 'verified')) {
        requestedStatus = existing.status;
      } else {
        requestedStatus = 'under_review';
      }
    }

    const saved = saveArticle(
      {
        id: body.id,
        slug: body.slug,
        title: String(body.title).trim(),
        summary: String(body.summary || '').trim(),
        content: String(body.content).trim(),
        categoryId: String(body.categoryId),
        subcategory: String(body.subcategory || ''),
        volumeId: body.volumeId || 'vol-01',
        keywords: Array.isArray(body.keywords)
          ? body.keywords
          : String(body.keywords || '')
              .split(/[،,]/)
              .map((s: string) => s.trim())
              .filter(Boolean),
        authorOrPublisher: String(body.authorOrPublisher || admin.displayName),
        sourceId: body.sourceId || null,
        sourceUrl: String(body.sourceUrl || '').trim(),
        references: Array.isArray(body.references) ? body.references : [],
        publishedAt: body.publishedAt,
        lastVerifiedAt: body.lastVerifiedAt || new Date().toISOString().slice(0, 10),
        status: requestedStatus,
        factClassification: (body.factClassification as FactClassification) || 'confirmed_fact',
        licenseInfo: String(body.licenseInfo || 'محتوى موسوعي أصلي موثق بالمصادر'),
        images: Array.isArray(body.images) ? body.images : [],
      },
      admin.displayName,
      body.changeSummary || (body.id ? 'تعديل ومراجعة المقال من لوحة الإدارة' : 'إنشاء مقال جديد من لوحة الإدارة')
    );

    return NextResponse.json({ ok: true, article: saved });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'تعذر حفظ المقال الموسوعي', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }
  if (admin.role !== 'owner' && !admin.permissions?.canDeleteContent) {
    return NextResponse.json(
      { error: 'حذف المقالات متاح للمالك (Owner) فقط أو للمسؤول المخوّل بصلاحية الحذف.' },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'معرف المقال مطلوب' }, { status: 400 });
  }

  const deleted = deleteArticle(id);
  return NextResponse.json({ ok: deleted });
}
