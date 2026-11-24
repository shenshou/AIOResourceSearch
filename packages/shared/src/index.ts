export const SOURCE_CATEGORIES = [
  "jav",
  "torrent",
  "forum",
  "other-index",
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

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

export interface SourceDefinition {
  id: string;
  name: string;
  category: SourceCategory;
  adapterId: string;
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
