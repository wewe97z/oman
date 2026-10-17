import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  changeOwnPassword,
  createSessionToken,
  getAuthenticatedAdmin,
  isFirstAdminInitialized,
  setupFirstAdmin,
  verifyAdminCredentials,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const initialized = isFirstAdminInitialized();
  const admin = getAuthenticatedAdmin();
  return NextResponse.json({
    initialized,
    authenticated: Boolean(admin),
    admin,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'login';

    // 1. إعداد حساب المالك الأول (يتطلب رمز إعداد سري على الخادم وغير متاح للتسجيل العام)
    if (action === 'setup_first_admin' || action === 'setup_owner') {
      const res = setupFirstAdmin({
        username: String(body.username || ''),
        displayName: String(body.displayName || 'مالك الموسوعة'),
        password: String(body.password || ''),
        setupSecret: String(body.setupSecret || ''),
      });
      if (!res.ok || !res.user) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 403 });
      }

      const token = createSessionToken(res.user);
      const response = NextResponse.json({
        ok: true,
        admin: res.user,
        message: 'تم إعداد حساب المالك الرئيسي وتسجيل الدخول بنجاح.',
      });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    // 2. تغيير كلمة المرور الخاصة بالمستخدم المسجل دخوله (إلزامي للمسؤول عند أول تسجيل دخول)
    if (action === 'change_own_password') {
      const currentAdmin = getAuthenticatedAdmin();
      if (!currentAdmin) {
        return NextResponse.json({ ok: false, error: 'يلزم تسجيل الدخول أولاً.' }, { status: 401 });
      }

      const res = changeOwnPassword(currentAdmin, {
        currentPassword: String(body.currentPassword || ''),
        newPassword: String(body.newPassword || ''),
      });

      if (!res.ok || !res.user) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      const token = createSessionToken(res.user);
      const response = NextResponse.json({
        ok: true,
        admin: res.user,
        message: 'تم تغيير كلمة المرور بنجاح وتفعيل الحساب.',
      });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    // 3. تسجيل الدخول للمالك (Owner) أو المسؤول (Admin)
    const res = verifyAdminCredentials(
      String(body.username || ''),
      String(body.password || '')
    );

    if (!res.ok || !res.user) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 401 });
    }

    const token = createSessionToken(res.user);
    const response = NextResponse.json({
      ok: true,
      admin: res.user,
      message: res.user.mustChangePassword
        ? 'يرجى تغيير كلمة المرور الأولية الخاصة بك للمتابعة.'
        : 'تم تسجيل الدخول بنجاح.',
    });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: 'حدث خطأ أثناء المصادقة', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
