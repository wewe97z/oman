import React from 'react';
import Link from 'next/link';
import {
  Compass,
  BookOpen,
  ArrowLeft,
  ExternalLink,
  Search,
} from 'lucide-react';
import { getCategories, listArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CategoriesPageProps {
  searchParams: { cat?: string };
}

export default function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const categories = getCategories();
  const selectedSlugOrId = searchParams.cat || '';
  const selectedCategory = selectedSlugOrId
    ? categories.find((c) => c.slug === selectedSlugOrId || c.id === selectedSlugOrId)
    : null;

  const articlesInSelected = selectedCategory
    ? listArticles({ categoryId: selectedCategory.id, status: 'all_public', limit: 100 })
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      {/* ترويسة التصفح الهادئة */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            تصفح الموسوعة العُمانية
          </h1>
          <p className="text-sm sm:text-base text-stone-600">
            استكشف موضوعات الموسوعة حسب الأبواب المعرفية والتاريخية والجغرافية
          </p>
        </div>

        <Link
          href="/search"
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200/90 text-xs sm:text-sm font-bold text-stone-800 shadow-sm transition-colors"
        >
          <Search className="w-4 h-4 text-[#8B1E24]" />
          <span>البحث في جميع المقالات</span>
        </Link>
      </div>

      {/* عرض مقالات التصنيف المختار */}
      {selectedCategory && (
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-[#8B1E24]">التصنيف المختار</span>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                {selectedCategory.name}
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">{selectedCategory.description}</p>
            </div>
            <Link
              href="/categories"
              className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200/80 text-xs font-bold text-stone-700"
            >
              عرض جميع التصنيفات
            </Link>
          </div>

          {articlesInSelected.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-500">
              سيتم عرض المقالات الموثقة في هذا التصنيف فور نشرها.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articlesInSelected.map((art) => (
                <article
                  key={art.id}
                  className="bg-[#FAF8F5] rounded-2xl p-5 border border-stone-200/80 hover:border-[#8B1E24]/40 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <span className="inline-block text-xs font-medium text-[#8B1E24]">
                      {art.subcategory || selectedCategory.name}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 hover:text-[#8B1E24]">
                      <Link href={`/articles/${art.slug}`}>{art.title}</Link>
                    </h3>
                    <p className="text-xs sm:text-sm text-stone-600 line-clamp-3 leading-relaxed">
                      {art.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-500">
                    <span className="truncate max-w-[180px]">{art.authorOrPublisher}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {art.sourceUrl && (
                        <a
                          href={art.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[#8B1E24]"
                        >
                          <span>المصدر</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <Link
                        href={`/articles/${art.slug}`}
                        className="inline-flex items-center gap-1 text-[#8B1E24] font-bold hover:underline"
                      >
                        <span>قراءة المقال</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* شبكة التصنيفات البسيطة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => {
          const isSelected = selectedCategory?.id === cat.id;

          return (
            <Link
              key={cat.id}
              href={`/categories?cat=${encodeURIComponent(cat.slug)}`}
              className={`group bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between space-y-4 shadow-sm ${
                isSelected
                  ? 'border-[#8B1E24] ring-1 ring-[#8B1E24]/20'
                  : 'border-stone-200/80 hover:border-[#8B1E24]/40'
              }`}
            >
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-stone-200/70 text-[#8B1E24] flex items-center justify-center group-hover:bg-[#8B1E24] group-hover:text-white transition-colors">
                  <Compass className="w-5 h-5" />
                </div>

                <h2 className="text-lg font-bold text-stone-900 group-hover:text-[#8B1E24] transition-colors">
                  {cat.name}
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
                  {cat.description}
                </p>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-[#8B1E24]">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>تصفح الموضوعات</span>
                </span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
