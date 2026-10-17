'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { UserRole } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{
    username: string;
    displayName: string;
    role: UserRole;
    mustChangePassword: boolean;
  } | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/auth')
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(Boolean(data.authenticated));
        if (data.admin) {
          setAdminInfo({
            username: data.admin.username,
            displayName: data.admin.displayName,
            role: data.admin.role,
            mustChangePassword: Boolean(data.admin.mustChangePassword),
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'تعذر تسجيل الدخول. يرجى التحقق من اسم المستخدم وكلمة المرور.');
      } else {
        router.push('/admin');
        router.refresh();
      }
    } catch {
      setError('تعذر الاتصال بالخادم حالياً.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setAdminInfo(null);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-stone-500 text-sm">
        جارٍ التحقق من حالة الجلسة...
      </div>
    );
  }

  if (authenticated && adminInfo) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-8 text-center space-y-6">
          <div className="flex justify-center">
            <BrandLogo variant="card" href="/" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF6EE] text-[#8B1E24] border border-[#C69C47]/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{adminInfo.role === 'owner' ? 'المالك الرئيسي (Owner)' : 'مسؤول محتوى (Admin)'}</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900">مرحباً، {adminInfo.displayName}</h1>
            <p className="text-xs text-stone-500">اسم المستخدم: {adminInfo.username}</p>
            {adminInfo.mustChangePassword && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 font-medium">
                يرجى الانتقال إلى لوحة الإدارة لتغيير كلمة المرور الأولية الخاصة بحسابك.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/admin"
              className="w-full py-3 px-4 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>
                {adminInfo.mustChangePassword
                  ? 'تغيير كلمة المرور الأولية والمتابعة'
                  : 'الانتقال إلى لوحة الإدارة'}
              </span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14 sm:py-20">
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BrandLogo variant="card" href="/" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">تسجيل الدخول</h1>
          <p className="text-xs sm:text-sm text-stone-500">
            مخصص لحساب المالك (Owner) وحسابات المسؤولين (Admins) المعتمدين
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-xs font-bold text-stone-700">
              اسم المستخدم
            </label>
            <input
              id="login-username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:border-[#8B1E24] focus:outline-none text-sm bg-[#FAF8F5]/60"
              placeholder="أدخل اسم المستخدم"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-bold text-stone-700">
              كلمة المرور
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:border-[#8B1E24] focus:outline-none text-sm bg-[#FAF8F5]/60"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-[#8B1E24] hover:bg-[#641217] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>{submitting ? 'جارٍ التحقق...' : 'تسجيل الدخول'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
