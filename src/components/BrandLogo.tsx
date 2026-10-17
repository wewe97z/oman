import React from 'react';
import Link from 'next/link';

export const BRAND_LOGO_FULL_PATH = '/images/oman-encyclopedia-logo.png';
export const BRAND_LOGO_MARK_PATH = '/images/oman-encyclopedia-mark.png';

interface BrandLogoProps {
  /**
   * - header: لشريط التنقل العلوي (رمز الشعار مع اسم الموسوعة بجانبه بحجم متجاوب للهواتف والحواسيب)
   * - hero: لواجهة الصفحة الرئيسية (الشعار الكامل مع النص العربي المدمج)
   * - card: لبطاقات الترحيب وتسجيل الدخول (حجم متوسط أنيق للشعار الكامل)
   * - footer: لتذييل الموقع (رمز الشعار المصغر بجانب اسم الموسوعة)
   * - mark-only: رمز الشعار فقط للأماكن الصغيرة
   */
  variant?: 'header' | 'hero' | 'card' | 'footer' | 'mark-only';
  href?: string | null;
  className?: string;
}

export default function BrandLogo({
  variant = 'header',
  href = '/',
  className = '',
}: BrandLogoProps) {
  const renderContent = () => {
    if (variant === 'hero') {
      return (
        <div className={`inline-flex flex-col items-center justify-center ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO_FULL_PATH}
            alt="شعار الموسوعة العُمانية الرقمية"
            width={160}
            height={160}
            className="w-28 h-28 sm:w-36 sm:h-36 object-contain select-none"
          />
        </div>
      );
    }

    if (variant === 'card') {
      return (
        <div className={`inline-flex flex-col items-center justify-center ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO_FULL_PATH}
            alt="شعار الموسوعة العُمانية الرقمية"
            width={112}
            height={112}
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain select-none"
          />
        </div>
      );
    }

    if (variant === 'mark-only') {
      return (
        <div className={`inline-flex items-center justify-center ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO_MARK_PATH}
            alt="رمز الموسوعة العُمانية الرقمية"
            width={44}
            height={44}
            className="w-9 h-9 sm:w-11 sm:h-11 object-contain select-none"
          />
        </div>
      );
    }

    if (variant === 'footer') {
      return (
        <div className={`inline-flex items-center gap-2.5 ${className}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO_MARK_PATH}
            alt="شعار الموسوعة العُمانية الرقمية"
            width={32}
            height={32}
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0 select-none"
          />
          <span className="font-heading font-bold text-stone-800 text-xs sm:text-sm">
            الموسوعة العُمانية الرقمية
          </span>
        </div>
      );
    }

    // الوضع الافتراضي: header
    return (
      <div className={`inline-flex items-center gap-2.5 sm:gap-3 group ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND_LOGO_MARK_PATH}
          alt="شعار الموسوعة العُمانية الرقمية"
          width={44}
          height={44}
          className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0 transition-transform duration-200 group-hover:scale-105 select-none"
        />
        <span className="font-heading font-bold text-sm sm:text-lg text-stone-900 group-hover:text-[#8B1E24] transition-colors">
          الموسوعة العُمانية الرقمية
        </span>
      </div>
    );
  };

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none">
        {renderContent()}
      </Link>
    );
  }

  return renderContent();
}
