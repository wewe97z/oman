import React from 'react';
import Link from 'next/link';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { getVolumes, listArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface VolumesPageProps {
  searchParams: { vol?: string };
}

export default function VolumesPage({ searchParams }: VolumesPageProps) {
  const volumes = getVolumes();
  const selectedVolId = searchParams.vol || '';
  const allPublicArticles = listArticles({ status: 'all_public', limit: 200 });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      <div className="border-b border-stone-200/80 pb-6 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          مجلدات الموسوعة العُمانية
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-3xl leading-relaxed">
          تُنظّم موضوعات الموسوعة في ستة مجلدات مرجعية لتسهيل المطالعة والبحث الموضوعي.
        </p>
      </div>

      <div className="space-y-6">
        {volumes.map((vol) => {
          const volArticles = allPublicArticles.filter((a) => a.volumeId === vol.id);
          const isHighlighted = selectedVolId === vol.id || selectedVolId === vol.slug;

          return (
            <section
              key={vol.id}
              id={vol.id}
              className={`bg-white rounded-3xl p-6 sm:p-8 border shadow-sm space-y-5 ${
                isHighlighted
                  ? 'border-[#8B1E24] ring-1 ring-[#8B1E24]/20'
                  : 'border-stone-200/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-14 rounded-xl bg-[#8B1E24] text-white flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-extrabold">{vol.volumeNumber}</span>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                      {vol.title}: {vol.subtitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600">{vol.description}</p>
                  </div>
                </div>
              </div>

              {volArticles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {volArticles.map((art) => (
                    <Link
                      key={art.id}
                      href={`/articles/${art.slug}`}
                      className="p-4 rounded-2xl bg-[#FAF8F5] hover:bg-stone-100/70 border border-stone-200/80 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#8B1E24] font-bold">
                          {art.categoryName || art.subcategory}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base text-stone-900 line-clamp-2">
                          {art.title}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs font-bold text-[#8B1E24]">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>قراءة المقال</span>
                        </span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
