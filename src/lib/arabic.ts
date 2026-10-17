import crypto from 'node:crypto';

/**
 * تطبيع النص العربي للبحث النصي المتقدم (Arabic Normalization)
 * يعالج:
 * - إزالة التشكيل والحركات (الفتحة، الضمة، الكسرة، التنوين، الشدة، السكون، الألف الخنجرية)
 * - إزالة التطويل (الكشيدة ـ)
 * - توحيد همزات الألف (أ، إ، آ، ٱ -> ا)
 * - توحيد التاء المربوطة والهاء في الفهرس البحثي (ة -> ه)
 * - توحيد الياء والألف المقصورة (ى -> ي)
 * - توحيد الهمزات المتوسطة والمتطرفة (ؤ -> و، ئ -> ي) للتسامح الإملائي
 * - توحيد الأرقام الهندية الشرقية (٠-٩) إلى أرقام عربية قياسية (0-9)
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';

  const easternDigits = '٠١٢٣٤٥٦٧٨٩';
  let text = input;

  // تحويل الأرقام الهندية إلى أرقام قياسية
  for (let i = 0; i < 10; i++) {
    text = text.replace(new RegExp(easternDigits[i], 'g'), String(i));
  }

  return text
    .toLowerCase()
    // إزالة التشكيل وعلامات الضبط القرآنية
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // إزالة التطويل (الكشيدة)
    .replace(/\u0640+/g, '')
    // توحيد صور الألف
    .replace(/[أإآٱ]/g, 'ا')
    // توحيد الألف المقصورة والياء الفارسية
    .replace(/[ىی]/g, 'ي')
    // توحيد التاء المربوطة والهاء للبحث
    .replace(/ة/g, 'ه')
    // توحيد الهمزة على واو والهمزة على نبرة للتسامح في البحث
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    // إزالة علامات الترقيم غير الحرفية مع الإبقاء على المسافات والأحرف والأرقام
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * قائمة كلمات التوقف العربية الشائعة (Stop Words) لتحسين دقة الترتيب الدلالي والصلات
 */
const ARABIC_STOP_WORDS = new Set([
  'في', 'من', 'الي', 'إلى', 'على', 'علي', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'الذين', 'اللاتي', 'هو', 'هي', 'هم', 'هن', 'كان', 'كانت', 'يكون',
  'تكون', 'ان', 'أن', 'إن', 'ما', 'لا', 'لم', 'لن', 'قد', 'كل', 'بعض', 'او', 'أو',
  'ثم', 'حتى', 'منذ', 'خلال', 'بين', 'حول', 'قبل', 'بعد', 'فوق', 'تحت', 'امام', 'أمام',
  'حيث', 'كما', 'كذلك', 'ايضا', 'أيضا', 'بل', 'لكن', 'غير', 'سوى', 'لدى', 'عند',
  'به', 'بها', 'له', 'لها', 'منه', 'منها', 'فيه', 'فيها', 'عنه', 'عنها', 'ال', 'و',
  'كيف', 'متي', 'متى', 'اين', 'أين', 'لماذا', 'ماذا', 'هل', 'كم', 'قصه', 'قصة',
  'اشهر', 'أشهر', 'اهم', 'أهم', 'ابرز', 'أبرز', 'تحدث', 'اذكر', 'اشرح', 'عرف'
]);

/**
 * تقسيم استعلام البحث إلى مصطلحات منظفة مع معالجة الـ التعريف الاختيارية والهمزة المتطرفة
 */
export function tokenizeArabicQuery(query: string): {
  rawPhrase: string;
  normalizedPhrase: string;
  tokens: string[];
  stemTokens: string[];
} {
  const rawPhrase = query.trim();
  const normalizedPhrase = normalizeArabic(rawPhrase);
  const allTokens = normalizedPhrase.split(/\s+/).filter(Boolean);

  // إذا كانت كل الكلمات من كلمات التوقف، نحتفظ بها؛ وإلا نصفي كلمات التوقف القصيرة
  const filtered = allTokens.filter((t) => t.length > 1 && !ARABIC_STOP_WORDS.has(t));
  const tokens = filtered.length > 0 ? filtered : allTokens;

  // توليد جذور مبسطة بإزالة "ال" التعريف واللواحق البسيطة والهمزة المتطرفة (مثل: بهلاء <-> بهلا) لتعزيز المطابقة العربية
  const stemTokens = Array.from(
    new Set(
      tokens.flatMap((token) => {
        const baseVariants = [token];
        if (token.endsWith('اء') && token.length >= 4) {
          baseVariants.push(token.slice(0, -1));
        } else if (token.endsWith('ا') && token.length >= 3) {
          baseVariants.push(token + 'ء');
        }

        const variants: string[] = [];
        for (const base of baseVariants) {
          variants.push(base);
          if (base.startsWith('ال') && base.length > 4) {
            variants.push(base.slice(2));
          } else if (!base.startsWith('ال') && base.length >= 3) {
            variants.push('ال' + base);
          }
          if (base.startsWith('وال') && base.length > 5) {
            variants.push(base.slice(3));
          }
          if (base.startsWith('بال') && base.length > 5) {
            variants.push(base.slice(3));
          }
        }
        return variants;
      })
    )
  );

  return {
    rawPhrase,
    normalizedPhrase,
    tokens,
    stemTokens,
  };
}

/**
 * بناء نمط Regex يطابق الكلمة العربية بغض النظر عن التشكيل أو التطويل أو شكل الألف/التاء المربوطة
 */
export function buildArabicFlexibleRegex(term: string): RegExp {
  const clean = normalizeArabic(term);
  if (!clean) return /(?!)/;

  const diacriticsAndTatweel = '[\\u064B-\\u065F\\u0670\\u0640]*';
  const patternParts: string[] = [];

  for (const ch of clean) {
    if (ch === 'ا') {
      patternParts.push('[اأإآٱ]');
    } else if (ch === 'ه') {
      patternParts.push('[هة]');
    } else if (ch === 'ي') {
      patternParts.push('[يىیئ]');
    } else if (ch === 'و') {
      patternParts.push('[وؤ]');
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      patternParts.push('\\' + ch);
    } else {
      patternParts.push(ch);
    }
  }

  const pattern = patternParts.join(diacriticsAndTatweel);
  return new RegExp(`(${pattern})`, 'giu');
}

/**
 * استخراج مقتطف سياقي من النص الأصلي يحتوي على عبارة البحث مع تمييز الكلمات المطابقة بعلامة <mark>
 */
export function extractSearchSnippet(
  originalText: string,
  query: string,
  maxLength = 240
): { snippet: string; matchedTerms: string[] } {
  if (!originalText) return { snippet: '', matchedTerms: [] };

  const { tokens, stemTokens } = tokenizeArabicQuery(query);
  if (tokens.length === 0) {
    const plain = originalText.slice(0, maxLength).trim();
    return {
      snippet: plain + (originalText.length > maxLength ? '...' : ''),
      matchedTerms: [],
    };
  }

  let bestIndex = -1;
  const matchedTerms: string[] = [];

  for (const term of [...tokens, ...stemTokens]) {
    if (term.length < 2) continue;
    const regex = buildArabicFlexibleRegex(term);
    const match = regex.exec(originalText);
    if (match && match.index !== undefined) {
      if (bestIndex === -1 || match.index < bestIndex) {
        bestIndex = match.index;
      }
      if (!matchedTerms.includes(match[0])) {
        matchedTerms.push(match[0]);
      }
    }
  }

  let start = 0;
  if (bestIndex > 60) {
    const spaceBefore = originalText.indexOf(' ', bestIndex - 60);
    start = spaceBefore !== -1 && spaceBefore < bestIndex ? spaceBefore + 1 : bestIndex - 50;
  }

  let end = Math.min(originalText.length, start + maxLength);
  if (end < originalText.length) {
    const spaceAfter = originalText.lastIndexOf(' ', end);
    if (spaceAfter > start + 80) {
      end = spaceAfter;
    }
  }

  let slice = originalText.slice(start, end).trim();
  if (start > 0) slice = '... ' + slice;
  if (end < originalText.length) slice = slice + ' ...';

  // تطبيق تمييز آمن بعد تنظيف أي وسوم HTML أولية
  let safeSlice = slice
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const uniqueTerms = Array.from(new Set(tokens.filter((t) => t.length >= 2))).sort(
    (a, b) => b.length - a.length
  );

  for (const term of uniqueTerms) {
    const regex = buildArabicFlexibleRegex(term);
    safeSlice = safeSlice.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  return { snippet: safeSlice, matchedTerms };
}

/**
 * حساب بصمة المحتوى (Content Hash) لاكتشاف التكرار التام
 */
export function computeContentHash(text: string): string {
  const normalized = normalizeArabic(text);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

/**
 * حساب نسبة التشابه (Jaccard Shingle Similarity) بين نصين عربيين لاكتشاف المقالات المكررة أو شبه المكررة
 */
export function computeTextSimilarity(textA: string, textB: string): number {
  const wordsA = normalizeArabic(textA).split(/\s+/).filter((w) => w.length > 2);
  const wordsB = normalizeArabic(textB).split(/\s+/).filter((w) => w.length > 2);

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const makeShingles = (words: string[]) => {
    const set = new Set<string>();
    if (words.length < 2) {
      words.forEach((w) => set.add(w));
      return set;
    }
    for (let i = 0; i < words.length - 1; i++) {
      set.add(`${words[i]}_${words[i + 1]}`);
    }
    return set;
  };

  const setA = makeShingles(wordsA);
  const setB = makeShingles(wordsB);

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(3));
}

/**
 * توليد معرف رابط عربي نظيف (Slug)
 */
export function createArabicSlug(title: string, suffix?: string): string {
  const base = title
    .trim()
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 75);
  return suffix ? `${base}-${suffix}` : base;
}

/**
 * التصنيف التلقائي للمقالات العُمانية عبر التصنيفات الـ 17 الأساسية
 * واقتراح الكلمات المفتاحية والملخص العربي التلقائي
 */
const CATEGORY_RULES: Array<{
  categoryId: string;
  subcategory: string;
  keywords: string[];
}> = [
  {
    categoryId: 'cat-05-castles-forts',
    subcategory: 'القلاع والحصون التاريخية',
    keywords: ['قلعة', 'حصن', 'برج', 'بهلا', 'جبرين', 'الجلالي', 'الميراني', 'سفالة', 'سور', 'تحصينات'],
  },
  {
    categoryId: 'cat-07-sultans-rulers',
    subcategory: 'الدولة البوسعيدية والسلاطين',
    keywords: ['السلطان', 'الإمام', 'أحمد بن سعيد', 'قابوس بن سعيد', 'هيثم بن طارق', 'سعيد بن سلطان', 'البوسعيد', 'اليعاربة', 'النهضة المتجددة'],
  },
  {
    categoryId: 'cat-06-personalities',
    subcategory: 'العلماء والملاحون والأعلام',
    keywords: ['الفراهيدي', 'أحمد بن ماجد', 'أسد البحار', 'العوتبي', 'السالمي', 'ابن رزيق', 'عالم', 'مؤرخ', 'ملاح', 'شخصية'],
  },
  {
    categoryId: 'cat-02-governorates',
    subcategory: 'المحافظات والولايات الإدارية',
    keywords: ['محافظة', 'ولاية', 'نيابة', 'مسقط', 'ظفار', 'صلالة', 'نزوى', 'صحار', 'مسندم', 'خصب', 'البريمي', 'صور', 'عبري', 'إبراء', 'هيماء', 'الرستاق'],
  },
  {
    categoryId: 'cat-03-geography',
    subcategory: 'التضاريس والجبال والأودية والصحاري',
    keywords: ['جبل', 'الجبل الأخضر', 'جبل شمس', 'سلسلة جبال الحجر', 'وادي', 'رمال الشرقية', 'الربع الخالي', 'صحراء', 'كهف', 'الهوتة', 'تضاريس'],
  },
  {
    categoryId: 'cat-04-seas-islands',
    subcategory: 'الجزر والسواحل والبحار العُمانية',
    keywords: ['جزيرة', 'مصيرة', 'الديمانيات', 'الحلانيات', 'بحر عمان', 'بحر العرب', 'مضيق هرمز', 'ساحل', 'خور', 'ملاحة بحرية'],
  },
  {
    categoryId: 'cat-08-heritage-traditions',
    subcategory: 'الأفلاج والعادات والسنع العُماني',
    keywords: ['فلج', 'الأفلاج', 'دارس', 'الخطمين', 'الملكي', 'السبلة', 'القهوة العمانية', 'اللبان', 'الزي العماني', 'عادات', 'تقاليد'],
  },
  {
    categoryId: 'cat-09-arts-crafts',
    subcategory: 'الفنون الشعبية والصناعات الحرفية',
    keywords: ['الرزحة', 'العازي', 'الخنجر العماني', 'الحلوى العمانية', 'الفخار', 'الفضيات', 'النسيج', 'البرعة', 'فن شعبي', 'حرفة'],
  },
  {
    categoryId: 'cat-10-literature-poetry',
    subcategory: 'الشعر واللغة والمعاجم',
    keywords: ['شعر', 'قصيدة', 'معجم العين', 'العروض', 'أدب', 'النبطي', 'الفصيح', 'الميدان', 'الأدب العماني'],
  },
  {
    categoryId: 'cat-11-science-education',
    subcategory: 'الجامعات والعلوم والبحث العلمي',
    keywords: ['جامعة السلطان قابوس', 'تعليم', 'بحث علمي', 'مدرسة', 'طب', 'فلك', 'مخطوطات علمية', 'أكاديمية'],
  },
  {
    categoryId: 'cat-12-economy-trade',
    subcategory: 'الاقتصاد والموانئ والمناطق الخاصة',
    keywords: ['الدقم', 'اقتصاد', 'تجارة', 'ميناء', 'طاقة', 'هيدروجين أخضر', 'استثمار', 'صناعة', 'مدائن'],
  },
  {
    categoryId: 'cat-13-environment-wildlife',
    subcategory: 'المحميات الطبيعية وصون البيئة',
    keywords: ['محمية', 'المها العربية', 'بيئة', 'السلاحف', 'رأس الجنز', 'القرم', 'جبل سمحان', 'تنوع أحيائي'],
  },
  {
    categoryId: 'cat-14-flora-fauna',
    subcategory: 'النباتات العطرية والحيوانات البرية',
    keywords: ['شجرة اللبان', 'النمر العربي', 'الوعل النوبي', 'الورد الجبلي', 'النخيل', 'الغزال العربي', 'نبات', 'حيوان'],
  },
  {
    categoryId: 'cat-15-tourism-nature',
    subcategory: 'المعالم السياحية وموسم الخريف',
    keywords: ['سياحة', 'خريف ظفار', 'وادي شاب', 'وادي بني خالد', 'هوية نجم', 'عين كسفة', 'وجهة سياحية'],
  },
  {
    categoryId: 'cat-16-national-institutions',
    subcategory: 'المتاحف والمؤسسات الوطنية',
    keywords: ['المتحف الوطني', 'دار الأوبرا السلطانية', 'وزارة الإعلام', 'وزارة الثقافة', 'مجلس عمان', 'مؤسسة', 'مبادرة'],
  },
  {
    categoryId: 'cat-17-modern-oman',
    subcategory: 'رؤية عُمان 2040 والتنمية المعاصرة',
    keywords: ['رؤية عمان 2040', '2040', 'التحول الرقمي', 'اللامركزية', 'عمان المعاصرة', 'التنمية المستدامة'],
  },
  {
    categoryId: 'cat-01-history-civilization',
    subcategory: 'حضارة مجان والتاريخ العُماني القديم والوسيط',
    keywords: ['مجان', 'حضارة', 'النحاس', 'بات والخطم والعين', 'قلهات', 'سمهرم', 'البليد', 'تاريخ عمان', 'آثار'],
  },
];

export function autoAnalyzeArabicArticle(title: string, content: string): {
  categoryId: string;
  subcategory: string;
  keywords: string[];
  summary: string;
} {
  const combinedNorm = normalizeArabic(`${title} ${title} ${content}`);

  let bestCategory = 'cat-01-history-civilization';
  let bestSubcategory = 'تاريخ عُمان العام';
  let maxScore = 0;
  const matchedKeywords = new Set<string>();

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      const kwNorm = normalizeArabic(kw);
      if (combinedNorm.includes(kwNorm)) {
        score += normalizeArabic(title).includes(kwNorm) ? 4 : 2;
        matchedKeywords.add(kw);
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCategory = rule.categoryId;
      bestSubcategory = rule.subcategory;
    }
  }

  // استخراج كلمات مفتاحية إضافية من العنوان والنص عند الحاجة
  const titleWords = title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !ARABIC_STOP_WORDS.has(normalizeArabic(w)));

  for (const tw of titleWords.slice(0, 5)) {
    matchedKeywords.add(tw);
  }
  matchedKeywords.add('سلطنة عُمان');

  // توليد ملخص عربي استخلاصي من أول جملتين أو ثلاث جمل مفيدة في النص
  const sentences = content
    .split(/(?<=[.؟!।\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 35);

  let summary = sentences.slice(0, 2).join(' ');
  if (!summary) {
    summary = content.slice(0, 260).trim();
  }
  if (summary.length > 320) {
    summary = summary.slice(0, 317).trim() + '...';
  }

  return {
    categoryId: bestCategory,
    subcategory: bestSubcategory,
    keywords: Array.from(matchedKeywords).slice(0, 8),
    summary,
  };
}
