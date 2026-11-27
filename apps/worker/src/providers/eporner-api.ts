import type { ResourceRelationship } from "@aio-resource-search/shared";
import type { ProviderAdapter, ProviderContext } from "./types";
import { isEpornerRemovalSyncFresh } from "../eporner-removals";

const API_HOST = "www.eporner.com";
const SEARCH_ENDPOINT = "https://www.eporner.com/api/v2/video/search/";
const STATUS_ENDPOINT = "https://www.eporner.com/api/v2/video/status/";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_LENGTH = 120;
const SEARCH_CACHE_TTL_SECONDS = 300;
const STATUS_CACHE_TTL_SECONDS = 60;

interface EpornerVideo {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  keywords?: unknown;
  views?: unknown;
  rate?: unknown;
  length_sec?: unknown;
  added?: unknown;
  categories?: unknown;
  pornstars?: unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Eporner request was cancelled.", "AbortError");
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Eporner API returned an empty response body.");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("Eporner API response exceeded the size limit.");
        throw new Error("Eporner API response exceeded the size limit.");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function safeVideoUrl(value: unknown, id: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" ||
        url.hostname !== API_HOST ||
        url.username ||
        url.password ||
        !url.pathname.startsWith("/video-" + id + "/")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeEntityUrl(value: unknown, entityType: "category" | "performer"): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const pathPattern = entityType === "performer"
      ? /^\/pornstar\/[a-z0-9-]+\/?$/i
      : /^\/cat\/[a-z0-9-]+\/?$/i;
    if (
      url.protocol !== "https:" ||
      url.hostname !== API_HOST ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !pathPattern.test(url.pathname)
    ) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function videoRelationships(video: EpornerVideo): ResourceRelationship[] {
  const relationships: ResourceRelationship[] = [];
  if (Array.isArray(video.pornstars)) {
    for (const raw of video.pornstars.slice(0, 30)) {
      if (typeof raw !== "object" || raw === null || !("name" in raw) ||
          typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 120) continue;
      const url = "url" in raw ? safeEntityUrl(raw.url, "performer") : undefined;
      relationships.push({
        type: "performer",
        name: raw.name.trim(),
        ...(url ? { url } : {}),
      });
    }
  }
  if (Array.isArray(video.categories)) {
    for (const raw of video.categories.slice(0, 20)) {
      if (typeof raw !== "object" || raw === null || !("name" in raw) ||
          typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 120) continue;
      const url = "url" in raw ? safeEntityUrl(raw.url, "category") : undefined;
      relationships.push({
        type: "genre",
        name: raw.name.trim(),
        ...(url ? { url } : {}),
      });
    }
  }
  if (typeof video.keywords === "string") {
    for (const keyword of video.keywords.split(",").slice(0, 20)) {
      const name = keyword.trim();
      if (name && name.length <= 120) relationships.push({ type: "tag", name });
    }
  }
  return relationships.slice(0, 40);
}

function parseSearchResults(payload: unknown): EpornerVideo[] {
  if (typeof payload !== "object" || payload === null ||
      !("videos" in payload) || !Array.isArray(payload.videos)) {
    throw new Error("Eporner API returned an invalid search response.");
  }
  return payload.videos as EpornerVideo[];
}

function sanitizeEntityReferences(value: unknown): Array<{ name: unknown; url: unknown }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((raw) => {
    if (typeof raw !== "object" || raw === null) return [];
    const record = raw as Record<string, unknown>;
    return [{ name: record.name, url: record.url }];
  });
}

function sanitizeSearchPayload(payload: unknown): unknown {
  return {
    videos: parseSearchResults(payload).slice(0, 50).map((video) => ({
      id: video.id,
      title: video.title,
      url: video.url,
      keywords: video.keywords,
      views: video.views,
      rate: video.rate,
      length_sec: video.length_sec,
      added: video.added,
      categories: sanitizeEntityReferences(video.categories),
      pornstars: sanitizeEntityReferences(video.pornstars),
    })),
  };
}

function sanitizeStatusPayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null ||
      !("videos" in payload) || !Array.isArray(payload.videos)) {
    throw new Error("Eporner API returned an invalid status response.");
  }
  return {
    videos: payload.videos.map((video: unknown) => {
      if (typeof video !== "object" || video === null) return video;
      const record = video as Record<string, unknown>;
      return { id: record.id, status: record.status };
    }),
  };
}

function parseStatuses(payload: unknown, expectedIds: string[]): Set<string> {
  if (typeof payload !== "object" || payload === null ||
      !("videos" in payload) || !Array.isArray(payload.videos)) {
    throw new Error("Eporner API returned an invalid status response.");
  }
  const statuses = new Map<string, string>();
  for (const raw of payload.videos) {
    if (typeof raw !== "object" || raw === null ||
        !("id" in raw) || typeof raw.id !== "string" ||
        !("status" in raw) || typeof raw.status !== "string" ||
        !/^[A-Za-z0-9]{11}$/.test(raw.id) ||
        !["active", "removed", "unavailable", "unknown"].includes(raw.status) ||
        statuses.has(raw.id)) {
      throw new Error("Eporner API returned an invalid video status record.");
    }
    statuses.set(raw.id, raw.status);
  }
  if (expectedIds.some((id) => !statuses.has(id))) {
    throw new Error("Eporner API omitted one or more requested video statuses.");
  }
  return new Set(expectedIds.filter((id) => statuses.get(id) === "active"));
}

async function fetchJson(
  url: URL,
  context: ProviderContext,
  cacheTtlSeconds: number,
  sanitizeForCache?: (payload: unknown) => unknown,
): Promise<unknown> {
  throwIfAborted(context.signal);
  const cacheKey = new Request(url.toString(), { method: "GET" });
  let cached: Response | undefined;
  if (context.cache) {
    try {
      cached = await context.cache.match(cacheKey);
    } catch {
      // Cache is an optimization; an unavailable cache must not fail a live request.
    }
  }
  throwIfAborted(context.signal);

  if (cached) {
    try {
      return JSON.parse(await readLimitedText(cached));
    } catch {
      // Ignore a malformed cache entry and refresh from the documented API.
    }
  }

  const response = await context.fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "AIOResourceSearch/0.1.0 (+https://github.com/shenshou/AIOResourceSearch)",
    },
    redirect: "manual",
    signal: context.signal,
  });
  throwIfAborted(context.signal);
  if (!response.ok) throw new Error("Eporner API returned HTTP " + response.status + ".");
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
      throw new Error("Eporner API redirected to an unexpected host.");
    }
  }
  if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    throw new Error("Eporner API returned an unexpected content type.");
  }
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Eporner API response exceeded the size limit.");
  }

  const text = await readLimitedText(response);
  throwIfAborted(context.signal);
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Eporner API returned malformed JSON.", { cause: error });
    throw error;
  }

  const cachePayload = sanitizeForCache ? sanitizeForCache(payload) : payload;
  if (context.cache) {
    try {
      await context.cache.put(cacheKey, new Response(JSON.stringify(cachePayload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=" + cacheTtlSeconds,
        },
      }));
    } catch {
      // A cache write failure must not discard valid upstream results.
    }
  }
  return cachePayload;
}

/** Metadata-only integration; search results are status-checked before return. */
export const epornerApiProvider: ProviderAdapter = {
  id: "eporner-api",
  version: "1.1.0",
  mechanism: "api",
  contentCategories: ["jav"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["keyword"],
  rateLimitLane: "eporner",
  async search(input, context) {
    if (input.mode !== "keyword") throw new Error("Eporner supports keyword search only.");
    if (!input.query.trim() || input.query.length > MAX_QUERY_LENGTH) {
      throw new Error("Eporner query must contain 1 to 120 characters.");
    }
    const syncState = await context.getEpornerSyncState?.();
    if (!isEpornerRemovalSyncFresh(syncState ?? null)) {
      throw new Error("Eporner removal feed has not completed a recent successful sync.");
    }

    const searchUrl = new URL(SEARCH_ENDPOINT);
    searchUrl.searchParams.set("query", input.query.trim());
    searchUrl.searchParams.set("per_page", "50");
    searchUrl.searchParams.set("page", "1");
    searchUrl.searchParams.set("thumbs", "none");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("gay", "1");
    searchUrl.searchParams.set("fields", "pornstars,categories");

    const searchPayload = await fetchJson(searchUrl, context, SEARCH_CACHE_TTL_SECONDS, sanitizeSearchPayload);
    const rawVideos = parseSearchResults(searchPayload).slice(0, 50);
    const seenIds = new Set<string>();
    const validVideos = rawVideos.flatMap((video) => {
      const id = typeof video.id === "string" && /^[A-Za-z0-9]{11}$/.test(video.id) ? video.id : "";
      const title = typeof video.title === "string" ? video.title.trim() : "";
      const url = id ? safeVideoUrl(video.url, id) : null;
      if (!id || !title || title.length > 500 || !url || seenIds.has(id)) return [];
      seenIds.add(id);
      return [{ video, id, title, url }];
    });
    if (!validVideos.length) return [];

    const statusUrl = new URL(STATUS_ENDPOINT);
    statusUrl.searchParams.set("id", validVideos.map((item) => item.id).join(","));
    const statusPayload = await fetchJson(statusUrl, context, STATUS_CACHE_TTL_SECONDS, sanitizeStatusPayload);
    const activeIds = parseStatuses(statusPayload, validVideos.map((item) => item.id));

    throwIfAborted(context.signal);
    return validVideos.flatMap(({ video, id, title, url }) => {
      if (!activeIds.has(id)) return [];
      const metadata: Record<string, string> = {};
      if (typeof video.keywords === "string" && video.keywords.trim()) metadata.keywords = video.keywords.trim().slice(0, 500);
      if (typeof video.views === "number" && Number.isSafeInteger(video.views) && video.views >= 0) metadata.views = String(video.views);
      if (typeof video.rate === "string" && /^\d{1,2}(?:\.\d{1,3})?$/.test(video.rate)) metadata.rating = video.rate;
      if (typeof video.length_sec === "number" &&
          Number.isSafeInteger(video.length_sec) && video.length_sec >= 0 && video.length_sec <= 86400) {
        metadata.durationSeconds = String(video.length_sec);
      }
      // The legacy added field has no timezone offset; retain it verbatim.
      if (typeof video.added === "string" && video.added.length <= 40) metadata.addedAtSource = video.added;

      const relationships = videoRelationships(video);
      return [{
        id,
        sourceId: context.source.id,
        sourceName: context.source.name,
        category: "other-index" as const,
        contentCategory: "jav" as const,
        title,
        url,
        ...(metadata.keywords ? { description: metadata.keywords } : {}),
        ...(Object.keys(metadata).length ? { metadata } : {}),
        ...(relationships.length ? { relationships } : {}),
      }];
    });
  },
};
