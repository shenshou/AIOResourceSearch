import type { AdaptersConfig, ContentCategory, SourceDefinition, SourcesConfig } from "@aio-resource-search/shared";
import { getProviderAdapter } from "./registry";
import { parseHtmlResults } from "./html-parser";
import type { NormalizedResource, ProviderAdapter } from "./types";
import { RESOURCE_RELATIONSHIP_TYPES } from "@aio-resource-search/shared";
import { createCoordinatedFetch, type RateLimitCoordinatorNamespace } from "../rate-limit-coordinator";
import { readEpornerRemovalSyncState } from "../eporner-removals";
import { readSourceCredential, type Env } from "../env";

const MAX_RESULTS_PER_SOURCE = 50;
const MAX_TOTAL_RESULTS = 100;

export interface SearchRequest {
  query: string;
  mode: "number" | "keyword";
  contentCategory?: ContentCategory | "all";
}

export interface SourceSearchStatus {
  sourceId: string;
  sourceName: string;
  status: "ok" | "error" | "timeout" | "unavailable";
  resultCount: number;
  errorCode?:
    | "adapter_unavailable"
    | "adapter_incompatible"
    | "provider_failed"
    | "provider_timeout"
    | "credential_unavailable";
}

export interface ExternalSearchLink {
  sourceId: string;
  sourceName: string;
  category: SourceDefinition["category"];
  kind: "search" | "homepage";
  url: string;
}

export interface SourceAttribution {
  sourceId: string;
  sourceName: string;
  category: SourceDefinition["category"];
}

export interface SearchResponse {
  query: string;
  mode: SearchRequest["mode"];
  results: NormalizedResource[];
  sources: SourceSearchStatus[];
  externalSearches: ExternalSearchLink[];
  meta: {
    totalResults: number;
    successfulSources: number;
    failedSources: number;
  };
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isMagnetUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return false;
    return url.searchParams.getAll("xt").some((topic) => {
      const match = /^urn:btih:([a-z0-9]{32}|[a-f0-9]{40})$/i.exec(topic);
      return Boolean(match);
    });
  } catch {
    return false;
  }
}

function isEd2kUri(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 4096 &&
    /^ed2k:\/\/\|file\|[^|]{1,255}\|\d+\|[a-f0-9]{32}\|/i.test(value);
}

function normalizeResource(
  value: NormalizedResource,
  source: SourceDefinition,
): NormalizedResource | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.id !== "string" || value.id.length < 1 || value.id.length > 512) return null;
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 500) return null;
  if (!isHttpsUrl(value.url)) return null;

  const metadata = value.metadata && typeof value.metadata === "object"
    ? Object.fromEntries(Object.entries(value.metadata)
        .filter(([key, item]) =>
          /^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) &&
          typeof item === "string" &&
          item.trim().length > 0 &&
          item.length <= 500,
        )
        .slice(0, 20)
        .map(([key, item]) => [key, (item as string).trim()]))
    : undefined;
  const catalogNumber = typeof value.catalogNumber === "string" ? value.catalogNumber.trim() : "";
  const releaseDate = typeof value.releaseDate === "string" ? value.releaseDate.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";

  const rawRelationships = source.capabilities.includes("metadata") && Array.isArray(value.relationships)
    ? value.relationships
        .slice(0, 80)
        .filter((relationship) =>
          relationship &&
          typeof relationship === "object" &&
          RESOURCE_RELATIONSHIP_TYPES.includes(relationship.type) &&
          typeof relationship.name === "string" &&
          relationship.name.trim().length > 0 &&
          relationship.name.length <= 120 &&
          (relationship.url === undefined || isHttpsUrl(relationship.url)),
        )
        .map((relationship) => ({
          type: relationship.type,
          name: relationship.name.trim(),
          ...(relationship.url ? { url: relationship.url } : {}),
        }))
    : undefined;
  const relationships = rawRelationships?.length
    ? mergeRelationships([], rawRelationships)
    : undefined;

  const externalLinks = Array.isArray(value.externalLinks)
    ? value.externalLinks
        .filter((link) =>
          link &&
          typeof link.label === "string" &&
          link.label.trim().length > 0 &&
          link.label.length <= 80 &&
          isHttpsUrl(link.url),
        )
        .slice(0, 20)
        .map((link) => ({ label: link.label.trim(), url: link.url }))
    : undefined;

  return {
    id: value.id,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    contentCategory: source.contentCategory ?? "jav",
    title: value.title.trim(),
    url: value.url,
    ...(source.capabilities.includes("metadata") && catalogNumber.length > 0 && catalogNumber.length <= 100
      ? { catalogNumber }
      : {}),
    ...(source.capabilities.includes("metadata") && releaseDate.length > 0 && releaseDate.length <= 40
      ? { releaseDate }
      : {}),
    ...(source.capabilities.includes("image") && isHttpsUrl(value.imageUrl) ? { imageUrl: value.imageUrl } : {}),
    ...(source.capabilities.includes("metadata") && description.length > 0 && description.length <= 4000
      ? { description }
      : {}),
    ...(source.capabilities.includes("metadata") && metadata && Object.keys(metadata).length ? { metadata } : {}),
    ...(source.capabilities.includes("magnet") && isMagnetUri(value.magnetUri) ? { magnetUri: value.magnetUri } : {}),
    ...(source.capabilities.includes("ed2k") && isEd2kUri(value.ed2kUri) ? { ed2kUri: value.ed2kUri } : {}),
    ...(source.capabilities.includes("torrent") && isHttpsUrl(value.torrentUrl) ? { torrentUrl: value.torrentUrl } : {}),
    ...(externalLinks?.length ? { externalLinks } : {}),
    ...(relationships?.length ? { relationships } : {}),
  };
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

/**
 * JAV catalogue numbers are stable cross-provider identity hints.
 * Normalize only conservative ASCII alphanumeric codes; never infer identity
 * from titles, actor names, or fuzzy similarity.
 */
function canonicalCatalogNumber(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const normalized = value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4 || normalized.length > 40) return null;
  if (!/[A-Z]/.test(normalized) || !/[0-9]/.test(normalized)) return null;
  return normalized;
}

function resourceIdentityKeys(resource: NormalizedResource): { url: string; catalog?: string } {
  const url = `url:${canonicalUrl(resource.url)}`;
  if ((resource.contentCategory ?? "jav") !== "jav") return { url };
  const catalogNumber = canonicalCatalogNumber(resource.catalogNumber);
  return catalogNumber ? { url, catalog: `jav:${catalogNumber}` } : { url };
}

function mergeRelationships(
  existing: NormalizedResource["relationships"],
  incoming: NormalizedResource["relationships"],
): NormalizedResource["relationships"] {
  const merged = new Map<string, NonNullable<NormalizedResource["relationships"]>[number]>();
  for (const relationship of [...(existing ?? []), ...(incoming ?? [])]) {
    const key = `${relationship.type}:${relationship.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()}`;
    const current = merged.get(key);
    if (!current) {
      if (merged.size < 40) merged.set(key, relationship);
    } else if (!current.url && relationship.url) {
      merged.set(key, { ...current, url: relationship.url });
    }
  }
  return [...merged.values()];
}

type ProviderResolution =
  | { provider: ProviderAdapter; errorCode?: never }
  | { provider: null; errorCode: "adapter_unavailable" | "adapter_incompatible" };

function resolveProvider(
  source: SourceDefinition,
  adapterConfig: AdaptersConfig,
  mode: SearchRequest["mode"],
  getAdapter: (adapterId: string) => ProviderAdapter | null,
): ProviderResolution {
  const adapterId = source.adapterId ?? "";
  if (!adapterId) return { provider: null, errorCode: "adapter_unavailable" };
  const metadata = adapterConfig.adapters.find((adapter) => adapter.id === adapterId);
  if (!metadata || !metadata.enabled || !metadata.implemented) {
    return { provider: null, errorCode: "adapter_unavailable" };
  }

  const provider = getAdapter(adapterId);
  if (!provider) return { provider: null, errorCode: "adapter_unavailable" };

  const compatible =
    provider.categories.includes(source.category) &&
    metadata.categories.includes(source.category) &&
    (!provider.contentCategories || provider.contentCategories.includes(source.contentCategory ?? "jav")) &&
    (!metadata.contentCategories || metadata.contentCategories.includes(source.contentCategory ?? "jav")) &&
    provider.searchModes.includes(mode) &&
    source.searchModes.includes(mode) &&
    source.capabilities.every((capability) => provider.capabilities.includes(capability)) &&
    source.capabilities.every((capability) => metadata.capabilities.includes(capability));

  return compatible
    ? { provider }
    : { provider: null, errorCode: "adapter_incompatible" };
}

async function searchOneSource(
  source: SourceDefinition,
  request: SearchRequest,
  adapterConfig: AdaptersConfig,
  getAdapter: (adapterId: string) => ProviderAdapter | null,
  cache?: Cache,
  requestSignal?: AbortSignal,
  rateLimitCoordinator?: RateLimitCoordinatorNamespace,
  env?: Env,
): Promise<{
  status: SourceSearchStatus;
  resources: NormalizedResource[];
}> {
  const resolution = resolveProvider(source, adapterConfig, request.mode, getAdapter);
  if (!resolution.provider) {
    return {
      status: {
        sourceId: source.id,
        sourceName: source.name,
        status: "unavailable",
        resultCount: 0,
        errorCode: resolution.errorCode,
      },
      resources: [],
    };
  }

  const provider = resolution.provider;
  const credential = readSourceCredential(env, source);
  if (source.credentialBinding && !credential) {
    return {
      status: {
        sourceId: source.id,
        sourceName: source.name,
        status: "unavailable",
        resultCount: 0,
        errorCode: "credential_unavailable",
      },
      resources: [],
    };
  }
  if (requestSignal?.aborted) {
    throw requestSignal.reason ?? new DOMException("Search request was cancelled.", "AbortError");
  }

  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal?.reason);
  requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectOnAbort: (() => void) | undefined;
  try {
    const cancelled = new Promise<never>((_, reject) => {
      if (!requestSignal) return;
      rejectOnAbort = () => reject(requestSignal.reason ?? new DOMException("Search request was cancelled.", "AbortError"));
      if (requestSignal.aborted) rejectOnAbort();
      else requestSignal.addEventListener("abort", rejectOnAbort, { once: true });
    });
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        const error = new Error("Provider timed out.");
        error.name = "TimeoutError";
        reject(error);
      }, source.timeoutMs);
    });

    const providerFetch = provider.rateLimitLane
      ? rateLimitCoordinator
        ? createCoordinatedFetch(rateLimitCoordinator, provider.rateLimitLane, controller.signal)
        : (async () => {
            throw new Error("Required shared rate-limit coordinator is unavailable.");
          }) as typeof fetch
      : fetch;

    const providerResult = provider.search(
      { query: request.query, mode: request.mode },
      { source, fetch: providerFetch, signal: controller.signal, cache, parseHtml: parseHtmlResults, ...(credential ? { credential } : {}), ...(source.id === "eporner" && env ? { getEpornerSyncState: () => readEpornerRemovalSyncState(env) } : {}) },
    );
    const resources = await Promise.race([providerResult, timeout, cancelled]);
    if (!Array.isArray(resources)) throw new Error("Provider returned an invalid result set.");

    const normalized = resources
      .slice(0, MAX_RESULTS_PER_SOURCE)
      .map((resource) => normalizeResource(resource, source))
      .filter((resource): resource is NormalizedResource => resource !== null);

    return {
      status: {
        sourceId: source.id,
        sourceName: source.name,
        status: "ok",
        resultCount: normalized.length,
      },
      resources: normalized,
    };
  } catch (error) {
    if (requestSignal?.aborted) throw error;
    const timedOut = error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      status: {
        sourceId: source.id,
        sourceName: source.name,
        status: timedOut ? "timeout" : "error",
        resultCount: 0,
        errorCode: timedOut ? "provider_timeout" : "provider_failed",
      },
      resources: [],
    };
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (rejectOnAbort) requestSignal?.removeEventListener("abort", rejectOnAbort);
    requestSignal?.removeEventListener("abort", abortFromRequest);
  }
}

export async function executeSourceTest(
  source: SourceDefinition,
  request: SearchRequest,
  adapterConfig: AdaptersConfig,
  cache?: Cache,
  signal?: AbortSignal,
  rateLimitCoordinator?: RateLimitCoordinatorNamespace,
  env?: Env,
): Promise<{ status: SourceSearchStatus; results: NormalizedResource[] }> {
  const result = await searchOneSource(
    source,
    request,
    adapterConfig,
    getProviderAdapter,
    cache,
    signal,
    rateLimitCoordinator,
    env,
  );
  return { status: result.status, results: result.resources };
}

export async function executeSearch(
  request: SearchRequest,
  sourceConfig: SourcesConfig,
  adapterConfig: AdaptersConfig,
  getAdapter: (adapterId: string) => ProviderAdapter | null = getProviderAdapter,
  cache?: Cache,
  signal?: AbortSignal,
  rateLimitCoordinator?: RateLimitCoordinatorNamespace,
  env?: Env,
): Promise<SearchResponse> {
  const matchesContentCategory = (source: SourceDefinition) =>
    request.contentCategory === undefined ||
    request.contentCategory === "all" ||
    (source.contentCategory ?? "jav") === request.contentCategory;
  const enabledSources = sourceConfig.sources.filter(
    (source) => source.enabled && (source.type ?? "provider") === "provider" && matchesContentCategory(source),
  );
  const externalSearches: ExternalSearchLink[] = sourceConfig.sources
    .filter((source) =>
      source.enabled &&
      matchesContentCategory(source) &&
      source.searchModes.includes(request.mode) &&
      ((source.type === "external-search" &&
        (typeof source.searchUrlTemplate === "string" || typeof source.baseUrl === "string")) ||
       ((source.type ?? "provider") === "provider" &&
        (typeof source.externalSearchUrlTemplate === "string" || typeof source.externalSearchBaseUrl === "string"))),
    )
    .flatMap((source) => {
      try {
        const isProvider = (source.type ?? "provider") === "provider";
        const searchTemplate = isProvider ? source.externalSearchUrlTemplate : source.searchUrlTemplate;
        const homepageUrl = isProvider ? source.externalSearchBaseUrl : source.baseUrl;
        const url = searchTemplate
          ? searchTemplate.replace("{query}", encodeURIComponent(request.query))
          : homepageUrl;
        if (!url) return [];
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password) return [];
        return [{
          sourceId: source.id,
          sourceName: source.name,
          category: source.category,
          kind: searchTemplate ? "search" : "homepage",
          url: parsed.toString(),
        }];
      } catch {
        return [];
      }
    });
  const settled: Array<Awaited<ReturnType<typeof searchOneSource>>> = new Array(enabledSources.length);
  let nextIndex = 0;

  // Bound outbound fan-out so a large source list cannot start 100 requests at once.
  const workerCount = Math.min(10, enabledSources.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < enabledSources.length) {
      const index = nextIndex++;
      if (signal?.aborted) return;
      settled[index] = await searchOneSource(enabledSources[index], request, adapterConfig, getAdapter, cache, signal, rateLimitCoordinator, env);
    }
  }));

  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Search request was cancelled.", "AbortError");
  }

  const resultIndexes = new Map<string, number>();
  const results: NormalizedResource[] = [];
  for (const item of settled) {
    for (const resource of item.resources) {
      const identity = resourceIdentityKeys(resource);
      const existingIndex = resultIndexes.get(identity.url) ??
        (identity.catalog ? resultIndexes.get(identity.catalog) : undefined);
      const attribution: SourceAttribution = {
        sourceId: resource.sourceId,
        sourceName: resource.sourceName,
        category: resource.category,
      };
      if (existingIndex === undefined) {
        // Keep scanning after the global cap so later sources can still enrich
        // already-collected works with attribution and missing metadata.
        if (results.length >= MAX_TOTAL_RESULTS) continue;
        resultIndexes.set(identity.url, results.length);
        if (identity.catalog) resultIndexes.set(identity.catalog, results.length);
        results.push({ ...resource, sourceAttributions: [attribution] });
        continue;
      }

      // Keep URL aliases and catalogue aliases attached to their original
      // result. A conflicting catalogue key must never be reassigned merely
      // because a stronger canonical-URL match was found.
      if (!resultIndexes.has(identity.url)) resultIndexes.set(identity.url, existingIndex);
      if (identity.catalog) {
        const catalogueMatch = resultIndexes.get(identity.catalog);
        if (catalogueMatch === undefined || catalogueMatch === existingIndex) {
          resultIndexes.set(identity.catalog, existingIndex);
        }
      }
      const existing = results[existingIndex];
      const attributions = existing.sourceAttributions ?? [];
      const hasAttribution = attributions.some((item) => item.sourceId === attribution.sourceId);
      const links = [...(existing.externalLinks ?? []), ...(resource.externalLinks ?? [])];
      const uniqueLinkMap = new Map<string, NonNullable<NormalizedResource["externalLinks"]>[number]>();
      for (const link of links) {
        if (!uniqueLinkMap.has(link.url)) uniqueLinkMap.set(link.url, link);
      }
      const uniqueLinks = [...uniqueLinkMap.values()].slice(0, 20);
      const mergedRelationships = mergeRelationships(existing.relationships, resource.relationships);
      results[existingIndex] = {
        ...existing,
        sourceAttributions: hasAttribution ? attributions : [...attributions, attribution],
        catalogNumber: existing.catalogNumber ?? resource.catalogNumber,
        releaseDate: existing.releaseDate ?? resource.releaseDate,
        imageUrl: existing.imageUrl ?? resource.imageUrl,
        description: existing.description ?? resource.description,
        metadata: {
          ...(resource.metadata ?? {}),
          ...(existing.metadata ?? {}),
        },
        magnetUri: existing.magnetUri ?? resource.magnetUri,
        ed2kUri: existing.ed2kUri ?? resource.ed2kUri,
        torrentUrl: existing.torrentUrl ?? resource.torrentUrl,
        ...(uniqueLinks.length ? { externalLinks: uniqueLinks } : {}),
        ...(mergedRelationships?.length ? { relationships: mergedRelationships } : {}),
      };
    }
  }

  const sources = settled.map((item) => item.status);
  return {
    query: request.query,
    mode: request.mode,
    results,
    sources,
    externalSearches,
    meta: {
      totalResults: results.length,
      successfulSources: sources.filter((source) => source.status === "ok").length,
      failedSources: sources.filter((source) => source.status !== "ok").length,
    },
  };
}
