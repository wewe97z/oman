import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * سكريبت تصدير جميع بيانات الموسوعة من SQLite إلى أوامر SQL متوافقة مع PostgreSQL / Supabase
 */
const DB_PATH = path.join(process.cwd(), 'data', 'encyclopedia.db');
const OUT_PATH = path.join(process.cwd(), 'scripts', 'seed-postgres-data.sql');

if (!fs.existsSync(DB_PATH)) {
  console.error('قاعدة البيانات المحلية غير موجودة:', DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
const lines: string[] = [
  '-- ==============================================================================',
  '-- بذر بيانات الموسوعة العُمانية الرقمية لـ PostgreSQL / Supabase',
  '-- ==============================================================================',
  'BEGIN;',
];

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

// 1. Categories
const categories = db.prepare('SELECT * FROM categories').all() as any[];
for (const c of categories) {
  lines.push(
    `INSERT INTO categories (id, slug, name, description, icon, sort_order, subcategories) ` +
    `VALUES (${escapeSql(c.id)}, ${escapeSql(c.slug)}, ${escapeSql(c.name)}, ${escapeSql(c.description)}, ${escapeSql(c.icon)}, ${c.sort_order}, ${escapeSql(c.subcategories)}::jsonb) ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
}

// 2. Volumes
const volumes = db.prepare('SELECT * FROM volumes').all() as any[];
for (const v of volumes) {
  lines.push(
    `INSERT INTO volumes (id, volume_number, slug, title, subtitle, description, letter_range, category_ids, cover_theme) ` +
    `VALUES (${escapeSql(v.id)}, ${v.volume_number}, ${escapeSql(v.slug)}, ${escapeSql(v.title)}, ${escapeSql(v.subtitle)}, ${escapeSql(v.description)}, ${escapeSql(v.letter_range)}, ${escapeSql(v.category_ids)}::jsonb, ${escapeSql(v.cover_theme)}) ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
}

// 3. Sources
const sources = db.prepare('SELECT * FROM sources').all() as any[];
for (const s of sources) {
  lines.push(
    `INSERT INTO sources (id, name, url, domain, source_type, publisher, trust_level, license_info, allowed_scraping, last_checked_at, status, notes, created_at) ` +
    `VALUES (${escapeSql(s.id)}, ${escapeSql(s.name)}, ${escapeSql(s.url)}, ${escapeSql(s.domain)}, ${escapeSql(s.source_type)}, ${escapeSql(s.publisher)}, ${escapeSql(s.trust_level)}, ${escapeSql(s.license_info)}, ${s.allowed_scraping}, ${escapeSql(s.last_checked_at)}, ${escapeSql(s.status)}, ${escapeSql(s.notes)}, ${escapeSql(s.created_at)}) ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
}

// 4. Articles
const articles = db.prepare('SELECT * FROM articles').all() as any[];
for (const a of articles) {
  lines.push(
    `INSERT INTO articles (id, slug, title, title_normalized, summary, summary_normalized, content, content_normalized, category_id, subcategory, volume_id, keywords, keywords_normalized, author_or_publisher, source_id, source_url, references_list, published_at, last_verified_at, status, fact_classification, license_info, images, content_hash, views_count, created_at, updated_at) ` +
    `VALUES (${escapeSql(a.id)}, ${escapeSql(a.slug)}, ${escapeSql(a.title)}, ${escapeSql(a.title_normalized)}, ${escapeSql(a.summary)}, ${escapeSql(a.summary_normalized)}, ${escapeSql(a.content)}, ${escapeSql(a.content_normalized)}, ${escapeSql(a.category_id)}, ${escapeSql(a.subcategory)}, ${escapeSql(a.volume_id)}, ${escapeSql(a.keywords)}::jsonb, ${escapeSql(a.keywords_normalized)}, ${escapeSql(a.author_or_publisher)}, ${escapeSql(a.source_id)}, ${escapeSql(a.source_url)}, ${escapeSql(a.references_list)}::jsonb, ${escapeSql(a.published_at)}, ${escapeSql(a.last_verified_at)}, ${escapeSql(a.status)}, ${escapeSql(a.fact_classification)}, ${escapeSql(a.license_info)}, ${escapeSql(a.images)}::jsonb, ${escapeSql(a.content_hash)}, ${a.views_count}, ${escapeSql(a.created_at)}, ${escapeSql(a.updated_at)}) ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
}

// 5. Admin users (Owner and existing admins)
const users = db.prepare('SELECT * FROM admin_users').all() as any[];
for (const u of users) {
  lines.push(
    `INSERT INTO admin_users (id, username, display_name, password_hash, password_salt, role, is_active, must_change_password, permissions, created_by, last_login_at, created_at) ` +
    `VALUES (${escapeSql(u.id)}, ${escapeSql(u.username)}, ${escapeSql(u.display_name)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.password_salt)}, ${escapeSql(u.role)}, ${u.is_active}, ${u.must_change_password}, ${escapeSql(u.permissions)}::jsonb, ${escapeSql(u.created_by)}, ${escapeSql(u.last_login_at)}, ${escapeSql(u.created_at)}) ` +
    `ON CONFLICT (id) DO NOTHING;`
  );
}

lines.push('COMMIT;');

fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
console.log(`تم بنجاح تصدير البيانات إلى: ${OUT_PATH}`);
console.log(`- الفئات: ${categories.length} | المجلدات: ${volumes.length} | المصادر: ${sources.length} | المقالات: ${articles.length} | المستخدمين: ${users.length}`);
