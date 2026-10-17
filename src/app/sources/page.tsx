import React from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  Building2,
  Globe,
  GraduationCap,
} from 'lucide-react';
import { getSources, listArticles } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function SourcesPage() {
  const sources = getSources();
  const articles = listArticles({ status: 'all_public', limit: 200 });

  const officialOmani = sources.filter((s) => s.sourceType === 'official_omani');
  const culturalAndAcademic = sources.filter(
    (s) => s.sourceType === 'cultural_omani' || s.sourceType === 'academic_omani'
  );
  const internationalSources = sources.filter((s) => s.sourceType === 'international');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      <div className="border-b border-stone-200/80 pb-6 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          المصادر والمراجع المعتمدة
        </h1>
        <p className="text-sm sm:text-base text-stone-600 max-w-3xl leading-relaxed">
          تعتمد الموسوعة العُمانية الرقمية على المصادر الرسمية والأكاديمية والثقافية العُمانية، مع تمييز المصادر الدولية الموثوقة عنها ونسبة كل مادة إلى جهتها الناشرة.
        </p>
      </div>

      {/* الفئة الأولى: المصادر الحكومية العُمانية الرسمية */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-[#8B1E24] flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          <span>المصادر الحكومية العُمانية الرسمية</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officialOmani.map((src) => {
            const linkedArticles = articles.filter((a) => a.sourceId === src.id);
            return (
              <div
                key={src.id}
                className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-stone-900">{src.name}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{src.notes}</p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/search?sourceId=${encodeURIComponent(src.id)}`}
                    className="font-bold text-[#8B1E24] hover:underline"
                  >
                    عرض المقالات ({linkedArticles.length})
                  </Link>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-[#8B1E24]"
                  >
                    <span>زيارة المصدر</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* الفئة الثانية: المؤسسات الثقافية والمتاحف والجامعات العُمانية */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-[#1F5A3B] flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          <span>المؤسسات الثقافية والأكاديمية العُمانية</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {culturalAndAcademic.map((src) => {
            const linkedArticles = articles.filter((a) => a.sourceId === src.id);
            return (
              <div
                key={src.id}
                className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-stone-900">{src.name}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{src.notes}</p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/search?sourceId=${encodeURIComponent(src.id)}`}
                    className="font-bold text-[#1F5A3B] hover:underline"
                  >
                    عرض المقالات ({linkedArticles.length})
                  </Link>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-[#1F5A3B]"
                  >
                    <span>زيارة المصدر</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* الفئة الثالثة: المصادر الدولية الموثوقة */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-stone-800 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          <span>المصادر والمنظمات الدولية الموثوقة</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {internationalSources.map((src) => {
            const linkedArticles = articles.filter((a) => a.sourceId === src.id);
            return (
              <div
                key={src.id}
                className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-stone-900">{src.name}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{src.notes}</p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/search?sourceId=${encodeURIComponent(src.id)}`}
                    className="font-bold text-stone-800 hover:underline"
                  >
                    عرض المقالات ({linkedArticles.length})
                  </Link>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-stone-600 hover:text-[#8B1E24]"
                  >
                    <span>زيارة المصدر</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
