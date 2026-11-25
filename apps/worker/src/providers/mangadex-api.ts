import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://api.mangadex.org/manga";
const API_HOST = "api.mangadex.org";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 3600;
const MAX_RESULTS = 20;
const USER_AGENT = "AIOResourceSearch/0.1.0 (https://github.com/shenshou/AIOResourceSearch)";
const CONTENT_RATINGS = ["safe", "suggestive", "erotica", "pornographic"] as const;

interface MangaDexRecord {
  id?: unknown;
  type?: unknown;
  attributes?: {
    title?: unknown;
    description?: unknown;
    year?: unknown;
    status?: unknown;
    originalLanguage?: unknown;
    contentRating?: unknown;
    tags?: unknown;
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("MangaDex request was cancelled.", "AbortError");
  }
}

function localizedText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim().slice(0, 4000) || undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const translations = value as Record<string, unknown>;
  for (const locale of ["en", "ja", "ja-ro", "zh", "zh-hk"]) {
    const candidate = translations[locale];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 4000);
  }
  const first = Object.values(translations).find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof first === "string" ? first.trim().slice(0, 4000) : undefined;
}

function validMangaId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tag: unknown) => {
    if (!tag || typeof tag !== "object" || !("attributes" in tag) ||
        !tag.attributes || typeof tag.attributes !== "object" ||
        !("name" in tag.attributes)) return [];
    const name = localizedText(tag.attributes.name);
    return name ? [name] : [];
  }).slice(0, 20);
}

function parseManga(record: MangaDexRecord) {
  if (record.type !== "manga" || !validMangaId(record.id) ||
      !record.attributes || typeof record.attributes !== "object") return [];

  const attributes = record.attributes;
  const title = localizedText(attributes.title);
  if (!title || title.length > 500) return [];

  const metadata: Record<string, string> = {};
  if (typeof attributes.status === "string" &&
      ["ongoing", "completed", "hiatus", "cancelled"].includes(attributes.status)) {
    metadata.status = attributes.status;
  }
  if (typeof attributes.originalLanguage === "string" &&
      /^[a-z]{2,3}(?:-[a-z]{2,3})?$/i.test(attributes.originalLanguage)) {
    metadata.originalLanguage = attributes.originalLanguage;
  }
  if (typeof attributes.contentRating === "string" &&
      (CONTENT_RATINGS as readonly string[]).includes(attributes.contentRating)) {
    metadata.contentRating = attributes.contentRating;
  }
  if (typeof attributes.year === "number" &&
      Number.isInteger(attributes.year) && attributes.year >= 1800 && attributes.year <= 2200) {
    metadata.year = String(attributes.year);
  }
  const tags = parseTags(attributes.tags);
  if (tags.length) metadata.tags = tags.join(", ").slice(0, 1000);

  const description = localizedText(attributes.description);
  return [{
    id: record.id,
    sourceId: "mangadex",
    sourceName: "MangaDex",
    category: "other-index" as const,
    contentCategory: "manga" as const,
    title,
    url: "https://mangadex.org/title/" + record.id,
    externalLinks: [{ label: "MangaDex attribution", url: "https://mangadex.org" }],
    ...(description ? { description } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  }];
}

function parseResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("result" in payload) ||
      payload.result !== "ok" || !("data" in payload) || !Array.isArray(payload.data)) {
    throw new Error("MangaDex returned an invalid search response.");
  }
  return payload.data.slice(0, MAX_RESULTS).flatMap((record: unknown) => {
    if (!record || typeof record !== "object") return [];
    return parseManga(record as MangaDexRecord);
  });
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("MangaDex returned an empty response body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("MangaDex response exceeded size limit.");
        throw new Error("MangaDex response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Public metadata-only MangaDex search. No chapter, feed, cover, image,
 * account, or user endpoints are accessed.
 */
export const mangaDexProvider: ProviderAdapter = {
  id: "mangadex-api",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["manga"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["keyword"],
  rateLimitLane: "mangadex",
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("title", input.query);
    url.searchParams.set("limit", String(MAX_RESULTS));
    url.searchParams.set("offset", "0");
    for (const rating of CONTENT_RATINGS) {
      url.searchParams.append("contentRating[]", rating);
    }

    throwIfAborted(context.signal);
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await context.cache?.match(cacheKey);
    throwIfAborted(context.signal);
    if (cached) {
      const cachedText = await readLimitedText(cached);
      throwIfAborted(context.signal);
      return parseResponse(JSON.parse(cachedText));
    }

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      redirect: "manual",
      signal: context.signal,
    });
    throwIfAborted(context.signal);
    if (!response.ok) {
      throw new Error("MangaDex API returned HTTP " + response.status + ".");
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("MangaDex API redirected to an unexpected host.");
      }
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error("MangaDex returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("MangaDex response exceeded the size limit.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("MangaDex returned malformed JSON.", { cause: error });
      }
      throw error;
    }
    throwIfAborted(context.signal);
    const results = parseResponse(payload);
    if (context.cache) {
      await context.cache.put(cacheKey, new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=" + CACHE_TTL_SECONDS,
        },
      }));
    }
    return results;
  },
};
