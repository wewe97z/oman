import React from 'react';
import BrandLogo from '@/components/BrandLogo';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-stone-200/80 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-stone-500">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-right">
          <BrandLogo variant="footer" href="/" />
          <span className="hidden sm:inline text-stone-300">•</span>
          <span>بوابة معرفية موثقة لتاريخ عُمان وتراثها وجغرافيتها وأعلامها</span>
        </div>
        <div className="text-center sm:text-left text-xs text-stone-400">
          جميع المواد تُنسب إلى مصادرها الرسمية والأكاديمية الموثقة مع حفظ حقوق النشر لأصحابها.
        </div>
      </div>
    </footer>
  );
}
