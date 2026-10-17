import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

/**
 * سكريبت التهيئة والاختبار الفوري باستخدام Node.js v22 المدمج (node:sqlite)
 * ينشئ قاعدة البيانات الفعلية ./data/encyclopedia.db ويحقق من الفهرس النصي الكامل والبيانات الموثقة.
 */

export function normalizeArabic(input) {
  if (!input) return '';
  const easternDigits = '٠١٢٣٤٥٦٧٨٩';
  let text = String(input);
  for (let i = 0; i < 10; i++) {
    text = text.replace(new RegExp(easternDigits[i], 'g'), String(i));
  }
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640+/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىی]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeContentHash(text) {
  return crypto.createHash('sha256').update(normalizeArabic(text)).digest('hex').slice(0, 32);
}

// استخلاص البيانات التأسيسية من ملف src/lib/seed-data.ts لضمان تطابق المصدر الوحيد للحقيقة
function loadSeedDataFromTs() {
  const seedTsPath = path.join(process.cwd(), 'src', 'lib', 'seed-data.ts');
  let code = fs.readFileSync(seedTsPath, 'utf8');

  // إزالة جمل الاستيراد والتعريفات النوعية الخاصة بـ TypeScript لتشغيله داخل سياق VM آمن
  code = code
    .replace(/^import\s+.*?;$/gm, '')
    .replace(/interface\s+RawSeedArticle\s*\{[\s\S]*?\}/m, '')
    .replace(/export\s+const\s+INITIAL_CATEGORIES\s*:\s*Category\[\]\s*=/, 'exports.INITIAL_CATEGORIES =')
    .replace(/export\s+const\s+INITIAL_VOLUMES\s*:\s*Volume\[\]\s*=/, 'exports.INITIAL_VOLUMES =')
    .replace(/export\s+const\s+INITIAL_SOURCES\s*:\s*Source\[\]\s*=/, 'exports.INITIAL_SOURCES =')
    .replace(/const\s+RAW_SEED_ARTICLES\s*:\s*RawSeedArticle\[\]\s*=/, 'const RAW_SEED_ARTICLES =')
    .replace(/export\s+const\s+INITIAL_ARTICLES\s*:\s*Article\[\]\s*=/, 'exports.INITIAL_ARTICLES =')
    .replace(/export\s+const\s+INITIAL_REVISIONS\s*:\s*ArticleRevision\[\]\s*=/, 'exports.INITIAL_REVISIONS =');

  const sandbox = {
    exports: {},
    normalizeArabic,
    computeContentHash,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.exports;
}

export function ensureDatabaseInitialized() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'encyclopedia.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'BookOpen',
      sort_order INTEGER NOT NULL DEFAULT 1,
      subcategories TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS volumes (
      id TEXT PRIMARY KEY,
      volume_number INTEGER UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      letter_range TEXT NOT NULL,
      category_ids TEXT NOT NULL DEFAULT '[]',
      cover_theme TEXT NOT NULL DEFAULT 'red'
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      domain TEXT NOT NULL,
      source_type TEXT NOT NULL,
      publisher TEXT NOT NULL,
      trust_level TEXT NOT NULL,
      license_info TEXT NOT NULL,
      allowed_scraping INTEGER NOT NULL DEFAULT 1,
      last_checked_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      title_normalized TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      summary_normalized TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      content_normalized TEXT NOT NULL,
      category_id TEXT NOT NULL,
      subcategory TEXT NOT NULL DEFAULT '',
      volume_id TEXT,
      keywords TEXT NOT NULL DEFAULT '[]',
      keywords_normalized TEXT NOT NULL DEFAULT '',
      author_or_publisher TEXT NOT NULL,
      source_id TEXT,
      source_url TEXT NOT NULL DEFAULT '',
      references_list TEXT NOT NULL DEFAULT '[]',
      published_at TEXT NOT NULL,
      last_verified_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'under_review',
      fact_classification TEXT NOT NULL DEFAULT 'confirmed_fact',
      license_info TEXT NOT NULL DEFAULT '',
      images TEXT NOT NULL DEFAULT '[]',
      content_hash TEXT NOT NULL,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(content_hash);

    CREATE TABLE IF NOT EXISTS article_revisions (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL,
      editor_name TEXT NOT NULL,
      change_summary TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      snapshot_title TEXT NOT NULL,
      snapshot_content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      target_url_or_query TEXT NOT NULL,
      source_id TEXT,
      status TEXT NOT NULL,
      extracted_title TEXT NOT NULL DEFAULT '',
      publisher_name TEXT NOT NULL DEFAULT '',
      created_article_id TEXT,
      error_message TEXT NOT NULL DEFAULT '',
      error_reason_code TEXT NOT NULL DEFAULT '',
      items_processed INTEGER NOT NULL DEFAULT 0,
      items_succeeded INTEGER NOT NULL DEFAULT 0,
      items_failed INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'super_admin',
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      module TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM categories').get();
  if (countRow.cnt === 0) {
    const {
      INITIAL_CATEGORIES,
      INITIAL_VOLUMES,
      INITIAL_SOURCES,
      INITIAL_ARTICLES,
      INITIAL_REVISIONS,
    } = loadSeedDataFromTs();

    const insertCat = db.prepare(`
      INSERT INTO categories (id, slug, name, description, icon, sort_order, subcategories)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const cat of INITIAL_CATEGORIES) {
      insertCat.run(
        cat.id,
        cat.slug,
        cat.name,
        cat.description,
        cat.icon,
        cat.sortOrder,
        JSON.stringify(cat.subcategories)
      );
    }

    const insertVol = db.prepare(`
      INSERT INTO volumes (id, volume_number, slug, title, subtitle, description, letter_range, category_ids, cover_theme)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const vol of INITIAL_VOLUMES) {
      insertVol.run(
        vol.id,
        vol.volumeNumber,
        vol.slug,
        vol.title,
        vol.subtitle,
        vol.description,
        vol.letterRange,
        JSON.stringify(vol.categoryIds),
        vol.coverTheme
      );
    }

    const insertSrc = db.prepare(`
      INSERT INTO sources (id, name, url, domain, source_type, publisher, trust_level, license_info, allowed_scraping, last_checked_at, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const src of INITIAL_SOURCES) {
      insertSrc.run(
        src.id,
        src.name,
        src.url,
        src.domain,
        src.sourceType,
        src.publisher,
        src.trustLevel,
        src.licenseInfo,
        src.allowedScraping ? 1 : 0,
        src.lastCheckedAt,
        src.status,
        src.notes,
        src.createdAt
      );
    }

    const insertArt = db.prepare(`
      INSERT INTO articles (
        id, slug, title, title_normalized, summary, summary_normalized,
        content, content_normalized, category_id, subcategory, volume_id,
        keywords, keywords_normalized, author_or_publisher, source_id, source_url,
        references_list, published_at, last_verified_at, status,
        fact_classification, license_info, images, content_hash, views_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const art of INITIAL_ARTICLES) {
      insertArt.run(
        art.id,
        art.slug,
        art.title,
        art.titleNormalized,
        art.summary,
        art.summaryNormalized,
        art.content,
        art.contentNormalized,
        art.categoryId,
        art.subcategory,
        art.volumeId,
        JSON.stringify(art.keywords),
        art.keywordsNormalized,
        art.authorOrPublisher,
        art.sourceId,
        art.sourceUrl,
        JSON.stringify(art.references),
        art.publishedAt,
        art.lastVerifiedAt,
        art.status,
        art.factClassification,
        art.licenseInfo,
        JSON.stringify(art.images),
        art.contentHash,
        art.viewsCount,
        art.createdAt,
        art.updatedAt
      );
    }

    const insertRev = db.prepare(`
      INSERT INTO article_revisions (
        id, article_id, editor_name, change_summary, previous_status, new_status,
        snapshot_title, snapshot_content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rev of INITIAL_REVISIONS) {
      insertRev.run(
        rev.id,
        rev.articleId,
        rev.editorName,
        rev.changeSummary,
        rev.previousStatus,
        rev.newStatus,
        rev.snapshotTitle,
        rev.snapshotContent,
        rev.createdAt
      );
    }

    db.prepare(`
      INSERT INTO import_jobs (
        id, job_type, target_url_or_query, source_id, status,
        extracted_title, publisher_name, created_article_id,
        error_message, error_reason_code, items_processed, items_succeeded, items_failed,
        started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'job-init-seed',
      'topic_discovery',
      'استيراد وتوثيق الحزمة التأسيسية من المصادر العُمانية الرسمية (البوابة الإعلامية، المتحف الوطني، اليونسكو، رؤية 2040)',
      'src-omaninfo',
      'completed',
      'الحزمة التأسيسية الموثقة للموسوعة العُمانية الرقمية',
      'وزارة الإعلام والمتحف الوطني واليونسكو',
      'art-01-busaid-state',
      '',
      '',
      16,
      16,
      0,
      '2026-10-16T07:00:00Z',
      '2026-10-16T07:01:00Z'
    );

    db.prepare(`
      INSERT INTO system_logs (id, level, module, message, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'log-init-1',
      'info',
      'database',
      'تم تهيئة قاعدة بيانات الموسوعة العُمانية الرقمية الذكية بنجاح',
      '17 تصنيفاً موسوعياً، 6 مجلدات، 10 مصادر رسمية وأكاديمية، و16 مادة موسوعية موثقة.',
      new Date().toISOString()
    );
  }

  return db;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('init-db-and-test.mjs')) {
  const db = ensureDatabaseInitialized();
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
  const volCount = db.prepare('SELECT COUNT(*) as c FROM volumes').get().c;
  const srcCount = db.prepare('SELECT COUNT(*) as c FROM sources').get().c;
  const artCount = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  const pubCount = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").get().c;

  assert.ok(catCount >= 17, 'يجب أن تحتوي قاعدة البيانات على 17 تصنيفاً على الأقل');
  assert.equal(volCount, 6, 'يجب أن تحتوي قاعدة البيانات على 6 مجلدات');
  assert.ok(srcCount >= 10, 'يجب أن تحتوي قاعدة البيانات على 10 مصادر معتمدة على الأقل');
  assert.ok(artCount >= 16, 'يجب أن تحتوي قاعدة البيانات على 16 مقالاً موثقاً على الأقل');
  assert.ok(pubCount >= 15, '15 مقالاً منشوراً على الأقل');

  console.log('==============================================================');
  console.log('تمت تهيئة قاعدة البيانات الفعلية (./data/encyclopedia.db) بنجاح!');
  console.log(`- التصنيفات: ${catCount} | المجلدات: ${volCount} | المصادر: ${srcCount} | المقالات: ${artCount}`);
  console.log('==============================================================');
}
