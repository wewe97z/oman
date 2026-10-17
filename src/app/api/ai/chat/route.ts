import { NextRequest, NextResponse } from 'next/server';
import { askOmaniEncyclopediaAI, getPublicAISettings } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ settings: getPublicAISettings() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = String(body.question || '');
    const allowWebSearchOverride =
      typeof body.enableWebSearch === 'boolean' ? body.enableWebSearch : undefined;

    const result = await askOmaniEncyclopediaAI({
      question,
      allowWebSearchOverride,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        answer: 'حدث خطأ غير متوقع أثناء معالجة سؤالك.',
        answerOrigin: 'insufficient_info',
        encyclopediaSection: '',
        webSearchSection: null,
        encyclopediaCitations: [],
        webCitations: [],
        modelUsed: 'gemini-2.5-flash',
        webSearchUsed: false,
        errorType: 'network_error',
        details: String(err),
      },
      { status: 500 }
    );
  }
}
