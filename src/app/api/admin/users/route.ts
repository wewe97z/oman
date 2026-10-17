import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  createAdminUserByOwner,
  createSessionToken,
  deleteAdminUserByOwner,
  getAuthenticatedAdmin,
  listAdminUsersForOwner,
  updateAdminUserByOwner,
  updateOwnerOwnAccount,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * جميع مسارات /api/admin/users محمية حصرياً لمالك الموقع (Owner) على مستوى الخادم.
 * أي محاولة من زائر أو من مسؤول عادي (Admin) تُرفض فوراً بكود 401 أو 403.
 */
export async function GET() {
  const actor = getAuthenticatedAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول.' }, { status: 401 });
  }
  if (actor.role !== 'owner') {
    return NextResponse.json(
      { error: 'غير مصرح: قسم إدارة المسؤولين متاح لمالك الموقع (Owner) فقط.' },
      { status: 403 }
    );
  }

  const res = listAdminUsersForOwner(actor);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true, users: res.users });
}

export async function POST(req: NextRequest) {
  const actor = getAuthenticatedAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول.' }, { status: 401 });
  }
  if (actor.role !== 'owner') {
    return NextResponse.json(
      { error: 'غير مصرح: المالك (Owner) وحده يملك صلاحية إدارة الحسابات أو تعديل إعدادات المالك.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'create_admin');

    // 1. إنشاء حساب مسؤول جديد (Admin) بكلمة مرور أولية
    if (action === 'create_admin') {
      const res = createAdminUserByOwner(actor, {
        username: String(body.username || ''),
        displayName: String(body.displayName || ''),
        initialPassword: String(body.initialPassword || ''),
        permissions: body.permissions,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      const listRes = listAdminUsersForOwner(actor);
      return NextResponse.json({
        ok: true,
        user: res.user,
        users: listRes.users || [],
        message: `تم إنشاء حساب المسؤول (${res.user?.username}) بنجاح. سيُطلب منه تغيير كلمة المرور عند أول دخول.`,
      });
    }

    // 2. تعديل حساب مسؤول حالي (تعديل اسم المستخدم، الاسم الظاهر، الصلاحيات، التعطيل/التفعيل، أو إعادة تعيين كلمة المرور)
    if (action === 'update_admin') {
      const res = updateAdminUserByOwner(actor, {
        targetUserId: String(body.targetUserId || ''),
        username: body.username !== undefined ? String(body.username) : undefined,
        displayName: body.displayName !== undefined ? String(body.displayName) : undefined,
        resetPassword: body.resetPassword ? String(body.resetPassword) : undefined,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
        permissions: body.permissions,
      });

      if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      const listRes = listAdminUsersForOwner(actor);
      return NextResponse.json({
        ok: true,
        user: res.user,
        users: listRes.users || [],
        message: 'تم تحديث بيانات حساب المسؤول بنجاح.',
      });
    }

    // 3. تحديث بيانات حساب المالك نفسه (اسم المستخدم أو كلمة المرور الخاصة بالمالك)
    if (action === 'update_owner_account') {
      const res = updateOwnerOwnAccount(actor, {
        currentPassword: String(body.currentPassword || ''),
        newUsername: body.newUsername !== undefined ? String(body.newUsername) : undefined,
        newDisplayName: body.newDisplayName !== undefined ? String(body.newDisplayName) : undefined,
        newPassword: body.newPassword ? String(body.newPassword) : undefined,
      });

      if (!res.ok || !res.user) {
        return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      }

      const token = createSessionToken(res.user);
      const listRes = listAdminUsersForOwner(res.user);
      const response = NextResponse.json({
        ok: true,
        admin: res.user,
        users: listRes.users || [],
        message: 'تم تحديث بيانات حساب المالك بنجاح.',
      });
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 12,
      });
      return response;
    }

    return NextResponse.json({ ok: false, error: 'إجراء غير معروف' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: 'تعذر تنفيذ العملية', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const actor = getAuthenticatedAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول.' }, { status: 401 });
  }
  if (actor.role !== 'owner') {
    return NextResponse.json(
      { error: 'غير مصرح: المالك (Owner) وحده يستطيع حذف حسابات المسؤولين.' },
      { status: 403 }
    );
  }

  const targetId = req.nextUrl.searchParams.get('id') || '';
  if (!targetId) {
    return NextResponse.json({ ok: false, error: 'معرف الحساب مطلوب.' }, { status: 400 });
  }

  const res = deleteAdminUserByOwner(actor, targetId);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  const listRes = listAdminUsersForOwner(actor);
  return NextResponse.json({
    ok: true,
    users: listRes.users || [],
    message: 'تم حذف حساب المسؤول بنجاح.',
  });
}
