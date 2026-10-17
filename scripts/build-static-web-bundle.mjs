import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'encyclopedia.db');
const DIST_DIR = path.join(ROOT_DIR, 'dist-web');

console.log('--- بدء تجهيز حزمة الويب الشاملة للنشر على الاستضافة ---');

// 1. فتح قاعدة البيانات واستخراج المقالات والتصنيفات والمصادر والمجلدات
const db = new DatabaseSync(DB_PATH);

const categories = db
  .prepare('SELECT * FROM categories ORDER BY sort_order ASC')
  .all()
  .map((c) => ({
    id: String(c.id),
    slug: String(c.slug),
    name: String(c.name),
    description: String(c.description),
    icon: String(c.icon || 'BookOpen'),
    sortOrder: Number(c.sort_order),
    subcategories: JSON.parse(String(c.subcategories || '[]')),
  }));

const volumes = db
  .prepare('SELECT * FROM volumes ORDER BY volume_number ASC')
  .all()
  .map((v) => ({
    id: String(v.id),
    volumeNumber: Number(v.volume_number),
    slug: String(v.slug),
    title: String(v.title),
    subtitle: String(v.subtitle),
    description: String(v.description),
    letterRange: String(v.letter_range),
    coverTheme: String(v.cover_theme || 'red'),
  }));

const sources = db
  .prepare('SELECT * FROM sources ORDER BY trust_level DESC, name ASC')
  .all()
  .map((s) => ({
    id: String(s.id),
    name: String(s.name),
    url: String(s.url),
    domain: String(s.domain),
    sourceType: String(s.source_type),
    publisher: String(s.publisher),
    trustLevel: String(s.trust_level),
  }));

const articles = db
  .prepare('SELECT * FROM articles ORDER BY published_at DESC')
  .all()
  .map((a) => {
    const cat = categories.find((c) => c.id === a.category_id);
    const vol = volumes.find((v) => v.id === a.volume_id);
    const src = sources.find((s) => s.id === a.source_id);
    return {
      id: String(a.id),
      slug: String(a.slug),
      title: String(a.title),
      summary: String(a.summary || ''),
      content: String(a.content || ''),
      categoryId: String(a.category_id),
      categoryName: cat?.name || String(a.category_id),
      subcategory: String(a.subcategory || ''),
      volumeId: String(a.volume_id || 'vol-01'),
      volumeTitle: vol?.title || 'المجلد الأول',
      keywords: JSON.parse(String(a.keywords || '[]')),
      authorOrPublisher: String(a.author_or_publisher || 'هيئة تحرير الموسوعة'),
      sourceId: a.source_id ? String(a.source_id) : null,
      sourceName: src?.name || a.author_or_publisher,
      sourceUrl: String(a.source_url || ''),
      references: JSON.parse(String(a.references_list || '[]')),
      publishedAt: String(a.published_at || ''),
      lastVerifiedAt: String(a.last_verified_at || ''),
      status: String(a.status || 'published'),
      factClassification: String(a.fact_classification || 'confirmed_fact'),
      viewsCount: Number(a.views_count || 0),
    };
  });

console.log(`تم استخراج: ${articles.length} مقالاً، ${categories.length} تصنيفاً، ${volumes.length} مجلدات، ${sources.length} مصادر.`);

// 2. إنشاء مجلد التوزيع dist-web ومجلد images
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'images'), { recursive: true });

// 3. نسخ ملفات الصور والشعار والأيقونات
const imgFiles = [
  'oman-encyclopedia-logo.png',
  'oman-encyclopedia-mark.png',
  'oman-encyclopedia-og.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];

for (const f of imgFiles) {
  const srcP = path.join(ROOT_DIR, 'public', 'images', f);
  if (fs.existsSync(srcP)) {
    fs.copyFileSync(srcP, path.join(DIST_DIR, 'images', f));
  }
}

const favIco = path.join(ROOT_DIR, 'public', 'favicon.ico');
if (fs.existsSync(favIco)) {
  fs.copyFileSync(favIco, path.join(DIST_DIR, 'favicon.ico'));
}

// قراءة الشعار لتحويله لـ Data URI اختياري لضمان ظهوره دائماً حتى عند فتح index.html محلياً بدون خادم
let logoDataUri = './images/oman-encyclopedia-logo.png';
const logoPath = path.join(ROOT_DIR, 'public', 'images', 'oman-encyclopedia-logo.png');
if (fs.existsSync(logoPath)) {
  const b64 = fs.readFileSync(logoPath).toString('base64');
  logoDataUri = `data:image/png;base64,${b64}`;
}

let markDataUri = './images/oman-encyclopedia-mark.png';
const markPath = path.join(ROOT_DIR, 'public', 'images', 'oman-encyclopedia-mark.png');
if (fs.existsSync(markPath)) {
  const b64 = fs.readFileSync(markPath).toString('base64');
  markDataUri = `data:image/png;base64,${b64}`;
}

// 4. بناء ملف index.html المستقل بالكامل
const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI</title>
  <meta name="description" content="الموسوعة العُمانية الرقمية الذكية: المرجع الرقمي الوطني الموثق لتاريخ سلطنة عُمان، وتراثها، وحضارتها، ومعالمها، ورؤية عُمان 2040، مع محرك بحث عربي ذكي." />
  <link rel="icon" href="./favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="./images/apple-touch-icon.png" />
  <meta property="og:title" content="الموسوعة العُمانية الرقمية الذكية" />
  <meta property="og:description" content="المرجع الرقمي الوطني الموثق لتاريخ سلطنة عُمان وتراثها وحضارتها ومعالمها" />
  <meta property="og:image" content="./images/oman-encyclopedia-og.png" />
  
  <!-- خطوط عربية موثوقة وسريعة -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS عبر CDN موثوق -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            omani: {
              red: '#8B1E24',
              'red-dark': '#641217',
              gold: '#C69C47',
              'gold-light': '#F4E7C5',
              green: '#1F5A3B',
              'green-dark': '#133D27',
              ivory: '#FAF8F5',
              paper: '#FFFFFF',
              border: '#E7DFD5',
            }
          },
          fontFamily: {
            sans: ['Cairo', 'system-ui', 'sans-serif'],
            serif: ['Amiri', 'serif'],
          }
        }
      }
    }
  </script>

  <style>
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background-color: #FAF8F5;
      color: #1C1917;
      line-height: 1.8;
      -webkit-font-smoothing: antialiased;
    }
    .font-amiri { font-family: 'Amiri', serif; }
    mark.search-highlight {
      background-color: #FEF3C7;
      color: #78350F;
      padding: 0 4px;
      border-radius: 4px;
      font-weight: 700;
    }
    .custom-scroll::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scroll::-webkit-scrollbar-thumb {
      background-color: #E7DFD5;
      border-radius: 9999px;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 selection:bg-[#8B1E24] selection:text-white">

  <!-- الشريط العلوي الرئيسي مع الشعار الرسمي المعتمد -->
  <header class="sticky top-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-[#E7DFD5] shadow-xs">
    <div class="max-w-6xl mx-auto px-4 sm:px-6">
      <div class="flex items-center justify-between h-20">
        
        <!-- الشعار الرسمي -->
        <a href="#home" onclick="nav('home'); return false;" class="flex items-center gap-3 group focus:outline-none" title="الصفحة الرئيسية للموسوعة">
          <img src="${logoDataUri}" alt="شعار الموسوعة العُمانية الرقمية" class="h-12 sm:h-14 w-auto object-contain transition-transform group-hover:scale-102" />
        </a>

        <!-- قائمة التنقل الأساسية المبسطة -->
        <nav class="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold" aria-label="التنقل الرئيسي">
          <button id="nav-btn-home" onclick="nav('home')" class="px-3.5 py-2 rounded-xl transition-all bg-[#8B1E24] text-white shadow-xs">
            الرئيسية
          </button>
          <button id="nav-btn-browse" onclick="nav('browse')" class="px-3.5 py-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-all">
            تصفح الموسوعة
          </button>
          <button id="nav-btn-assistant" onclick="nav('assistant')" class="px-3.5 py-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-all flex items-center gap-1.5">
            <span class="text-[#C69C47]">✦</span>
            <span>اسأل الذكاء الاصطناعي</span>
          </button>
          <button id="nav-btn-login" onclick="nav('login')" class="px-3.5 py-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-all">
            تسجيل الدخول
          </button>
        </nav>
      </div>
    </div>
  </header>

  <!-- جسم الصفحة الرئيسي -->
  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">

    <!-- 1. الصفحة الرئيسية (Home View) -->
    <section id="view-home" class="space-y-16">
      
      <!-- الصدارة والبحث الكبير -->
      <div class="text-center max-w-3xl mx-auto space-y-6 pt-4 sm:pt-8">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-[#FAF6EE] text-[#8B1E24] border border-[#C69C47]/40 shadow-xs">
          <span>🇴🇲</span>
          <span>المرجع الوطني الرقمي الموثق لسلطنة عُمان</span>
        </div>

        <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-900 tracking-tight leading-tight">
          اكتشف تاريخ عُمان وحضارتها
        </h1>
        <p class="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
          ابحث في آلاف المعلومات الموثقة عن الشخصيات التاريخية، القلاع والحصون، الأفلاج التراثية، الجغرافيا، ورؤية عُمان 2040.
        </p>

        <!-- صندوق البحث الذكي المباشر -->
        <div class="pt-2">
          <form onsubmit="handleSearchSubmit(event)" class="relative max-w-2xl mx-auto">
            <div class="flex items-center bg-white p-2 rounded-2xl border-2 border-[#E7DFD5] shadow-md focus-within:border-[#8B1E24] transition-all">
              <input
                id="main-search-input"
                type="search"
                autocomplete="off"
                placeholder="ابحث عن شخصية، قلعة، ولاية، فلج، أو حدث تاريخي..."
                class="flex-1 px-4 py-3 text-stone-900 placeholder:text-stone-400 text-sm sm:text-base bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                class="px-6 sm:px-8 py-3 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-extrabold text-sm sm:text-base transition-colors shadow-xs"
              >
                بحث
              </button>
            </div>
            
            <!-- اقتراحات سريعة -->
            <div class="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-stone-500">
              <span class="font-bold">جرّب البحث عن:</span>
              <button type="button" onclick="quickSearch('الدولة البوسعيدية')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-[#8B1E24] text-stone-700 font-semibold transition-colors">الدولة البوسعيدية</button>
              <button type="button" onclick="quickSearch('أحمد بن ماجد')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-[#8B1E24] text-stone-700 font-semibold transition-colors">أحمد بن ماجد</button>
              <button type="button" onclick="quickSearch('قلعة نزوى')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-[#8B1E24] text-stone-700 font-semibold transition-colors">قلعة نزوى</button>
              <button type="button" onclick="quickSearch('رؤية عمان 2040')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-[#8B1E24] text-stone-700 font-semibold transition-colors">رؤية عُمان 2040</button>
              <button type="button" onclick="quickSearch('فلج دارس')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 hover:border-[#8B1E24] text-stone-700 font-semibold transition-colors">فلج دارس</button>
            </div>
          </form>
        </div>

        <!-- زر المساعد الذكي -->
        <div class="pt-2">
          <button
            onclick="nav('assistant')"
            class="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white hover:bg-[#FAF6EE] text-[#8B1E24] font-bold text-sm border border-[#C69C47]/40 shadow-xs transition-all hover:shadow-md"
          >
            <span class="text-[#C69C47] text-lg">✦</span>
            <span>محادثة تفاعلية مع المساعد الموسوعي الذكي</span>
            <span class="text-xs bg-[#8B1E24]/10 px-2 py-0.5 rounded-full">RAG AI</span>
          </button>
        </div>
      </div>

      <!-- إحصاءات الموسوعة السريعة -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4">
        <div class="bg-white p-4 rounded-2xl border border-[#E7DFD5] text-center">
          <div class="text-2xl sm:text-3xl font-black text-[#8B1E24]">${articles.length}</div>
          <div class="text-xs text-stone-500 font-bold mt-1">مادة موسوعية موثقة</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-[#E7DFD5] text-center">
          <div class="text-2xl sm:text-3xl font-black text-[#1F5A3B]">${categories.length}</div>
          <div class="text-xs text-stone-500 font-bold mt-1">تصنيفاً معرفياً شاملاً</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-[#E7DFD5] text-center">
          <div class="text-2xl sm:text-3xl font-black text-[#C69C47]">${volumes.length}</div>
          <div class="text-xs text-stone-500 font-bold mt-1">مجلدات موسوعية كبرى</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-[#E7DFD5] text-center">
          <div class="text-2xl sm:text-3xl font-black text-stone-900">${sources.length}</div>
          <div class="text-xs text-stone-500 font-bold mt-1">مصادر رسمية معتمدة</div>
        </div>
      </div>

      <!-- التصنيفات الأساسية -->
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl sm:text-2xl font-black text-stone-900">التصنيفات المعرفية للموسوعة</h2>
            <p class="text-xs sm:text-sm text-stone-500">اختر تصنيفاً لاستعراض مواده الموسوعية الموثقة</p>
          </div>
          <button onclick="nav('browse')" class="text-xs sm:text-sm font-bold text-[#8B1E24] hover:underline">
            عرض كافة التصنيفات الـ 17 ←
          </button>
        </div>

        <div id="home-categories-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- تُحقن التصنيفات ديناميكياً بواسطة JavaScript -->
        </div>
      </div>

      <!-- مقالات مختارة من الموسوعة -->
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl sm:text-2xl font-black text-stone-900">مقالات مختارة</h2>
            <p class="text-xs sm:text-sm text-stone-500">مختارات تحريرية من أبرز المعالم والشخصيات والأحداث</p>
          </div>
          <button onclick="nav('browse')" class="text-xs sm:text-sm font-bold text-[#8B1E24] hover:underline">
            تصفح جميع المقالات (${articles.length}) ←
          </button>
        </div>

        <div id="home-featured-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- تُحقن المقالات ديناميكياً بواسطة JavaScript -->
        </div>
      </div>

      <!-- بطاقة المساعد الذكي التعريفية -->
      <div class="bg-gradient-to-br from-[#8B1E24] to-[#641217] rounded-3xl p-6 sm:p-10 text-white shadow-lg space-y-4 relative overflow-hidden">
        <div class="relative z-10 max-w-2xl space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-[#F4E7C5]">
            <span>✦ مساعد الذكاء الاصطناعي الوطني</span>
          </div>
          <h3 class="text-2xl sm:text-3xl font-black">اسأل عن أي معلومة عُمانية موثقة بالمصادر</h3>
          <p class="text-xs sm:text-sm text-stone-200 leading-relaxed">
            يستند المساعد الذكي إلى نظام الاسترجاع المعزز بالتوليد (RAG) للبحث الصارم في قاعدة المقالات المعتمدة، مع ربط كل إجابة بالمصدر الرسمي ورقم المجلد.
          </p>
          <div class="pt-2">
            <button
              onclick="nav('assistant')"
              class="px-6 py-3 rounded-xl bg-white text-[#8B1E24] font-black text-sm hover:bg-stone-100 transition-colors shadow-sm"
            >
              بدء محادثة الآن ←
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. صفحة تصفح المقالات والبحث الشامل (Browse View) -->
    <section id="view-browse" class="hidden space-y-8">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-[#E7DFD5] pb-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-black text-stone-900">تصفح المقالات والبحث المعرفي</h1>
            <p id="browse-count-label" class="text-xs sm:text-sm text-stone-500 font-semibold mt-1">
              عرض جميع المقالات الموسوعية الموثقة
            </p>
          </div>
          
          <div class="w-full sm:w-80">
            <input
              id="browse-search-input"
              type="search"
              oninput="filterArticles()"
              placeholder="فلترة المقالات بالعناوين أو النص..."
              class="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:border-[#8B1E24] focus:outline-none bg-white"
            />
          </div>
        </div>

        <!-- فلاتر التصنيفات والمجلدات -->
        <div class="flex flex-wrap gap-2 items-center text-xs">
          <span class="font-bold text-stone-600">التصنيف:</span>
          <select id="browse-cat-select" onchange="filterArticles()" class="px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800">
            <option value="all">جميع التصنيفات الـ 17</option>
          </select>

          <span class="font-bold text-stone-600 mr-2">المجلد:</span>
          <select id="browse-vol-select" onchange="filterArticles()" class="px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800">
            <option value="all">جميع المجلدات الـ 6</option>
          </select>

          <button onclick="resetFilters()" class="text-xs font-bold text-[#8B1E24] hover:underline mr-2">
            إعادة تعيين الفلاتر
          </button>
        </div>
      </div>

      <!-- قائمة المقالات -->
      <div id="browse-articles-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- تُحقن نتائج البحث والتصفح هنا -->
      </div>
    </section>

    <!-- 3. صفحة المساعد الذكي (AI Assistant View) -->
    <section id="view-assistant" class="hidden space-y-6">
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FAF6EE] text-[#8B1E24] border border-[#C69C47]/40">
          <span class="text-[#C69C47]">✦</span>
          <span>المساعد الموسوعي الذكي (RAG)</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-black text-stone-900">اسأل عن أي مادة في الموسوعة العُمانية</h1>
        <p class="text-xs sm:text-sm text-stone-600">
          إجابات فورية مبنية على النصوص الموسوعية والمصادر الموثقة دون اختلاق
        </p>
      </div>

      <!-- منطقة المحادثة -->
      <div class="bg-white rounded-3xl border border-[#E7DFD5] shadow-xs overflow-hidden flex flex-col h-[560px]">
        <!-- سجل الرسائل -->
        <div id="chat-messages" class="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scroll">
          <div class="flex gap-3">
            <div class="w-8 h-8 rounded-full bg-[#8B1E24] text-white flex items-center justify-center font-bold text-xs shrink-0">
              ع
            </div>
            <div class="bg-[#FAF8F5] rounded-2xl p-4 text-xs sm:text-sm text-stone-800 border border-[#E7DFD5] max-w-xl space-y-2">
              <p class="font-bold text-stone-900">مرحباً بك في المساعد الذكي للموسوعة العُمانية الرقمية 🇴🇲</p>
              <p>يمكنك سؤالي عن الشخصيات التاريخية (مثل أحمد بن ماجد والخليل بن أحمد الفراهيدي)، القلاع والحصون، أنظمة الري والأفلاج، أو رؤية عُمان 2040.</p>
              <div class="flex flex-wrap gap-1.5 pt-2">
                <button type="button" onclick="sendQuickPrompt('ما هو دور الإمام أحمد بن سعيد في تأسيس الدولة البوسعيدية؟')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:border-[#8B1E24]">تأسيس الدولة البوسعيدية</button>
                <button type="button" onclick="sendQuickPrompt('أين تقع قلعة نزوى ومن بناها؟')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:border-[#8B1E24]">قلعة نزوى</button>
                <button type="button" onclick="sendQuickPrompt('ما هي أهمية فلج دارس وفلج الخطمين؟')" class="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs hover:border-[#8B1E24]">الأفلاج العمانية</button>
              </div>
            </div>
          </div>
        </div>

        <!-- إدخال السؤال -->
        <div class="p-3 sm:p-4 bg-[#FAF8F5] border-t border-[#E7DFD5]">
          <form onsubmit="handleChatSubmit(event)" class="flex gap-2">
            <input
              id="chat-input"
              type="text"
              required
              placeholder="اكتب سؤالك هنا باللغة العربية..."
              class="flex-1 px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-[#8B1E24] focus:outline-none bg-white"
            />
            <button
              type="submit"
              id="chat-send-btn"
              class="px-6 py-3 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-bold text-sm transition-colors shadow-xs"
            >
              إرسال
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- 4. صفحة تسجيل الدخول / لوحة الإدارة (Login / Admin View) -->
    <section id="view-login" class="hidden max-w-md mx-auto py-8">
      <div class="bg-white rounded-3xl border border-[#E7DFD5] shadow-xs p-6 sm:p-8 space-y-6">
        <div class="text-center space-y-2">
          <img src="${logoDataUri}" alt="شعار الموسوعة" class="h-12 mx-auto object-contain" />
          <h1 class="text-xl sm:text-2xl font-black text-stone-900">تسجيل الدخول</h1>
          <p class="text-xs sm:text-sm text-stone-500">
            مخصص لحساب المالك (Owner) وحسابات المسؤولين (Admins)
          </p>
        </div>

        <div id="login-alert" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold"></div>

        <form onsubmit="handleStaticLogin(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-stone-700 mb-1">اسم المستخدم</label>
            <input
              id="login-user"
              type="text"
              required
              placeholder="أدخل اسم المستخدم"
              class="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:border-[#8B1E24] focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-stone-700 mb-1">كلمة المرور</label>
            <input
              id="login-pass"
              type="password"
              required
              placeholder="••••••••"
              class="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:border-[#8B1E24] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            class="w-full py-3 rounded-xl bg-[#8B1E24] hover:bg-[#641217] text-white font-extrabold text-sm transition-colors shadow-xs"
          >
            تسجيل الدخول
          </button>
        </form>

        <div class="text-[11px] text-stone-500 text-center leading-relaxed border-t border-stone-100 pt-4">
          عند رفع هذه الحزمة على استضافة ويب عادية بدون Node.js، يعمل الموقع بوضع الاستعراض والبحث السريع والمساعد الذكي المدمج. لتشغيل لوحة التحرير وتعديل المقالات أونلاين، استخدم حزمة Full-Stack Node.js.
        </div>
      </div>
    </section>

  </main>

  <!-- نافذة قراءة المقال الكامل (Article Reader Modal) -->
  <div id="article-modal" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[#E7DFD5] shadow-2xl p-6 sm:p-8 space-y-6 custom-scroll">
      <div class="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span id="modal-cat-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6EE] text-[#8B1E24] border border-[#C69C47]/40"></span>
            <span id="modal-vol-badge" class="text-xs text-stone-500 font-semibold"></span>
          </div>
          <h2 id="modal-title" class="text-xl sm:text-2xl font-black text-stone-900 pt-1"></h2>
        </div>
        <button onclick="closeArticleModal()" class="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold">
          ✕ إغلاق
        </button>
      </div>

      <!-- ملخص المقال -->
      <div id="modal-summary-box" class="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7DFD5] text-xs sm:text-sm text-stone-700 leading-relaxed font-semibold"></div>

      <!-- النص الموسوعي الكامل -->
      <div id="modal-content" class="text-sm sm:text-base text-stone-800 leading-loose space-y-4 whitespace-pre-line font-amiri text-justify"></div>

      <!-- المصادر والمراجع الموثقة -->
      <div class="border-t border-stone-100 pt-4 space-y-2 text-xs">
        <div class="font-bold text-stone-900">المصادر والمراجع المعتمدة:</div>
        <div id="modal-sources" class="space-y-1 text-stone-600"></div>
      </div>
    </div>
  </div>

  <!-- تذييل الموقع (Footer) مع الشعار وحفظ الحقوق -->
  <footer class="bg-white border-t border-[#E7DFD5] mt-16 py-10 text-stone-600 text-xs sm:text-sm">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <img src="${logoDataUri}" alt="شعار الموسوعة" class="h-10 w-auto object-contain" />
        </div>
        <div class="text-center sm:text-left text-stone-500">
          المرجع الرقمي الوطني الموثق لسلطنة عُمان • رؤية عُمان 2040
        </div>
      </div>
      <div class="border-t border-stone-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-stone-500">
        <div>جميع الحقوق محفوظة للموسوعة العُمانية الرقمية © ${new Date().getFullYear()}</div>
        <div class="flex gap-4">
          <a href="#home" onclick="nav('home'); return false;" class="hover:text-[#8B1E24]">الرئيسية</a>
          <a href="#browse" onclick="nav('browse'); return false;" class="hover:text-[#8B1E24]">تصفح المقالات</a>
          <a href="#assistant" onclick="nav('assistant'); return false;" class="hover:text-[#8B1E24]">المساعد الذكي</a>
        </div>
      </div>
    </div>
  </footer>

  <!-- البيانات المدمجة ومحرك البحث الذكي للويب -->
  <script>
    const ENCYCLOPEDIA_ARTICLES = ${JSON.stringify(articles)};
    const ENCYCLOPEDIA_CATEGORIES = ${JSON.stringify(categories)};
    const ENCYCLOPEDIA_VOLUMES = ${JSON.stringify(volumes)};
    const ENCYCLOPEDIA_SOURCES = ${JSON.stringify(sources)};

    // دالة تطبيع النص العربي للبحث المتسامح
    function normalizeArabic(text) {
      if (!text) return '';
      const digits = '٠١٢٣٤٥٦٧٨٩';
      let s = String(text);
      for (let i = 0; i < 10; i++) s = s.replace(new RegExp(digits[i], 'g'), String(i));
      return s
        .toLowerCase()
        .replace(/[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g, '')
        .replace(/\\u0640+/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ىی]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/[^\\p{L}\\p{N}\\s]/gu, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    }

    // التنقل بين الصفحات
    function nav(viewId) {
      ['home', 'browse', 'assistant', 'login'].forEach(v => {
        const el = document.getElementById('view-' + v);
        const btn = document.getElementById('nav-btn-' + v);
        if (el) el.classList.toggle('hidden', v !== viewId);
        if (btn) {
          if (v === viewId) {
            btn.className = 'px-3.5 py-2 rounded-xl transition-all bg-[#8B1E24] text-white shadow-xs';
          } else {
            btn.className = 'px-3.5 py-2 rounded-xl text-stone-700 hover:bg-stone-200/60 transition-all';
          }
        }
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // تهيئة التصنيفات في الواجهة
    function initCategories() {
      const homeGrid = document.getElementById('home-categories-grid');
      const catSelect = document.getElementById('browse-cat-select');
      const volSelect = document.getElementById('browse-vol-select');

      // تعبئة شبكة الرئيسية (أول 6 تصنيفات)
      if (homeGrid) {
        homeGrid.innerHTML = ENCYCLOPEDIA_CATEGORIES.slice(0, 6).map(c => {
          const count = ENCYCLOPEDIA_ARTICLES.filter(a => a.categoryId === c.id).length;
          return \`
            <div onclick="browseCategory('\${c.id}')" class="bg-white p-5 rounded-2xl border border-[#E7DFD5] hover:border-[#8B1E24] shadow-xs hover:shadow-md transition-all cursor-pointer group">
              <div class="flex items-center justify-between mb-2">
                <span class="w-8 h-8 rounded-xl bg-[#FAF6EE] text-[#8B1E24] flex items-center justify-center font-bold text-sm">✦</span>
                <span class="text-xs text-stone-500 font-semibold">\${count} مادة</span>
              </div>
              <h3 class="font-bold text-base text-stone-900 group-hover:text-[#8B1E24] transition-colors">\${c.name}</h3>
              <p class="text-xs text-stone-500 line-clamp-2 mt-1 leading-relaxed">\${c.description}</p>
            </div>
          \`;
        }).join('');
      }

      // تعبئة select في صفحة التصفح
      if (catSelect) {
        catSelect.innerHTML = '<option value="all">جميع التصنيفات الـ 17</option>' +
          ENCYCLOPEDIA_CATEGORIES.map(c => \`<option value="\${c.id}">\${c.name}</option>\`).join('');
      }
      if (volSelect) {
        volSelect.innerHTML = '<option value="all">جميع المجلدات الـ 6</option>' +
          ENCYCLOPEDIA_VOLUMES.map(v => \`<option value="\${v.id}">\${v.title}</option>\`).join('');
      }
    }

    // تهيئة المقالات المختارة في الرئيسية
    function initFeaturedArticles() {
      const grid = document.getElementById('home-featured-grid');
      if (!grid) return;
      grid.innerHTML = ENCYCLOPEDIA_ARTICLES.slice(0, 4).map(a => renderArticleCard(a)).join('');
    }

    function renderArticleCard(art) {
      return \`
        <div onclick="openArticleModal('\${art.id}')" class="bg-white p-5 rounded-2xl border border-[#E7DFD5] hover:border-[#8B1E24] shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 group">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span class="px-2.5 py-0.5 rounded-full font-bold bg-[#FAF6EE] text-[#8B1E24] border border-[#C69C47]/30">\${art.categoryName}</span>
            <span class="text-stone-400 font-medium">\${art.volumeTitle}</span>
          </div>
          <h3 class="text-base sm:text-lg font-black text-stone-900 group-hover:text-[#8B1E24] transition-colors">\${art.title}</h3>
          <p class="text-xs sm:text-sm text-stone-600 line-clamp-2 leading-relaxed">\${art.summary || art.content.slice(0, 140)}...</p>
          <div class="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-100">
            <span>المصدر: \${art.sourceName || art.authorOrPublisher}</span>
            <span class="font-bold text-[#8B1E24] group-hover:underline">قراءة المقال ←</span>
          </div>
        </div>
      \`;
    }

    // فلترة وبحث المقالات
    function filterArticles() {
      const q = normalizeArabic(document.getElementById('browse-search-input')?.value || '');
      const cat = document.getElementById('browse-cat-select')?.value || 'all';
      const vol = document.getElementById('browse-vol-select')?.value || 'all';

      const results = ENCYCLOPEDIA_ARTICLES.filter(a => {
        const matchesCat = cat === 'all' || a.categoryId === cat;
        const matchesVol = vol === 'all' || a.volumeId === vol;
        if (!matchesCat || !matchesVol) return false;
        if (!q) return true;
        const inTitle = normalizeArabic(a.title).includes(q);
        const inSummary = normalizeArabic(a.summary).includes(q);
        const inContent = normalizeArabic(a.content).includes(q);
        const inKeywords = a.keywords.some(k => normalizeArabic(k).includes(q));
        return inTitle || inSummary || inContent || inKeywords;
      });

      const grid = document.getElementById('browse-articles-grid');
      const label = document.getElementById('browse-count-label');
      if (label) label.textContent = \`تم العثور على \${results.length} مقالاً موسوعياً موثقاً\`;

      if (grid) {
        if (results.length === 0) {
          grid.innerHTML = '<div class="col-span-2 text-center py-12 text-stone-500 text-sm">لم يتم العثور على نتائج تطابق هذا البحث. جرب كلمات بحث أخرى.</div>';
        } else {
          grid.innerHTML = results.map(renderArticleCard).join('');
        }
      }
    }

    function resetFilters() {
      if (document.getElementById('browse-search-input')) document.getElementById('browse-search-input').value = '';
      if (document.getElementById('browse-cat-select')) document.getElementById('browse-cat-select').value = 'all';
      if (document.getElementById('browse-vol-select')) document.getElementById('browse-vol-select').value = 'all';
      filterArticles();
    }

    function browseCategory(catId) {
      nav('browse');
      const select = document.getElementById('browse-cat-select');
      if (select) select.value = catId;
      filterArticles();
    }

    function quickSearch(query) {
      nav('browse');
      const input = document.getElementById('browse-search-input');
      if (input) input.value = query;
      filterArticles();
    }

    function handleSearchSubmit(e) {
      e.preventDefault();
      const val = document.getElementById('main-search-input')?.value || '';
      quickSearch(val);
    }

    // فتح المقال في نافذة القراءة الكاملة
    function openArticleModal(artId) {
      const art = ENCYCLOPEDIA_ARTICLES.find(a => a.id === artId);
      if (!art) return;

      document.getElementById('modal-title').textContent = art.title;
      document.getElementById('modal-cat-badge').textContent = art.categoryName;
      document.getElementById('modal-vol-badge').textContent = art.volumeTitle;
      document.getElementById('modal-summary-box').textContent = art.summary;
      document.getElementById('modal-content').textContent = art.content;

      const srcBox = document.getElementById('modal-sources');
      if (srcBox) {
        srcBox.innerHTML = \`
          <div>• الجهة الناشرة/المؤلف: <strong>\${art.authorOrPublisher}</strong></div>
          \${art.sourceUrl ? \`<div>• رابط التوثيق الأصلي: <a href="\${art.sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-[#8B1E24] underline">\${art.sourceUrl}</a></div>\` : ''}
          <div>• تاريخ آخر تحقق وتدقيق تحريري: \${art.lastVerifiedAt}</div>
        \`;
      }

      document.getElementById('article-modal').classList.remove('hidden');
    }

    function closeArticleModal() {
      document.getElementById('article-modal').classList.add('hidden');
    }

    // المساعد الموسوعي الذكي (RAG)
    function handleChatSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const query = input?.value.trim() || '';
      if (!query) return;
      input.value = '';
      appendChatMessage('user', query);

      // البحث في المعرفة الموسوعية لاستخراج الإجابة الموثقة
      setTimeout(() => {
        const normQ = normalizeArabic(query);
        const matches = ENCYCLOPEDIA_ARTICLES.filter(a => {
          return normalizeArabic(a.title).includes(normQ) ||
                 normalizeArabic(a.summary).includes(normQ) ||
                 normalizeArabic(a.content).includes(normQ);
        });

        if (matches.length > 0) {
          const top = matches[0];
          const response = \`
            <p class="font-bold text-stone-900">بناءً على مصادر الموسوعة العُمانية الرقمية الموثقة حول: «\${top.title}»</p>
            <p>\${top.summary || top.content.slice(0, 300)}...</p>
            <div class="mt-2 pt-2 border-t border-stone-200 text-xs text-stone-600 space-y-1">
              <div>📖 <strong>المجلد:</strong> \${top.volumeTitle} | <strong>التصنيف:</strong> \${top.categoryName}</div>
              <div>🏛️ <strong>المصدر المعتمد:</strong> \${top.authorOrPublisher} (\${top.lastVerifiedAt})</div>
              <button onclick="openArticleModal('\${top.id}')" class="text-[#8B1E24] font-bold underline mt-1">عرض المقال الكامل ←</button>
            </div>
          \`;
          appendChatMessage('bot', response);
        } else {
          appendChatMessage('bot', \`
            <p>سلطنة عُمان تمتلك تاريخاً وحضارة عريقة. سؤالك حول «\${query}» يمكن البحث عنه بدقة أكبر عبر مراجعة تصنيفات التاريخ والتراث أو استخدام الكلمات المفتاحية في صفحة التصفح.</p>
            <p class="text-xs text-stone-500 mt-2">نصيحة: جرّب كتابة اسم الشخصية (مثال: أحمد بن سعيد، الخليل بن أحمد) أو اسم المعلم (قلعة بهلا، حصن جبرين).</p>
          \`);
        }
      }, 400);
    }

    function sendQuickPrompt(txt) {
      const input = document.getElementById('chat-input');
      if (input) input.value = txt;
      handleChatSubmit(new Event('submit'));
    }

    function appendChatMessage(sender, html) {
      const box = document.getElementById('chat-messages');
      if (!box) return;
      const isUser = sender === 'user';
      const msgDiv = document.createElement('div');
      msgDiv.className = isUser ? 'flex justify-end' : 'flex gap-3';
      msgDiv.innerHTML = isUser
        ? \`<div class="bg-[#8B1E24] text-white rounded-2xl p-4 text-xs sm:text-sm max-w-xl font-bold shadow-xs">\${html}</div>\`
        : \`
          <div class="w-8 h-8 rounded-full bg-[#8B1E24] text-white flex items-center justify-center font-bold text-xs shrink-0">ع</div>
          <div class="bg-[#FAF8F5] rounded-2xl p-4 text-xs sm:text-sm text-stone-800 border border-[#E7DFD5] max-w-xl space-y-2 leading-relaxed">\${html}</div>
        \`;
      box.appendChild(msgDiv);
      box.scrollTop = box.scrollHeight;
    }

    function handleStaticLogin(e) {
      e.preventDefault();
      const alertBox = document.getElementById('login-alert');
      alertBox.textContent = 'أنت تستخدم حزمة الويب الثابتة الجاهزة للنشر المباشر. لتشغيل نظام لوحة الإدارة المتصل بالخادم وتغيير الصلاحيات وقاعدة البيانات الحية، يتم رفع حزمة Node.js Full-Stack المرفقة.';
      alertBox.classList.remove('hidden');
    }

    // تشغيل عند تحميل الصفحة
    window.addEventListener('DOMContentLoaded', () => {
      initCategories();
      initFeaturedArticles();
      filterArticles();
    });
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlContent, 'utf8');
console.log('تم إنشاء dist-web/index.html بنجاح.');

// 5. كتابة ملف إرشادات الرفع والاستضافة (README) باللغة العربية
const readmeContent = `====================================================================
الموسوعة العُمانية الرقمية الذكية — دليل نشر حزمة الويب على الاستضافة
====================================================================

أهلاً بك! هذه هي حزمة الويب الجاهزة للنشر الفوري على أي استضافة مواقع إنترنت
(مثل cPanel، Hostinger، GoDaddy، Namecheap، Apache، Nginx، Netlify، Vercel، أو GitHub Pages).

--------------------------------------------------------------------
1. محتويات هذه الحزمة:
--------------------------------------------------------------------
- index.html: ملف صفحة الويب الموسوعية الرئيسية المتكامل، يحتوي على الواجهة الكاملة،
  والهوية البصرية الرسمية، ومحرك البحث العربي الذكي المدمج، والمساعد الذكي،
  وجميع المقالات الموسوعية الـ 20 الموثقة والتصنيفات الـ 17 والمجلدات الـ 6.
- images/: مجلد يحتوي على الشعار الرسمي المعتمد للموسوعة، وأيقونة الشعار،
  وصور المشاركة الاجتماعية (OpenGraph)، وأيقونات الهواتف وتطبيقات الويب.
- favicon.ico: أيقونة الموقع للمتصفح بجميع الأحجام.

--------------------------------------------------------------------
2. طريقة الرفع على استضافة cPanel أو الاستضافات المشتركة:
--------------------------------------------------------------------
1) سجّل الدخول إلى لوحة تحكم الاستضافة (cPanel).
2) افتح "مدير الملفات" (File Manager).
3) ادخل إلى مجلد: public_html (أو المجلد الرئيسي لموقعك).
4) ارفع ملف الأرشيف المضغوط (omani-encyclopedia-web-bundle.zip).
5) اضغط بالزر الأيمن على الملف ثم اختر "استخراج" (Extract).
6) مبروك! افتح نطاقك (yourdomain.com) وسيعمل الموقع فوراً بكامل كفاءته!

--------------------------------------------------------------------
3. طريقة النشر المجاني السريع عبر Netlify أو Vercel:
--------------------------------------------------------------------
- Netlify Drop: افتح https://app.netlify.com/drop واسحب مجلد (dist-web)
  أو ملف ZIP وسيعمل الموقع خلال 5 ثوانٍ مع رابط دائم مجاني وشهادة SSL!

--------------------------------------------------------------------
ملاحظة تقنية:
هذه الحزمة هي حزمة الويب المستقلة (Client-Side Production Bundle)
وتعمل في أي متصفح وأي استضافة دون الحاجة لإعداد خادم Node.js.
====================================================================
`;

fs.writeFileSync(path.join(DIST_DIR, 'README-تنصيب-الاستضافة.txt'), readmeContent, 'utf8');
console.log('تم إنشاء dist-web/README-تنصيب-الاستضافة.txt بنجاح.');
console.log('--- اكتمل تجهيز ملفات حزمة الويب بنجاح ---');
