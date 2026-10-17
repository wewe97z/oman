import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArabic,
  tokenizeArabicQuery,
  extractSearchSnippet,
  computeTextSimilarity,
  autoAnalyzeArabicArticle,
} from '../src/lib/arabic';
import {
  getCategories,
  getVolumes,
  getSources,
  searchArticles,
  sanitizeLogText,
  getDashboardStats,
} from '../src/lib/db';
import { extractCleanArticleFromHtml } from '../src/lib/importer';

test('1. تطبيع النص العربي (التشكيل، التطويل، صور الألف، التاء المربوطة، والأرقام الهندية)', () => {
  const raw = 'سَلْطَنَةُ عُمَانَ — الرُّؤْيَةُ ٢٠٤٠ والتَّارِيخُ العَرِيقُ';
  const normalized = normalizeArabic(raw);
  assert.equal(normalized, 'سلطنه عمان الرويه 2040 والتاريخ العريق');
});

test('2. استخراج المقتطفات وتمييز الكلمات العربية مع اختلاف الهمزات والتاء المربوطة', () => {
  const content =
    'تقع قلعة بهلا التاريخية في محافظة الداخلية بسلطنة عُمان وتُعد أول موقع عُماني في قائمة التراث العالمي.';
  const { snippet, matchedTerms } = extractSearchSnippet(content, 'قلعه بهلا', 150);
  assert.ok(snippet.includes('<mark class="search-highlight">قلعة</mark>'));
  assert.ok(snippet.includes('<mark class="search-highlight">بهلا</mark>'));
  assert.ok(matchedTerms.length >= 2);
});

test('3. اكتشاف التشابه النصي والمقالات المكررة (Jaccard Shingle Similarity)', () => {
  const textA = 'تأسست الدولة البوسعيدية في سلطنة عمان عام 1744م على يد الإمام أحمد بن سعيد البوسعيدي.';
  const textB = 'تاسست الدوله البوسعيديه في سلطنه عمان عام ١٧٤٤م علي يد الامام احمد بن سعيد البوسعيدي.';
  const sim = computeTextSimilarity(textA, textB);
  assert.equal(sim, 1);
});

test('4. التصنيف التلقائي للمقالات العُمانية واقتراح الكلمات المفتاحية والملخص', () => {
  const analysis = autoAnalyzeArabicArticle(
    'دراسة حول فلج دارس وفلج الخطمين في نزوى',
    'تعد الأفلاج العمانية من أقدم أنظمة الري في سلطنة عمان، ومن أشهرها فلج دارس وفلج الخطمين المدرجان في قائمة التراث العالمي لليونسكو.'
  );
  assert.equal(analysis.categoryId, 'cat-08-heritage-traditions');
  assert.ok(analysis.keywords.includes('فلج'));
  assert.ok(analysis.summary.length > 20);
});

test('5. التحقق من قاعدة البيانات والتصنيفات الـ 17 والمجلدات ومحرك البحث الفعلي', () => {
  const categories = getCategories();
  assert.ok(categories.length >= 17, 'يجب أن تتضمن الموسوعة 17 تصنيفاً على الأقل');

  const volumes = getVolumes();
  assert.equal(volumes.length, 6);

  const sources = getSources();
  assert.ok(sources.length >= 10);

  // البحث عن "احمد بن ماجد" بدون همزة
  const searchRes = searchArticles({ query: 'احمد بن ماجد', status: 'all_public' });
  assert.ok(searchRes.total >= 1);
  assert.ok(searchRes.hits[0].article.title.includes('أحمد بن ماجد'));

  const stats = getDashboardStats();
  assert.ok(stats.publishedArticles >= 15);
});

test('6. تنظيف HTML من القوائم والإعلانات وحجب مفاتيح API من السجلات', () => {
  const sampleHtml = `
    <html>
      <head>
        <title>قلعة نزوى التاريخية</title>
        <meta property="og:site_name" content="البوابة الإعلامية" />
      </head>
      <body>
        <nav>قائمة التنقل العلوية</nav>
        <div class="ads">إعلان تجاري</div>
        <article>
          <h1>قلعة نزوى التاريخية في محافظة الداخلية</h1>
          <p>تعد قلعة نزوى من أشهر القلاع التاريخية في سلطنة عمان وقد بناها الإمام سلطان بن سيف اليعربي في القرن السابع عشر الميلادي وتتميز ببرجها الدائري الضخم.</p>
        </article>
        <footer>جميع الحقوق محفوظة</footer>
      </body>
    </html>
  `;
  const extracted = extractCleanArticleFromHtml(sampleHtml, 'https://www.omaninfo.om/nizwa');
  assert.equal(extracted.title, 'قلعة نزوى التاريخية في محافظة الداخلية');
  assert.ok(!extracted.cleanedText.includes('قائمة التنقل العلوية'));
  assert.ok(extracted.cleanedText.includes('الإمام سلطان بن سيف اليعربي'));

  const logSample = 'Error calling API with key AIzaSyD1234567890abcdefghijklmnopqrstuv';
  const sanitized = sanitizeLogText(logSample);
  assert.ok(!sanitized.includes('AIzaSyD1234567890'));
  assert.ok(sanitized.includes('[REDACTED_GEMINI_KEY]'));
});

test('7. مطابقة الأسئلة المقترحة والهمزة المتطرفة (قلعة بهلاء <-> قلعة بهلا)', () => {
  const bahlaSearch = searchArticles({ query: 'ما قصة قلعة بهلاء؟', status: 'all_public' });
  assert.ok(bahlaSearch.total >= 1);
  assert.ok(bahlaSearch.hits[0].article.title.includes('قلعة بهلا'));

  const majanSearch = searchArticles({ query: 'كيف نشأت حضارة مجان؟', status: 'all_public' });
  assert.ok(majanSearch.total >= 1);
  assert.ok(majanSearch.hits[0].article.title.includes('حضارة مجان'));
});

test('8. التحقق من ملفات الشعار الرسمي وأيقونات المتصفح (Favicon & App Icons)', async () => {
  const fs = await import('node:fs');

  const pngFiles: Array<[string, number, number]> = [
    ['public/images/oman-encyclopedia-logo.png', 1024, 1024],
    ['public/images/oman-encyclopedia-mark.png', 512, 512],
    ['public/images/oman-encyclopedia-og.png', 1200, 630],
    ['public/images/favicon-16x16.png', 16, 16],
    ['public/images/favicon-32x32.png', 32, 32],
    ['public/images/favicon-48x48.png', 48, 48],
    ['public/images/apple-touch-icon.png', 180, 180],
    ['public/images/icon-192.png', 192, 192],
    ['public/images/icon-512.png', 512, 512],
    ['src/app/icon.png', 512, 512],
    ['src/app/apple-icon.png', 180, 180],
  ];

  for (const [relPath, expectedW, expectedH] of pngFiles) {
    assert.ok(fs.existsSync(relPath), `يجب وجود الملف: ${relPath}`);
    const buf = fs.readFileSync(relPath);
    assert.equal(buf[0], 137);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG');
    assert.equal(buf.readUInt32BE(16), expectedW, `عرض غير مطابق في ${relPath}`);
    assert.equal(buf.readUInt32BE(20), expectedH, `ارتفاع غير مطابق في ${relPath}`);
  }

  for (const icoPath of ['public/favicon.ico']) {
    assert.ok(fs.existsSync(icoPath), `يجب وجود ملف الأيقونة: ${icoPath}`);
    const icoBuf = fs.readFileSync(icoPath);
    assert.equal(icoBuf.readUInt16LE(0), 0);
    assert.equal(icoBuf.readUInt16LE(2), 1); // ICO type
    assert.equal(icoBuf.readUInt16LE(4), 3); // 3 sizes (16, 32, 48)
  }
});

test('9. نظام الصلاحيات الثنائي (Owner vs Admin): إنشاء مسؤول، تسجيل الدخول، تغيير كلمة المرور الأولية، ومنع تجاوز الصلاحيات', async () => {
  const auth = await import('../src/lib/auth');
  const dbModule = await import('../src/lib/db');
  const db = dbModule.getDb();

  const ownerRow = db.prepare("SELECT * FROM admin_users WHERE role = 'owner' LIMIT 1").get() as Record<string, unknown> | undefined;
  assert.ok(ownerRow, 'يجب وجود حساب المالك الرئيسي (Owner) في قاعدة البيانات');
  const ownerUser = auth.mapAdminRowToPublic(ownerRow);
  assert.equal(ownerUser.role, 'owner');
  assert.equal(ownerUser.isActive, true);

  const listRes = auth.listAdminUsersForOwner(ownerUser);
  assert.equal(listRes.ok, true);
  const usersBefore = listRes.users || [];

  const testUsername = `test_editor_${Date.now().toString(36)}`;
  const existingTest = usersBefore.find((u) => u.username === testUsername);
  if (existingTest) {
    auth.deleteAdminUserByOwner(ownerUser, existingTest.id);
  }

  // 1. المالك ينشئ حساب مسؤول جديد بكلمة مرور أولية
  const createRes = auth.createAdminUserByOwner(ownerUser, {
    username: testUsername,
    displayName: 'مسؤول اختبار التحرير',
    initialPassword: 'InitialPass#2026',
    permissions: {
      canPublishArticles: false,
      canDeleteContent: false,
      canManageCategories: false,
      canAccessBackups: false,
    },
  });
  assert.equal(createRes.ok, true);
  assert.ok(createRes.user);
  assert.equal(createRes.user.role, 'admin');
  assert.equal(createRes.user.mustChangePassword, true);

  const createdAdminUser = createRes.user;

  try {
    // 2. المسؤول يسجل الدخول بكلمة المرور الأولية ويظهر له إلزام تغيير كلمة المرور
    const firstLogin = auth.verifyAdminCredentials(testUsername, 'InitialPass#2026');
    assert.equal(firstLogin.ok, true);
    assert.ok(firstLogin.user);
    assert.equal(firstLogin.user.role, 'admin');
    assert.equal(firstLogin.user.mustChangePassword, true);

    const token = auth.createSessionToken(firstLogin.user);
    const sessionCheck = auth.verifySessionToken(token);
    assert.ok(sessionCheck);
    assert.equal(sessionCheck.mustChangePassword, true);

    // 3. لا يقبل النظام إعادة استخدام نفس كلمة المرور الأولية عند التغيير
    const samePwdAttempt = auth.changeOwnPassword(firstLogin.user, {
      currentPassword: 'InitialPass#2026',
      newPassword: 'InitialPass#2026',
    });
    assert.equal(samePwdAttempt.ok, false);

    // 4. المسؤول يغيّر كلمة المرور الأولية إلى كلمة مرور جديدة خاصة به
    const pwdChangeRes = auth.changeOwnPassword(firstLogin.user, {
      currentPassword: 'InitialPass#2026',
      newPassword: 'NewPersonalPass#2026',
    });
    assert.equal(pwdChangeRes.ok, true);
    assert.ok(pwdChangeRes.user);
    assert.equal(pwdChangeRes.user.mustChangePassword, false);

    // 5. المسؤول لا يستطيع إنشاء حسابات أخرى أو تعديل/حذف حساب المالك
    const illegalCreateByAdmin = auth.createAdminUserByOwner(pwdChangeRes.user, {
      username: 'illegal_admin_2',
      displayName: 'محاولة غير مصرحة',
      initialPassword: 'SomePassword123',
    });
    assert.equal(illegalCreateByAdmin.ok, false);

    const illegalModifyOwner = auth.updateAdminUserByOwner(pwdChangeRes.user, {
      targetUserId: ownerUser.id,
      isActive: false,
    });
    assert.equal(illegalModifyOwner.ok, false);

    const illegalOwnerSelfDelete = auth.deleteAdminUserByOwner(ownerUser, ownerUser.id);
    assert.equal(illegalOwnerSelfDelete.ok, false);

    // 6. المالك يستطيع تعطيل حساب المسؤول مما يبطل جلسته فوراً
    const disableRes = auth.updateAdminUserByOwner(ownerUser, {
      targetUserId: createdAdminUser.id,
      isActive: false,
    });
    assert.equal(disableRes.ok, true);

    const disabledSessionCheck = auth.verifySessionToken(token);
    assert.equal(disabledSessionCheck, null, 'يجب إبطال جلسة المسؤول المعطّل فوراً');

    const disabledLoginCheck = auth.verifyAdminCredentials(testUsername, 'NewPersonalPass#2026');
    assert.equal(disabledLoginCheck.ok, false);
  } finally {
    // 7. المالك يحذف حساب المسؤول التجريبي
    const delRes = auth.deleteAdminUserByOwner(ownerUser, createdAdminUser.id);
    assert.equal(delRes.ok, true);
  }
});

