-- ==============================================================================
-- الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI
-- مخطط قاعدة بيانات PostgreSQL المتوافق مع Supabase / Neon / Render
-- ==============================================================================

-- 1. جدول التصنيفات
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'BookOpen',
  sort_order INTEGER NOT NULL DEFAULT 1,
  subcategories JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 2. جدول المجلدات الرسمية
CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  volume_number INTEGER UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  letter_range TEXT NOT NULL,
  category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_theme TEXT NOT NULL DEFAULT 'red'
);

-- 3. جدول المصادر التاريخية المعتمدة
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
  last_checked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول المقالات الموثقة
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  summary_normalized TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  content_normalized TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  subcategory TEXT NOT NULL DEFAULT '',
  volume_id TEXT REFERENCES volumes(id),
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords_normalized TEXT NOT NULL DEFAULT '',
  author_or_publisher TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  source_url TEXT NOT NULL DEFAULT '',
  references_list JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ NOT NULL,
  last_verified_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  fact_classification TEXT NOT NULL DEFAULT 'confirmed_fact',
  license_info TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_pg_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_pg_articles_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_pg_articles_slug ON articles(slug);

-- 5. جدول سجل مراجعات وتعديلات المقالات
CREATE TABLE IF NOT EXISTS article_revisions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  editor_name TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  snapshot_title TEXT NOT NULL,
  snapshot_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول مهام الاستيراد
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  target_url_or_query TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  status TEXT NOT NULL,
  extracted_title TEXT NOT NULL DEFAULT '',
  publisher_name TEXT NOT NULL DEFAULT '',
  created_article_id TEXT,
  error_message TEXT NOT NULL DEFAULT '',
  error_reason_code TEXT NOT NULL DEFAULT '',
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_succeeded INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 7. جدول حسابات الإدارة والصلاحيات (RBAC: owner vs admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. جدول سجلات النظام والأمان
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
