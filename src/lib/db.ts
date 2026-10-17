import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  Article,
  ArticleRevision,
  ArticleStatus,
  Category,
  DuplicatePair,
  FactClassification,
  ImportJob,
  SearchFilters,
  SearchHit,
  SearchResponse,
  Source,
  SystemLog,
  Volume,
} from './types';
import {
  normalizeArabic,
  tokenizeArabicQuery,
  extractSearchSnippet,
  computeContentHash,
  computeTextSimilarity,
  createArabicSlug,
} from './arabic';
import {
  INITIAL_CATEGORIES,
  INITIAL_VOLUMES,
  INITIAL_SOURCES,
  INITIAL_ARTICLES,
  INITIAL_REVISIONS,
} from './seed-data';

function resolveDbPath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.cwd(), process.env.SQLITE_DB_PATH);
  }

  // في بيئات الخوادم السحابية المؤقتة (Vercel / Serverless)، يكون نظام الملفات للقراءة فقط باستثناء /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDir = path.join('/tmp', 'omani-encyclopedia-data');
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    const tmpDb = path.join(tmpDir, 'encyclopedia.db');
    if (!fs.existsSync(tmpDb)) {
      const bundledDb = path.join(process.cwd(), 'data', 'encyclopedia.db');
      if (fs.existsSync(bundledDb)) {
        try {
          fs.copyFileSync(bundledDb, tmpDb);
        } catch (e) {
          console.warn('تعذر نسخ قاعدة البيانات المدمجة إلى /tmp:', e);
        }
      }
    }
    return tmpDb;
  }

  return path.join(process.cwd(), 'data', 'encyclopedia.db');
}

declare global {
  // eslint-disable-next-line no-var
  var __omaniEncyclopediaDb: DatabaseSync | undefined;
}

/**
 * تنظيف أي نص قبل تسجيله في سجلات النظام لضمان عدم تسرب أي مفتاح سري
 */
export function sanitizeLogText(text: string): string {
  if (!text) return '';
  return text
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^\s"',}]+/gi, '$1=[REDACTED]');
}

export function getDb(): DatabaseSync {
  if (global.__omaniEncyclopediaDb) {
    return global.__omaniEncyclopediaDb;
  }

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  try {
    db.exec('PRAGMA journal_mode = WAL;');
  } catch {
    try {
      db.exec('PRAGMA journal_mode = DELETE;');
    } catch {
      // ignore
    }
  }
  db.exec('PRAGMA foreign_keys = ON;');

  initializeSchemaAndSeed(db);
  global.__omaniEncyclopediaDb = db;
  return db;
}

function initializeSchemaAndSeed(db: DatabaseSync): void {
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
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      permissions TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
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

  // ترقية آمنة غير مدمرة لجدول admin_users وتحويل حساب المدير السابق (super_admin) إلى المالك (owner) دون فقد أي بيانات
  const adminColumns = db
    .prepare('PRAGMA table_info(admin_users)')
    .all() as Array<{ name: string }>;
  const colNames = new Set(adminColumns.map((c) => c.name));

  if (!colNames.has('is_active')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
  }
  if (!colNames.has('must_change_password')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;');
  }
  if (!colNames.has('permissions')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}';");
  }
  if (!colNames.has('created_by')) {
    db.exec('ALTER TABLE admin_users ADD COLUMN created_by TEXT;');
  }

  // تحويل أي حساب super_admin موجود إلى owner تلقائياً وبأمان
  db.prepare(
    "UPDATE admin_users SET role = 'owner', is_active = 1, must_change_password = 0 WHERE role = 'super_admin'"
  ).run();

  // إذا كان هناك حسابات سابقة ولا يوجد أي حساب بدور owner، نرقي أقدم حساب إلى owner
  const ownerRow = db
    .prepare("SELECT id FROM admin_users WHERE role = 'owner' LIMIT 1")
    .get() as { id: string } | undefined;
  if (!ownerRow) {
    const oldestUser = db
      .prepare('SELECT id FROM admin_users ORDER BY created_at ASC LIMIT 1')
      .get() as { id: string } | undefined;
    if (oldestUser) {
      db.prepare(
        "UPDATE admin_users SET role = 'owner', is_active = 1, must_change_password = 0 WHERE id = ?"
      ).run(oldestUser.id);
    }
  }

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM categories').get() as { cnt: number };
  if (countRow.cnt === 0) {
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

    // تسجيل مهمة استيراد تأسيسية موثقة في السجل
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
}

function mapArticleRow(row: Record<string, unknown>): Article {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    titleNormalized: String(row.title_normalized),
    summary: String(row.summary || ''),
    summaryNormalized: String(row.summary_normalized || ''),
    content: String(row.content),
    contentNormalized: String(row.content_normalized),
    categoryId: String(row.category_id),
    categoryName: row.category_name ? String(row.category_name) : undefined,
    subcategory: String(row.subcategory || ''),
    volumeId: row.volume_id ? String(row.volume_id) : null,
    volumeTitle: row.volume_title ? String(row.volume_title) : undefined,
    keywords: JSON.parse(String(row.keywords || '[]')),
    keywordsNormalized: String(row.keywords_normalized || ''),
    authorOrPublisher: String(row.author_or_publisher),
    sourceId: row.source_id ? String(row.source_id) : null,
    sourceName: row.source_name ? String(row.source_name) : undefined,
    sourceType: row.source_type ? (String(row.source_type) as Article['sourceType']) : undefined,
    sourceUrl: String(row.source_url || ''),
    references: JSON.parse(String(row.references_list || '[]')),
    publishedAt: String(row.published_at),
    lastVerifiedAt: String(row.last_verified_at),
    status: String(row.status) as ArticleStatus,
    factClassification: String(row.fact_classification) as FactClassification,
    licenseInfo: String(row.license_info || ''),
    images: JSON.parse(String(row.images || '[]')),
    contentHash: String(row.content_hash),
    viewsCount: Number(row.views_count || 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ============================================================================
// 1. إدارة التصنيفات (Categories)
// ============================================================================

export function getCategories(): Category[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      c.*,
      SUM(CASE WHEN a.status IN ('published', 'verified') THEN 1 ELSE 0 END) AS published_count,
      COUNT(a.id) AS total_count
    FROM categories c
    LEFT JOIN articles a ON a.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    description: String(r.description),
    icon: String(r.icon),
    sortOrder: Number(r.sort_order),
    subcategories: JSON.parse(String(r.subcategories || '[]')),
    publishedCount: Number(r.published_count || 0),
    totalCount: Number(r.total_count || 0),
  }));
}

export function getCategoryBySlugOrId(slugOrId: string): Category | null {
  const all = getCategories();
  return all.find((c) => c.slug === slugOrId || c.id === slugOrId) || null;
}

export function upsertCategory(input: {
  id?: string;
  slug?: string;
  name: string;
  description: string;
  icon?: string;
  sortOrder?: number;
  subcategories?: string[];
}): Category {
  const db = getDb();
  const id = input.id || `cat-${Date.now()}`;
  const slug = input.slug || createArabicSlug(input.name, String(Date.now()).slice(-4));
  const icon = input.icon || 'BookOpen';
  const sortOrder = input.sortOrder ?? 18;
  const subcategories = input.subcategories || [];

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`
      UPDATE categories
      SET name = ?, description = ?, icon = ?, sort_order = ?, subcategories = ?
      WHERE id = ?
    `).run(input.name, input.description, icon, sortOrder, JSON.stringify(subcategories), id);
  } else {
    db.prepare(`
      INSERT INTO categories (id, slug, name, description, icon, sort_order, subcategories)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, slug, input.name, input.description, icon, sortOrder, JSON.stringify(subcategories));
  }

  addSystemLog('info', 'categories', `تم حفظ التصنيف الموسوعي: ${input.name}`, `المعرف: ${id}`);
  return getCategoryBySlugOrId(id)!;
}

// ============================================================================
// 2. إدارة المجلدات (Volumes)
// ============================================================================

export function getVolumes(): Volume[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      v.*,
      SUM(CASE WHEN a.status IN ('published', 'verified') THEN 1 ELSE 0 END) AS article_count
    FROM volumes v
    LEFT JOIN articles a ON a.volume_id = v.id
    GROUP BY v.id
    ORDER BY v.volume_number ASC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    volumeNumber: Number(r.volume_number),
    slug: String(r.slug),
    title: String(r.title),
    subtitle: String(r.subtitle),
    description: String(r.description),
    letterRange: String(r.letter_range),
    categoryIds: JSON.parse(String(r.category_ids || '[]')),
    coverTheme: String(r.cover_theme) as Volume['coverTheme'],
    articleCount: Number(r.article_count || 0),
  }));
}

// ============================================================================
// 3. إدارة المصادر (Sources)
// ============================================================================

export function getSources(): Source[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      s.*,
      COUNT(a.id) AS article_count
    FROM sources s
    LEFT JOIN articles a ON a.source_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    url: String(r.url),
    domain: String(r.domain),
    sourceType: String(r.source_type) as Source['sourceType'],
    publisher: String(r.publisher),
    trustLevel: String(r.trust_level) as Source['trustLevel'],
    licenseInfo: String(r.license_info),
    allowedScraping: Boolean(r.allowed_scraping),
    lastCheckedAt: r.last_checked_at ? String(r.last_checked_at) : null,
    status: String(r.status) as Source['status'],
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    articleCount: Number(r.article_count || 0),
  }));
}

export function upsertSource(input: {
  id?: string;
  name: string;
  url: string;
  sourceType: Source['sourceType'];
  publisher: string;
  trustLevel: Source['trustLevel'];
  licenseInfo: string;
  allowedScraping?: boolean;
  status?: Source['status'];
  notes?: string;
}): Source {
  const db = getDb();
  let domain = 'unknown';
  try {
    domain = new URL(input.url).hostname.replace(/^www\./, '');
  } catch {
    domain = input.url;
  }

  const id = input.id || `src-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM sources WHERE id = ? OR url = ?').get(id, input.url) as
    | { id: string }
    | undefined;

  if (existing) {
    db.prepare(`
      UPDATE sources
      SET name = ?, url = ?, domain = ?, source_type = ?, publisher = ?,
          trust_level = ?, license_info = ?, allowed_scraping = ?,
          last_checked_at = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
      input.name,
      input.url,
      domain,
      input.sourceType,
      input.publisher,
      input.trustLevel,
      input.licenseInfo,
      input.allowedScraping === false ? 0 : 1,
      now,
      input.status || 'active',
      input.notes || '',
      existing.id
    );
    addSystemLog('info', 'sources', `تم تحديث المصدر: ${input.name}`, input.url);
    return getSources().find((s) => s.id === existing.id)!;
  } else {
    db.prepare(`
      INSERT INTO sources (
        id, name, url, domain, source_type, publisher, trust_level,
        license_info, allowed_scraping, last_checked_at, status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.url,
      domain,
      input.sourceType,
      input.publisher,
      input.trustLevel,
      input.licenseInfo,
      input.allowedScraping === false ? 0 : 1,
      now,
      input.status || 'active',
      input.notes || '',
      now
    );
    addSystemLog('info', 'sources', `تمت إضافة مصدر جديد: ${input.name}`, input.url);
    return getSources().find((s) => s.id === id)!;
  }
}

export function deleteSource(id: string): boolean {
  const db = getDb();
  db.prepare('UPDATE articles SET source_id = NULL WHERE source_id = ?').run(id);
  const res = db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  addSystemLog('warning', 'sources', `تم حذف المصدر ذي المعرف: ${id}`, '');
  return res.changes > 0;
}

// ============================================================================
// 4. إدارة المقالات وسجل المراجعات (Articles & Revisions)
// ============================================================================

const BASE_ARTICLE_SELECT = `
  SELECT
    a.*,
    c.name AS category_name,
    v.title AS volume_title,
    s.name AS source_name,
    s.source_type AS source_type
  FROM articles a
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN volumes v ON v.id = a.volume_id
  LEFT JOIN sources s ON s.id = a.source_id
`;

export function listArticles(filters: SearchFilters = {}): Article[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (!filters.status || filters.status === 'all_public') {
    conditions.push("a.status IN ('published', 'verified')");
  } else if (filters.status !== 'all') {
    conditions.push('a.status = ?');
    params.push(filters.status);
  }

  if (filters.categoryId) {
    conditions.push('a.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.sourceId) {
    conditions.push('a.source_id = ?');
    params.push(filters.sourceId);
  }

  if (filters.volumeId) {
    conditions.push('a.volume_id = ?');
    params.push(filters.volumeId);
  }

  if (filters.factClassification) {
    conditions.push('a.fact_classification = ?');
    params.push(filters.factClassification);
  }

  if (filters.dateFrom) {
    conditions.push('a.published_at >= ?');
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push('a.published_at <= ?');
    params.push(filters.dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const rows = db
    .prepare(`${BASE_ARTICLE_SELECT} ${whereClause} ORDER BY a.updated_at DESC, a.views_count DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Array<Record<string, unknown>>;

  return rows.map(mapArticleRow);
}

export function getArticleBySlugOrId(
  slugOrId: string,
  options: { includeNonPublished?: boolean; incrementViews?: boolean } = {}
): Article | null {
  const db = getDb();
  const decoded = decodeURIComponent(slugOrId);
  const row = db
    .prepare(`${BASE_ARTICLE_SELECT} WHERE a.slug = ? OR a.id = ? LIMIT 1`)
    .get(decoded, decoded) as Record<string, unknown> | undefined;

  if (!row) return null;
  const article = mapArticleRow(row);

  if (
    !options.includeNonPublished &&
    article.status !== 'published' &&
    article.status !== 'verified'
  ) {
    return null;
  }

  if (options.incrementViews) {
    db.prepare('UPDATE articles SET views_count = views_count + 1 WHERE id = ?').run(article.id);
    article.viewsCount += 1;
  }

  const revRows = db
    .prepare('SELECT * FROM article_revisions WHERE article_id = ? ORDER BY created_at DESC')
    .all(article.id) as Array<Record<string, unknown>>;

  article.revisions = revRows.map((r) => ({
    id: String(r.id),
    articleId: String(r.article_id),
    editorName: String(r.editor_name),
    changeSummary: String(r.change_summary),
    previousStatus: String(r.previous_status) as ArticleStatus,
    newStatus: String(r.new_status) as ArticleStatus,
    snapshotTitle: String(r.snapshot_title),
    snapshotContent: String(r.snapshot_content),
    createdAt: String(r.created_at),
  }));

  return article;
}

export function saveArticle(
  input: {
    id?: string;
    slug?: string;
    title: string;
    summary: string;
    content: string;
    categoryId: string;
    subcategory?: string;
    volumeId?: string | null;
    keywords: string[];
    authorOrPublisher: string;
    sourceId?: string | null;
    sourceUrl: string;
    references: Article['references'];
    publishedAt?: string;
    lastVerifiedAt?: string;
    status: ArticleStatus;
    factClassification?: FactClassification;
    licenseInfo?: string;
    images?: Article['images'];
  },
  editorName = 'مدير التحرير',
  changeSummary = 'حفظ وتحديث المادة الموسوعية'
): Article {
  const db = getDb();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const titleNorm = normalizeArabic(input.title);
  const summaryNorm = normalizeArabic(input.summary);
  const contentNorm = normalizeArabic(input.content);
  const keywordsNorm = normalizeArabic(input.keywords.join(' '));
  const contentHash = computeContentHash(input.content);

  const existing = input.id
    ? (db.prepare('SELECT * FROM articles WHERE id = ?').get(input.id) as Record<string, unknown> | undefined)
    : undefined;

  if (existing) {
    const prevStatus = String(existing.status) as ArticleStatus;
    db.prepare(`
      UPDATE articles SET
        title = ?, title_normalized = ?,
        summary = ?, summary_normalized = ?,
        content = ?, content_normalized = ?,
        category_id = ?, subcategory = ?, volume_id = ?,
        keywords = ?, keywords_normalized = ?,
        author_or_publisher = ?, source_id = ?, source_url = ?,
        references_list = ?, published_at = ?, last_verified_at = ?,
        status = ?, fact_classification = ?, license_info = ?,
        images = ?, content_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.title,
      titleNorm,
      input.summary,
      summaryNorm,
      input.content,
      contentNorm,
      input.categoryId,
      input.subcategory || '',
      input.volumeId || null,
      JSON.stringify(input.keywords),
      keywordsNorm,
      input.authorOrPublisher,
      input.sourceId || null,
      input.sourceUrl,
      JSON.stringify(input.references || []),
      input.publishedAt || String(existing.published_at),
      input.lastVerifiedAt || today,
      input.status,
      input.factClassification || 'confirmed_fact',
      input.licenseInfo || 'محتوى موسوعي أصلي موثق بالمصادر الرسمية',
      JSON.stringify(input.images || []),
      contentHash,
      now,
      input.id!
    );

    db.prepare(`
      INSERT INTO article_revisions (
        id, article_id, editor_name, change_summary, previous_status, new_status,
        snapshot_title, snapshot_content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `rev-${crypto.randomBytes(5).toString('hex')}`,
      input.id!,
      editorName,
      changeSummary,
      prevStatus,
      input.status,
      input.title,
      input.content,
      now
    );

    addSystemLog('info', 'articles', `تم تحديث المقال: ${input.title}`, `الحالة: ${input.status}`);
    return getArticleBySlugOrId(input.id!, { includeNonPublished: true })!;
  } else {
    const id = input.id || `art-${crypto.randomBytes(5).toString('hex')}`;
    const baseSlug = input.slug || createArabicSlug(input.title, id.slice(-4));

    db.prepare(`
      INSERT INTO articles (
        id, slug, title, title_normalized, summary, summary_normalized,
        content, content_normalized, category_id, subcategory, volume_id,
        keywords, keywords_normalized, author_or_publisher, source_id, source_url,
        references_list, published_at, last_verified_at, status,
        fact_classification, license_info, images, content_hash, views_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      baseSlug,
      input.title,
      titleNorm,
      input.summary,
      summaryNorm,
      input.content,
      contentNorm,
      input.categoryId,
      input.subcategory || '',
      input.volumeId || 'vol-01',
      JSON.stringify(input.keywords),
      keywordsNorm,
      input.authorOrPublisher,
      input.sourceId || null,
      input.sourceUrl,
      JSON.stringify(input.references || []),
      input.publishedAt || today,
      input.lastVerifiedAt || today,
      input.status,
      input.factClassification || 'confirmed_fact',
      input.licenseInfo || 'محتوى موسوعي أصلي موثق بالمصادر الرسمية',
      JSON.stringify(input.images || []),
      contentHash,
      1,
      now,
      now
    );

    db.prepare(`
      INSERT INTO article_revisions (
        id, article_id, editor_name, change_summary, previous_status, new_status,
        snapshot_title, snapshot_content, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `rev-${crypto.randomBytes(5).toString('hex')}`,
      id,
      editorName,
      changeSummary,
      'under_review',
      input.status,
      input.title,
      input.content,
      now
    );

    addSystemLog('info', 'articles', `تم إنشاء مقال موسوعي جديد: ${input.title}`, `المعرف: ${id}`);
    return getArticleBySlugOrId(id, { includeNonPublished: true })!;
  }
}

export function deleteArticle(id: string): boolean {
  const db = getDb();
  const res = db.prepare('DELETE FROM articles WHERE id = ?').run(id);
  addSystemLog('warning', 'articles', `تم حذف المقال ذي المعرف: ${id}`, '');
  return res.changes > 0;
}

// ============================================================================
// 5. محرك البحث النصي الكامل والدلالي العربي (Full-Text & Arabic Search Engine)
// ============================================================================

export function searchArticles(filters: SearchFilters = {}): SearchResponse {
  const startTime = Date.now();
  const rawQuery = (filters.query || '').trim();
  const candidates = listArticles({
    ...filters,
    limit: 500,
    offset: 0,
  });

  if (!rawQuery) {
    const hits: SearchHit[] = candidates.map((article) => ({
      article,
      score: 1,
      snippet: article.summary || article.content.slice(0, 220) + '...',
      matchedTerms: [],
    }));
    return {
      query: '',
      normalizedQuery: '',
      total: hits.length,
      hits: hits.slice(0, filters.limit || 50),
      relatedArticles: candidates.slice(0, 4),
      executionTimeMs: Math.max(1, Date.now() - startTime),
    };
  }

  const { normalizedPhrase, tokens, stemTokens } = tokenizeArabicQuery(rawQuery);
  const scoredHits: SearchHit[] = [];

  for (const article of candidates) {
    let score = 0;

    // 1. مطابقة العبارة الكاملة (Exact Normalized Phrase Match)
    if (normalizedPhrase.length >= 2) {
      if (article.titleNormalized.includes(normalizedPhrase)) {
        score += 45;
      }
      if (article.keywordsNormalized.includes(normalizedPhrase)) {
        score += 30;
      }
      if (article.summaryNormalized.includes(normalizedPhrase)) {
        score += 20;
      }
      if (article.contentNormalized.includes(normalizedPhrase)) {
        score += 15;
      }
    }

    // 2. مطابقة الكلمات الأساسية والجذور العربية (Token & Stem Matching)
    let matchedTokenCount = 0;
    for (const token of tokens) {
      if (token.length < 2) continue;
      let tokenMatched = false;

      if (article.titleNormalized.includes(token)) {
        score += 18;
        tokenMatched = true;
      }
      if (article.keywordsNormalized.includes(token)) {
        score += 12;
        tokenMatched = true;
      }
      if (article.summaryNormalized.includes(token)) {
        score += 8;
        tokenMatched = true;
      }
      if (article.contentNormalized.includes(token)) {
        // حساب تكرار الكلمة داخل النص (TF)
        const occurrences = article.contentNormalized.split(token).length - 1;
        score += Math.min(15, occurrences * 3);
        tokenMatched = true;
      }

      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // 3. مطابقة الجذور بدون "ال" التعريف أو معها
    for (const stem of stemTokens) {
      if (tokens.includes(stem) || stem.length < 3) continue;
      if (article.titleNormalized.includes(stem)) score += 9;
      if (article.keywordsNormalized.includes(stem)) score += 6;
      if (article.contentNormalized.includes(stem)) score += 4;
    }

    // مكافأة إضافية عند اجتماع كل كلمات البحث في المقال نفسه
    if (tokens.length > 1 && matchedTokenCount === tokens.length) {
      score += 25;
    }

    if (score > 0) {
      const { snippet, matchedTerms } = extractSearchSnippet(
        article.content,
        rawQuery,
        250
      );
      scoredHits.push({
        article,
        score,
        snippet,
        matchedTerms,
      });
    }
  }

  scoredHits.sort((a, b) => b.score - a.score || b.article.viewsCount - a.article.viewsCount);

  // اقتراح مقالات ذات صلة من نفس التصنيفات لأعلى النتائج (غير موجودة في أول النتيجة أو مكملة لها)
  const topCategoryIds = new Set(scoredHits.slice(0, 3).map((h) => h.article.categoryId));
  const hitIds = new Set(scoredHits.map((h) => h.article.id));

  let relatedArticles = candidates
    .filter((a) => !hitIds.has(a.id) && topCategoryIds.has(a.categoryId))
    .slice(0, 4);

  if (relatedArticles.length === 0) {
    relatedArticles = candidates.filter((a) => !hitIds.has(a.id)).slice(0, 4);
  }

  return {
    query: rawQuery,
    normalizedQuery: normalizedPhrase,
    total: scoredHits.length,
    hits: scoredHits.slice(0, filters.limit || 50),
    relatedArticles,
    executionTimeMs: Math.max(1, Date.now() - startTime),
  };
}

export function getRelatedArticlesForArticle(article: Article, limit = 4): Article[] {
  const allPublic = listArticles({ status: 'all_public', limit: 100 });
  const scored = allPublic
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.categoryId === article.categoryId) score += 10;
      if (candidate.volumeId && candidate.volumeId === article.volumeId) score += 4;
      for (const kw of article.keywords) {
        const kwNorm = normalizeArabic(kw);
        if (candidate.keywordsNormalized.includes(kwNorm) || candidate.titleNormalized.includes(kwNorm)) {
          score += 5;
        }
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.candidate);
}

// ============================================================================
// 6. فحص جودة المحتوى واكتشاف التكرار والمقالات بلا مصادر
// ============================================================================

export function detectDuplicateArticles(): DuplicatePair[] {
  const articles = listArticles({ status: 'all', limit: 500 });
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const a = articles[i];
      const b = articles[j];

      if (a.contentHash === b.contentHash) {
        duplicates.push({
          articleA: a,
          articleB: b,
          similarity: 1.0,
          reason: 'تطابق تام في بصمة المحتوى (Content Hash)',
        });
        continue;
      }

      if (a.titleNormalized === b.titleNormalized) {
        duplicates.push({
          articleA: a,
          articleB: b,
          similarity: 0.95,
          reason: 'تطابق في العنوان المطبّع',
        });
        continue;
      }

      const sim = computeTextSimilarity(a.content, b.content);
      if (sim >= 0.45) {
        duplicates.push({
          articleA: a,
          articleB: b,
          similarity: sim,
          reason: `تشابه نصي عالٍ (${Math.round(sim * 100)}%) في العبارات المكونة للمقال`,
        });
      }
    }
  }

  return duplicates.sort((x, y) => y.similarity - x.similarity);
}

export function getArticlesMissingSources(): Article[] {
  const articles = listArticles({ status: 'all', limit: 500 });
  return articles.filter(
    (a) =>
      !a.sourceUrl ||
      a.sourceUrl.trim() === '' ||
      !a.references ||
      a.references.length === 0
  );
}

// ============================================================================
// 7. إدارة مهام الاستيراد وسجل النظام والإحصاءات والنسخ الاحتياطي
// ============================================================================

export function createImportJob(input: {
  jobType: ImportJob['jobType'];
  targetUrlOrQuery: string;
  sourceId?: string | null;
}): ImportJob {
  const db = getDb();
  const id = `job-${crypto.randomBytes(5).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO import_jobs (
      id, job_type, target_url_or_query, source_id, status,
      extracted_title, publisher_name, created_article_id,
      error_message, error_reason_code, items_processed, items_succeeded, items_failed,
      started_at, completed_at
    ) VALUES (?, ?, ?, ?, 'running', '', '', NULL, '', '', 0, 0, 0, ?, NULL)
  `).run(id, input.jobType, input.targetUrlOrQuery, input.sourceId || null, now);

  return getImportJobById(id)!;
}

export function updateImportJob(
  id: string,
  updates: Partial<{
    status: ImportJob['status'];
    extractedTitle: string;
    publisherName: string;
    createdArticleId: string | null;
    errorMessage: string;
    errorReasonCode: string;
    itemsProcessed: number;
    itemsSucceeded: number;
    itemsFailed: number;
    completedAt: string | null;
  }>
): ImportJob | null {
  const db = getDb();
  const current = getImportJobById(id);
  if (!current) return null;

  const status = updates.status ?? current.status;
  const completedAt =
    updates.completedAt !== undefined
      ? updates.completedAt
      : ['completed', 'failed', 'stopped', 'duplicate_skipped'].includes(status)
      ? new Date().toISOString()
      : current.completedAt;

  db.prepare(`
    UPDATE import_jobs SET
      status = ?,
      extracted_title = ?,
      publisher_name = ?,
      created_article_id = ?,
      error_message = ?,
      error_reason_code = ?,
      items_processed = ?,
      items_succeeded = ?,
      items_failed = ?,
      completed_at = ?
    WHERE id = ?
  `).run(
    status,
    updates.extractedTitle ?? current.extractedTitle,
    updates.publisherName ?? current.publisherName,
    updates.createdArticleId !== undefined ? updates.createdArticleId : current.createdArticleId,
    sanitizeLogText(updates.errorMessage ?? current.errorMessage),
    updates.errorReasonCode ?? current.errorReasonCode,
    updates.itemsProcessed ?? current.itemsProcessed,
    updates.itemsSucceeded ?? current.itemsSucceeded,
    updates.itemsFailed ?? current.itemsFailed,
    completedAt,
    id
  );

  return getImportJobById(id);
}

export function getImportJobById(id: string): ImportJob | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!r) return null;
  return {
    id: String(r.id),
    jobType: String(r.job_type) as ImportJob['jobType'],
    targetUrlOrQuery: String(r.target_url_or_query),
    sourceId: r.source_id ? String(r.source_id) : null,
    status: String(r.status) as ImportJob['status'],
    extractedTitle: String(r.extracted_title || ''),
    publisherName: String(r.publisher_name || ''),
    createdArticleId: r.created_article_id ? String(r.created_article_id) : null,
    errorMessage: String(r.error_message || ''),
    errorReasonCode: String(r.error_reason_code || ''),
    itemsProcessed: Number(r.items_processed || 0),
    itemsSucceeded: Number(r.items_succeeded || 0),
    itemsFailed: Number(r.items_failed || 0),
    startedAt: String(r.started_at),
    completedAt: r.completed_at ? String(r.completed_at) : null,
  };
}

export function listImportJobs(limit = 50): ImportJob[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM import_jobs ORDER BY started_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    jobType: String(r.job_type) as ImportJob['jobType'],
    targetUrlOrQuery: String(r.target_url_or_query),
    sourceId: r.source_id ? String(r.source_id) : null,
    status: String(r.status) as ImportJob['status'],
    extractedTitle: String(r.extracted_title || ''),
    publisherName: String(r.publisher_name || ''),
    createdArticleId: r.created_article_id ? String(r.created_article_id) : null,
    errorMessage: String(r.error_message || ''),
    errorReasonCode: String(r.error_reason_code || ''),
    itemsProcessed: Number(r.items_processed || 0),
    itemsSucceeded: Number(r.items_succeeded || 0),
    itemsFailed: Number(r.items_failed || 0),
    startedAt: String(r.started_at),
    completedAt: r.completed_at ? String(r.completed_at) : null,
  }));
}

export function stopAllRunningImportJobs(): number {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare(
      "UPDATE import_jobs SET status = 'stopped', error_message = 'تم إيقاف المهمة يدوياً من لوحة الإدارة', completed_at = ? WHERE status IN ('pending', 'running')"
    )
    .run(now);
  addSystemLog('warning', 'importer', `تم إيقاف مهام الاستيراد الجارية (${res.changes} مهام)`, '');
  return Number(res.changes);
}

export function addSystemLog(
  level: SystemLog['level'],
  module: string,
  message: string,
  details = ''
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO system_logs (id, level, module, message, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `log-${crypto.randomBytes(5).toString('hex')}`,
    level,
    module,
    sanitizeLogText(message),
    sanitizeLogText(details),
    new Date().toISOString()
  );
}

export function listSystemLogs(limit = 60): SystemLog[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    level: String(r.level) as SystemLog['level'],
    module: String(r.module),
    message: String(r.message),
    details: String(r.details || ''),
    createdAt: String(r.created_at),
  }));
}

export function getDashboardStats() {
  const db = getDb();
  const totalArticles = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number }).c;
  const publishedArticles = (
    db.prepare("SELECT COUNT(*) as c FROM articles WHERE status IN ('published', 'verified')").get() as { c: number }
  ).c;
  const underReviewArticles = (
    db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'under_review'").get() as { c: number }
  ).c;
  const needsUpdateArticles = (
    db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'needs_update'").get() as { c: number }
  ).c;
  const totalSources = (db.prepare('SELECT COUNT(*) as c FROM sources').get() as { c: number }).c;
  const totalCategories = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  const lastUpdatedRow = db
    .prepare('SELECT MAX(updated_at) as last_up FROM articles')
    .get() as { last_up: string | null };

  const duplicates = detectDuplicateArticles();
  const missingSources = getArticlesMissingSources();

  return {
    totalArticles,
    publishedArticles,
    underReviewArticles,
    needsUpdateArticles,
    totalSources,
    totalCategories,
    duplicatesCount: duplicates.length,
    missingSourcesCount: missingSources.length,
    lastUpdatedAt: lastUpdatedRow?.last_up || new Date().toISOString(),
  };
}

export function exportDatabaseBackup() {
  return {
    exportedAt: new Date().toISOString(),
    project: 'الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI',
    version: '1.0.0',
    categories: getCategories(),
    volumes: getVolumes(),
    sources: getSources(),
    articles: listArticles({ status: 'all', limit: 2000 }),
    importJobs: listImportJobs(100),
    systemLogs: listSystemLogs(100),
  };
}
