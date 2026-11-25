import type {
  ContentCategory,
  FetchMechanism,
  HtmlSelectorConfig,
  SearchMode,
  SourceCapability,
  SourceCategory,
  SourceDefinition,
} from "@aio-resource-search/shared";

/** A resource returned by a provider, normalized into the platform contract. */
export interface NormalizedResource {
  /** Stable identifier within the source, preferably derived from its canonical URL. */
  id: string;
  sourceId: string;
  sourceName: string;
  category: SourceCategory;
  /** All configured sources that returned the same canonical resource URL. */
  sourceAttributions?: Array<{
    sourceId: string;
    sourceName: string;
    category: SourceCategory;
  }>;
  contentCategory?: ContentCategory;
  title: string;
  url: string;
  catalogNumber?: string;
  releaseDate?: string;
  imageUrl?: string;
  description?: string;
  /** Extensible category-specific metadata; values are normalized strings. */
  metadata?: Record<string, string>;
  magnetUri?: string;
  ed2kUri?: string;
  torrentUrl?: string;
  externalLinks?: Array<{
    label: string;
    url: string;
  }>;
}

export interface ProviderSearchInput {
  query: string;
  mode: SearchMode;
}

export interface ProviderContext {
  source: SourceDefinition;
  /** Use the Worker Fetch API; adapters must honor the supplied abort signal. */
  fetch: typeof fetch;
  signal: AbortSignal;
  /** Optional Cloudflare edge cache for upstream APIs with explicit cache intervals. */
  cache?: Cache;
  /** Cloudflare HTMLRewriter-backed parser, injected by the Worker runtime. */
  parseHtml?: (response: Response, selectors: HtmlSelectorConfig) => Promise<Array<{ title: string; url: string; imageUrl?: string; description?: string; magnetUri?: string; metadata?: Record<string, string> }>>;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly version: string;
  readonly mechanism?: FetchMechanism;
  readonly contentCategories?: readonly ContentCategory[];
  readonly categories: readonly SourceCategory[];
  readonly capabilities: readonly SourceCapability[];
  readonly searchModes: readonly SearchMode[];
  search(
    input: ProviderSearchInput,
    context: ProviderContext,
  ): Promise<NormalizedResource[]>;
}
