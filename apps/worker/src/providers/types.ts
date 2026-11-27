import type { EpornerRemovalSyncState } from "../eporner-removals";
import type {
  ContentCategory,
  FieldAttribution,
  ResourceRelationship,
  ResourceLink,
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
  /** All configured sources that contributed to the same aggregated work identity. */
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
  /** Source provenance for individually prioritized scalar and metadata fields. */
  fieldAttributions?: Record<string, FieldAttribution>;
  magnetUri?: string;
  ed2kUri?: string;
  torrentUrl?: string;
  /** Multiple downloadable links, each retaining the source that supplied it. */
  resourceLinks?: ResourceLink[];
  externalLinks?: Array<{
    label: string;
    url: string;
  }>;
  relationships?: ResourceRelationship[];
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
  /** Optional secret value resolved from the source Worker secret binding; never persisted or returned to clients. */
  credential?: string;
  /** Optional Cloudflare edge cache for upstream APIs with explicit cache intervals. */
  cache?: Cache;
  /** Eporner requires a recent completed official removal-feed sync before returning results. */
  getEpornerSyncState?: () => Promise<EpornerRemovalSyncState | null>;
  /** Cloudflare HTMLRewriter-backed parser, injected by the Worker runtime. */
  parseHtml?: (response: Response, selectors: HtmlSelectorConfig) => Promise<Array<{ title: string; url: string; imageUrl?: string; description?: string; magnetUri?: string; torrentUrl?: string; ed2kUri?: string; resourceLinks?: Array<{ type: "magnet" | "torrent" | "ed2k"; url: string }>; metadata?: Record<string, string> }>>;
}

export interface ProviderAdapter {
  readonly id: string;
  /** Shared upstream pacing lane; missing coordinator must fail closed. */
  readonly rateLimitLane?: "musicbrainz" | "mangadex" | "anibt" | "therarbg" | "eporner" | "librivox" | "audiosilo" | "perverzija";
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
