import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://musicbrainz.org/ws/2/release-group";
const API_HOST = "musicbrainz.org";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 3600;
const MAX_RESULTS = 20;
const USER_AGENT = "AIOResourceSearch/0.1.0 (https://github.com/shenshou/AIOResourceSearch)";
const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReleaseGroupRecord {
  id?: unknown;
  title?: unknown;
  "first-release-date"?: unknown;
  "primary-type"?: unknown;
  "artist-credit"?: unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("MusicBrainz request was cancelled.", "AbortError");
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result && result.length <= maxLength ? result : undefined;
}

function parseArtistCredit(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  let result = "";
  const credits = value.slice(0, 20);
  for (let index = 0; index < credits.length; index += 1) {
    const item = credits[index];
    if (!item || typeof item !== "object") continue;
    const credit = item as Record<string, unknown>;
    const artist = credit.artist && typeof credit.artist === "object"
      ? credit.artist as Record<string, unknown>
      : undefined;
    const name = boundedString(credit.name, 200) ?? boundedString(artist?.name, 200);
    if (!name) continue;
    result += name;
    if (typeof credit.joinphrase === "string" && credit.joinphrase.length <= 80) {
      result += credit.joinphrase;
    } else if (index < credits.length - 1) {
      result += " ";
    }
  }
  return result.trim().slice(0, 500) || undefined;
}

function parseFirstReleaseDate(value: unknown): {
  releaseDate?: string;
  metadata?: { firstReleaseDate: string; year?: string };
} {
  const date = boundedString(value, 10);
  if (!date || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) return {};
  const year = date.slice(0, 4);
  if (date.length === 10) {
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return {};
    return { releaseDate: date, metadata: { firstReleaseDate: date, year } };
  }
  return { metadata: { firstReleaseDate: date, year } };
}

function parseReleaseGroup(record: ReleaseGroupRecord) {
  if (typeof record.id !== "string" || !MBID_PATTERN.test(record.id)) return [];
  const title = boundedString(record.title, 500);
  if (!title) return [];

  const metadata: Record<string, string> = { musicBrainzId: record.id };
  const artist = parseArtistCredit(record["artist-credit"]);
  if (artist) metadata.artist = artist;
  const primaryType = boundedString(record["primary-type"], 80);
  if (primaryType) metadata.primaryType = primaryType;

  const date = parseFirstReleaseDate(record["first-release-date"]);
  if (date.metadata) Object.assign(metadata, date.metadata);

  return [{
    id: record.id,
    sourceId: "musicbrainz",
    sourceName: "MusicBrainz",
    category: "other-index" as const,
    contentCategory: "music" as const,
    title,
    url: "https://musicbrainz.org/release-group/" + record.id,
    externalLinks: [{ label: "MusicBrainz attribution", url: "https://musicbrainz.org" }],
    ...(date.releaseDate ? { releaseDate: date.releaseDate } : {}),
    metadata,
  }];
}

function parseResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("release-groups" in payload) ||
      !Array.isArray(payload["release-groups"])) {
    throw new Error("MusicBrainz returned an invalid release-group search response.");
  }
  return payload["release-groups"].slice(0, MAX_RESULTS).flatMap((record: unknown) => {
    if (!record || typeof record !== "object") return [];
    return parseReleaseGroup(record as ReleaseGroupRecord);
  });
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("MusicBrainz returned an empty response body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("MusicBrainz response exceeded size limit.");
        throw new Error("MusicBrainz response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Public, non-commercial MusicBrainz release-group metadata search.
 * Uses core metadata only; no tags, ratings, cover art, or user data.
 */
export const musicBrainzProvider: ProviderAdapter = {
  id: "musicbrainz-api",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["music"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["keyword"],
  rateLimitLane: "musicbrainz",
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("query", input.query);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", String(MAX_RESULTS));
    url.searchParams.set("offset", "0");
    url.searchParams.set("dismax", "true");

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
      throw new Error("MusicBrainz API returned HTTP " + response.status + ".");
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("MusicBrainz API redirected to an unexpected host.");
      }
    }
    if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      throw new Error("MusicBrainz returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("MusicBrainz response exceeded the size limit.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("MusicBrainz returned malformed JSON.", { cause: error });
      }
      throw error;
    }
    throwIfAborted(context.signal);
    const results = parseResponse(payload);
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
