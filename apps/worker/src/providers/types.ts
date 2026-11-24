import type {
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
  title: string;
  url: string;
  catalogNumber?: string;
  releaseDate?: string;
  imageUrl?: string;
  description?: string;
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
}

export interface ProviderAdapter {
  readonly id: string;
  readonly version: string;
  readonly categories: readonly SourceCategory[];
  readonly capabilities: readonly SourceCapability[];
  readonly searchModes: readonly SearchMode[];
  search(
    input: ProviderSearchInput,
    context: ProviderContext,
  ): Promise<NormalizedResource[]>;
}
