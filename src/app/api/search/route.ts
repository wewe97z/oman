import { NextRequest, NextResponse } from 'next/server';
import { searchArticles, getCategories, getSources, getVolumes } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { ArticleStatus, FactClassification } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const admin = getAuthenticatedAdmin();
    const query = sp.get('q') || sp.get('query') || '';
    const categoryId = sp.get('categoryId') || undefined;
    const sourceId = sp.get('sourceId') || undefined;
    const volumeId = sp.get('volumeId') || undefined;
    const requestedStatus = (sp.get('status') as ArticleStatus | 'all_public' | 'all') || 'all_public';
    const status = admin ? requestedStatus : 'all_public';
    const factClassification = (sp.get('factClassification') as FactClassification) || undefined;
    const dateFrom = sp.get('dateFrom') || undefined;
    const dateTo = sp.get('dateTo') || undefined;
    const limit = Number(sp.get('limit') || 50);

    const results = searchArticles({
      query,
      categoryId,
      sourceId,
      volumeId,
      status,
      factClassification,
      dateFrom,
      dateTo,
      limit,
    });

    const includeFacets = sp.get('facets') === 'true';
    if (includeFacets) {
      return NextResponse.json({
        ...results,
        facets: {
          categories: getCategories(),
          sources: getSources(),
          volumes: getVolumes(),
        },
      });
    }

    return NextResponse.json(results);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تنفيذ البحث في قاعدة البيانات', details: String(err) },
      { status: 500 }
    );
  }
}
