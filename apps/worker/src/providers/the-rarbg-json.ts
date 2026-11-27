import type { ContentCategory } from "@aio-resource-search/shared";
import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://therarbg.com/api/v1/search/";
const API_HOST = "therarbg.com";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 120;
const MAX_QUERY_LENGTH = 120;

const CATEGORY_BY_CONTENT: Record<ContentCategory, string | null> = {
  jav: "XXX",
  anime: "Anime",
  "film-tv": "Movies,TV",
  manga: null,
  novel: null,
  game: "Games",
  music: "Music",
  audiobook: null,
  general: null,
};

interface TorrentRecord {
  id?: unknown;
  name?: unknown;
  infoHash?: unknown;
  magnet?: unknown;
  category?: unknown;
  size?: unknown;
  seeders?: unknown;
  leechers?: unknown;
  added?: unknown;
  imdb?: unknown;
  qualityScore?: unknown;
  tags?: unknown;
  url?: unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

function safeDetailUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== API_HOST ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/post-detail/")
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeMagnet(value: unknown, expectedHash: string): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return null;
    const hashes = url.searchParams.getAll("xt")
      .map((topic) => /^urn:btih:([a-f0-9]{40})$/i.exec(topic)?.[1]?.toLowerCase())
      .filter((hash): hash is string => Boolean(hash));
    return hashes.includes(expectedHash.toLowerCase()) ? value : null;
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The RarBg returned an empty response body.");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("JSON response exceeded size limit.");
        throw new Error("The RarBg response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseResults(payload: unknown, sourceId: string, sourceName: string) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("results" in payload) ||
    !Array.isArray(payload.results)
  ) {
    throw new Error("The RarBg returned an invalid JSON response.");
  }

  return payload.results.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as TorrentRecord;
    const infoHash = typeof item.infoHash === "string" && /^[a-f0-9]{40}$/i.test(item.infoHash)
      ? item.infoHash.toLowerCase()
      : "";
    const title = typeof item.name === "string" ? item.name.trim() : "";
    const detailUrl = safeDetailUrl(item.url);
    const magnetUri = infoHash ? safeMagnet(item.magnet, infoHash) : null;
    if (!infoHash || !title || title.length > 500 || !detailUrl || !magnetUri) return [];

    const stats = [
      typeof item.seeders === "number" && Number.isSafeInteger(item.seeders) && item.seeders >= 0
        ? "Seeds: " + item.seeders : "",
      typeof item.leechers === "number" && Number.isSafeInteger(item.leechers) && item.leechers >= 0
        ? "Peers: " + item.leechers : "",
      typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size >= 0
        ? "Size: " + item.size + " bytes" : "",
    ].filter(Boolean);

    const metadata: Record<string, string> = { infoHash };
    if (typeof item.category === "string" && item.category.length <= 40) metadata.category = item.category;
    if (typeof item.qualityScore === "number" && Number.isInteger(item.qualityScore) && item.qualityScore >= 0 && item.qualityScore <= 100) {
      metadata.qualityScore = String(item.qualityScore);
    }
    if (Array.isArray(item.tags)) {
      const tags = item.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0 && tag.length <= 80).slice(0, 20);
      if (tags.length) metadata.tags = tags.join(", ");
    }
    if (typeof item.imdb === "string" && /^tt\d{5,12}$/.test(item.imdb)) metadata.imdbId = item.imdb;

    if (typeof item.added === "number" && Number.isSafeInteger(item.added) &&
        item.added > 0 && item.added < 4_102_444_800) {
      metadata.addedAt = new Date(item.added * 1000).toISOString();
    }

    return [{
      id: infoHash,
      sourceId,
      sourceName,
      category: "torrent" as const,
      title,
      url: detailUrl,
      magnetUri,
      ...(stats.length ? { description: stats.join(" · ") } : {}),
      metadata,
    }];
  });
}

/**
 * Uses only The RarBg's documented public JSON torrent-search endpoint.
 * Does not call TMDB-backed title/extra endpoints or fetch images.
 */
export const theRarBgProvider: ProviderAdapter = {
  id: "the-rarbg-json",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["jav", "anime", "film-tv", "game", "music"],
  categories: ["torrent"],
  capabilities: ["metadata", "magnet"],
  searchModes: ["number", "keyword"],
  rateLimitLane: "therarbg",
  async search(input, context) {
    if (input.query.length > MAX_QUERY_LENGTH) throw new Error("The RarBg query exceeds the length limit.");
    const contentCategory = context.source.contentCategory ?? "jav";
    const category = CATEGORY_BY_CONTENT[contentCategory];
    if (!category) throw new Error("The RarBg does not support this content category.");

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("category", category);
    url.searchParams.set("limit", "50");
    url.searchParams.set("page", "1");
    url.searchParams.set("clean", "1");

    throwIfAborted(context.signal);
    const cacheKey = new Request(url.toString(), { method: "GET" });
    let cached: Response | undefined;
    if (context.cache) {
      try {
        cached = await context.cache.match(cacheKey);
      } catch {
        // Cache is an optimization; an unavailable cache must not fail a live search.
      }
    }
    throwIfAborted(context.signal);
    if (cached) {
      const cachedText = await readLimitedText(cached);
      throwIfAborted(context.signal);
      try {
        return parseResults(JSON.parse(cachedText), context.source.id, context.source.name);
      } catch (error) {
        if (error instanceof SyntaxError) throw new Error("The RarBg returned malformed cached JSON.", { cause: error });
        throw error;
      }
    }

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: context.signal,
    });
    throwIfAborted(context.signal);
    if (!response.ok) throw new Error("The RarBg API returned HTTP " + response.status + ".");
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("The RarBg API redirected to an unexpected host.");
      }
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("The RarBg response exceeded the size limit.");
    }
    if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      throw new Error("The RarBg returned an unexpected content type.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("The RarBg returned malformed JSON.", { cause: error });
      throw error;
    }
    throwIfAborted(context.signal);
    const results = parseResults(payload, context.source.id, context.source.name);
    if (context.cache) {
      try {
        await context.cache.put(cacheKey, new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=" + CACHE_TTL_SECONDS,
          },
        }));
      } catch {
        // A cache write failure must not discard valid upstream results.
      }
    }
    return results;
  },
};
