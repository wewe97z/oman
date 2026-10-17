import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'encyclopedia.db');
const OUT_DIR = path.join(ROOT_DIR, 'dist-static');

console.log('--- بدء توليد النسخة الثابتة الكاملة للموسوعة العُمانية الرقمية (Multi-page Static Bundle) ---');

if (!fs.existsSync(DB_PATH)) {
  console.error('قاعدة البيانات غير موجودة:', DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

// 1. استخراج البيانات
const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all().map(c => ({
  id: String(c.id),
  slug: String(c.slug),
  name: String(c.name),
  description: String(c.description),
  icon: String(c.icon || 'BookOpen'),
  sortOrder: Number(c.sort_order),
  subcategories: JSON.parse(String(c.subcategories || '[]')),
}));

const volumes = db.prepare('SELECT * FROM volumes ORDER BY volume_number ASC').all().map(v => ({
  id: String(v.id),
  volumeNumber: Number(v.volume_number),
  slug: String(v.slug),
  title: String(v.title),
  subtitle: String(v.subtitle),
  description: String(v.description),
  letterRange: String(v.letter_range),
  coverTheme: String(v.cover_theme || 'red'),
}));

const sources = db.prepare('SELECT * FROM sources ORDER BY trust_level DESC, name ASC').all().map(s => ({
  id: String(s.id),
  name: String(s.name),
  url: String(s.url),
  domain: String(s.domain),
  sourceType: String(s.source_type),
  publisher: String(s.publisher),
  trustLevel: String(s.trust_level),
  licenseInfo: String(s.license_info),
  notes: String(s.notes || ''),
}));

const articles = db.prepare('SELECT * FROM articles ORDER BY published_at DESC').all().map(a => {
  const cat = categories.find(c => c.id === a.category_id);
  const vol = volumes.find(v => v.id === a.volume_id);
  const src = sources.find(s => s.id === a.source_id);
  return {
    id: String(a.id),
    slug: String(a.slug),
    title: String(a.title),
    summary: String(a.summary || ''),
    content: String(a.content || ''),
    categoryId: String(a.category_id),
    categoryName: cat?.name || 'عام',
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

// 2. تجهيز المجلدات
if (fs.existsSync(OUT_DIR)) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'images'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'articles'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'categories'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'volumes'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'sources'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'search'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'assistant'), { recursive: true });

// 3. نسخ الصور والأيقونات
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
    fs.copyFileSync(srcP, path.join(OUT_DIR, 'images', f));
  }
}

const favIco = path.join(ROOT_DIR, 'public', 'favicon.ico');
if (fs.existsSync(favIco)) {
  fs.copyFileSync(favIco, path.join(OUT_DIR, 'favicon.ico'));
}

// 4. إنشاء ملف الأنماط المشترك assets/style.css
const styleCss = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap');

:root {
  --color-primary: #8B1E24;
  --color-primary-dark: #641217;
  --color-gold: #C69C47;
  --color-gold-light: #F4E7C5;
  --color-green: #1F5A3B;
  --color-bg: #FAF8F5;
  --color-card: #FFFFFF;
  --color-border: #E7DFD5;
  --color-text: #1C1917;
  --color-text-muted: #57534E;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
  line-height: 1.8;
  direction: rtl;
  text-align: right;
  -webkit-font-smoothing: antialiased;
}

.font-serif {
  font-family: 'Amiri', serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.container {
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1.25rem;
  padding-right: 1.25rem;
}

/* Header */
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: rgba(250, 248, 245, 0.96);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--color-border);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 4.5rem;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.brand-logo {
  height: 3.25rem;
  width: auto;
  object-fit: contain;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  list-style: none;
}

.nav-link {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition: color 0.15s ease;
}

.nav-link:hover, .nav-link.active {
  color: var(--color-primary);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background-color: var(--color-primary);
  color: #FFFFFF !important;
  font-weight: 700;
  padding: 0.6rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background-color: #FFFFFF;
  color: var(--color-text);
  font-weight: 700;
  padding: 0.55rem 1.2rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn-outline:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
}

.badge-verified {
  background-color: #DCFCE7;
  color: #166534;
}

.badge-category {
  background-color: #F5F5F4;
  color: #44403C;
}

.badge-fact {
  background-color: #FEF3C7;
  color: #92400E;
}

/* Cards */
.article-card {
  background: #FFFFFF;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.article-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-primary);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
}

/* Modal */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: #FFFFFF;
  border-radius: 1.25rem;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  background: #F5F5F4;
  border: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 700;
  font-size: 1.2rem;
}

/* Footer */
.site-footer {
  margin-top: auto;
  background-color: #FFFFFF;
  border-top: 1px solid var(--color-border);
  padding: 3rem 0 2rem;
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'style.css'), styleCss, 'utf8');

// 5. توليد ملف الجافاسكريبت المشترك assets/app.js
const appJs = `
// محرك البحث والتفاعل الذكي للموسوعة العُمانية الرقمية
window.ENCYCLOPEDIA_DATA = {
  articles: ${JSON.stringify(articles)},
  categories: ${JSON.stringify(categories)},
  volumes: ${JSON.stringify(volumes)},
  sources: ${JSON.stringify(sources)}
};

function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]/g, '')
    .replace(/\\u0640+/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();
}

function searchArticles(query) {
  if (!query || !query.trim()) return window.ENCYCLOPEDIA_DATA.articles;
  const qNorm = normalizeArabic(query);
  const terms = qNorm.split(/\\s+/).filter(Boolean);
  return window.ENCYCLOPEDIA_DATA.articles.filter(a => {
    const titleN = normalizeArabic(a.title);
    const summaryN = normalizeArabic(a.summary);
    const contentN = normalizeArabic(a.content);
    const keywordsN = normalizeArabic((a.keywords || []).join(' '));
    return terms.every(t => titleN.includes(t) || summaryN.includes(t) || keywordsN.includes(t) || contentN.includes(t));
  });
}

function openArticleModal(slug) {
  const article = window.ENCYCLOPEDIA_DATA.articles.find(a => a.slug === slug);
  if (!article) return;
  const overlay = document.getElementById('articleModalOverlay');
  const body = document.getElementById('articleModalBody');
  if (!overlay || !body) {
    window.location.href = './articles/' + slug + '/index.html';
    return;
  }
  
  body.innerHTML = \`
    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem;">
      <span class="badge badge-verified">✓ موثق في الموسوعة</span>
      <span class="badge badge-category">\${article.categoryName}</span>
      <span class="badge badge-fact">حقيقة تاريخية مؤكدة</span>
    </div>
    <h1 style="font-size: 1.75rem; font-weight: 800; color: #8B1E24; margin-bottom: 1rem;">\${article.title}</h1>
    <div style="font-size: 0.85rem; color: #78716C; margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
      <span>المجلد: \${article.volumeTitle}</span>
      <span>المصدر: \${article.sourceName}</span>
      <span>تاريخ النشر: \${article.publishedAt ? article.publishedAt.slice(0, 10) : '2024'}</span>
    </div>
    <div style="font-size: 1.05rem; line-height: 1.9; color: #292524; white-space: pre-line; margin-bottom: 2rem;">
      \${article.content}
    </div>
    <div style="border-top: 1px solid #E7DFD5; padding-top: 1.5rem; margin-top: 1.5rem;">
      <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">المراجع والمصادر الرسمية:</h3>
      <ul style="padding-right: 1.25rem; font-size: 0.9rem; color: #57534E;">
        \${(article.references || []).map(r => \`
          <li style="margin-bottom: 0.5rem;">
            \${r.url ? \`<a href="\${r.url}" target="_blank" rel="noopener noreferrer" style="color: #8B1E24; font-weight: 600; text-decoration: underline;">\${r.title}</a>\` : \`<strong>\${r.title}</strong>\`}
            \${r.publisher ? \` - \${r.publisher}\` : ''}
          </li>
        \`).join('')}
      </ul>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #E7DFD5;">
      <a href="./articles/\${article.slug}/index.html" class="btn-outline">فتح في صفحة مستقلة ↗</a>
      <button onclick="navigator.clipboard.writeText(window.location.origin + '/articles/' + '\${article.slug}/'); alert('تم نسخ رابط المقال بنجاح!');" class="btn-primary">نسخ الرابط</button>
    </div>
  \`;
  overlay.style.display = 'flex';
}

function closeArticleModal() {
  const overlay = document.getElementById('articleModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

// المساعد الذكي المحلي
function askLocalAi(query) {
  if (!query || !query.trim()) return null;
  const qNorm = normalizeArabic(query);
  const hits = searchArticles(query);
  if (hits.length === 0) {
    return {
      answer: 'عذرًا، لم يتم العثور على مقالات تطابق هذا السؤال في الموسوعة العُمانية الحالية. يُرجى محاولة استخدام كلمات بحث أخرى مثل: قلاع، صلالة، الخليل بن أحمد، نزوى، الرؤية المستقبلية.',
      sources: []
    };
  }
  const top = hits[0];
  return {
    answer: top.summary || top.content.slice(0, 350) + '...',
    sources: [{ title: top.title, slug: top.slug, sourceName: top.sourceName, references: top.references }]
  };
}
`;
fs.writeFileSync(path.join(OUT_DIR, 'assets', 'app.js'), appJs, 'utf8');

// دالة مساعدة لإنشاء شريط التنقل العلوي
function renderNav(activeTab = 'home', relativePath = '.') {
  return `
  <header class="site-header">
    <div class="container header-inner">
      <a href="${relativePath}/index.html" class="brand-link" title="الموسوعة العُمانية الرقمية">
        <img src="${relativePath}/images/oman-encyclopedia-logo.png" alt="شعار الموسوعة العُمانية الرقمية" class="brand-logo" />
      </a>
      <nav>
        <ul class="nav-links">
          <li><a href="${relativePath}/index.html" class="nav-link ${activeTab === 'home' ? 'active' : ''}">الرئيسية</a></li>
          <li><a href="${relativePath}/articles/index.html" class="nav-link ${activeTab === 'articles' ? 'active' : ''}">تصفح المقالات</a></li>
          <li><a href="${relativePath}/categories/index.html" class="nav-link ${activeTab === 'categories' ? 'active' : ''}">التصنيفات (17)</a></li>
          <li><a href="${relativePath}/volumes/index.html" class="nav-link ${activeTab === 'volumes' ? 'active' : ''}">المجلدات (6)</a></li>
          <li><a href="${relativePath}/sources/index.html" class="nav-link ${activeTab === 'sources' ? 'active' : ''}">المصادر المعتمدة</a></li>
          <li><a href="${relativePath}/search/index.html" class="nav-link ${activeTab === 'search' ? 'active' : ''}">البحث الذكي</a></li>
        </ul>
      </nav>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <a href="${relativePath}/assistant/index.html" class="btn-primary">
          <span>✨ اسأل المساعد الذكي</span>
        </a>
      </div>
    </div>
  </header>
  `;
}

// دالة مساعدة لإنشاء التذييل
function renderFooter(relativePath = '.') {
  return `
  <footer class="site-footer">
    <div class="container" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${relativePath}/images/oman-encyclopedia-mark.png" alt="رمز الموسوعة" style="height: 2.25rem; width: auto;" />
          <div>
            <div style="font-weight: 800; color: #8B1E24; font-size: 1.05rem;">الموسوعة العُمانية الرقمية الذكية</div>
            <div style="font-size: 0.8rem; color: #78716C;">مرجع وطني معرفي موثق ومفتوح لتاريخ عُمان وتراثها وحضارتها</div>
          </div>
        </div>
        <div style="display: flex; gap: 1.25rem; font-size: 0.85rem; color: #57534E;">
          <a href="${relativePath}/index.html">الرئيسية</a>
          <a href="${relativePath}/articles/index.html">المقالات</a>
          <a href="${relativePath}/categories/index.html">التصنيفات</a>
          <a href="${relativePath}/volumes/index.html">المجلدات</a>
          <a href="${relativePath}/sources/index.html">المصادر</a>
        </div>
      </div>
      <div style="border-top: 1px solid #E7DFD5; padding-top: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; font-size: 0.8rem; color: #78716C;">
        <div>جميع الحقوق محفوظة للموسوعة العُمانية الرقمية © ${new Date().getFullYear()} — سلطنة عُمان</div>
        <div>نسخة الإنتاج الثابتة الشاملة (Standalone Static Distribution)</div>
      </div>
    </div>
  </footer>
  `;
}

// 6. توليد index.html الرئيسي
const homeHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI</title>
  <meta name="description" content="البوابة الرقمية الموثقة لتاريخ سلطنة عُمان وتراثها ومعالمها وأعلامها ومجلداتها الرسمية مع محرك بحث عربي ذكي." />
  <link rel="icon" href="./favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="./images/apple-touch-icon.png" />
  <meta property="og:title" content="الموسوعة العُمانية الرقمية الذكية" />
  <meta property="og:description" content="تصفح 20 مقالاً موثقاً عبر 17 تصنيفاً و6 مجلدات تاريخية مع محرك بحث ومساعد ذكي." />
  <meta property="og:image" content="./images/oman-encyclopedia-og.png" />
  <link rel="stylesheet" href="./assets/style.css" />
</head>
<body>
  ${renderNav('home', '.')}

  <!-- Hero Section -->
  <section style="background: linear-gradient(180deg, #FAF8F5 0%, #F5F0E8 100%); padding: 4rem 0 3rem; text-align: center; border-bottom: 1px solid var(--color-border);">
    <div class="container" style="max-width: 800px;">
      <div style="margin-bottom: 1.5rem; display: flex; justify-content: center;">
        <img src="./images/oman-encyclopedia-logo.png" alt="شعار الموسوعة العُمانية الرقمية" style="max-height: 100px; width: auto;" />
      </div>
      <h1 style="font-size: 2.5rem; font-weight: 900; color: #1C1917; margin-bottom: 0.75rem; letter-spacing: -0.02em;">
        اكتشف تاريخ عُمان وحضارتها
      </h1>
      <p style="font-size: 1.15rem; color: #57534E; margin-bottom: 2rem;">
        مرجع رقمي وطني شامل يضم 20 مقالاً موثقاً من وزارة الإعلام ووزارة التراث والسياحة وجامعة السلطان قابوس.
      </p>

      <!-- مربع البحث التفاعلي الفوري -->
      <div style="background: #FFFFFF; padding: 0.5rem; border-radius: 9999px; border: 2px solid #E7DFD5; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 0.5rem;">
        <input 
          type="text" 
          id="homeSearchInput" 
          placeholder="ابحث عن شخصية، قلعة، ولاية، أو حدث تاريخي..." 
          style="flex: 1; border: none; padding: 0.75rem 1.25rem; font-size: 1.05rem; font-family: inherit; outline: none;"
          oninput="handleHomeSearch(this.value)"
        />
        <a href="./search/index.html" class="btn-primary" style="padding: 0.75rem 1.75rem; font-size: 1rem;">بحث</a>
      </div>

      <!-- إحصائيات سريعة -->
      <div style="display: flex; justify-content: center; gap: 2rem; margin-top: 2.5rem; flex-wrap: wrap; font-size: 0.9rem; color: #78716C;">
        <div>📚 <strong>20</strong> مقالاً موثقاً</div>
        <div>🗂️ <strong>17</strong> تصنيفاً معرفياً</div>
        <div>📖 <strong>6</strong> مجلدات تاريخية</div>
        <div>🏛️ <strong>11</strong> مصدراً رسمياً</div>
      </div>
    </div>
  </section>

  <!-- شبكة المقالات الموثقة -->
  <main class="container" style="padding-top: 3rem; padding-bottom: 4rem;">
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.75rem; font-weight: 800; color: #8B1E24;">المقالات الموثقة</h2>
        <p style="color: #78716C; font-size: 0.95rem;">انقر على أي مقال لقراءته فوراً أو نسخه أو مشاركته</p>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="categoryFilterButtons">
        <button class="btn-primary" onclick="filterArticlesByCategory('all')">الكل (20)</button>
        <button class="btn-outline" onclick="filterArticlesByCategory('cat-01-history-civilization')">التاريخ والحضارة</button>
        <button class="btn-outline" onclick="filterArticlesByCategory('cat-05-castles-forts')">القلاع والحصون</button>
        <button class="btn-outline" onclick="filterArticlesByCategory('cat-06-personalities')">الشخصيات والأعلام</button>
        <button class="btn-outline" onclick="filterArticlesByCategory('cat-02-governorates')">المحافظات والولايات</button>
      </div>
    </div>

    <!-- بطاقات المقالات -->
    <div id="articlesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
      ${articles.map(a => `
        <article class="article-card" data-category="${a.categoryId}" data-slug="${a.slug}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span class="badge badge-category">${a.categoryName}</span>
              <span class="badge badge-verified">✓ موثق</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem; line-height: 1.4;">
              <a href="./articles/${a.slug}/index.html" onclick="openArticleModal('${a.slug}'); return false;">${a.title}</a>
            </h3>
            <p style="font-size: 0.9rem; color: #57534E; line-height: 1.7; margin-bottom: 1.25rem;">
              ${a.summary.slice(0, 160)}${a.summary.length > 160 ? '...' : ''}
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E7DFD5; padding-top: 1rem; font-size: 0.8rem; color: #78716C;">
            <span>📖 ${a.volumeTitle}</span>
            <button onclick="openArticleModal('${a.slug}')" class="btn-outline" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">قراءة المقال</button>
          </div>
        </article>
      `).join('')}
    </div>
  </main>

  <!-- نافذة قراءة المقال المنبثقة السريعة (Modal) -->
  <div class="modal-overlay" id="articleModalOverlay" onclick="if(event.target === this) closeArticleModal()">
    <div class="modal-content">
      <button class="modal-close" onclick="closeArticleModal()" title="إغلاق">✕</button>
      <div id="articleModalBody"></div>
    </div>
  </div>

  ${renderFooter('.')}

  <script src="./assets/app.js"></script>
  <script>
    function handleHomeSearch(val) {
      if (!val || !val.trim()) {
        document.querySelectorAll('#articlesGrid .article-card').forEach(el => el.style.display = 'flex');
        return;
      }
      const results = searchArticles(val);
      const slugs = new Set(results.map(r => r.slug));
      document.querySelectorAll('#articlesGrid .article-card').forEach(el => {
        el.style.display = slugs.has(el.getAttribute('data-slug')) ? 'flex' : 'none';
      });
    }

    function filterArticlesByCategory(catId) {
      document.querySelectorAll('#categoryFilterButtons button').forEach(b => {
        b.className = 'btn-outline';
      });
      event.target.className = 'btn-primary';
      document.querySelectorAll('#articlesGrid .article-card').forEach(el => {
        if (catId === 'all' || el.getAttribute('data-category') === catId) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), homeHtml, 'utf8');

// 7. توليد صفحات المقالات المستقلة: articles/[slug]/index.html
for (const a of articles) {
  const artDir = path.join(OUT_DIR, 'articles', a.slug);
  fs.mkdirSync(artDir, { recursive: true });

  const articleHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${a.title} | الموسوعة العُمانية الرقمية</title>
  <meta name="description" content="${a.summary.slice(0, 160)}" />
  <link rel="icon" href="../../favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="../../images/apple-touch-icon.png" />
  <meta property="og:title" content="${a.title} — الموسوعة العُمانية الرقمية" />
  <meta property="og:description" content="${a.summary.slice(0, 200)}" />
  <meta property="og:image" content="../../images/oman-encyclopedia-og.png" />
  <link rel="stylesheet" href="../../assets/style.css" />
</head>
<body>
  ${renderNav('articles', '../..')}

  <div class="container" style="max-width: 860px; padding-top: 2.5rem; padding-bottom: 5rem;">
    <!-- فتات الخبز (Breadcrumb) -->
    <nav style="display: flex; gap: 0.5rem; font-size: 0.85rem; color: #78716C; margin-bottom: 1.5rem; align-items: center; flex-wrap: wrap;">
      <a href="../../index.html" style="color: #8B1E24; font-weight: 600;">الرئيسية</a>
      <span>›</span>
      <a href="../../categories/${a.categoryId}/index.html" style="color: #8B1E24; font-weight: 600;">${a.categoryName}</a>
      <span>›</span>
      <span style="color: #1C1917;">${a.title}</span>
    </nav>

    <!-- شارات التوثيق -->
    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap;">
      <span class="badge badge-verified">✓ مقال موثق في الموسوعة</span>
      <span class="badge badge-category">${a.categoryName}</span>
      <span class="badge badge-fact">حقيقة تاريخية مؤكدة</span>
      <span style="font-size: 0.8rem; color: #78716C; margin-right: auto;">📖 ${a.volumeTitle}</span>
    </div>

    <!-- العنوان الرئيسي -->
    <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 1rem; line-height: 1.3;">
      ${a.title}
    </h1>

    <!-- بيانات النشر والمصدر -->
    <div style="display: flex; gap: 1.5rem; font-size: 0.85rem; color: #57534E; border-bottom: 1px solid #E7DFD5; padding-bottom: 1.25rem; margin-bottom: 2rem; flex-wrap: wrap;">
      <div>✍️ الجهة التحريرية: <strong>${a.authorOrPublisher}</strong></div>
      <div>🏛️ المصدر المعتمد: <strong>${a.sourceName}</strong></div>
      <div>📅 تاريخ التدقيق: <strong>${a.lastVerifiedAt ? a.lastVerifiedAt.slice(0, 10) : '2024'}</strong></div>
    </div>

    <!-- صندوق الحقيقة والملخص التوثيقي -->
    <div style="background-color: #FEF3C7; border-right: 4px solid #D97706; padding: 1.25rem; border-radius: 0.5rem; margin-bottom: 2.5rem; font-size: 1rem; color: #78350F; line-height: 1.8;">
      <strong style="display: block; margin-bottom: 0.35rem; font-size: 0.95rem;">الملخص التوثيقي:</strong>
      ${a.summary}
    </div>

    <!-- نص المقال الكامل -->
    <div style="font-size: 1.15rem; line-height: 2.1; color: #1C1917; white-space: pre-line; margin-bottom: 3rem; text-align: justify;">
      ${a.content}
    </div>

    <!-- الكلمات المفتاحية -->
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 3rem; align-items: center;">
      <span style="font-size: 0.85rem; font-weight: 700; color: #78716C;">الكلمات المفتاحية:</span>
      ${a.keywords.map(k => `<span class="badge" style="background: #F5F5F4; color: #44403C;">#${k}</span>`).join('')}
    </div>

    <!-- قسم المراجع الموثقة -->
    <div style="background: #FFFFFF; border: 1px solid #E7DFD5; border-radius: 1rem; padding: 1.75rem; margin-bottom: 3rem;">
      <h2 style="font-size: 1.2rem; font-weight: 800; color: #8B1E24; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>📚 المراجع والمصادر الرسمية المعتمدة</span>
      </h2>
      <ul style="padding-right: 1.5rem; font-size: 0.95rem; color: #44403C; line-height: 1.9;">
        ${a.references.map(r => `
          <li style="margin-bottom: 0.5rem;">
            ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener noreferrer" style="color: #8B1E24; font-weight: 700; text-decoration: underline;">${r.title}</a>` : `<strong>${r.title}</strong>`}
            ${r.publisher ? ` — ${r.publisher}` : ''}
            ${r.accessDate ? ` <span style="font-size: 0.8rem; color: #78716C;">(تم التحقق: ${r.accessDate})</span>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>

    <!-- أزرار الإجراءات والمشاركة -->
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-top: 1px solid #E7DFD5; padding-top: 1.5rem;">
      <a href="../../articles/index.html" class="btn-outline">← العودة إلى قائمة المقالات</a>
      <div style="display: flex; gap: 0.75rem;">
        <button onclick="window.print()" class="btn-outline">🖨️ طباعة المقال</button>
        <button onclick="navigator.clipboard.writeText(window.location.href); alert('تم نسخ رابط المقال المباشر بنجاح!');" class="btn-primary">📋 نسخ الرابط</button>
      </div>
    </div>
  </div>

  ${renderFooter('../..')}
  <script src="../../assets/app.js"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(artDir, 'index.html'), articleHtml, 'utf8');
}

// 8. توليد صفحة دليل المقالات: articles/index.html
const articlesIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تصفح جميع المقالات (20) | الموسوعة العُمانية الرقمية</title>
  <meta name="description" content="فهرس المقالات الـ 20 الموثقة في تاريخ سلطنة عُمان وحضارتها وجغرافيتها." />
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="apple-touch-icon" href="../images/apple-touch-icon.png" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('articles', '..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2.5rem; text-align: center;">
      <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">فهرس المقالات الموثقة</h1>
      <p style="color: #78716C; font-size: 1.05rem;">استكشف كافة المقالات المعتمدة البالغ عددها 20 مقالاً موثقاً</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
      ${articles.map(a => `
        <article class="article-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span class="badge badge-category">${a.categoryName}</span>
              <span class="badge badge-verified">✓ موثق</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem; line-height: 1.4;">
              <a href="./${a.slug}/index.html">${a.title}</a>
            </h3>
            <p style="font-size: 0.9rem; color: #57534E; line-height: 1.7; margin-bottom: 1.25rem;">
              ${a.summary.slice(0, 160)}...
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E7DFD5; padding-top: 1rem; font-size: 0.8rem; color: #78716C;">
            <span>📖 ${a.volumeTitle}</span>
            <a href="./${a.slug}/index.html" class="btn-primary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">قراءة المقال ←</a>
          </div>
        </article>
      `).join('')}
    </div>
  </main>
  ${renderFooter('..')}
  <script src="../assets/app.js"></script>
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'articles', 'index.html'), articlesIndexHtml, 'utf8');

// 9. توليد صفحات التصنيفات: categories/index.html و categories/[slug]/index.html
const categoriesIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>التصنيفات المعرفية الـ 17 | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('categories', '..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2.5rem; text-align: center;">
      <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">التصنيفات المعرفية</h1>
      <p style="color: #78716C; font-size: 1.05rem;">17 تصنيفاً معرفياً شاملاً لكافة جوانب سلطنة عُمان</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
      ${categories.map(c => {
        const count = articles.filter(a => a.categoryId === c.id).length;
        return `
          <div style="background: #FFFFFF; border: 1px solid #E7DFD5; border-radius: 1rem; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 1.5rem; margin-bottom: 0.75rem;">📁</div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem;">
                <a href="./${c.id}/index.html">${c.name}</a>
              </h3>
              <p style="font-size: 0.85rem; color: #57534E; line-height: 1.6; margin-bottom: 1rem;">
                ${c.description}
              </p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E7DFD5; padding-top: 0.75rem; font-size: 0.85rem;">
              <span style="color: #78716C;">${count} مقال</span>
              <a href="./${c.id}/index.html" style="color: #8B1E24; font-weight: 700;">تصفح التصنيف ←</a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </main>
  ${renderFooter('..')}
  <script src="../assets/app.js"></script>
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'categories', 'index.html'), categoriesIndexHtml, 'utf8');

// صفحات كل تصنيف
for (const c of categories) {
  const cDir = path.join(OUT_DIR, 'categories', c.id);
  fs.mkdirSync(cDir, { recursive: true });
  const catArticles = articles.filter(a => a.categoryId === c.id);
  const catPageHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تصنيف: ${c.name} | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="../../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../../assets/style.css" />
</head>
<body>
  ${renderNav('categories', '../..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2rem;">
      <a href="../index.html" class="btn-outline" style="margin-bottom: 1rem;">← كل التصنيفات</a>
      <h1 style="font-size: 2rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">${c.name}</h1>
      <p style="color: #57534E; font-size: 1rem;">${c.description}</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
      ${catArticles.length > 0 ? catArticles.map(a => `
        <article class="article-card">
          <div>
            <span class="badge badge-verified" style="margin-bottom: 0.5rem;">✓ موثق</span>
            <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem;">
              <a href="../../articles/${a.slug}/index.html">${a.title}</a>
            </h3>
            <p style="font-size: 0.9rem; color: #57534E; line-height: 1.7; margin-bottom: 1rem;">
              ${a.summary.slice(0, 140)}...
            </p>
          </div>
          <a href="../../articles/${a.slug}/index.html" class="btn-primary" style="font-size: 0.85rem; padding: 0.4rem 0.9rem;">قراءة المقال</a>
        </article>
      `).join('') : '<p style="color: #78716C;">لا توجد مقالات منشورة في هذا التصنيف حالياً.</p>'}
    </div>
  </main>
  ${renderFooter('../..')}
</body>
</html>`;
  fs.writeFileSync(path.join(cDir, 'index.html'), catPageHtml, 'utf8');
}

// 10. توليد صفحات المجلدات: volumes/index.html
const volumesIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>مجلدات الموسوعة العُمانية الـ 6 | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('volumes', '..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2.5rem; text-align: center;">
      <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">مجلدات الموسوعة العُمانية</h1>
      <p style="color: #78716C; font-size: 1.05rem;">ستة مجلدات شاملة تغطي حروف المعجم العُماني</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
      ${volumes.map(v => {
        const count = articles.filter(a => a.volumeId === v.id).length;
        return `
          <div style="background: #FFFFFF; border: 1px solid #E7DFD5; border-radius: 1rem; padding: 1.75rem; border-top: 4px solid #8B1E24;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #8B1E24; margin-bottom: 0.5rem;">المجلد ${v.volumeNumber} (${v.letterRange})</div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem;">${v.title}</h3>
            <p style="font-size: 0.9rem; color: #57534E; line-height: 1.6; margin-bottom: 1.25rem;">${v.description}</p>
            <div style="font-size: 0.85rem; color: #78716C; border-top: 1px solid #E7DFD5; padding-top: 0.75rem;">
              📚 يضم <strong>${count}</strong> مقالاً في هذه النسخة
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </main>
  ${renderFooter('..')}
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'volumes', 'index.html'), volumesIndexHtml, 'utf8');

// 11. توليد صفحة المصادر المعتمدة: sources/index.html
const sourcesIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>المصادر والمراجع التاريخية المعتمدة | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('sources', '..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2.5rem; text-align: center;">
      <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">المصادر والمراجع المعتمدة</h1>
      <p style="color: #78716C; font-size: 1.05rem;">قائمة المؤسسات الحكومية والأكاديمية والمراجع التاريخية الموثوقة</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1.5rem;">
      ${sources.map(s => `
        <div style="background: #FFFFFF; border: 1px solid #E7DFD5; border-radius: 1rem; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span class="badge" style="background: #DCFCE7; color: #166534;">درجة الثقة: عالية جدًا</span>
              <span style="font-size: 0.8rem; color: #78716C;">${s.sourceType}</span>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem;">${s.name}</h3>
            <p style="font-size: 0.85rem; color: #57534E; margin-bottom: 1rem;">الناشر: ${s.publisher}</p>
          </div>
          <div style="border-top: 1px solid #E7DFD5; padding-top: 0.75rem;">
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" style="color: #8B1E24; font-weight: 700; font-size: 0.9rem; text-decoration: underline;">
              زيارة الموقع الرسمي للمصدر ↗
            </a>
          </div>
        </div>
      `).join('')}
    </div>
  </main>
  ${renderFooter('..')}
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'sources', 'index.html'), sourcesIndexHtml, 'utf8');

// 12. توليد صفحة البحث الذكي: search/index.html
const searchIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>البحث الذكي الموحد | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('search', '..')}
  <main class="container" style="padding-top: 3rem; padding-bottom: 5rem;">
    <div style="margin-bottom: 2.5rem; text-align: center; max-width: 700px; margin-left: auto; margin-right: auto;">
      <h1 style="font-size: 2.25rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.75rem;">البحث في الموسوعة</h1>
      <p style="color: #78716C; font-size: 1.05rem; margin-bottom: 1.5rem;">محرك بحث عربي ذكي يدعم تطبيع الحروف والهمزات والتاء المربوطة والأرقام</p>
      
      <div style="background: #FFFFFF; padding: 0.5rem; border-radius: 9999px; border: 2px solid #8B1E24; display: flex; align-items: center; box-shadow: 0 4px 20px rgba(139,30,36,0.08);">
        <input 
          type="text" 
          id="searchInput" 
          placeholder="ابحث هنا (مثلاً: نزوى، بهلاء، اللبان، مسقط، أحمد بن سعيد)..." 
          style="flex: 1; border: none; padding: 0.75rem 1.25rem; font-size: 1.1rem; font-family: inherit; outline: none;"
          oninput="doSearch(this.value)"
        />
      </div>
      <div id="resultsCount" style="margin-top: 1rem; font-size: 0.9rem; color: #78716C;">
        يتم عرض 20 مقالاً موثقاً
      </div>
    </div>

    <div id="searchResultsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
      ${articles.map(a => `
        <article class="article-card" data-slug="${a.slug}">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span class="badge badge-category">${a.categoryName}</span>
              <span class="badge badge-verified">✓ موثق</span>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #1C1917; margin-bottom: 0.5rem;">
              <a href="../articles/${a.slug}/index.html">${a.title}</a>
            </h3>
            <p style="font-size: 0.9rem; color: #57534E; line-height: 1.7; margin-bottom: 1.25rem;">
              ${a.summary.slice(0, 150)}...
            </p>
          </div>
          <div style="border-top: 1px solid #E7DFD5; padding-top: 0.75rem; text-align: left;">
            <a href="../articles/${a.slug}/index.html" class="btn-primary" style="font-size: 0.8rem; padding: 0.35rem 0.85rem;">قراءة المقال ←</a>
          </div>
        </article>
      `).join('')}
    </div>
  </main>
  ${renderFooter('..')}
  <script src="../assets/app.js"></script>
  <script>
    function doSearch(q) {
      const results = searchArticles(q);
      const countEl = document.getElementById('resultsCount');
      if (countEl) countEl.innerText = 'تم العثور على ' + results.length + ' نتيجة مطابقة';
      const slugs = new Set(results.map(r => r.slug));
      document.querySelectorAll('#searchResultsGrid .article-card').forEach(el => {
        el.style.display = slugs.has(el.getAttribute('data-slug')) ? 'flex' : 'none';
      });
    }
  </script>
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'search', 'index.html'), searchIndexHtml, 'utf8');

// 13. توليد صفحة المساعد الذكي: assistant/index.html
const assistantIndexHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>المساعد الذكي للموسوعة العُمانية | Omani Encyclopedia AI Assistant</title>
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="stylesheet" href="../assets/style.css" />
</head>
<body>
  ${renderNav('assistant', '..')}
  <main class="container" style="max-width: 800px; padding-top: 3rem; padding-bottom: 5rem;">
    <div style="text-align: center; margin-bottom: 2rem;">
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✨</div>
      <h1 style="font-size: 2rem; font-weight: 900; color: #8B1E24; margin-bottom: 0.5rem;">المساعد الذكي للموسوعة</h1>
      <p style="color: #78716C; font-size: 1rem;">اطرح أي سؤال حول تاريخ عُمان، قلاعها، شخصياتها، أو حضارتها، وسيجيبك المساعد بالاستناد المباشر إلى مصادر الموسوعة الموثقة.</p>
    </div>

    <!-- أسئلة مقترحة -->
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem;">
      <button class="btn-outline" onclick="askQuestion('ما هي قلعة نزوى ومن بناها؟')">ما هي قلعة نزوى؟</button>
      <button class="btn-outline" onclick="askQuestion('من هو الإمام أحمد بن سعيد؟')">الإمام أحمد بن سعيد</button>
      <button class="btn-outline" onclick="askQuestion('ما هي أنظمة الأفلاج العمانية؟')">أنظمة الأفلاج العُمانية</button>
      <button class="btn-outline" onclick="askQuestion('ما هي مرتكزات رؤية عمان 2040؟')">رؤية عُمان 2040</button>
    </div>

    <!-- مربع السؤال -->
    <div style="background: #FFFFFF; border: 2px solid #E7DFD5; border-radius: 1.25rem; padding: 1rem; margin-bottom: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
      <textarea 
        id="aiQuestionInput" 
        rows="3" 
        placeholder="اكتب سؤالك هنا..." 
        style="width: 100%; border: none; font-size: 1.05rem; font-family: inherit; outline: none; resize: none;"
      ></textarea>
      <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
        <button onclick="submitAiQuestion()" class="btn-primary" style="padding: 0.6rem 1.75rem;">إرسال السؤال ✨</button>
      </div>
    </div>

    <!-- منطقة الإجابة -->
    <div id="aiResponseContainer" style="display: none; background: #FFFFFF; border: 1px solid #E7DFD5; border-radius: 1.25rem; padding: 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.03);">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
        <span style="font-size: 1.25rem;">✨</span>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: #8B1E24;">إجابة المساعد الذكي الموثقة</h3>
      </div>
      <div id="aiResponseText" style="font-size: 1.05rem; line-height: 1.9; color: #1C1917; margin-bottom: 1.5rem; white-space: pre-line;"></div>
      <div id="aiResponseSources" style="border-top: 1px solid #E7DFD5; padding-top: 1rem; font-size: 0.85rem; color: #57534E;"></div>
    </div>
  </main>
  ${renderFooter('..')}
  <script src="../assets/app.js"></script>
  <script>
    function askQuestion(q) {
      document.getElementById('aiQuestionInput').value = q;
      submitAiQuestion();
    }

    function submitAiQuestion() {
      const q = document.getElementById('aiQuestionInput').value;
      if (!q || !q.trim()) return;
      const res = askLocalAi(q);
      const container = document.getElementById('aiResponseContainer');
      const textEl = document.getElementById('aiResponseText');
      const sourcesEl = document.getElementById('aiResponseSources');
      
      textEl.innerText = res.answer;
      if (res.sources && res.sources.length > 0) {
        sourcesEl.innerHTML = '<strong>المصادر المستند إليها:</strong><br>' + res.sources.map(s => 
          '• <a href="../articles/' + s.slug + '/index.html" style="color: #8B1E24; font-weight: 700; text-decoration: underline;">' + s.title + '</a> (' + s.sourceName + ')'
        ).join('<br>');
      } else {
        sourcesEl.innerHTML = '';
      }
      container.style.display = 'block';
    }
  </script>
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, 'assistant', 'index.html'), assistantIndexHtml, 'utf8');

// 14. توليد صفحة 404: 404.html
const notFoundHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>الصفحة غير موجودة | الموسوعة العُمانية الرقمية</title>
  <link rel="icon" href="./favicon.ico" sizes="any" />
  <link rel="stylesheet" href="./assets/style.css" />
</head>
<body style="min-h-screen; display: flex; flex-direction: column;">
  ${renderNav('home', '.')}
  <main class="container" style="padding: 6rem 0; text-align: center; flex: 1;">
    <div style="font-size: 4rem; font-weight: 900; color: #8B1E24; margin-bottom: 1rem;">404</div>
    <h1 style="font-size: 1.75rem; font-weight: 800; margin-bottom: 1rem;">الصفحة المطلوبة غير موجودة</h1>
    <p style="color: #78716C; margin-bottom: 2rem;">عذرًا، يبدو أن الرابط الذي حاولت فتحه غير متوفر أو تم نقله.</p>
    <a href="./index.html" class="btn-primary">العودة إلى الصفحة الرئيسية للموسوعة</a>
  </main>
  ${renderFooter('.')}
</body>
</html>`;
fs.writeFileSync(path.join(OUT_DIR, '404.html'), notFoundHtml, 'utf8');

// 15. ملفات توجيه الخوادم والاستضافات
// Netlify & Cloudflare Pages
fs.writeFileSync(path.join(OUT_DIR, '_redirects'), '/*  /index.html  200\n', 'utf8');

// Apache / cPanel / Hostinger (.htaccess)
const htaccess = `
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Serve real files and directories directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  # Fallback to index.html
  RewriteRule ^ index.html [L]
</IfModule>
`;
fs.writeFileSync(path.join(OUT_DIR, '.htaccess'), htaccess.trim() + '\n', 'utf8');

// Vercel static config
const vercelStatic = JSON.stringify({
  cleanUrls: true,
  trailingSlash: false
}, null, 2);
fs.writeFileSync(path.join(OUT_DIR, 'vercel.json'), vercelStatic, 'utf8');

// 16. ملف دليل التنصيب السريع باللغة العربية
const readmeStatic = `
================================================================================
الموسوعة العُمانية الرقمية الذكية — دليل نشر النسخة الثابتة (Static Distribution)
================================================================================

هذه الحزمة مجهزة بالكامل للعمل على أي استضافة مواقع مجانية أو مدفوعة بدون الحاجة لتثبيت Node.js أو خادم خلفي!

محتويات الحزمة:
1. index.html : البوابة الرئيسية للموسوعة
2. articles/ : مجلد يضم صفحات مستقلة لكل مقال من المقالات الـ 20 الموثقة
3. categories/ : صفحات الـ 17 تصنيفاً معرفياً
4. volumes/ : صفحات المجلدات الـ 6
5. sources/ : صفحة المراجع والمصادر الرسمية
6. search/ : محرك البحث الذكي
7. assistant/ : واجهة المساعد الذكي
8. assets/ : ملفات التنسيق والبرمجة الجاهزة (style.css و app.js)
9. images/ : شعار الموسوعة الرسمي وجميع أيقونات المتصفح
10. _redirects و .htaccess : إعدادات منع أخطاء 404 عند تحديث الصفحات في Netlify أو cPanel

--------------------------------------------------------------------------------
طريقة الرفع على استضافة cPanel أو Hostinger:
--------------------------------------------------------------------------------
1. افتح لوحة التحكم cPanel ثم اذهب إلى "مدير الملفات" (File Manager).
2. افتح المجلد العام "public_html".
3. ارفع الملف المضغوط (omani-encyclopedia-static-bundle.zip).
4. انقر بزر الفأرة الأيمن على الملف واختر "استخراج" (Extract).
5. افتح نطاق موقعك في المتصفح وسيعمل الموقع فوراً!

--------------------------------------------------------------------------------
طريقة الرفع على Netlify (مجاناً 100%):
--------------------------------------------------------------------------------
1. اذهب إلى https://app.netlify.com وسجل دخولك مجاناً.
2. اسحب مجلد (dist-static) أو ملف الـ zip وأفلته في خانة "Drag and drop your site output folder here".
3. سيعمل موقعك مباشرة مع شهادة أمان SSL مجانية ونطاق مجاني!

--------------------------------------------------------------------------------
طريقة الرفع على GitHub Pages (مجاناً 100%):
--------------------------------------------------------------------------------
1. أنشئ مستودعاً جديداً على GitHub باسم your-username.github.io.
2. ارفع محتويات مجلد dist-static إلى الفرع main.
3. فعّل GitHub Pages من إعدادات المستودع (Settings -> Pages).
`;
fs.writeFileSync(path.join(OUT_DIR, 'README-تنصيب-الاستضافة-المجانية.txt'), readmeStatic.trim() + '\n', 'utf8');

console.log('--- اكتمل توليد جميع ملفات النسخة الثابتة بنجاح داخل مجلد dist-static ---');
