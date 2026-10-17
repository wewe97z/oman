'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  LogOut,
  FileText,
  Download,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Sparkles,
  Database,
  Layers,
  Search,
  StopCircle,
  Upload,
  Activity,
  Users,
  KeyRound,
  UserCheck,
  UserX,
  Crown,
} from 'lucide-react';
import {
  AdminPermissions,
  AdminUserPublic,
  AISettingsPublic,
  Article,
  ArticleStatus,
  Category,
  DuplicatePair,
  FactClassification,
  ImportJob,
  Source,
  SystemLog,
  UserRole,
  Volume,
} from '@/lib/types';

type AdminTab =
  | 'overview'
  | 'articles'
  | 'importer'
  | 'taxonomy_sources'
  | 'quality'
  | 'users'
  | 'ai_and_logs'
  | 'my_account';

export default function AdminDashboardPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
    mustChangePassword: boolean;
    permissions: AdminPermissions;
  } | null>(null);

  // حقول نموذج تسجيل الدخول
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // حقول تغيير كلمة المرور الأولية (أو الشخصية)
  const [currentPwdInput, setCurrentPwdInput] = useState('');
  const [newPwdInput, setNewPwdInput] = useState('');
  const [confirmPwdInput, setConfirmPwdInput] = useState('');
  const [pwdChangeError, setPwdChangeError] = useState('');
  const [pwdChangeSuccess, setPwdChangeSuccess] = useState('');

  // بيانات لوحة الإدارة
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<{
    totalArticles: number;
    publishedArticles: number;
    underReviewArticles: number;
    needsUpdateArticles: number;
    totalSources: number;
    totalCategories: number;
    duplicatesCount: number;
    missingSourcesCount: number;
    lastUpdatedAt: string;
  } | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [missingSources, setMissingSources] = useState<Article[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [aiSettings, setAiSettings] = useState<AISettingsPublic | null>(null);
  const [adminUsersList, setAdminUsersList] = useState<AdminUserPublic[]>([]);

  // نماذج إدارة المسؤولين (للمالك Owner فقط)
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('');
  const [newAdminInitialPassword, setNewAdminInitialPassword] = useState('');
  const [newAdminPerms, setNewAdminPerms] = useState<AdminPermissions>({
    canPublishArticles: false,
    canDeleteContent: false,
    canManageCategories: false,
    canAccessBackups: false,
  });

  // تعديل بيانات مسؤول أو إعادة تعيين كلمة مروره (من قِبل المالك)
  const [editingTargetAdmin, setEditingTargetAdmin] = useState<{
    id: string;
    username: string;
    displayName: string;
    permissions: AdminPermissions;
  } | null>(null);
  const [resetPwdTargetId, setResetPwdTargetId] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdForceChange, setResetPwdForceChange] = useState(true);

  // نموذج تحديث بيانات حساب المالك نفسه
  const [ownerUsernameInput, setOwnerUsernameInput] = useState('');
  const [ownerDisplayNameInput, setOwnerDisplayNameInput] = useState('');
  const [ownerCurrentPasswordInput, setOwnerCurrentPasswordInput] = useState('');
  const [ownerNewPasswordInput, setOwnerNewPasswordInput] = useState('');

  // رسالة تنبيه عامة
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // البحث الإداري السريع داخل قاعدة البيانات
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('all');

  // نموذج إضافة/تعديل مقال
  const [editingArticle, setEditingArticle] = useState<{
    id?: string;
    title: string;
    summary: string;
    content: string;
    categoryId: string;
    subcategory: string;
    volumeId: string;
    keywords: string;
    authorOrPublisher: string;
    sourceId: string;
    sourceUrl: string;
    status: ArticleStatus;
    factClassification: FactClassification;
    changeSummary: string;
  }>({
    title: '',
    summary: '',
    content: '',
    categoryId: 'cat-01-history-civilization',
    subcategory: '',
    volumeId: 'vol-01',
    keywords: '',
    authorOrPublisher: 'هيئة تحرير الموسوعة',
    sourceId: 'src-omaninfo',
    sourceUrl: 'https://www.omaninfo.om',
    status: 'under_review',
    factClassification: 'confirmed_fact',
    changeSummary: '',
  });

  // نماذج وحدة الاستيراد
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importUrlPublisher, setImportUrlPublisher] = useState('');
  const [importUrlAutoPublish, setImportUrlAutoPublish] = useState(false);

  const [batchTopicQuery, setBatchTopicQuery] = useState('قلاع وحصون سلطنة عمان');
  const [batchSize, setBatchSize] = useState(2);

  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualSourceUrl, setManualSourceUrl] = useState('');
  const [manualPublisher, setManualPublisher] = useState('');

  // نموذج إضافة/تعديل تصنيف
  const [catForm, setCatForm] = useState({
    id: '',
    name: '',
    description: '',
    subcategories: '',
    sortOrder: 18,
  });

  // نموذج إضافة/تعديل مصدر
  const [srcForm, setSrcForm] = useState({
    id: '',
    name: '',
    url: '',
    sourceType: 'official_omani' as Source['sourceType'],
    publisher: '',
    trustLevel: 'high' as Source['trustLevel'],
    licenseInfo: 'مصدر معتمد — يُستشهد به مع ذكر الجهة الناشرة والرابط الأصلي',
    notes: '',
  });

  // نموذج إعدادات Gemini API الآمنة
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelNameInput, setModelNameInput] = useState('gemini-2.5-flash');
  const [enableWebSearchInput, setEnableWebSearchInput] = useState(false);
  const [maxTokensInput, setMaxTokensInput] = useState(1536);
  const [rateLimitInput, setRateLimitInput] = useState(15);

  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuthStatus() {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
      if (data.admin) {
        setAdminUser(data.admin);
        setOwnerUsernameInput(data.admin.username || '');
        setOwnerDisplayNameInput(data.admin.displayName || '');
      } else {
        setAdminUser(null);
      }
      if (data.authenticated && !data.admin?.mustChangePassword) {
        await loadAdminOverview();
      }
    } catch {
      // ignore
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadAdminOverview() {
    try {
      const res = await fetch('/api/admin/overview');
      if (!res.ok) return;
      const data = await res.json();
      if (data.currentAdmin) {
        setAdminUser(data.currentAdmin);
        setOwnerUsernameInput(data.currentAdmin.username || '');
        setOwnerDisplayNameInput(data.currentAdmin.displayName || '');
      }
      setStats(data.stats);
      setArticles(data.articles || []);
      setCategories(data.categories || []);
      setVolumes(data.volumes || []);
      setSources(data.sources || []);
      setDuplicates(data.duplicates || []);
      setMissingSources(data.missingSources || []);
      setImportJobs(data.importJobs || []);
      setLogs(data.logs || []);
      if (Array.isArray(data.adminUsers)) {
        setAdminUsersList(data.adminUsers);
      }
      if (data.aiSettings) {
        setAiSettings(data.aiSettings);
        setModelNameInput(data.aiSettings.modelName || 'gemini-2.5-flash');
        setEnableWebSearchInput(Boolean(data.aiSettings.enableWebSearch));
        setMaxTokensInput(Number(data.aiSettings.maxOutputTokens || 1536));
        setRateLimitInput(Number(data.aiSettings.rateLimitPerMinute || 15));
      }
    } catch {
      // ignore
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || 'تعذر تسجيل الدخول. يرجى التحقق من البيانات.');
      } else {
        setAuthenticated(true);
        setAdminUser(data.admin);
        setOwnerUsernameInput(data.admin?.username || '');
        setOwnerDisplayNameInput(data.admin?.displayName || '');
        setPassword('');
        if (!data.admin?.mustChangePassword) {
          await loadAdminOverview();
        }
      }
    } catch {
      setAuthError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  }

  async function handleChangeOwnPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdChangeError('');
    setPwdChangeSuccess('');
    if (newPwdInput.length < 8) {
      setPwdChangeError('كلمة المرور الجديدة يجب أن تتكون من 8 أحرف على الأقل.');
      return;
    }
    if (newPwdInput !== confirmPwdInput) {
      setPwdChangeError('تأكيد كلمة المرور الجديدة غير متطابق.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_own_password',
          currentPassword: currentPwdInput,
          newPassword: newPwdInput,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPwdChangeError(data.error || 'تعذر تغيير كلمة المرور.');
      } else {
        setCurrentPwdInput('');
        setNewPwdInput('');
        setConfirmPwdInput('');
        setPwdChangeSuccess(data.message || 'تم تحديث كلمة المرور بنجاح.');
        if (data.admin) {
          setAdminUser(data.admin);
        }
        await loadAdminOverview();
      }
    } catch {
      setPwdChangeError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAdminUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminUsername,
          displayName: newAdminDisplayName,
          initialPassword: newAdminInitialPassword,
          permissions: newAdminPerms,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر إنشاء حساب المسؤول.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        setNewAdminUsername('');
        setNewAdminDisplayName('');
        setNewAdminInitialPassword('');
        setNewAdminPerms({
          canPublishArticles: false,
          canDeleteContent: false,
          canManageCategories: false,
          canAccessBackups: false,
        });
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTargetAdminDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTargetAdmin) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          targetUserId: editingTargetAdmin.id,
          username: editingTargetAdmin.username,
          displayName: editingTargetAdmin.displayName,
          permissions: editingTargetAdmin.permissions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر تحديث بيانات المسؤول.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        setEditingTargetAdmin(null);
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResetAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwdTargetId) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          targetUserId: resetPwdTargetId,
          newPassword: resetPwdValue,
          mustChangePassword: resetPwdForceChange,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر إعادة تعيين كلمة المرور.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        setResetPwdTargetId(null);
        setResetPwdValue('');
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAdminActive(target: AdminUserPublic) {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          targetUserId: target.id,
          isActive: !target.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر تغيير حالة الحساب.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAdminAccount(target: AdminUserPublic) {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر حذف حساب المسؤول.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateOwnerOwnAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_owner_account',
          currentPassword: ownerCurrentPasswordInput,
          newUsername: ownerUsernameInput,
          newDisplayName: ownerDisplayNameInput,
          newPassword: ownerNewPasswordInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر تحديث بيانات حساب المالك.' });
      } else {
        setBannerMsg({ type: 'ok', text: data.message });
        setOwnerCurrentPasswordInput('');
        setOwnerNewPasswordInput('');
        if (data.admin) setAdminUser(data.admin);
        if (Array.isArray(data.users)) setAdminUsersList(data.users);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setAuthenticated(false);
    setAdminUser(null);
  }

  async function handleSaveArticle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingArticle,
          references: editingArticle.sourceUrl
            ? [
                {
                  title: editingArticle.title,
                  url: editingArticle.sourceUrl,
                  publisher: editingArticle.authorOrPublisher,
                  accessDate: new Date().toISOString().slice(0, 10),
                  sourceType: 'official_omani',
                },
              ]
            : [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر حفظ المقال' });
      } else {
        setBannerMsg({
          type: 'ok',
          text: `تم حفظ المقال «${data.article.title}» وتسجيل المراجعة في السجل بنجاح.`,
        });
        setEditingArticle({
          title: '',
          summary: '',
          content: '',
          categoryId: 'cat-01-history-civilization',
          subcategory: '',
          volumeId: 'vol-01',
          keywords: '',
          authorOrPublisher: adminUser?.displayName || 'هيئة تحرير الموسوعة',
          sourceId: 'src-omaninfo',
          sourceUrl: 'https://www.omaninfo.om',
          status: 'under_review',
          factClassification: 'confirmed_fact',
          changeSummary: '',
        });
        await loadAdminOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickStatusChange(article: Article, newStatus: ArticleStatus) {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...article,
          status: newStatus,
          changeSummary: `تغيير حالة المراجعة والنشر إلى: ${newStatus}`,
        }),
      });
      if (res.ok) {
        setBannerMsg({
          type: 'ok',
          text: `تم تحديث حالة مقال «${article.title}» إلى (${newStatus}).`,
        });
        await loadAdminOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshArticleSource(articleId: string) {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh_article',
          articleId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBannerMsg({ type: 'ok', text: data.message });
        await loadAdminOverview();
      } else {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر تحديث المصدر' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteArticle(id: string, title: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/articles?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBannerMsg({ type: 'ok', text: `تم حذف المقال: ${title}` });
        await loadAdminOverview();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFromUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!importUrlInput.trim()) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'url_fetch',
          url: importUrlInput,
          publisherName: importUrlPublisher,
          autoPublish: importUrlAutoPublish,
        }),
      });
      const data = await res.json();
      if (data.ok && data.article) {
        setBannerMsg({
          type: 'ok',
          text: `تم استيراد وتصنيف مقال «${data.article.title}» بنجاح!`,
        });
        setImportUrlInput('');
      } else {
        setBannerMsg({
          type: 'err',
          text: data.error || 'تعذر استيراد الرابط المحدد.',
        });
      }
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  async function handleBatchDiscovery(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'topic_discovery',
          topicQuery: batchTopicQuery,
          maxBatchSize: batchSize,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBannerMsg({
          type: 'ok',
          text: `اكتملت دفعة الاستيراد: تم استيراد ${
            data.importedArticles?.length || 0
          } مقالات جديدة، وتخطي ${data.skippedDuplicates?.length || 0} مكررة.`,
        });
      } else {
        setBannerMsg({
          type: 'err',
          text: data.errors?.[0] || 'تعذر إتمام دفعة البحث الخارجي.',
        });
      }
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  async function handleManualFileImport(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_file',
          title: manualTitle,
          content: manualContent,
          sourceUrl: manualSourceUrl,
          publisherName: manualPublisher,
          autoPublish: false,
        }),
      });
      const data = await res.json();
      if (data.ok && data.article) {
        setBannerMsg({
          type: 'ok',
          text: `تم استيراد وتصنيف المادة الموثقة «${data.article.title}» وحفظها للمراجعة بنجاح.`,
        });
        setManualTitle('');
        setManualContent('');
        setManualSourceUrl('');
        setManualPublisher('');
      } else {
        setBannerMsg({
          type: 'err',
          text: data.error || 'تعذر استيراد النص الموثق.',
        });
      }
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  function handleFileUploadFromDisk(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        const parsed = JSON.parse(text);
        if (parsed.title && parsed.content) {
          setManualTitle(String(parsed.title));
          setManualContent(String(parsed.content));
          if (parsed.sourceUrl) setManualSourceUrl(String(parsed.sourceUrl));
          if (parsed.publisherName) setManualPublisher(String(parsed.publisherName));
          return;
        }
      } catch {
        // نص عادي
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        setManualTitle(lines[0].replace(/^#+\s*/, '').trim());
        setManualContent(lines.slice(1).join('\n\n').trim());
      } else {
        setManualContent(text);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleStopImportJobs() {
    setBusy(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_all' }),
      });
      const data = await res.json();
      setBannerMsg({ type: 'ok', text: data.message || 'تم إيقاف المهام الجارية.' });
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catForm),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBannerMsg({ type: 'ok', text: `تم حفظ التصنيف: ${data.category.name}` });
        setCatForm({ id: '', name: '', description: '', subcategories: '', sortOrder: 18 });
        await loadAdminOverview();
      } else {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر حفظ التصنيف' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSource(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(srcForm),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBannerMsg({ type: 'ok', text: `تم حفظ المصدر: ${data.source.name}` });
        setSrcForm({
          id: '',
          name: '',
          url: '',
          sourceType: 'official_omani',
          publisher: '',
          trustLevel: 'high',
          licenseInfo: 'مصدر معتمد — يُستشهد به مع ذكر الجهة الناشرة والرابط الأصلي',
          notes: '',
        });
        await loadAdminOverview();
      } else {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر حفظ المصدر' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSource(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setBannerMsg({ type: 'ok', text: 'تم حذف المصدر بنجاح.' });
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAISettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyInput.trim() || undefined,
          modelName: modelNameInput,
          enableWebSearch: enableWebSearchInput,
          maxOutputTokens: maxTokensInput,
          rateLimitPerMinute: rateLimitInput,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setApiKeyInput('');
        setAiSettings(data.settings);
        setBannerMsg({ type: 'ok', text: data.message });
        await loadAdminOverview();
      } else {
        setBannerMsg({ type: 'err', text: data.error || 'تعذر حفظ إعدادات الذكاء الاصطناعي' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTestGeminiConnection() {
    setBusy(true);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' }),
      });
      const data = await res.json();
      if (data.settings) setAiSettings(data.settings);
      setBannerMsg({
        type: data.ok ? 'ok' : 'err',
        text: data.message,
      });
      await loadAdminOverview();
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center font-bold text-stone-600">
        جارٍ التحقق من حالة الجلسة الآمنة...
      </div>
    );
  }

  // شاشة تسجيل الدخول الآمنة للمالك (Owner) والمسؤولين (Admins)
  if (!authenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14">
        <div className="bg-white rounded-3xl border-2 border-omani-ivory-border shadow-lg overflow-hidden">
          <div className="omani-pattern-bg text-white p-8 space-y-3 border-b-4 border-omani-gold">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-omani-gold-light text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>بوابة المالك والمسؤولين المعتمدين</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/oman-encyclopedia-mark.png"
                alt="شعار الموسوعة العُمانية الرقمية"
                className="w-10 h-10 object-contain bg-white/95 rounded-xl p-1"
              />
            </div>
            <h1 className="text-2xl font-extrabold">تسجيل الدخول إلى لوحة الإدارة</h1>
            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
              مخصص لحساب المالك الرئيسي (Owner) وحسابات المسؤولين (Admins) التي ينشئها المالك.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-8 space-y-4">
            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                اسم المستخدم (Username):
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-omani-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                كلمة المرور:
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-omani-red focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-sm shadow-md transition-colors"
            >
              {busy ? 'جارٍ التحقق...' : 'تسجيل الدخول الآمن'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // شاشة إلزامية لتغيير كلمة المرور الأولية عند دخول المسؤول لأول مرة
  if (adminUser?.mustChangePassword) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14">
        <div className="bg-white rounded-3xl border-2 border-omani-ivory-border shadow-lg overflow-hidden">
          <div className="omani-pattern-bg text-white p-8 space-y-3 border-b-4 border-omani-gold">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-omani-gold-light text-xs font-bold">
                <KeyRound className="w-3.5 h-3.5" />
                <span>إجراء أمني إلزامي عند الدخول الأول</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/oman-encyclopedia-mark.png"
                alt="شعار الموسوعة العُمانية الرقمية"
                className="w-10 h-10 object-contain bg-white/95 rounded-xl p-1"
              />
            </div>
            <h1 className="text-2xl font-extrabold">تغيير كلمة المرور الأولية</h1>
            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
              مرحباً بك <strong>{adminUser.displayName}</strong> ({adminUser.username}). حفاظاً على أمان
              حسابك، يرجى استبدال كلمة المرور الأولية بكلمة مرور جديدة خاصة بك قبل البدء في إدارة المحتوى.
            </p>
          </div>

          <form onSubmit={handleChangeOwnPassword} className="p-8 space-y-4">
            {pwdChangeError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {pwdChangeError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                كلمة المرور الأولية (الحالية):
              </label>
              <input
                type="password"
                required
                value={currentPwdInput}
                onChange={(e) => setCurrentPwdInput(e.target.value)}
                placeholder="أدخل كلمة المرور الأولية التي استلمتها من المالك"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-omani-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                كلمة المرور الجديدة الخاصة بك (8 أحرف على الأقل):
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPwdInput}
                onChange={(e) => setNewPwdInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-omani-red focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                تأكيد كلمة المرور الجديدة:
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPwdInput}
                onChange={(e) => setConfirmPwdInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 text-sm focus:border-omani-red focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 py-3.5 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-sm shadow-md transition-colors"
              >
                {busy ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة والدخول للوحة الإدارة'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-3.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs"
              >
                تسجيل الخروج
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const isOwner = adminUser?.role === 'owner';
  const canPublish = isOwner || Boolean(adminUser?.permissions?.canPublishArticles);
  const canDelete = isOwner || Boolean(adminUser?.permissions?.canDeleteContent);
  const canManageCategories = isOwner || Boolean(adminUser?.permissions?.canManageCategories);
  const canAccessBackups = isOwner || Boolean(adminUser?.permissions?.canAccessBackups);

  const visibleTabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: '1. الإحصاءات والبحث الإداري', icon: Database },
    { id: 'articles', label: '2. إضافة وتعديل المقالات', icon: FileText },
    { id: 'importer', label: '3. وحدة استيراد المحتوى', icon: Globe },
    { id: 'taxonomy_sources', label: '4. المصادر والتصنيفات', icon: Layers },
    {
      id: 'quality',
      label: `5. فحص التكرار والمصادر (${(stats?.duplicatesCount || 0) + (stats?.missingSourcesCount || 0)})`,
      icon: AlertTriangle,
    },
    ...(isOwner
      ? [
          { id: 'users' as AdminTab, label: '6. إدارة المسؤولين وحساب المالك', icon: Users },
          { id: 'ai_and_logs' as AdminTab, label: '7. إعدادات Gemini API وسجل النظام', icon: Sparkles },
        ]
      : [{ id: 'my_account' as AdminTab, label: '6. حسابي وتغيير كلمة المرور', icon: KeyRound }]),
  ];

  const filteredArticles = articles.filter((a) => {
    const matchesStatus = adminStatusFilter === 'all' || a.status === adminStatusFilter;
    const matchesQuery =
      !adminSearchQuery.trim() ||
      a.title.includes(adminSearchQuery.trim()) ||
      a.content.includes(adminSearchQuery.trim()) ||
      a.authorOrPublisher.includes(adminSearchQuery.trim());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* شريط رأس لوحة الإدارة */}
      <div className="bg-white rounded-3xl p-6 border-2 border-omani-ivory-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-omani-red text-white flex items-center justify-center font-bold shadow">
            {isOwner ? (
              <Crown className="w-6 h-6 text-omani-gold-light" />
            ) : (
              <ShieldCheck className="w-6 h-6 text-omani-gold-light" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900">
                لوحة الإدارة والتحرير الموسوعي
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-extrabold border ${
                  isOwner
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                {isOwner ? 'المالك الرئيسي (Owner)' : 'مسؤول محتوى (Admin)'}
              </span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">
              مرحباً بك: <strong>{adminUser?.displayName}</strong> ({adminUser?.username}) • آخر تحديث
              لقاعدة البيانات: {stats?.lastUpdatedAt ? stats.lastUpdatedAt.slice(0, 16).replace('T', ' ') : 'الآن'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canAccessBackups && (
            <a
              href="/api/admin/overview?export=1"
              className="px-4 py-2.5 rounded-xl bg-omani-green hover:bg-omani-green-light text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>نسخ احتياطي وتصدير (JSON)</span>
            </a>
          )}
          <button
            type="button"
            onClick={loadAdminOverview}
            className="px-3.5 py-2.5 rounded-xl bg-omani-ivory hover:bg-omani-ivory-paper border border-omani-ivory-border text-xs font-bold text-stone-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث البيانات</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 text-xs font-bold flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* رسالة التنبيه للعمليات */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-2xl border-2 text-sm font-bold flex items-center justify-between ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-xs underline px-2"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* تبويبات لوحة الإدارة (بحسب صلاحية الحساب) */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-omani-ivory-border shadow-sm">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                active
                  ? 'bg-omani-red text-white shadow'
                  : 'text-stone-700 hover:bg-omani-ivory'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* التبويب 1: نظرة عامة والبحث في قاعدة البيانات */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-omani-ivory-border">
              <div className="text-2xl font-extrabold text-stone-900">{stats.totalArticles}</div>
              <div className="text-xs text-stone-600 mt-1">إجمالي المقالات بالقاعدة</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-omani-green/30">
              <div className="text-2xl font-extrabold text-omani-green">{stats.publishedArticles}</div>
              <div className="text-xs text-stone-600 mt-1">مقالات منشورة وموثقة</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-300">
              <div className="text-2xl font-extrabold text-amber-700">{stats.underReviewArticles}</div>
              <div className="text-xs text-stone-600 mt-1">مقالات قيد المراجعة</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-omani-ivory-border">
              <div className="text-2xl font-extrabold text-omani-red">{stats.totalSources}</div>
              <div className="text-xs text-stone-600 mt-1">المصادر المسجلة</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-omani-ivory-border">
              <div className="text-2xl font-extrabold text-stone-900">{stats.duplicatesCount}</div>
              <div className="text-xs text-stone-600 mt-1">حالات تكرار مكتشفة</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-omani-ivory-border">
              <div className="text-2xl font-extrabold text-stone-900">{stats.missingSourcesCount}</div>
              <div className="text-xs text-stone-600 mt-1">مقالات تفتقر لمصدر</div>
            </div>
          </div>

          {/* البحث داخل قاعدة البيانات ومراجعة الحالات */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-omani-red" />
                <span>البحث المباشر داخل قاعدة البيانات وإدارة المقالات</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  placeholder="ابحث في العناوين، المتن، أو الناشر..."
                  className="px-3.5 py-2 rounded-xl border border-stone-300 text-xs w-64"
                />
                <select
                  value={adminStatusFilter}
                  onChange={(e) => setAdminStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white font-bold"
                >
                  <option value="all">جميع الحالات ({articles.length})</option>
                  <option value="published">منشور (published)</option>
                  <option value="verified">موثّق (verified)</option>
                  <option value="under_review">قيد المراجعة (under_review)</option>
                  <option value="needs_update">يحتاج إلى تحديث (needs_update)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-omani-ivory-paper text-stone-800 border-b border-omani-ivory-border">
                    <th className="p-3">عنوان المقال الموسوعي</th>
                    <th className="p-3">التصنيف</th>
                    <th className="p-3">المصدر</th>
                    <th className="p-3">آخر تحقق</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات المراجعة والتحديث</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredArticles.map((art) => (
                    <tr key={art.id} className="hover:bg-omani-ivory/40">
                      <td className="p-3 font-bold text-stone-900">
                        <Link href={`/articles/${art.slug}`} className="hover:text-omani-red">
                          {art.title}
                        </Link>
                      </td>
                      <td className="p-3 text-xs text-stone-600">
                        {art.categoryName || art.categoryId}
                      </td>
                      <td className="p-3 text-xs text-stone-600">
                        {art.sourceName || art.authorOrPublisher}
                      </td>
                      <td className="p-3 text-xs text-stone-500">{art.lastVerifiedAt}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            art.status === 'published'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : art.status === 'verified'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : art.status === 'under_review'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          {art.status === 'published'
                            ? 'منشور'
                            : art.status === 'verified'
                            ? 'موثّق'
                            : art.status === 'under_review'
                            ? 'قيد المراجعة'
                            : 'يحتاج لتحديث'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canPublish && art.status !== 'published' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(art, 'published')}
                              className="px-2.5 py-1 rounded bg-omani-green text-white text-xs font-bold"
                            >
                              اعتماد ونشر
                            </button>
                          )}
                          {art.status !== 'under_review' && (
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(art, 'under_review')}
                              className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold"
                            >
                              للمراجعة
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRefreshArticleSource(art.id)}
                            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center gap-1"
                            title="إعادة جلب المعلومات وتحديث تاريخ التحقق"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>إعادة تحقق</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingArticle({
                                id: art.id,
                                title: art.title,
                                summary: art.summary,
                                content: art.content,
                                categoryId: art.categoryId,
                                subcategory: art.subcategory,
                                volumeId: art.volumeId || 'vol-01',
                                keywords: art.keywords.join('، '),
                                authorOrPublisher: art.authorOrPublisher,
                                sourceId: art.sourceId || '',
                                sourceUrl: art.sourceUrl,
                                status: art.status,
                                factClassification: art.factClassification,
                                changeSummary: 'تحديث تحريري',
                              });
                              setActiveTab('articles');
                            }}
                            className="p-1.5 rounded bg-stone-100 hover:bg-omani-gold/30 text-stone-700"
                            title="تعديل المقال"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteArticle(art.id, art.title)}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700"
                              title="حذف المقال"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 2: نموذج إنشاء وتعديل ومراجعة المقالات */}
      {activeTab === 'articles' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-omani-ivory-border space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <h2 className="text-xl font-extrabold text-stone-900">
              {editingArticle.id ? `تعديل المقال: ${editingArticle.title}` : 'إضافة مقال موسوعي موثق جديد'}
            </h2>
            {editingArticle.id && (
              <button
                type="button"
                onClick={() =>
                  setEditingArticle({
                    title: '',
                    summary: '',
                    content: '',
                    categoryId: 'cat-01-history-civilization',
                    subcategory: '',
                    volumeId: 'vol-01',
                    keywords: '',
                    authorOrPublisher: adminUser?.displayName || 'هيئة تحرير الموسوعة',
                    sourceId: 'src-omaninfo',
                    sourceUrl: 'https://www.omaninfo.om',
                    status: 'under_review',
                    factClassification: 'confirmed_fact',
                    changeSummary: '',
                  })
                }
                className="text-xs font-bold text-omani-red underline"
              >
                + تفريغ النموذج لإنشاء مقال جديد
              </button>
            )}
          </div>

          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">عنوان المقال *</label>
                <input
                  type="text"
                  required
                  value={editingArticle.title}
                  onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">التصنيف الرئيسي *</label>
                <select
                  value={editingArticle.categoryId}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, categoryId: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">التصنيف الفرعي</label>
                <input
                  type="text"
                  value={editingArticle.subcategory}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, subcategory: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">المجلد الموسوعي</label>
                <select
                  value={editingArticle.volumeId}
                  onChange={(e) => setEditingArticle({ ...editingArticle, volumeId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                >
                  {volumes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">الملخص الموسوعي</label>
              <textarea
                rows={2}
                value={editingArticle.summary}
                onChange={(e) => setEditingArticle({ ...editingArticle, summary: e.target.value })}
                className="w-full p-3.5 rounded-xl border border-stone-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                النص الموسوعي الكامل *
              </label>
              <textarea
                rows={8}
                required
                value={editingArticle.content}
                onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                className="w-full p-3.5 rounded-xl border border-stone-300 text-sm leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الكلمات المفتاحية (مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={editingArticle.keywords}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, keywords: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  الجهة الناشرة أو المؤلف *
                </label>
                <input
                  type="text"
                  required
                  value={editingArticle.authorOrPublisher}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, authorOrPublisher: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رابط المصدر الموثق (URL) *
                </label>
                <input
                  type="url"
                  required
                  value={editingArticle.sourceUrl}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, sourceUrl: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  حالة المراجعة والنشر
                </label>
                <select
                  value={editingArticle.status}
                  onChange={(e) =>
                    setEditingArticle({
                      ...editingArticle,
                      status: e.target.value as ArticleStatus,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white font-bold"
                >
                  <option value="under_review">قيد المراجعة (under_review)</option>
                  <option value="verified">موثّق (verified)</option>
                  <option value="published">منشور (published)</option>
                  <option value="needs_update">يحتاج إلى تحديث (needs_update)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  طبيعة المعلومة التاريخية
                </label>
                <select
                  value={editingArticle.factClassification}
                  onChange={(e) =>
                    setEditingArticle({
                      ...editingArticle,
                      factClassification: e.target.value as FactClassification,
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                >
                  <option value="confirmed_fact">حقيقة تاريخية/علمية مؤكدة</option>
                  <option value="historical_narrative">رواية تاريخية مع توضيح السياق</option>
                  <option value="disputed_narrative">رواية مختلف عليها</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  ملخص سبب التعديل (يُحفظ في سجل التعديلات)
                </label>
                <input
                  type="text"
                  value={editingArticle.changeSummary}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle, changeSummary: e.target.value })
                  }
                  placeholder="مثال: تدقيق المراجع وإضافة الفقرة الثانية"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="px-8 py-3.5 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-sm shadow"
            >
              {busy ? 'جارٍ الحفظ...' : 'حفظ المادة الموسوعية وتسجيل المراجعة'}
            </button>
          </form>
        </div>
      )}

      {/* التبويب 3: وحدة استيراد المحتوى الذكي */}
      {activeTab === 'importer' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* أ. استيراد صفحة عبر رابط URL */}
            <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
              <h2 className="text-lg font-extrabold text-omani-red-dark flex items-center gap-2">
                <Globe className="w-5 h-5" />
                <span>1. استيراد محتوى صفحة عبر رابط URL مباشر</span>
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                يفحص النظام شروط <code className="font-mono">robots.txt</code>، ويستخرج العنوان والنص
                والتاريخ والناشر، وينظف القوائم والإعلانات، ويكتشف التكرار، ويقترح التصنيف والملخص
                والكلمات المفتاحية تلقائياً.
              </p>

              <form onSubmit={handleImportFromUrl} className="space-y-3">
                <input
                  type="url"
                  required
                  value={importUrlInput}
                  onChange={(e) => setImportUrlInput(e.target.value)}
                  placeholder="https://ar.wikipedia.org/wiki/قلعة_نزوى أو رابط صفحة عُمانية عامة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
                <input
                  type="text"
                  value={importUrlPublisher}
                  onChange={(e) => setImportUrlPublisher(e.target.value)}
                  placeholder="اسم الجهة الناشرة (اختياري — يُستخرج تلقائياً عند تركه فارغاً)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-stone-700">
                  <input
                    type="checkbox"
                    checked={importUrlAutoPublish}
                    onChange={(e) => setImportUrlAutoPublish(e.target.checked)}
                  />
                  <span>نشر مباشر بعد الاستيراد (افتراضياً يوضع في حالة قيد المراجعة/موثق)</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-bold text-sm"
                >
                  {busy ? 'جارٍ الجلب والتنظيف والتحقق...' : 'جلب واستيراد الرابط الآن'}
                </button>
              </form>
            </div>

            {/* ب. البحث التلقائي بالدفعات الصغيرة حول موضوع عُماني */}
            <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
              <h2 className="text-lg font-extrabold text-omani-green-dark flex items-center gap-2">
                <Search className="w-5 h-5" />
                <span>2. البحث والاستيراد التلقائي بالدفعات الصغيرة</span>
              </h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                يبحث عن صفحات عربية مرخصة قانونياً ذات صلة بموضوع عُماني محدد، ويشغّل الاستيراد على
                دفعات صغيرة جداً (1 إلى 5 مقالات) مع فاصل زمني لاحترام حدود المواقع.
              </p>

              <form onSubmit={handleBatchDiscovery} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    موضوع البحث العُماني:
                  </label>
                  <input
                    type="text"
                    required
                    value={batchTopicQuery}
                    onChange={(e) => setBatchTopicQuery(e.target.value)}
                    placeholder="مثال: قلعة نزوى، حصن جبرين، وادي شاب..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    حجم الدفعة الصغيرة (حد أقصى 5 مقالات في الدفعة):
                  </label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                  >
                    <option value={1}>مقال واحد (1)</option>
                    <option value={2}>مقالان (2)</option>
                    <option value={3}>3 مقالات</option>
                    <option value={5}>5 مقالات</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 py-3 rounded-xl bg-omani-green hover:bg-omani-green-light text-white font-bold text-sm"
                  >
                    {busy ? 'جارٍ تشغيل الدفعة...' : 'تشغيل دفعة البحث والاستيراد'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStopImportJobs}
                    className="px-4 py-3 rounded-xl bg-stone-800 hover:bg-red-800 text-white font-bold text-xs flex items-center gap-1"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>إيقاف المهام</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* ج. بديل الاستيراد عبر ملف أو نص موثق يختاره المدير */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-omani-gold-dark" />
                <span>3. استيراد ملف نصي (.txt / .md / .json) أو نص موثق يختاره المدير</span>
              </h2>
              <label className="px-4 py-2 rounded-xl bg-omani-ivory hover:bg-omani-gold/25 border border-omani-ivory-border text-xs font-bold text-stone-800 cursor-pointer">
                <span>اختيار ملف من جهازك (.txt / .json / .md)</span>
                <input
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={handleFileUploadFromDisk}
                  className="hidden"
                />
              </label>
            </div>

            <form onSubmit={handleManualFileImport} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="عنوان المقال *"
                  className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
                <input
                  type="url"
                  required
                  value={manualSourceUrl}
                  onChange={(e) => setManualSourceUrl(e.target.value)}
                  placeholder="رابط المصدر الأصلي للتوثيق (https://...) *"
                  className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
                <input
                  type="text"
                  required
                  value={manualPublisher}
                  onChange={(e) => setManualPublisher(e.target.value)}
                  placeholder="اسم الجهة الناشرة *"
                  className="px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>
              <textarea
                rows={4}
                required
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="الصق النص الموسوعي هنا أو اختر ملفاً من الزر أعلاه ليقوم النظام بتصنيفه وتلخيصه وفحص عدم تكراره..."
                className="w-full p-3.5 rounded-xl border border-stone-300 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-omani-red text-white font-bold text-xs sm:text-sm"
              >
                تحليل وتصنيف وحفظ المادة المستوردة
              </button>
            </form>
          </div>

          {/* د. جدول متابعة مهام الاستيراد الناجحة والفاشلة وأسباب الأخطاء */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900">
              سجل مهام الاستيراد وحالات النجاح والفشل وأسبابها ({importJobs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-omani-ivory-paper border-b border-omani-ivory-border">
                    <th className="p-3">نوع المهمة</th>
                    <th className="p-3">الرابط أو الاستعلام المستهدف</th>
                    <th className="p-3">العنوان المستخرج / النتيجة</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">تفاصيل الخطأ أو سبب التخطي</th>
                    <th className="p-3">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {importJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="p-3 font-bold">{job.jobType}</td>
                      <td className="p-3 max-w-xs truncate" title={job.targetUrlOrQuery}>
                        {job.targetUrlOrQuery}
                      </td>
                      <td className="p-3 font-semibold text-stone-800">
                        {job.extractedTitle || '—'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            job.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : job.status === 'duplicate_skipped'
                              ? 'bg-amber-50 text-amber-800'
                              : job.status === 'failed'
                              ? 'bg-red-50 text-red-800'
                              : 'bg-stone-100 text-stone-800'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 text-red-700 max-w-sm">
                        {job.errorReasonCode ? `[${job.errorReasonCode}] ` : ''}
                        {job.errorMessage || 'تم بنجاح دون أخطاء'}
                      </td>
                      <td className="p-3 text-stone-500">
                        {job.startedAt.slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 4: إدارة التصنيفات والمصادر */}
      {activeTab === 'taxonomy_sources' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* إدارة التصنيفات */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-5">
            <h2 className="text-lg font-extrabold text-stone-900">
              التصنيفات الموسوعية ({categories.length})
            </h2>
            {canManageCategories ? (
              <form onSubmit={handleSaveCategory} className="space-y-3">
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="اسم التصنيف (مثال: المخطوطات والوثائق العُمانية) *"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
                <textarea
                  rows={2}
                  required
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="وصف التصنيف *"
                  className="w-full p-3.5 rounded-xl border border-stone-300 text-sm"
                />
                <input
                  type="text"
                  value={catForm.subcategories}
                  onChange={(e) => setCatForm({ ...catForm, subcategories: e.target.value })}
                  placeholder="التصنيفات الفرعية مفصولة بفاصلة"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-omani-red text-white font-bold text-xs"
                >
                  <Plus className="w-4 h-4 inline ml-1" />
                  حفظ التصنيف
                </button>
              </form>
            ) : (
              <p className="text-xs text-stone-600 bg-omani-ivory p-3 rounded-xl border border-omani-ivory-border">
                عرض التصنيفات المتاحة لاختيارها عند إضافة المقالات (تعديل التصنيفات مخصص للمالك أو المسؤول المخوّل).
              </p>
            )}

            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 text-xs">
              {categories.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-stone-900">{c.name}</div>
                    <div className="text-stone-500">{c.publishedCount || 0} مقالة منشورة</div>
                  </div>
                  {canManageCategories && (
                    <button
                      type="button"
                      onClick={() =>
                        setCatForm({
                          id: c.id,
                          name: c.name,
                          description: c.description,
                          subcategories: c.subcategories.join('، '),
                          sortOrder: c.sortOrder,
                        })
                      }
                      className="px-2.5 py-1 rounded bg-stone-100 hover:bg-omani-gold/30 font-bold"
                    >
                      تعديل
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* إدارة المصادر */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-5">
            <h2 className="text-lg font-extrabold text-stone-900">
              إضافة أو تحديث مصدر معتمد ({sources.length})
            </h2>
            <form onSubmit={handleSaveSource} className="space-y-3">
              <input
                type="text"
                required
                value={srcForm.name}
                onChange={(e) => setSrcForm({ ...srcForm, name: e.target.value })}
                placeholder="اسم المصدر (مثال: هيئة الوثائق والمحفوظات الوطنية) *"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
              />
              <input
                type="url"
                required
                value={srcForm.url}
                onChange={(e) => setSrcForm({ ...srcForm, url: e.target.value })}
                placeholder="رابط الموقع الرسمي (https://...) *"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={srcForm.sourceType}
                  onChange={(e) =>
                    setSrcForm({
                      ...srcForm,
                      sourceType: e.target.value as Source['sourceType'],
                    })
                  }
                  className="px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
                >
                  <option value="official_omani">مصدر حكومي عُماني رسمي</option>
                  <option value="cultural_omani">مؤسسة ثقافية عُمانية</option>
                  <option value="academic_omani">مؤسسة أكاديمية عُمانية</option>
                  <option value="international">مصدر دولي موثوق</option>
                </select>
                <select
                  value={srcForm.trustLevel}
                  onChange={(e) =>
                    setSrcForm({
                      ...srcForm,
                      trustLevel: e.target.value as Source['trustLevel'],
                    })
                  }
                  className="px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
                >
                  <option value="high">موثوقية عالية (High)</option>
                  <option value="medium">موثوقية متوسطة (Medium)</option>
                  <option value="review_required">يتطلب مراجعة (Review Required)</option>
                </select>
              </div>
              <input
                type="text"
                value={srcForm.notes}
                onChange={(e) => setSrcForm({ ...srcForm, notes: e.target.value })}
                placeholder="ملاحظات حول نطاق التغطية والترخيص"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-omani-green text-white font-bold text-xs"
              >
                حفظ المصدر
              </button>
            </form>

            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100 text-xs">
              {sources.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-stone-900">{s.name}</div>
                    <div className="text-stone-500">
                      {s.domain} • {s.articleCount || 0} مقالات مرتبطة
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSrcForm({
                          id: s.id,
                          name: s.name,
                          url: s.url,
                          sourceType: s.sourceType,
                          publisher: s.publisher,
                          trustLevel: s.trustLevel,
                          licenseInfo: s.licenseInfo,
                          notes: s.notes,
                        })
                      }
                      className="px-2 py-1 rounded bg-stone-100 font-bold"
                    >
                      تعديل
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(s.id)}
                        className="p-1 rounded bg-red-50 text-red-700"
                        title="حذف المصدر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* التبويب 5: فحص المقالات المكررة والمقالات التي تفتقر إلى مصادر */}
      {activeTab === 'quality' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-omani-green" />
              <span>اكتشاف المقالات المكررة أو المتشابهة ({duplicates.length})</span>
            </h2>
            {duplicates.length === 0 ? (
              <p className="text-sm text-omani-green bg-omani-green-50 p-4 rounded-xl font-bold">
                ممتاز! لا توجد أي مقالات مكررة حالياً في قاعدة البيانات.
              </p>
            ) : (
              <div className="space-y-3">
                {duplicates.map((pair, i) => (
                  <div key={i} className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                    <div className="font-bold text-amber-950">{pair.reason}</div>
                    <div>1: {pair.articleA.title}</div>
                    <div>2: {pair.articleB.title}</div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteArticle(pair.articleB.id, pair.articleB.title)}
                        className="px-3 py-1 rounded bg-red-700 text-white font-bold"
                      >
                        حذف النسخة المكررة الثانية
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>مراجعة المقالات التي تفتقر إلى مصادر ({missingSources.length})</span>
            </h2>
            {missingSources.length === 0 ? (
              <p className="text-sm text-omani-green bg-omani-green-50 p-4 rounded-xl font-bold">
                جميع المقالات المسجلة في الموسوعة مرتبطة بمصادر ومراجع موثقة.
              </p>
            ) : (
              <div className="space-y-3">
                {missingSources.map((art) => (
                  <div key={art.id} className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs flex items-center justify-between">
                    <span className="font-bold text-red-950">{art.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticle({
                          id: art.id,
                          title: art.title,
                          summary: art.summary,
                          content: art.content,
                          categoryId: art.categoryId,
                          subcategory: art.subcategory,
                          volumeId: art.volumeId || 'vol-01',
                          keywords: art.keywords.join('، '),
                          authorOrPublisher: art.authorOrPublisher,
                          sourceId: art.sourceId || '',
                          sourceUrl: art.sourceUrl,
                          status: art.status,
                          factClassification: art.factClassification,
                          changeSummary: 'إضافة رابط المصدر الموثق',
                        });
                        setActiveTab('articles');
                      }}
                      className="px-3 py-1.5 rounded bg-omani-red text-white font-bold"
                    >
                      إضافة مصدر الآن
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* التبويب 6 (للمالك فقط): إدارة المسؤولين وحساب المالك */}
      {isOwner && activeTab === 'users' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* أ. إضافة حساب مسؤول جديد (Admin) */}
            <div className="bg-white rounded-3xl p-6 border-2 border-omani-ivory-border space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-omani-red" />
                  <span>إضافة حساب مسؤول جديد (Admin)</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-omani-ivory text-stone-700">
                  يُطالب بتغيير كلمة المرور عند الدخول الأول
                </span>
              </div>

              <form onSubmit={handleCreateAdminUser} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      اسم المستخدم للمسؤول الجديد *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="مثال: editor_ahmed"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الاسم الظاهر للمسؤول *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminDisplayName}
                      onChange={(e) => setNewAdminDisplayName(e.target.value)}
                      placeholder="مثال: أحمد — مسؤول تحرير المحتوى"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">
                      كلمة المرور الأولية المؤقتة (8 أحرف على الأقل) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
                        let generated = '';
                        for (let i = 0; i < 12; i++) {
                          generated += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        setNewAdminInitialPassword(generated);
                      }}
                      className="text-xs font-bold text-omani-red hover:underline"
                    >
                      توليد كلمة مرور أولية قوية
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={newAdminInitialPassword}
                    onChange={(e) => setNewAdminInitialPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الأولية لتسليمها للمسؤول"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-omani-ivory/60 border border-omani-ivory-border space-y-2.5">
                  <div className="text-xs font-extrabold text-stone-800">
                    صلاحيات المسؤول الإضافية (اختيارية — يحددها المالك):
                  </div>
                  <p className="text-[11px] text-stone-600">
                    بشكل افتراضي يستطيع المسؤول إضافة وتعديل المقالات والمصادر والمراجع واستخدام أدوات التحرير.
                    يمكنك منحه أياً من الصلاحيات الإضافية التالية:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-stone-700 pt-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canPublishArticles}
                        onChange={(e) =>
                          setNewAdminPerms({
                            ...newAdminPerms,
                            canPublishArticles: e.target.checked,
                          })
                        }
                      />
                      <span>نشر المقالات مباشرة (Published)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canManageCategories}
                        onChange={(e) =>
                          setNewAdminPerms({
                            ...newAdminPerms,
                            canManageCategories: e.target.checked,
                          })
                        }
                      />
                      <span>إضافة وتعديل التصنيفات</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canDeleteContent}
                        onChange={(e) =>
                          setNewAdminPerms({
                            ...newAdminPerms,
                            canDeleteContent: e.target.checked,
                          })
                        }
                      />
                      <span>حذف المقالات والمصادر</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.canAccessBackups}
                        onChange={(e) =>
                          setNewAdminPerms({
                            ...newAdminPerms,
                            canAccessBackups: e.target.checked,
                          })
                        }
                      />
                      <span>تحميل النسخ الاحتياطية (JSON)</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-sm shadow"
                >
                  <Plus className="w-4 h-4 inline ml-1" />
                  إنشاء حساب المسؤول الآن
                </button>
              </form>
            </div>

            {/* ب. إعدادات حساب المالك الرئيسي نفسه (Owner) */}
            <div className="bg-white rounded-3xl p-6 border-2 border-omani-ivory-border space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-omani-gold-dark" />
                  <span>إعدادات حساب المالك الرئيسي (Owner)</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                  تحكم كامل ومحصّن
                </span>
              </div>

              <form onSubmit={handleUpdateOwnerOwnAccount} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      اسم مستخدم المالك (Username) *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={ownerUsernameInput}
                      onChange={(e) => setOwnerUsernameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      الاسم الظاهر للمالك *
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerDisplayNameInput}
                      onChange={(e) => setOwnerDisplayNameInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    كلمة المرور الحالية للمالك (مطلوبة لتأكيد أي تعديل) *
                  </label>
                  <input
                    type="password"
                    required
                    value={ownerCurrentPasswordInput}
                    onChange={(e) => setOwnerCurrentPasswordInput(e.target.value)}
                    placeholder="أدخل كلمة مرورك الحالية للتأكيد"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    كلمة مرور جديدة للمالك (اختياري — اتركها فارغة للإبقاء على الحالية)
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={ownerNewPasswordInput}
                    onChange={(e) => setOwnerNewPasswordInput(e.target.value)}
                    placeholder="أدخل كلمة مرور جديدة (8 أحرف على الأقل) إن رغبت بتغييرها"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-stone-900 hover:bg-omani-red text-white font-extrabold text-sm shadow"
                >
                  حفظ بيانات حساب المالك
                </button>
              </form>
            </div>
          </div>

          {/* ج. جدول الحسابات الحالية وإدارة المسؤولين */}
          <div className="bg-white rounded-3xl p-6 border-2 border-omani-ivory-border space-y-5">
            <h2 className="text-lg font-extrabold text-stone-900">
              قائمة الحسابات الإدارية المسجلة ({adminUsersList.length})
            </h2>

            {/* نافذة تعديل بيانات وصلاحيات مسؤول محدد */}
            {editingTargetAdmin && (
              <form
                onSubmit={handleSaveTargetAdminDetails}
                className="p-5 rounded-2xl bg-omani-ivory border-2 border-omani-gold space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-stone-900">
                    تعديل بيانات وصلاحيات المسؤول: {editingTargetAdmin.displayName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingTargetAdmin(null)}
                    className="text-xs font-bold text-stone-600 underline"
                  >
                    إلغاء
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم المستخدم</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={editingTargetAdmin.username}
                      onChange={(e) =>
                        setEditingTargetAdmin({ ...editingTargetAdmin, username: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الظاهر</label>
                    <input
                      type="text"
                      required
                      value={editingTargetAdmin.displayName}
                      onChange={(e) =>
                        setEditingTargetAdmin({
                          ...editingTargetAdmin,
                          displayName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-stone-800">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editingTargetAdmin.permissions.canPublishArticles}
                      onChange={(e) =>
                        setEditingTargetAdmin({
                          ...editingTargetAdmin,
                          permissions: {
                            ...editingTargetAdmin.permissions,
                            canPublishArticles: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>نشر المقالات</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editingTargetAdmin.permissions.canManageCategories}
                      onChange={(e) =>
                        setEditingTargetAdmin({
                          ...editingTargetAdmin,
                          permissions: {
                            ...editingTargetAdmin.permissions,
                            canManageCategories: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>إدارة التصنيفات</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editingTargetAdmin.permissions.canDeleteContent}
                      onChange={(e) =>
                        setEditingTargetAdmin({
                          ...editingTargetAdmin,
                          permissions: {
                            ...editingTargetAdmin.permissions,
                            canDeleteContent: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>حذف المحتوى</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editingTargetAdmin.permissions.canAccessBackups}
                      onChange={(e) =>
                        setEditingTargetAdmin({
                          ...editingTargetAdmin,
                          permissions: {
                            ...editingTargetAdmin.permissions,
                            canAccessBackups: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>النسخ الاحتياطية</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-omani-red text-white text-xs font-bold"
                >
                  حفظ التعديلات
                </button>
              </form>
            )}

            {/* نافذة إعادة تعيين كلمة مرور مسؤول محدد */}
            {resetPwdTargetId && (
              <form
                onSubmit={handleResetAdminPassword}
                className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-amber-950">
                    إعادة تعيين كلمة المرور للمسؤول
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setResetPwdTargetId(null);
                      setResetPwdValue('');
                    }}
                    className="text-xs font-bold text-amber-900 underline"
                  >
                    إلغاء
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={resetPwdValue}
                    onChange={(e) => setResetPwdValue(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة المؤقتة (8 أحرف على الأقل)"
                    className="px-3.5 py-2 rounded-xl border border-amber-300 text-sm bg-white font-mono"
                  />
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={resetPwdForceChange}
                      onChange={(e) => setResetPwdForceChange(e.target.checked)}
                    />
                    <span>إلزام المسؤول بتغييرها فور تسجيل دخوله القادم</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold"
                >
                  تأكيد إعادة تعيين كلمة المرور
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-omani-ivory-paper border-b border-omani-ivory-border text-stone-800">
                    <th className="p-3">الاسم الظاهر</th>
                    <th className="p-3">اسم المستخدم</th>
                    <th className="p-3">الفئة (Role)</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الصلاحيات</th>
                    <th className="p-3">آخر دخول</th>
                    <th className="p-3">إجراءات المالك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {adminUsersList.map((u) => (
                    <tr key={u.id} className="hover:bg-omani-ivory/30">
                      <td className="p-3 font-bold text-stone-900">{u.displayName}</td>
                      <td className="p-3 font-mono text-xs text-stone-700">{u.username}</td>
                      <td className="p-3">
                        {u.role === 'owner' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-300">
                            المالك (Owner)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-800">
                            مسؤول (Admin)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-block w-fit px-2 py-0.5 rounded text-xs font-bold ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            {u.isActive ? 'نشط' : 'معطّل'}
                          </span>
                          {u.mustChangePassword && (
                            <span className="text-[11px] text-amber-700 font-semibold">
                              بانتظار تغيير كلمة المرور الأولية
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs text-stone-600">
                        {u.role === 'owner' ? (
                          <span className="font-bold text-omani-green">تحكم كامل بجميع الأقسام</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 rounded bg-stone-100">إضافة/تعديل مقالات ومصادر</span>
                            {u.permissions.canPublishArticles && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">
                                نشر
                              </span>
                            )}
                            {u.permissions.canManageCategories && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold">
                                تصنيفات
                              </span>
                            )}
                            {u.permissions.canDeleteContent && (
                              <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 font-bold">
                                حذف
                              </span>
                            )}
                            {u.permissions.canAccessBackups && (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">
                                نسخ احتياطي
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs text-stone-500">
                        {u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace('T', ' ') : 'لم يسجل دخولاً بعد'}
                      </td>
                      <td className="p-3">
                        {u.role === 'owner' ? (
                          <span className="text-xs text-stone-400 font-semibold">
                            حساب المالك الأساسي (محمي)
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingTargetAdmin({
                                  id: u.id,
                                  username: u.username,
                                  displayName: u.displayName,
                                  permissions: { ...u.permissions },
                                })
                              }
                              className="px-2.5 py-1 rounded bg-stone-100 hover:bg-omani-gold/30 text-stone-800 text-xs font-bold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetPwdTargetId(u.id);
                                setResetPwdValue('');
                                setResetPwdForceChange(true);
                              }}
                              className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>كلمة المرور</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAdminActive(u)}
                              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 ${
                                u.isActive
                                  ? 'bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-800'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {u.isActive ? (
                                <>
                                  <UserX className="w-3 h-3" />
                                  <span>تعطيل</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>تفعيل</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAdminAccount(u)}
                              className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-700"
                              title="حذف حساب المسؤول نهائياً"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* التبويب 6 (للمسؤول Admin): حسابي وتغيير كلمة المرور */}
      {!isOwner && activeTab === 'my_account' && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-omani-ivory-border space-y-5">
          <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-omani-red" />
            <span>حساب المسؤول وتغيير كلمة المرور</span>
          </h2>
          <div className="p-4 rounded-2xl bg-omani-ivory/60 border border-omani-ivory-border text-xs space-y-1.5">
            <div>
              <strong>الاسم الظاهر:</strong> {adminUser?.displayName}
            </div>
            <div>
              <strong>اسم المستخدم:</strong> {adminUser?.username}
            </div>
            <div>
              <strong>نوع الحساب:</strong> مسؤول محتوى (Admin)
            </div>
          </div>

          {pwdChangeError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
              {pwdChangeError}
            </div>
          )}
          {pwdChangeSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {pwdChangeSuccess}
            </div>
          )}

          <form onSubmit={handleChangeOwnPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                كلمة المرور الحالية *
              </label>
              <input
                type="password"
                required
                value={currentPwdInput}
                onChange={(e) => setCurrentPwdInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                كلمة المرور الجديدة (8 أحرف على الأقل) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPwdInput}
                onChange={(e) => setNewPwdInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                تأكيد كلمة المرور الجديدة *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPwdInput}
                onChange={(e) => setConfirmPwdInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-xs sm:text-sm"
            >
              تحديث كلمة المرور الخاصة بي
            </button>
          </form>
        </div>
      )}

      {/* التبويب 7 (للمالك فقط): إعدادات Gemini API الآمنة واختبار الاتصال وسجل الأخطاء */}
      {isOwner && activeTab === 'ai_and_logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-5">
            <h2 className="text-lg font-extrabold text-stone-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-omani-red" />
              <span>إعدادات Google Gemini API الآمنة (للمالك فقط — جهة الخادم)</span>
            </h2>

            {aiSettings && (
              <div className="p-4 rounded-2xl bg-omani-ivory border border-omani-ivory-border space-y-2 text-xs">
                <div>
                  <strong>حالة المفتاح الحالية:</strong>{' '}
                  <span className={aiSettings.hasApiKey ? 'text-omani-green font-bold' : 'text-amber-800 font-bold'}>
                    {aiSettings.maskedKeyHint}
                  </span>
                </div>
                <div>
                  <strong>آخر اختبار اتصال:</strong> {aiSettings.lastTestMessage}
                </div>
                <button
                  type="button"
                  onClick={handleTestGeminiConnection}
                  disabled={busy}
                  className="mt-2 px-4 py-2 rounded-xl bg-omani-green hover:bg-omani-green-light text-white font-bold flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4" />
                  <span>اختبار الاتصال بالنموذج الآن</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAISettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  مفتاح Gemini API الجديد (يُشفّر بـ AES-256-GCM على الخادم ولا يظهر في المتصفح أبداً):
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="اتركه فارغاً للإبقاء على المفتاح الحالي، أو الصق المفتاح الجديد هنا..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  اسم نموذج Gemini (قابل للتغيير دون إعادة بناء الموقع):
                </label>
                <input
                  type="text"
                  value={modelNameInput}
                  onChange={(e) => setModelNameInput(e.target.value)}
                  list="gemini-models-list"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono"
                />
                <datalist id="gemini-models-list">
                  <option value="gemini-2.5-flash" />
                  <option value="gemini-2.5-pro" />
                  <option value="gemini-2.0-flash" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    الحد الأقصى للرموز (Max Output Tokens):
                  </label>
                  <input
                    type="number"
                    min={256}
                    max={4096}
                    value={maxTokensInput}
                    onChange={(e) => setMaxTokensInput(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    الحد الأقصى للطلبات/دقيقة:
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={rateLimitInput}
                    onChange={(e) => setRateLimitInput(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-stone-800 bg-omani-ivory p-3 rounded-xl border border-omani-ivory-border">
                <input
                  type="checkbox"
                  checked={enableWebSearchInput}
                  onChange={(e) => setEnableWebSearchInput(e.target.checked)}
                />
                <span>
                  تفعيل ميزة البحث عبر Google Search Grounding افتراضياً (قابلة للتشغيل والإيقاف مستقلاً)
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-omani-red hover:bg-omani-red-dark text-white font-extrabold text-sm"
              >
                حفظ إعدادات الذكاء الاصطناعي بأمان
              </button>
            </form>
          </div>

          {/* سجل الأخطاء والعمليات الخالي من الأسرار */}
          <div className="bg-white rounded-3xl p-6 border border-omani-ivory-border space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900">
              سجل عمليات النظام والأخطاء (خالٍ تماماً من المفاتيح والأسرار)
            </h2>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-stone-100 text-xs">
              {logs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        log.level === 'error'
                          ? 'bg-red-50 text-red-800'
                          : log.level === 'security'
                          ? 'bg-purple-50 text-purple-900'
                          : log.level === 'warning'
                          ? 'bg-amber-50 text-amber-900'
                          : 'bg-stone-100 text-stone-800'
                      }`}
                    >
                      [{log.level.toUpperCase()}] {log.module}
                    </span>
                    <span className="text-stone-400">
                      {log.createdAt.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                  <div className="font-bold text-stone-800">{log.message}</div>
                  {log.details && <div className="text-stone-500">{log.details}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
