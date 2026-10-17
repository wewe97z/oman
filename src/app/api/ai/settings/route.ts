import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicAISettings,
  testGeminiConnection,
  updateAISettings,
} from '@/lib/gemini';
import { getAuthenticatedAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = getAuthenticatedAdmin();
  const fullSettings = getPublicAISettings();
  // إعدادات Gemini API التفصيلية وتلميح المفتاح متاحة لمالك الموقع (Owner) فقط
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({
      settings: {
        hasApiKey: fullSettings.hasApiKey,
        enableWebSearch: fullSettings.enableWebSearch,
        maxInputChars: fullSettings.maxInputChars,
      },
    });
  }
  return NextResponse.json({ settings: fullSettings });
}

export async function POST(req: NextRequest) {
  const admin = getAuthenticatedAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: 'يلزم تسجيل الدخول.' },
      { status: 401 }
    );
  }
  if (admin.role !== 'owner') {
    return NextResponse.json(
      { error: 'غير مصرح: الوصول إلى إعدادات Gemini API والأسرار التقنية مخصص لمالك الموقع (Owner) فقط.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    if (body.action === 'test_connection') {
      const testResult = await testGeminiConnection();
      return NextResponse.json({
        ...testResult,
        settings: getPublicAISettings(),
      });
    }

    const updated = updateAISettings({
      apiKey: body.apiKey,
      clearSavedKey: Boolean(body.clearSavedKey),
      modelName: body.modelName,
      enableWebSearch: body.enableWebSearch,
      maxOutputTokens: body.maxOutputTokens,
      maxInputChars: body.maxInputChars,
      rateLimitPerMinute: body.rateLimitPerMinute,
    });

    return NextResponse.json({
      ok: true,
      settings: updated,
      message: 'تم حفظ إعدادات الذكاء الاصطناعي بأمان على الخادم.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'تعذر تحديث إعدادات الذكاء الاصطناعي', details: String(err) },
      { status: 500 }
    );
  }
}
