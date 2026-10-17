import React from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  Landmark,
  MapPin,
  Castle,
  Users,
  Compass,
  ScrollText,
  ArrowLeft,
} from 'lucide-react';
import { getCategories, listArticles } from '@/lib/db';
import BrandLogo from '@/components/BrandLogo';

export const dynamic = 'force-dynamic';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'cat-01-history-civilization': Landmark,
  'cat-02-governorates': MapPin,
  'cat-05-castles-forts': Castle,
  'cat-06-personalities': Users,
  'cat-03-geography': Compass,
  'cat-08-heritage-traditions': ScrollText,
};

export default function HomePage() {
  const allCategories = getCategories();
  const featuredCategories = allCategories.slice(0, 6);
  const featuredArticles = listArticles({ status: 'all_public', limit: 6 });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16 sm:space-y-20">
      {/* القسم الرئيسي (Hero): الشعار الرسمي + عنوان قصير + سطر وصفي واحد + مربع بحث كبير + زر اسأل المساعد الذكي */}
      <section className="text-center max-w-2xl mx-auto space-y-5">
        <div className="flex justify-center">
          <BrandLogo variant="hero" href={null} />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight">
            اكتشف عُمان
          </h1>
          <p className="text-base sm:text-lg text-stone-600">
            ابحث في تاريخ عُمان وتراثها وجغرافيتها وشخصياتها
          </p>
        </div>

        {/* مربع البحث الكبير والواضح */}
        <form action="/search" method="GET" className="pt-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-white p-2 rounded-2xl border border-stone-200/90 shadow-sm focus-within:border-[#8B1E24] transition-colors">
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-stone-400 mr-3.5 shrink-0" />
              <input
                type="search"
                name="q"
                placeholder="ابحث عن شخصية، قلعة، ولاية، أو حدث تاريخي..."
                className="w-full py-3 px-3 bg-transparent text-stone-900 placeholder:text-stone-400 text-base focus:outline-none"
                aria-label="ابحث في الموسوعة العُمانية"
              />
            </div>
            <button
              type="submit"
              className="px-7 py-3 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-bold text-sm sm:text-base transition-colors shrink-0"
            >
              بحث
            </button>
          </div>
        </form>

        {/* زر واضح: اسأل المساعد الذكي */}
        <div className="pt-1 flex justify-center">
          <Link
            href="/assistant"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-stone-50 text-[#8B1E24] border border-stone-200/90 shadow-sm font-bold text-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-[#C59B27]" />
            <span>اسأل المساعد الذكي</span>
          </Link>
        </div>
      </section>

      {/* مجموعة صغيرة من التصنيفات الأساسية في بطاقات بسيطة */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900">التصنيفات الأساسية</h2>
          <Link
            href="/categories"
            className="text-xs sm:text-sm font-bold text-[#8B1E24] hover:underline inline-flex items-center gap-1"
          >
            <span>جميع التصنيفات</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredCategories.map((cat) => {
            const IconComponent = CATEGORY_ICONS[cat.id] || Compass;
            return (
              <Link
                key={cat.id}
                href={`/categories?cat=${encodeURIComponent(cat.slug)}`}
                className="group bg-white rounded-2xl p-5 border border-stone-200/80 hover:border-[#8B1E24]/40 shadow-sm transition-all flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-stone-200/70 text-[#8B1E24] flex items-center justify-center shrink-0 group-hover:bg-[#8B1E24] group-hover:text-white transition-colors">
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-base font-bold text-stone-900 group-hover:text-[#8B1E24] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* قسم مقالات مختارة يعرض عدداً محدوداً من المقالات الحقيقية الموثقة */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900">مقالات مختارة</h2>
          <Link
            href="/search"
            className="text-xs sm:text-sm font-bold text-[#8B1E24] hover:underline inline-flex items-center gap-1"
          >
            <span>تصفح جميع المقالات</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {featuredArticles.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-stone-200/80 text-sm text-stone-500">
            سيتم عرض المقالات الموثقة هنا فور نشرها
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="group bg-white rounded-2xl p-6 border border-stone-200/80 hover:border-[#8B1E24]/40 shadow-sm transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <span className="inline-block text-xs font-medium text-[#8B1E24] bg-[#8B1E24]/5 px-2.5 py-1 rounded-lg">
                    {article.categoryName || article.subcategory}
                  </span>
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-[#8B1E24] transition-colors leading-snug">
                    {article.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span className="truncate max-w-[180px]">{article.authorOrPublisher}</span>
                  <span className="font-bold text-[#8B1E24] inline-flex items-center gap-1 shrink-0">
                    <span>اقرأ المقال</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
