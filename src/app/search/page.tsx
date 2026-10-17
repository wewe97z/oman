import React from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  ArrowLeft,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  getCategories,
  getSources,
  getVolumes,
  searchArticles,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: {
    q?: string;
    categoryId?: string;
    sourceId?: string;
    volumeId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || '';
  const categoryId = searchParams.categoryId || '';
  const sourceId = searchParams.sourceId || '';
  const volumeId = searchParams.volumeId || '';
  const dateFrom = searchParams.dateFrom || '';
  const dateTo = searchParams.dateTo || '';

  const hasActiveFilter = Boolean(categoryId || sourceId || volumeId || dateFrom || dateTo);

  const categories = getCategories();
  const sources = getSources();
  const volumes = getVolumes();

  const searchRes = searchArticles({
    query,
    categoryId: categoryId || undefined,
    sourceId: sourceId || undefined,
    volumeId: volumeId || undefined,
    status: 'all_public',
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: 50,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      {/* الترويسة ومربع البحث الرئيسي */}
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          البحث في الموسوعة
        </h1>

        <form action="/search" method="GET" className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white p-2 rounded-2xl border border-stone-200/90 shadow-sm focus-within:border-[#8B1E24] transition-colors">
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-stone-400 mr-3.5 shrink-0" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="ابحث عن شخصية، قلعة، ولاية، أو موضوع..."
                className="w-full py-2.5 px-3 bg-transparent text-stone-900 placeholder:text-stone-400 text-base focus:outline-none"
                aria-label="عبارة البحث"
              />
            </div>
            <button
              type="submit"
              className="px-7 py-2.5 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-bold text-sm sm:text-base transition-colors shrink-0"
            >
              بحث
            </button>
          </div>

          {/* زر خيارات البحث القابل للطي */}
          <details
            open={hasActiveFilter}
            className="group bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden"
          >
            <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-xs sm:text-sm font-bold text-stone-700 hover:text-[#8B1E24] select-none">
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#8B1E24]" />
                <span>خيارات البحث</span>
              </span>
              <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="p-4 pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-stone-700 mb-1">التصنيف</label>
                <select
                  name="categoryId"
                  defaultValue={categoryId}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-800 focus:border-[#8B1E24] focus:outline-none"
                >
                  <option value="">جميع التصنيفات</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">المجلد</label>
                <select
                  name="volumeId"
                  defaultValue={volumeId}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-800 focus:border-[#8B1E24] focus:outline-none"
                >
                  <option value="">جميع المجلدات</option>
                  {volumes.map((v) => (
                    <option key={v.id} value={v.id}>
                      المجلد {v.volumeNumber}: {v.subtitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">المصدر</label>
                <select
                  name="sourceId"
                  defaultValue={sourceId}
                  className="w-full p-2.5 rounded-xl border border-stone-200 bg-[#FAF8F5] text-stone-800 focus:border-[#8B1E24] focus:outline-none"
                >
                  <option value="">جميع المصادر</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2">
                {hasActiveFilter && (
                  <Link
                    href={query ? `/search?q=${encodeURIComponent(query)}` : '/search'}
                    className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold"
                  >
                    إعادة ضبط الخيارات
                  </Link>
                )}
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white text-xs font-bold"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </details>
        </form>
      </div>

      {/* ملخص عدد النتائج */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-stone-600 border-b border-stone-200/70 pb-3">
        <div>
          {query ? (
            <span>
              نتائج البحث عن <strong className="text-stone-900">«{query}»</strong> ({searchRes.total})
            </span>
          ) : (
            <span>جميع المقالات المنشورة ({searchRes.total})</span>
          )}
        </div>
      </div>

      {/* قائمة النتائج */}
      {searchRes.hits.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-stone-200/80 space-y-3">
          <p className="text-base font-bold text-stone-800">
            لم يُعثر على مقالات مطابقة لعبارة البحث.
          </p>
          <p className="text-xs sm:text-sm text-stone-500">
            جرّب البحث بكلمات أعم أو تصفح التصنيفات الأساسية للموسوعة.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {searchRes.hits.map((hit) => {
            const { article, snippet } = hit;
            return (
              <article
                key={article.id}
                className="bg-white rounded-2xl p-6 border border-stone-200/80 hover:border-[#8B1E24]/40 shadow-sm transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-[#8B1E24]/8 text-[#8B1E24] font-bold">
                    {article.categoryName || article.subcategory}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-stone-900 hover:text-[#8B1E24] transition-colors">
                  <Link href={`/articles/${article.slug}`}>{article.title}</Link>
                </h2>

                <div
                  className="text-sm text-stone-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: snippet }}
                />

                <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
                  <div className="flex items-center gap-2">
                    <span>المصدر: {article.authorOrPublisher}</span>
                    {article.sourceUrl && (
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-stone-500 hover:text-[#8B1E24]"
                        title="فتح المصدر"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/articles/${article.slug}`}
                    className="inline-flex items-center gap-1 font-bold text-[#8B1E24] hover:underline"
                  >
                    <span>قراءة المقال</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
