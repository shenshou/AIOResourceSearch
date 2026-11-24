import type { AdaptersConfig, SourceDefinition, SourcesConfig } from "@aio-resource-search/shared";
import { getProviderAdapter } from "./registry";
import type { NormalizedResource, ProviderAdapter } from "./types";

const MAX_RESULTS_PER_SOURCE = 50;
const MAX_TOTAL_RESULTS = 100;

export interface SearchRequest {
  query: string;
  mode: "number" | "keyword";
}

export interface SourceSearchStatus {
  sourceId: string;
  sourceName: string;
  status: "ok" | "error" | "timeout" | "unavailable";
  resultCount: number;
  errorCode?: "adapter_unavailable" | "adapter_incompatible" | "provider_failed" | "provider_timeout";
}

export interface SearchResponse {
  query: string;
  mode: SearchRequest["mode"];
  results: NormalizedResource[];
  sources: SourceSearchStatus[];
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
  return typeof value === "string" &&
    value.length <= 4096 &&
    /^magnet:\?xt=urn:btih:[a-z0-9]{32,40}(?:&|$)/i.test(value);
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
    title: value.title.trim(),
    url: value.url,
    ...(typeof value.catalogNumber === "string" && value.catalogNumber.length <= 100
      ? { catalogNumber: value.catalogNumber.trim() }
      : {}),
    ...(typeof value.releaseDate === "string" && value.releaseDate.length <= 40
      ? { releaseDate: value.releaseDate }
      : {}),
    ...(isHttpsUrl(value.imageUrl) ? { imageUrl: value.imageUrl } : {}),
    ...(typeof value.description === "string" && value.description.length <= 4000
      ? { description: value.description }
      : {}),
    ...(isMagnetUri(value.magnetUri) ? { magnetUri: value.magnetUri } : {}),
    ...(isEd2kUri(value.ed2kUri) ? { ed2kUri: value.ed2kUri } : {}),
    ...(isHttpsUrl(value.torrentUrl) ? { torrentUrl: value.torrentUrl } : {}),
    ...(externalLinks?.length ? { externalLinks } : {}),
  };
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function compatibleProvider(
  source: SourceDefinition,
  adapterConfig: AdaptersConfig,
  mode: SearchRequest["mode"],
): ProviderAdapter | null {
  const metadata = adapterConfig.adapters.find(
    (adapter) => adapter.id === source.adapterId && adapter.enabled && adapter.implemented,
  );
  if (!metadata) return null;

  const provider = getProviderAdapter(source.adapterId);
  if (!provider) return null;
  if (
    !provider.categories.includes(source.category) ||
    !provider.searchModes.includes(mode) ||
    !source.searchModes.includes(mode) ||
    !source.capabilities.every((capability) => provider.capabilities.includes(capability)) ||
    !source.capabilities.every((capability) => metadata.capabilities.includes(capability))
  ) return null;

  return provider;
}

export async function executeSearch(
  request: SearchRequest,
  sourceConfig: SourcesConfig,
  adapterConfig: AdaptersConfig,
): Promise<SearchResponse> {
  const enabledSources = sourceConfig.sources.filter((source) => source.enabled);
  const settled = await Promise.all(enabledSources.map(async (source) => {
    const provider = compatibleProvider(source, adapterConfig, request.mode);
    if (!provider) {
      return {
        status: {
          sourceId: source.id,
          sourceName: source.name,
          status: "unavailable" as const,
          resultCount: 0,
          errorCode: "adapter_unavailable" as const,
        },
        resources: [] as NormalizedResource[],
      };
    }

    try {
      const resources = await provider.search(
        { query: request.query, mode: request.mode },
        { source, fetch, signal: AbortSignal.timeout(source.timeoutMs) },
      );
      if (!Array.isArray(resources)) throw new Error("Provider returned an invalid result set.");

      const normalized = resources
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map((resource) => normalizeResource(resource, source))
        .filter((resource): resource is NormalizedResource => resource !== null);

      return {
        status: {
          sourceId: source.id,
          sourceName: source.name,
          status: "ok" as const,
          resultCount: normalized.length,
        },
        resources: normalized,
      };
    } catch (error) {
      const timedOut = error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      return {
        status: {
          sourceId: source.id,
          sourceName: source.name,
          status: timedOut ? "timeout" as const : "error" as const,
          resultCount: 0,
          errorCode: timedOut ? "provider_timeout" as const : "provider_failed" as const,
        },
        resources: [] as NormalizedResource[],
      };
    }
  }));

  const seen = new Set<string>();
  const results: NormalizedResource[] = [];
  for (const item of settled) {
    for (const resource of item.resources) {
      const key = canonicalUrl(resource.url);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(resource);
      if (results.length >= MAX_TOTAL_RESULTS) break;
    }
    if (results.length >= MAX_TOTAL_RESULTS) break;
  }

  const sources = settled.map((item) => item.status);
  return {
    query: request.query,
    mode: request.mode,
    results,
    sources,
    meta: {
      totalResults: results.length,
      successfulSources: sources.filter((source) => source.status === "ok").length,
      failedSources: sources.filter((source) => source.status !== "ok").length,
    },
  };
}
