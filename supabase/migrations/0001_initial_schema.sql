-- ==============================================================================
-- الموسوعة العُمانية الرقمية الذكية — Omani Digital Encyclopedia AI
-- مخطط قاعدة البيانات لـ PostgreSQL / Supabase مع دعم البحث النصي الكامل بالعربية
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. جدول التصنيفات (Categories)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'BookOpen',
    sort_order INTEGER NOT NULL DEFAULT 1,
    subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول المجلدات الموسوعية (Volumes)
CREATE TABLE IF NOT EXISTS volumes (
    id TEXT PRIMARY KEY,
    volume_number INTEGER UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    description TEXT NOT NULL,
    letter_range TEXT NOT NULL,
    category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    cover_theme TEXT NOT NULL DEFAULT 'red',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول المصادر المعتمدة (Sources)
CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    domain TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('official_omani', 'cultural_omani', 'academic_omani', 'international', 'historical_archive')),
    publisher TEXT NOT NULL,
    trust_level TEXT NOT NULL CHECK (trust_level IN ('high', 'medium', 'review_required')),
    license_info TEXT NOT NULL,
    allowed_scraping BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unreachable', 'paused')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول المقالات الموسوعية (Articles)
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_normalized TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    summary_normalized TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    content_normalized TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory TEXT NOT NULL DEFAULT '',
    volume_id TEXT REFERENCES volumes(id) ON DELETE SET NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    keywords_normalized TEXT NOT NULL DEFAULT '',
    author_or_publisher TEXT NOT NULL,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    source_url TEXT NOT NULL DEFAULT '',
    references_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_at TEXT,
    last_verified_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'verified', 'published', 'needs_update')),
    fact_classification TEXT NOT NULL DEFAULT 'confirmed_fact' CHECK (fact_classification IN ('confirmed_fact', 'historical_narrative', 'disputed_narrative')),
    license_info TEXT NOT NULL DEFAULT 'محتوى موسوعي أصلي موثق بالمصادر الرسمية مع حفظ حقوق الجهات الناشرة',
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    content_hash TEXT NOT NULL,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title_normalized, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(keywords_normalized, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(summary_normalized, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(content_normalized, '')), 'C')
    ) STORED
);

CREATE INDEX IF NOT EXISTS idx_articles_search_vector ON articles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING GIN (title_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_content_trgm ON articles USING GIN (content_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);

-- 5. جدول سجل التعديلات والمراجعات (Article Revisions)
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

-- 6. جدول مهام الاستيراد والجلب (Import Jobs)
CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL CHECK (job_type IN ('url_fetch', 'topic_discovery', 'batch_refresh', 'manual_file')),
    target_urlOrQuery TEXT NOT NULL,
    source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped', 'duplicate_skipped')),
    extracted_title TEXT DEFAULT '',
    publisher_name TEXT DEFAULT '',
    created_article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    error_message TEXT DEFAULT '',
    error_reason_code TEXT DEFAULT '',
    items_processed INTEGER NOT NULL DEFAULT 0,
    items_succeeded INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 7. جدول مديري النظام (Admin Users) - لا يحتوي على كلمات مرور افتراضية ثابتة
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. جدول سجل النظام والأخطاء (System & Error Logs - خالٍ من الأسرار)
CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'security')),
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
