import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { getDb, addSystemLog } from './db';
import { AdminPermissions, AdminUserPublic, UserRole } from './types';

const COOKIE_NAME = 'omani_enc_admin_session';
const DATA_DIR = path.join(process.cwd(), 'data');
const SECRET_FILE = path.join(DATA_DIR, '.secret_key');
const OWNER_SETUP_TOKEN_FILE = path.join(DATA_DIR, '.owner_setup_token');

/**
 * الحصول على مفتاح التوقيع والتشفير الخادمي (Server-side Secret Key)
 */
export function getServerSecretKey(): Buffer {
  if (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 16) {
    return crypto.createHash('sha256').update(process.env.ADMIN_SESSION_SECRET).digest();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(SECRET_FILE)) {
    const hex = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (hex.length === 64) {
      return Buffer.from(hex, 'hex');
    }
  }

  const randomKey = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_FILE, randomKey.toString('hex'), { mode: 0o600 });
  return randomKey;
}

/**
 * الحصول على رمز الإعداد الأولي السري للمالك (Owner Setup Secret) في حال عدم وجود مالك بعد.
 * يُقرأ من متغير البيئة OWNER_SETUP_SECRET، وإلا يُولّد رمز سري محلي في data/.owner_setup_token
 * ولا يُكشف أبداً للزوار عبر واجهات الويب العامة.
 */
export function getOwnerSetupSecret(): string {
  if (process.env.OWNER_SETUP_SECRET && process.env.OWNER_SETUP_SECRET.trim().length >= 8) {
    return process.env.OWNER_SETUP_SECRET.trim();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(OWNER_SETUP_TOKEN_FILE)) {
    const existing = fs.readFileSync(OWNER_SETUP_TOKEN_FILE, 'utf8').trim();
    if (existing.length >= 12) {
      return existing;
    }
  }

  const generated = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(OWNER_SETUP_TOKEN_FILE, generated, { mode: 0o600 });
  return generated;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function parsePermissions(raw: unknown, role: UserRole): AdminPermissions {
  if (role === 'owner') {
    return {
      canPublishArticles: true,
      canDeleteContent: true,
      canManageCategories: true,
      canAccessBackups: true,
    };
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    return {
      canPublishArticles: Boolean(parsed.canPublishArticles),
      canDeleteContent: Boolean(parsed.canDeleteContent),
      canManageCategories: Boolean(parsed.canManageCategories),
      canAccessBackups: Boolean(parsed.canAccessBackups),
    };
  } catch {
    return {
      canPublishArticles: false,
      canDeleteContent: false,
      canManageCategories: false,
      canAccessBackups: false,
    };
  }
}

export function mapAdminRowToPublic(row: Record<string, unknown>): AdminUserPublic {
  const rawRole = String(row.role || 'admin');
  const role: UserRole = rawRole === 'owner' || rawRole === 'super_admin' ? 'owner' : 'admin';
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role,
    isActive: row.is_active === undefined ? true : Boolean(Number(row.is_active)),
    mustChangePassword:
      role === 'owner'
        ? false
        : row.must_change_password === undefined
        ? false
        : Boolean(Number(row.must_change_password)),
    permissions: parsePermissions(row.permissions, role),
    createdBy: row.created_by ? String(row.created_by) : null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    createdAt: String(row.created_at),
  };
}

/**
 * التحقق مما إذا كان حساب المالك (Owner) موجوداً في قاعدة البيانات
 */
export function isFirstAdminInitialized(): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM admin_users WHERE role IN ('owner', 'super_admin')")
    .get() as { cnt: number };
  return row.cnt > 0;
}

/**
 * إعداد حساب المالك الأول (Owner) عند عدم وجود مالك في قاعدة البيانات.
 * يتطلب رمز الإعداد السري الخاص بصاحب المشروع (setupSecret) لمنع إنشاء حساب مالك من صفحة عامة.
 */
export function setupFirstAdmin(input: {
  username: string;
  displayName: string;
  password: string;
  setupSecret?: string;
}): { ok: boolean; error?: string; user?: AdminUserPublic } {
  if (isFirstAdminInitialized()) {
    return {
      ok: false,
      error: 'حساب المالك مُعدّ مسبقاً. لا يُسمح بإنشاء حساب مالك جديد.',
    };
  }

  const expectedSecret = getOwnerSetupSecret();
  const providedSecret = String(input.setupSecret || '').trim();
  const secretBufA = Buffer.from(providedSecret);
  const secretBufB = Buffer.from(expectedSecret);

  if (
    !providedSecret ||
    secretBufA.length !== secretBufB.length ||
    !crypto.timingSafeEqual(secretBufA, secretBufB)
  ) {
    addSystemLog('security', 'auth', 'رفض محاولة إعداد حساب المالك الأول بسبب رمز إعداد سري غير صحيح', '');
    return {
      ok: false,
      error:
        'رمز الإعداد السري للمالك غير صحيح. يرجى إدخال الرمز السري المحدد في متغير OWNER_SETUP_SECRET أو ملف data/.owner_setup_token على الخادم.',
    };
  }

  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim() || 'مالك الموسوعة';
  const password = input.password;

  if (username.length < 3) {
    return { ok: false, error: 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'يجب أن تتكون كلمة المرور من 8 أحرف أو رموز على الأقل لضمان الأمان.' };
  }

  const { hash, salt } = hashPassword(password);
  const id = `own-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  const db = getDb();
  db.prepare(`
    INSERT INTO admin_users (
      id, username, display_name, password_hash, password_salt, role,
      is_active, must_change_password, permissions, created_by, last_login_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'owner', 1, 0, ?, 'system', ?, ?)
  `).run(
    id,
    username,
    displayName,
    hash,
    salt,
    JSON.stringify({
      canPublishArticles: true,
      canDeleteContent: true,
      canManageCategories: true,
      canAccessBackups: true,
    }),
    now,
    now
  );

  addSystemLog('security', 'auth', `تم إعداد حساب المالك الرئيسي للنظام بنجاح (${username})`, '');
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as Record<string, unknown>;
  return { ok: true, user: mapAdminRowToPublic(row) };
}

/**
 * التحقق من بيانات تسجيل الدخول للمالك (Owner) أو المسؤول (Admin)
 */
export function verifyAdminCredentials(
  usernameInput: string,
  passwordInput: string
): { ok: boolean; error?: string; user?: AdminUserPublic } {
  const db = getDb();
  const username = usernameInput.trim().toLowerCase();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE username = ? LIMIT 1')
    .get(username) as Record<string, unknown> | undefined;

  if (!row) {
    addSystemLog('security', 'auth', `محاولة تسجيل دخول فاشلة لاسم مستخدم غير مسجل: ${username}`, '');
    return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
  }

  const isActive = row.is_active === undefined ? true : Boolean(Number(row.is_active));
  if (!isActive) {
    addSystemLog('security', 'auth', `محاولة تسجيل دخول لحساب مسؤول معطّل: ${username}`, '');
    return { ok: false, error: 'هذا الحساب معطّل حالياً من قِبل المالك. يرجى التواصل مع مالك الموقع.' };
  }

  const { hash } = hashPassword(passwordInput, String(row.password_salt));
  const storedHash = String(row.password_hash);

  const isMatch =
    hash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));

  if (!isMatch) {
    addSystemLog('security', 'auth', `محاولة تسجيل دخول بكلمة مرور خاطئة للمستخدم: ${username}`, '');
    return { ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(now, String(row.id));

  const updatedRow = db
    .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
    .get(String(row.id)) as Record<string, unknown>;
  const user = mapAdminRowToPublic(updatedRow);

  addSystemLog(
    'security',
    'auth',
    `تسجيل دخول ناجح (${user.role === 'owner' ? 'المالك' : 'مسؤول'}): ${user.username}`,
    ''
  );

  return { ok: true, user };
}

export function createSessionToken(user: {
  id: string;
  username: string;
  displayName: string;
  role?: UserRole;
}): string {
  const payload = {
    sub: user.id,
    usr: user.username,
    nam: user.displayName,
    rol: user.role || 'admin',
    exp: Date.now() + 1000 * 60 * 60 * 12, // صالح لمدة 12 ساعة
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getServerSecretKey())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

/**
 * التحقق من صلاحية رمز الجلسة ومطابقته الحية مع قاعدة البيانات
 * (لضمان تطبيق تعطيل الحساب أو تغيير الصلاحيات أو إلزام تغيير كلمة المرور فوراً على الخادم)
 */
export function verifySessionToken(token?: string | null): AdminUserPublic | null {
  if (!token || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getServerSecretKey())
    .update(payloadB64)
    .digest('base64url');

  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > Number(payload.exp)) {
      return null;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
      .get(String(payload.sub)) as Record<string, unknown> | undefined;

    if (!row) return null;

    const user = mapAdminRowToPublic(row);
    if (!user.isActive) return null;

    return user;
  } catch {
    return null;
  }
}

export function getAuthenticatedAdmin(): AdminUserPublic | null {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

// ============================================================================
// إدارة حسابات المسؤولين وحساب المالك (تُنفَّذ حصرياً مع التحقق الخادمي الصارم)
// ============================================================================

/**
 * قائمة جميع الحسابات الإدارية (متاحة للمالك فقط)
 */
export function listAdminUsersForOwner(actor: AdminUserPublic): {
  ok: boolean;
  error?: string;
  users?: AdminUserPublic[];
} {
  if (!actor || actor.role !== 'owner') {
    return { ok: false, error: 'غير مصرح: هذه العملية مخصصة لمالك الموقع (Owner) فقط.' };
  }

  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM admin_users ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at ASC")
    .all() as Array<Record<string, unknown>>;

  return {
    ok: true,
    users: rows.map(mapAdminRowToPublic),
  };
}

/**
 * إنشاء حساب مسؤول جديد (Admin) بواسطة المالك حصرياً
 * مع فرض تغيير كلمة المرور الأولية عند أول تسجيل دخول (must_change_password = 1)
 */
export function createAdminUserByOwner(
  actor: AdminUserPublic,
  input: {
    username: string;
    displayName: string;
    initialPassword: string;
    permissions?: AdminPermissions;
  }
): { ok: boolean; error?: string; user?: AdminUserPublic } {
  if (!actor || actor.role !== 'owner') {
    addSystemLog('security', 'auth', `محاولة غير مصرح بها لإنشاء حساب مسؤول من قِبل: ${actor?.username || 'مجهول'}`, '');
    return { ok: false, error: 'غير مصرح: المالك (Owner) وحده يستطيع إنشاء حسابات المسؤولين.' };
  }

  const username = String(input.username || '').trim().toLowerCase();
  const displayName = String(input.displayName || '').trim() || username;
  const initialPassword = String(input.initialPassword || '');

  if (username.length < 3 || !/^[a-z0-9_.-]+$/.test(username)) {
    return {
      ok: false,
      error: 'يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل (أحرف إنجليزية أو أرقام أو _).',
    };
  }

  if (initialPassword.length < 8) {
    return {
      ok: false,
      error: 'يجب أن تتكون كلمة المرور الأولية من 8 أحرف أو أرقام على الأقل.',
    };
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (existing) {
    return { ok: false, error: 'اسم المستخدم هذا مستخدم بالفعل. يرجى اختيار اسم مستخدم آخر.' };
  }

  const { hash, salt } = hashPassword(initialPassword);
  const id = `adm-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  const permissions: AdminPermissions = {
    canPublishArticles: Boolean(input.permissions?.canPublishArticles),
    canDeleteContent: Boolean(input.permissions?.canDeleteContent),
    canManageCategories: Boolean(input.permissions?.canManageCategories),
    canAccessBackups: Boolean(input.permissions?.canAccessBackups),
  };

  // يُحظر تماماً إنشاء حساب بدور owner من هنا؛ الدور دائماً 'admin'
  db.prepare(`
    INSERT INTO admin_users (
      id, username, display_name, password_hash, password_salt, role,
      is_active, must_change_password, permissions, created_by, last_login_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'admin', 1, 1, ?, ?, NULL, ?)
  `).run(id, username, displayName, hash, salt, JSON.stringify(permissions), actor.username, now);

  addSystemLog(
    'security',
    'auth',
    `قام المالك (${actor.username}) بإنشاء حساب مسؤول جديد: ${username}`,
    `إلزام تغيير كلمة المرور الأولية عند أول دخول`
  );

  const createdRow = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as Record<string, unknown>;
  return { ok: true, user: mapAdminRowToPublic(createdRow) };
}

/**
 * تعديل بيانات حساب مسؤول أو إعادة تعيين كلمة مروره أو تعطيله/تفعيله (بواسطة المالك حصرياً)
 */
export function updateAdminUserByOwner(
  actor: AdminUserPublic,
  input: {
    targetUserId: string;
    username?: string;
    displayName?: string;
    resetPassword?: string;
    isActive?: boolean;
    permissions?: AdminPermissions;
  }
): { ok: boolean; error?: string; user?: AdminUserPublic } {
  if (!actor || actor.role !== 'owner') {
    addSystemLog('security', 'auth', `محاولة غير مصرح بها لتعديل حساب إداري من قِبل: ${actor?.username || 'مجهول'}`, '');
    return { ok: false, error: 'غير مصرح: المالك (Owner) وحده يستطيع تعديل حسابات المسؤولين.' };
  }

  const db = getDb();
  const targetRow = db
    .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
    .get(String(input.targetUserId || '')) as Record<string, unknown> | undefined;

  if (!targetRow) {
    return { ok: false, error: 'الحساب المطلوب غير موجود.' };
  }

  const targetUser = mapAdminRowToPublic(targetRow);
  if (targetUser.role === 'owner') {
    return {
      ok: false,
      error: 'لا يمكن تعطيل حساب المالك أو تعديله من نافذة المسؤولين. استخدم قسم إعدادات حساب المالك.',
    };
  }

  let newUsername = targetUser.username;
  if (input.username !== undefined && input.username.trim() !== '') {
    const candidate = input.username.trim().toLowerCase();
    if (candidate.length < 3 || !/^[a-z0-9_.-]+$/.test(candidate)) {
      return { ok: false, error: 'اسم المستخدم الجديد غير صالح (3 أحرف على الأقل).' };
    }
    if (candidate !== targetUser.username) {
      const collision = db
        .prepare('SELECT id FROM admin_users WHERE username = ? AND id != ?')
        .get(candidate, targetUser.id);
      if (collision) {
        return { ok: false, error: 'اسم المستخدم الجديد مستخدم بالفعل لحساب آخر.' };
      }
      newUsername = candidate;
    }
  }

  const newDisplayName =
    input.displayName !== undefined && input.displayName.trim() !== ''
      ? input.displayName.trim()
      : targetUser.displayName;

  const newIsActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : targetUser.isActive ? 1 : 0;

  const newPermissions: AdminPermissions =
    input.permissions !== undefined
      ? {
          canPublishArticles: Boolean(input.permissions.canPublishArticles),
          canDeleteContent: Boolean(input.permissions.canDeleteContent),
          canManageCategories: Boolean(input.permissions.canManageCategories),
          canAccessBackups: Boolean(input.permissions.canAccessBackups),
        }
      : targetUser.permissions;

  if (input.resetPassword && input.resetPassword.trim().length > 0) {
    if (input.resetPassword.length < 8) {
      return { ok: false, error: 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.' };
    }
    const { hash, salt } = hashPassword(input.resetPassword);
    db.prepare(`
      UPDATE admin_users
      SET username = ?, display_name = ?, password_hash = ?, password_salt = ?,
          is_active = ?, must_change_password = 1, permissions = ?, role = 'admin'
      WHERE id = ? AND role != 'owner'
    `).run(
      newUsername,
      newDisplayName,
      hash,
      salt,
      newIsActive,
      JSON.stringify(newPermissions),
      targetUser.id
    );
    addSystemLog(
      'security',
      'auth',
      `قام المالك (${actor.username}) بإعادة تعيين كلمة المرور وتحديث حساب المسؤول: ${newUsername}`,
      'سيُطلب من المسؤول تغيير كلمة المرور عند الدخول القادم'
    );
  } else {
    db.prepare(`
      UPDATE admin_users
      SET username = ?, display_name = ?, is_active = ?, permissions = ?, role = 'admin'
      WHERE id = ? AND role != 'owner'
    `).run(
      newUsername,
      newDisplayName,
      newIsActive,
      JSON.stringify(newPermissions),
      targetUser.id
    );
    addSystemLog(
      'security',
      'auth',
      `قام المالك (${actor.username}) بتحديث بيانات/حالة المسؤول: ${newUsername} (نشط=${Boolean(newIsActive)})`,
      ''
    );
  }

  const updated = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(targetUser.id) as Record<
    string,
    unknown
  >;
  return { ok: true, user: mapAdminRowToPublic(updated) };
}

/**
 * حذف حساب مسؤول نهائياً (بواسطة المالك حصرياً، مع منع حذف المالك)
 */
export function deleteAdminUserByOwner(
  actor: AdminUserPublic,
  targetUserId: string
): { ok: boolean; error?: string } {
  if (!actor || actor.role !== 'owner') {
    addSystemLog('security', 'auth', `محاولة غير مصرح بها لحذف حساب إداري من قِبل: ${actor?.username || 'مجهول'}`, '');
    return { ok: false, error: 'غير مصرح: المالك (Owner) وحده يستطيع حذف حسابات المسؤولين.' };
  }

  const db = getDb();
  const targetRow = db
    .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
    .get(String(targetUserId || '')) as Record<string, unknown> | undefined;

  if (!targetRow) {
    return { ok: false, error: 'الحساب المطلوب غير موجود.' };
  }

  const targetUser = mapAdminRowToPublic(targetRow);
  if (targetUser.role === 'owner' || targetUser.id === actor.id) {
    return { ok: false, error: 'لا يمكن حذف حساب المالك الرئيسي للنظام.' };
  }

  db.prepare("DELETE FROM admin_users WHERE id = ? AND role != 'owner'").run(targetUser.id);
  addSystemLog(
    'security',
    'auth',
    `قام المالك (${actor.username}) بحذف حساب المسؤول: ${targetUser.username}`,
    ''
  );
  return { ok: true };
}

/**
 * تحديث بيانات حساب المالك نفسه (اسم المستخدم، الاسم الظاهر، أو كلمة المرور) بشرط التحقق من كلمة المرور الحالية
 */
export function updateOwnerOwnAccount(
  actor: AdminUserPublic,
  input: {
    currentPassword: string;
    newUsername?: string;
    newDisplayName?: string;
    newPassword?: string;
  }
): { ok: boolean; error?: string; user?: AdminUserPublic } {
  if (!actor || actor.role !== 'owner') {
    return { ok: false, error: 'غير مصرح: هذا الإجراء مخصص لحساب المالك فقط.' };
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
    .get(actor.id) as Record<string, unknown> | undefined;

  if (!row) {
    return { ok: false, error: 'حساب المالك غير موجود.' };
  }

  const { hash: currentHash } = hashPassword(String(input.currentPassword || ''), String(row.password_salt));
  const storedHash = String(row.password_hash);
  const isMatch =
    currentHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(currentHash, 'hex'), Buffer.from(storedHash, 'hex'));

  if (!isMatch) {
    addSystemLog('security', 'auth', `فشل تحديث بيانات المالك بسبب كلمة مرور حالية غير صحيحة (${actor.username})`, '');
    return { ok: false, error: 'كلمة المرور الحالية غير صحيحة.' };
  }

  let nextUsername = actor.username;
  if (input.newUsername && input.newUsername.trim() !== '') {
    const candidate = input.newUsername.trim().toLowerCase();
    if (candidate.length < 3 || !/^[a-z0-9_.-]+$/.test(candidate)) {
      return { ok: false, error: 'يجب أن يتكون اسم المستخدم الجديد من 3 أحرف على الأقل.' };
    }
    if (candidate !== actor.username) {
      const collision = db
        .prepare('SELECT id FROM admin_users WHERE username = ? AND id != ?')
        .get(candidate, actor.id);
      if (collision) {
        return { ok: false, error: 'اسم المستخدم هذا مستخدم بالفعل.' };
      }
      nextUsername = candidate;
    }
  }

  const nextDisplayName =
    input.newDisplayName && input.newDisplayName.trim() !== ''
      ? input.newDisplayName.trim()
      : actor.displayName;

  if (input.newPassword && input.newPassword.trim().length > 0) {
    if (input.newPassword.length < 8) {
      return { ok: false, error: 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.' };
    }
    const { hash, salt } = hashPassword(input.newPassword);
    db.prepare(`
      UPDATE admin_users
      SET username = ?, display_name = ?, password_hash = ?, password_salt = ?, must_change_password = 0
      WHERE id = ?
    `).run(nextUsername, nextDisplayName, hash, salt, actor.id);
  } else {
    db.prepare(`
      UPDATE admin_users
      SET username = ?, display_name = ?
      WHERE id = ?
    `).run(nextUsername, nextDisplayName, actor.id);
  }

  addSystemLog('security', 'auth', `قام المالك بتحديث بيانات حسابه الشخصي (${nextUsername})`, '');
  const updatedRow = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(actor.id) as Record<
    string,
    unknown
  >;
  return { ok: true, user: mapAdminRowToPublic(updatedRow) };
}

/**
 * تغيير كلمة المرور الخاصة بالمستخدم المسجل دخوله (ضروري للمسؤول عند أول تسجيل دخول لإلغاء must_change_password)
 * لا يسمح أبداً بتغيير الدور (role) أو الصلاحيات (permissions).
 */
export function changeOwnPassword(
  actor: AdminUserPublic,
  input: {
    currentPassword: string;
    newPassword: string;
  }
): { ok: boolean; error?: string; user?: AdminUserPublic } {
  if (!actor) {
    return { ok: false, error: 'يلزم تسجيل الدخول أولاً.' };
  }

  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');

  if (newPassword.length < 8) {
    return { ok: false, error: 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف أو أرقام على الأقل.' };
  }

  if (currentPassword === newPassword) {
    return { ok: false, error: 'يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الأولية/الحالية.' };
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM admin_users WHERE id = ? LIMIT 1')
    .get(actor.id) as Record<string, unknown> | undefined;

  if (!row) {
    return { ok: false, error: 'الحساب غير موجود.' };
  }

  const { hash: currentHash } = hashPassword(currentPassword, String(row.password_salt));
  const storedHash = String(row.password_hash);
  const isMatch =
    currentHash.length === storedHash.length &&
    crypto.timingSafeEqual(Buffer.from(currentHash, 'hex'), Buffer.from(storedHash, 'hex'));

  if (!isMatch) {
    return { ok: false, error: 'كلمة المرور الحالية غير صحيحة.' };
  }

  const { hash: newHash, salt: newSalt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE admin_users
    SET password_hash = ?, password_salt = ?, must_change_password = 0
    WHERE id = ?
  `).run(newHash, newSalt, actor.id);

  addSystemLog(
    'security',
    'auth',
    `قام المستخدم (${actor.username}) بتغيير كلمة المرور الخاصة به بنجاح`,
    ''
  );

  const updatedRow = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(actor.id) as Record<
    string,
    unknown
  >;
  return { ok: true, user: mapAdminRowToPublic(updatedRow) };
}

export { COOKIE_NAME };
