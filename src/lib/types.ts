export type ArticleStatus = 'under_review' | 'verified' | 'published' | 'needs_update';

export type FactClassification = 'confirmed_fact' | 'historical_narrative' | 'disputed_narrative';

export type SourceType =
  | 'official_omani'
  | 'cultural_omani'
  | 'academic_omani'
  | 'international'
  | 'historical_archive';

export type TrustLevel = 'high' | 'medium' | 'review_required';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  subcategories: string[];
  publishedCount?: number;
  totalCount?: number;
}

export interface Volume {
  id: string;
  volumeNumber: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  letterRange: string;
  categoryIds: string[];
  coverTheme: 'red' | 'green' | 'gold' | 'emerald' | 'crimson' | 'amber';
  articleCount?: number;
}

export interface ReferenceItem {
  title: string;
  url: string;
  publisher: string;
  accessDate: string;
  sourceType: SourceType;
}

export interface ArticleImage {
  url: string;
  caption: string;
  license: string;
  attribution: string;
}

export interface ArticleRevision {
  id: string;
  articleId: string;
  editorName: string;
  changeSummary: string;
  previousStatus: ArticleStatus;
  newStatus: ArticleStatus;
  snapshotTitle: string;
  snapshotContent: string;
  createdAt: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  titleNormalized: string;
  summary: string;
  summaryNormalized: string;
  content: string;
  contentNormalized: string;
  categoryId: string;
  categoryName?: string;
  subcategory: string;
  volumeId: string | null;
  volumeTitle?: string;
  keywords: string[];
  keywordsNormalized: string;
  authorOrPublisher: string;
  sourceId: string | null;
  sourceName?: string;
  sourceType?: SourceType;
  sourceUrl: string;
  references: ReferenceItem[];
  publishedAt: string;
  lastVerifiedAt: string;
  status: ArticleStatus;
  factClassification: FactClassification;
  licenseInfo: string;
  images: ArticleImage[];
  contentHash: string;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  revisions?: ArticleRevision[];
}

export interface Source {
  id: string;
  name: string;
  url: string;
  domain: string;
  sourceType: SourceType;
  publisher: string;
  trustLevel: TrustLevel;
  licenseInfo: string;
  allowedScraping: boolean;
  lastCheckedAt: string | null;
  status: 'active' | 'unreachable' | 'paused';
  notes: string;
  createdAt: string;
  articleCount?: number;
}

export interface ImportJob {
  id: string;
  jobType: 'url_fetch' | 'topic_discovery' | 'batch_refresh' | 'manual_file';
  targetUrlOrQuery: string;
  sourceId: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'duplicate_skipped';
  extractedTitle: string;
  publisherName: string;
  createdArticleId: string | null;
  errorMessage: string;
  errorReasonCode: string;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  startedAt: string;
  completedAt: string | null;
}

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  sourceId?: string;
  volumeId?: string;
  status?: ArticleStatus | 'all_public' | 'all';
  dateFrom?: string;
  dateTo?: string;
  factClassification?: FactClassification;
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  article: Article;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  total: number;
  hits: SearchHit[];
  relatedArticles: Article[];
  executionTimeMs: number;
}

export interface DuplicatePair {
  articleA: Pick<Article, 'id' | 'slug' | 'title' | 'sourceUrl' | 'status' | 'createdAt'>;
  articleB: Pick<Article, 'id' | 'slug' | 'title' | 'sourceUrl' | 'status' | 'createdAt'>;
  similarity: number;
  reason: string;
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error' | 'security';
  module: string;
  message: string;
  details: string;
  createdAt: string;
}

export interface AISettingsPublic {
  hasApiKey: boolean;
  keySource: 'env' | 'server_encrypted_store' | 'none';
  maskedKeyHint: string;
  modelName: string;
  enableWebSearch: boolean;
  maxOutputTokens: number;
  maxInputChars: number;
  rateLimitPerMinute: number;
  lastTestedAt: string | null;
  lastTestStatus: 'untested' | 'ok' | 'error';
  lastTestMessage: string;
}

export interface AICitation {
  title: string;
  url: string;
  publisher: string;
  origin: 'encyclopedia_db' | 'google_search';
  articleSlug?: string;
  snippet?: string;
}

export interface AIChatResponse {
  answer: string;
  answerOrigin: 'encyclopedia_only' | 'hybrid_encyclopedia_and_web' | 'web_grounding' | 'insufficient_info';
  encyclopediaSection: string;
  webSearchSection: string | null;
  encyclopediaCitations: AICitation[];
  webCitations: AICitation[];
  modelUsed: string;
  webSearchUsed: boolean;
  requiresSetup?: boolean;
  errorType?: 'missing_key' | 'invalid_key' | 'quota_exceeded' | 'rate_limited' | 'network_error';
}

export type UserRole = 'owner' | 'admin';

export interface AdminPermissions {
  canPublishArticles?: boolean;
  canDeleteContent?: boolean;
  canManageCategories?: boolean;
  canAccessBackups?: boolean;
}

export interface AdminUserPublic {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  permissions: AdminPermissions;
  createdBy?: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

