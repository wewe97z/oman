'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Sparkles, Compass, LogIn, ShieldCheck, Menu, X } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/admin/auth')
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(Boolean(data?.authenticated));
      })
      .catch(() => {
        setIsAdmin(false);
      });
  }, [pathname]);

  const navItems = [
    { href: '/', label: 'الرئيسية', icon: BookOpen },
    { href: '/categories', label: 'تصفح الموسوعة', icon: Compass },
    { href: '/assistant', label: 'اسأل الذكاء الاصطناعي', icon: Sparkles },
    { href: '/login', label: 'تسجيل الدخول', icon: LogIn },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* الشعار المشترك الجديد بجانب اسم الموسوعة */}
          <BrandLogo variant="header" href="/" />

          {/* شريط التنقل الرئيسي للحواسيب (4 عناصر فقط + رابط منفصل للمدير عند تسجيل الدخول) */}
          <nav className="hidden md:flex items-center gap-2" aria-label="التنقل الرئيسي">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href) ||
                    (item.href === '/categories' &&
                      (pathname.startsWith('/search') ||
                        pathname.startsWith('/articles') ||
                        pathname.startsWith('/volumes') ||
                        pathname.startsWith('/sources')));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#8B1E24] text-white font-bold shadow-sm'
                      : 'text-stone-700 hover:bg-stone-200/60 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-colors mr-1 ${
                  pathname.startsWith('/admin')
                    ? 'bg-[#1F5A3B] text-white border-[#1F5A3B]'
                    : 'bg-[#1F5A3B]/10 text-[#1F5A3B] border-[#1F5A3B]/25 hover:bg-[#1F5A3B] hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>لوحة الإدارة</span>
              </Link>
            )}
          </nav>

          {/* زر القائمة للهواتف */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2.5 rounded-xl text-stone-700 hover:bg-stone-200/60 focus:outline-none"
              aria-label="فتح القائمة"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* القائمة المنسدلة البسيطة للهواتف */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-stone-200 px-4 pt-2 pb-4 space-y-1.5 shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#8B1E24] text-white font-bold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-[#1F5A3B]/10 text-[#1F5A3B]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>لوحة الإدارة</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
