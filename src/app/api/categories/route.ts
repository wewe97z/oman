import { NextRequest, NextResponse } from 'next/server';
import { getCategories, upsertCategory } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ categories: getCategories() });
}

export async function POST(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول لتعديل التصنيفات.' }, { status: 401 });
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }
  if (admin.role !== 'owner' && !admin.permissions?.canManageCategories) {
    return NextResponse.json(
      { error: 'إدارة التصنيفات متاحة للمالك (Owner) فقط أو للمسؤول المخوّل بصلاحية إدارة التصنيفات.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!body.name || !body.description) {
      return NextResponse.json({ error: 'اسم التصنيف ووصفه مطلوبان.' }, { status: 400 });
    }

    const subcategories = Array.isArray(body.subcategories)
      ? body.subcategories
      : String(body.subcategories || '')
          .split(/[،,]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

    const saved = upsertCategory({
      id: body.id,
      slug: body.slug,
      name: String(body.name).trim(),
      description: String(body.description).trim(),
      icon: body.icon || 'BookOpen',
      sortOrder: Number(body.sortOrder || 18),
      subcategories,
    });

    return NextResponse.json({ ok: true, category: saved });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'تعذر حفظ التصنيف', details: String(err) },
      { status: 500 }
    );
  }
}
