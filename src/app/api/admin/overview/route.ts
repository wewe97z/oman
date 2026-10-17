import { NextRequest, NextResponse } from 'next/server';
import {
  detectDuplicateArticles,
  exportDatabaseBackup,
  getArticlesMissingSources,
  getCategories,
  getDashboardStats,
  getSources,
  getVolumes,
  listArticles,
  listImportJobs,
  listSystemLogs,
} from '@/lib/db';
import { getAuthenticatedAdmin, listAdminUsersForOwner } from '@/lib/auth';
import { getPublicAISettings } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'يلزم تسجيل الدخول للوصول إلى بيانات لوحة الإدارة.' },
      { status: 401 }
    );
  }

  if (admin.mustChangePassword) {
    return NextResponse.json(
      {
        error: 'يلزم تغيير كلمة المرور الأولية أولاً قبل الوصول إلى أدوات لوحة الإدارة.',
        mustChangePassword: true,
      },
      { status: 403 }
    );
  }

  const isOwner = admin.role === 'owner';
  const sp = req.nextUrl.searchParams;

  // تصدير النسخة الاحتياطية: متاح للمالك فقط (أو للمسؤول إذا منحه المالك صلاحية صريحة canAccessBackups)
  if (sp.get('export') === '1') {
    if (!isOwner && !admin.permissions.canAccessBackups) {
      return NextResponse.json(
        { error: 'غير مصرح: النسخ الاحتياطية الكاملة مخصصة لمالك الموقع (Owner) فقط.' },
        { status: 403 }
      );
    }

    const backup = exportDatabaseBackup();
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="omani-encyclopedia-backup-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  }

  const allLogs = listSystemLogs(80);
  // لا يرى المسؤول العادي سجلات الأمان الحساسة أو إعدادات Gemini API أو قائمة حسابات الإدارة
  const visibleLogs = isOwner
    ? allLogs
    : allLogs.filter((l) => l.level !== 'security' && l.module !== 'gemini' && l.module !== 'auth');

  const adminUsers = isOwner ? listAdminUsersForOwner(admin).users || [] : [];

  return NextResponse.json({
    currentAdmin: admin,
    stats: getDashboardStats(),
    articles: listArticles({ status: 'all', limit: 200 }),
    categories: getCategories(),
    volumes: getVolumes(),
    sources: getSources(),
    duplicates: detectDuplicateArticles(),
    missingSources: getArticlesMissingSources(),
    importJobs: listImportJobs(50),
    logs: visibleLogs,
    aiSettings: isOwner ? getPublicAISettings() : null,
    adminUsers,
  });
}
