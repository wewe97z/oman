import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BookOpen,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { getArticleBySlugOrId, getRelatedArticlesForArticle } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  params: { slug: string };
}

export default function ArticleDetailPage({ params }: ArticlePageProps) {
  const admin = getAuthenticatedAdmin();
  const article = getArticleBySlugOrId(params.slug, {
    includeNonPublished: Boolean(admin),
    incrementViews: true,
  });

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedArticlesForArticle(article, 4);
  const paragraphs = article.content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      {/* رابط العودة البسيط */}
      <div>
        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-500 hover:text-[#8B1E24] transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى تصفح الموسوعة</span>
        </Link>
      </div>

      {/* بطاقة قراءة المقال الهادئة */}
      <article className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-6 sm:p-12 space-y-8">
        {/* تصنيف المقال وعنوانه وملخصه */}
        <header className="space-y-4 border-b border-stone-100 pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {article.categoryName && (
              <Link
                href={`/categories?cat=${encodeURIComponent(article.categoryId)}`}
                className="px-3 py-1 rounded-lg bg-[#8B1E24]/8 text-[#8B1E24] font-bold"
              >
                {article.categoryName}
              </Link>
            )}
            {article.subcategory && (
              <span className="text-stone-500">• {article.subcategory}</span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-stone-900 leading-snug">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-base sm:text-lg text-stone-600 leading-relaxed pt-1">
              {article.summary}
            </p>
          )}
        </header>

        {/* الصور المرخصة المرتبطة إن وجدت */}
        {article.images && article.images.length > 0 && (
          <div className="space-y-3">
            {article.images.map((img, i) => (
              <figure
                key={i}
                className="rounded-2xl overflow-hidden border border-stone-200/80 bg-[#FAF8F5]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption}
                  className="w-full max-h-96 object-cover"
                />
                {img.caption && (
                  <figcaption className="px-4 py-2.5 text-xs text-stone-600">
                    {img.caption}
                    {img.attribution ? ` — ${img.attribution}` : ''}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {/* النص الموسوعي الواضح بعناوين فرعية مرتبة */}
        <div className="space-y-5 text-stone-800 text-base sm:text-lg leading-loose">
          {paragraphs.map((para, idx) => {
            const isSubheading =
              para.length < 85 && (para.endsWith(':') || /^[0-9٠-٩]+[-.]/.test(para));
            if (isSubheading) {
              return (
                <h2
                  key={idx}
                  className="text-lg sm:text-xl font-bold text-[#8B1E24] pt-4 border-b border-stone-100 pb-2"
                >
                  {para}
                </h2>
              );
            }
            return (
              <p key={idx} className="text-justify leading-[2]">
                {para}
              </p>
            );
          })}
        </div>

        {/* قسم المصادر والمراجع القابل للطي */}
        <div className="pt-6 border-t border-stone-100 space-y-4">
          <details className="group rounded-2xl bg-[#FAF8F5] border border-stone-200/80 overflow-hidden">
            <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm font-bold text-stone-800 hover:text-[#8B1E24] select-none">
              <span className="inline-flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#8B1E24]" />
                <span>المصادر والمراجع</span>
              </span>
              <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="px-5 pb-5 pt-2 border-t border-stone-200/60 space-y-3 text-xs sm:text-sm text-stone-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-stone-900">الجهة الناشرة / المصدر: </span>
                  <span>{article.authorOrPublisher}</span>
                </div>
                {article.sourceUrl && (
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#8B1E24] hover:underline"
                  >
                    <span>فتح المصدر الأصلي</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {article.references && article.references.length > 0 && (
                <ul className="space-y-2 pt-2 border-t border-stone-200/50">
                  {article.references.map((ref, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-semibold text-stone-900">{ref.title}</span>
                        {ref.publisher && (
                          <span className="text-stone-500"> — {ref.publisher}</span>
                        )}
                      </div>
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-stone-500 hover:text-[#8B1E24] shrink-0"
                          title="فتح المرجع"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <div className="flex justify-end">
            <Link
              href={`/assistant?q=${encodeURIComponent(`ما أبرز المعلومات حول ${article.title}؟`)}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8B1E24] hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C59B27]" />
              <span>اسأل المساعد الذكي حول هذا الموضوع</span>
            </Link>
          </div>
        </div>
      </article>

      {/* مقالات ذات صلة */}
      {relatedArticles.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-stone-900">مقالات ذات صلة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedArticles.map((rel) => (
              <Link
                key={rel.id}
                href={`/articles/${rel.slug}`}
                className="group bg-white rounded-2xl p-5 border border-stone-200/80 hover:border-[#8B1E24]/40 shadow-sm transition-all space-y-2"
              >
                <span className="text-xs font-medium text-[#8B1E24]">
                  {rel.categoryName || rel.subcategory}
                </span>
                <h3 className="text-base font-bold text-stone-900 group-hover:text-[#8B1E24] transition-colors">
                  {rel.title}
                </h3>
                <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                  {rel.summary}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
