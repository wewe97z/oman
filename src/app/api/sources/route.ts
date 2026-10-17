import { NextRequest, NextResponse } from 'next/server';
import { deleteSource, getSources, upsertSource } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ sources: getSources() });
}

export async function POST(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'يلزم تسجيل الدخول لإدارة المصادر.' }, { status: 401 });
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!body.name || !body.url) {
      return NextResponse.json({ error: 'اسم المصدر ورابطه (URL) مطلوبان.' }, { status: 400 });
    }

    const saved = upsertSource({
      id: body.id,
      name: String(body.name).trim(),
      url: String(body.url).trim(),
      sourceType: body.sourceType || 'official_omani',
      publisher: String(body.publisher || body.name).trim(),
      trustLevel: body.trustLevel || 'high',
      licenseInfo: String(
        body.licenseInfo || 'مصدر معتمد — يُستشهد به مع حفظ حقوق الجهة الناشرة'
      ).trim(),
      allowedScraping: body.allowedScraping !== false,
      status: body.status || 'active',
      notes: String(body.notes || '').trim(),
    });

    return NextResponse.json({ ok: true, source: saved });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'تعذر حفظ المصدر', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }
  if (admin.mustChangePassword) {
    return NextResponse.json(
      { error: 'يجب تغيير كلمة المرور الأولية أولاً.' },
      { status: 403 }
    );
  }
  if (admin.role !== 'owner' && !admin.permissions?.canDeleteContent) {
    return NextResponse.json(
      { error: 'حذف المصادر متاح للمالك (Owner) فقط أو للمسؤول المخوّل بصلاحية الحذف.' },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'معرف المصدر مطلوب' }, { status: 400 });
  }

  const deleted = deleteSource(id);
  return NextResponse.json({ ok: deleted });
}
