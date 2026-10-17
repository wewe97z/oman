'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  Trash2,
  BookOpen,
  ExternalLink,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { AIChatResponse } from '@/lib/types';
import BrandLogo from '@/components/BrandLogo';

interface ChatTurn {
  id: string;
  question: string;
  response: AIChatResponse;
  timestamp: string;
}

const STARTER_QUESTIONS = [
  'ما قصة قلعة بهلاء؟',
  'من هو أحمد بن ماجد؟',
  'ما أشهر المواقع التاريخية في عُمان؟',
  'كيف نشأت حضارة مجان؟',
];

function AssistantContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/ai/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setHasApiKey(Boolean(data.settings.hasApiKey));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialQuery && history.length === 0 && !loading) {
      handleAsk(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    if (history.length > 0 || loading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [history, loading]);

  async function handleAsk(qText?: string) {
    const targetQuestion = (qText ?? question).trim();
    if (!targetQuestion || loading) return;

    if (!qText) setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: targetQuestion,
        }),
      });
      const data = (await res.json()) as AIChatResponse;
      const newTurn: ChatTurn = {
        id: `turn-${Date.now()}`,
        question: targetQuestion,
        response: data,
        timestamp: new Date().toLocaleTimeString('ar-OM', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setHistory((prev) => [...prev, newTurn]);
    } catch {
      const fallbackTurn: ChatTurn = {
        id: `turn-${Date.now()}`,
        question: targetQuestion,
        response: {
          answer: 'عذراً، تعذر الاتصال بالخادم حالياً. يرجى المحاولة مرة أخرى.',
          answerOrigin: 'insufficient_info',
          encyclopediaSection: '',
          webSearchSection: null,
          encyclopediaCitations: [],
          webCitations: [],
          modelUsed: '',
          webSearchUsed: false,
          errorType: 'network_error',
        },
        timestamp: new Date().toLocaleTimeString('ar-OM', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setHistory((prev) => [...prev, fallbackTurn]);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(turn: ChatTurn) {
    const textToCopy = turn.response.encyclopediaSection || turn.response.answer;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(turn.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col min-h-[calc(100vh-9rem)]">
      {/* الترويسة البسيطة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
            اسأل الموسوعة العُمانية
          </h1>
          <p className="text-sm sm:text-base text-stone-600">
            اسأل عن تاريخ عُمان وتراثها وجغرافيتها وشخصياتها
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setHistory([])}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-200/90 text-xs font-bold text-stone-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-500" />
            <span>محادثة جديدة</span>
          </button>
        )}
      </div>

      {/* رسالة مهذبة وبسيطة إذا لم يكن المساعد مفعلاً */}
      {hasApiKey === false && (
        <div className="mt-6 bg-stone-100/80 border border-stone-200/90 rounded-2xl px-4 py-3 text-xs sm:text-sm text-stone-700">
          المساعد الذكي غير مفعّل حالياً، وسيتم عرض المقتطفات الموثقة المتوفرة في الموسوعة مباشرة عند السؤال.
        </div>
      )}

      {/* منطقة المحادثة الواسعة */}
      <div className="flex-1 py-6 space-y-6">
        {history.length === 0 && !loading ? (
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm p-6 sm:p-10 text-center max-w-2xl mx-auto my-6 space-y-6">
            <div className="flex justify-center">
              <BrandLogo variant="card" href={null} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                مرحباً بك في المساعد الذكي للموسوعة العُمانية
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                اختر أحد الأسئلة المقترحة للبدء أو اكتب سؤالك في الشريط السفلي:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
              {STARTER_QUESTIONS.map((sq) => (
                <button
                  key={sq}
                  type="button"
                  onClick={() => handleAsk(sq)}
                  className="p-3.5 rounded-xl bg-[#FAF8F5] hover:bg-[#8B1E24]/5 border border-stone-200/90 hover:border-[#8B1E24]/40 text-xs sm:text-sm font-bold text-stone-800 transition-all text-right"
                >
                  {sq}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((turn) => {
              const totalCitations =
                turn.response.encyclopediaCitations.length + turn.response.webCitations.length;

              return (
                <div key={turn.id} className="space-y-3">
                  {/* سؤال المستخدم */}
                  <div className="flex justify-start">
                    <div className="bg-[#8B1E24] text-white rounded-2xl rounded-tr-sm px-5 py-3.5 max-w-2xl shadow-sm">
                      <p className="text-sm sm:text-base font-medium leading-relaxed">
                        {turn.question}
                      </p>
                    </div>
                  </div>

                  {/* إجابة المساعد */}
                  <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 sm:p-6 space-y-4">
                    <div className="text-sm sm:text-base text-stone-800 whitespace-pre-line leading-relaxed">
                      {turn.response.encyclopediaSection || turn.response.answer}
                    </div>

                    {turn.response.webSearchSection && (
                      <div className="pt-4 border-t border-stone-100 space-y-2">
                        <div className="text-xs font-bold text-stone-600">
                          معلومات إضافية من بحث الويب:
                        </div>
                        <div className="text-sm sm:text-base text-stone-800 whitespace-pre-line leading-relaxed">
                          {turn.response.webSearchSection}
                        </div>
                      </div>
                    )}

                    {/* شريط الأدوات السفلي للإجابة + المصادر والمراجع القابلة للطي */}
                    <div className="pt-3 border-t border-stone-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-stone-400">{turn.timestamp}</span>

                        <button
                          type="button"
                          onClick={() => handleCopy(turn)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-stone-100 border border-stone-200/80 text-xs font-medium text-stone-700 transition-colors"
                        >
                          {copiedId === turn.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#1F5A3B]" />
                              <span className="text-[#1F5A3B] font-bold">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الإجابة</span>
                            </>
                          )}
                        </button>
                      </div>

                      {totalCitations > 0 && (
                        <details className="group rounded-xl bg-[#FAF8F5] border border-stone-200/80 overflow-hidden">
                          <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 hover:text-[#8B1E24] select-none">
                            <span className="inline-flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-[#8B1E24]" />
                              <span>المصادر والمراجع ({totalCitations})</span>
                            </span>
                            <ChevronDown className="w-4 h-4 text-stone-400 transition-transform group-open:rotate-180" />
                          </summary>

                          <div className="px-4 pb-3 pt-1 border-t border-stone-200/60 space-y-2">
                            {turn.response.encyclopediaCitations.map((cit, i) => (
                              <div
                                key={`enc-${i}`}
                                className="flex items-center justify-between gap-2 text-xs py-1.5 border-b last:border-b-0 border-stone-200/50"
                              >
                                <div>
                                  <Link
                                    href={`/articles/${cit.articleSlug}`}
                                    className="font-bold text-stone-900 hover:text-[#8B1E24] hover:underline"
                                  >
                                    {cit.title}
                                  </Link>
                                  <span className="text-stone-500 mx-1.5">—</span>
                                  <span className="text-stone-500">{cit.publisher}</span>
                                </div>
                                {cit.url && cit.url.startsWith('http') && (
                                  <a
                                    href={cit.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-stone-500 hover:text-[#8B1E24] shrink-0"
                                    title="فتح المصدر"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            ))}

                            {turn.response.webCitations.map((wcit, idx) => (
                              <div
                                key={`web-${idx}`}
                                className="flex items-center justify-between gap-2 text-xs py-1.5 border-b last:border-b-0 border-stone-200/50"
                              >
                                <a
                                  href={wcit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-stone-800 hover:text-[#8B1E24] hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{wcit.title}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* مؤشر انتظار بسيط عند توليد الإجابة */}
            {loading && (
              <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 flex items-center gap-3 text-sm text-stone-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#8B1E24]" />
                <span>جارٍ إعداد الإجابة...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* شريط الإدخال الثابت في الأسفل */}
      <div className="sticky bottom-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="bg-white rounded-2xl border border-stone-300/90 shadow-md p-2 flex items-center gap-2 focus-within:border-[#8B1E24] transition-colors"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1500}
            placeholder="اكتب سؤالك عن سلطنة عُمان..."
            className="flex-1 py-2.5 px-3.5 bg-transparent text-stone-900 placeholder:text-stone-400 text-sm sm:text-base focus:outline-none"
            aria-label="اكتب سؤالك"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#8B1E24] hover:bg-[#641217] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>إرسال</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto p-12 text-center text-sm text-stone-500">
          جارٍ تحميل المساعد الذكي...
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
