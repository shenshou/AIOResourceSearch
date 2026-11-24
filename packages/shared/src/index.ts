export const SOURCE_CATEGORIES = [
  "jav",
  "torrent",
  "forum",
  "other-index",
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

// User-facing content categories are independent from source transport/type.
// "torrent", "forum", and "other-index" remain source-kind categories for compatibility.
export const CONTENT_CATEGORIES = [
  "jav",
  "anime",
  "film-tv",
  "manga",
  "novel",
  "game",
  "music",
  "general",
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  jav: "JAV / 成人影视",
  anime: "动漫",
  "film-tv": "电影 / 电视剧",
  manga: "漫画",
  novel: "小说",
  game: "游戏",
  music: "音乐",
  general: "通用资源",
};

export const FETCH_MECHANISMS = ["api", "rss", "html"] as const;
export type FetchMechanism = (typeof FETCH_MECHANISMS)[number];

export const SEARCH_MODES = ["number", "keyword"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const SOURCE_CAPABILITIES = [
  "metadata",
  "image",
  "magnet",
  "ed2k",
  "torrent",
  "forum-post",
] as const;
export type SourceCapability = (typeof SOURCE_CAPABILITIES)[number];

export const SOURCE_TYPES = ["provider", "external-search"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface SourceDefinition {
  id: string;
  name: string;
  category: SourceCategory;
  /** User-facing content category. Missing legacy values are interpreted by the Worker. */
  contentCategory?: ContentCategory;
  /** provider calls a Worker implementation; external-search only builds a destination URL. */
  type?: SourceType;
  adapterId?: string;
  /** Optional HTTPS search URL template for external-search sources; must contain exactly one {query}. If omitted, baseUrl is opened as a homepage link. */
  searchUrlTemplate?: string;
  enabled: boolean;
  baseUrl?: string;
  searchModes: SearchMode[];
  capabilities: SourceCapability[];
  timeoutMs: number;
  /** Name of a Worker secret binding; never a credential value. */
  credentialBinding?: string;
  notes?: string;
}

export interface SourcesConfig {
  version: number;
  updatedAt: string | null;
  sources: SourceDefinition[];
}

/**
 * Administrative metadata for an adapter implementation.
 * This record does not contain executable code. Runtime implementations
 * remain part of the Worker bundle and require deployment when changed.
 */
export interface AdapterDefinition {
  id: string;
  name: string;
  description: string;
  /** Protocol used by this adapter implementation. */
  mechanism?: FetchMechanism;
  /** Content categories the adapter can normalize. Omitted legacy metadata defaults to JAV. */
  contentCategories?: ContentCategory[];
  version: string;
  enabled: boolean;
  categories: SourceCategory[];
  capabilities: SourceCapability[];
  /** True only when a matching implementation is registered in Worker code. */
  implemented: boolean;
  notes?: string;
}

export interface AdaptersConfig {
  version: number;
  updatedAt: string | null;
  adapters: AdapterDefinition[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
