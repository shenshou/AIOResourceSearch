import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://yourbittorrent.com/api/search.json";
const API_HOST = "yourbittorrent.com";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 900;

interface TorrentRecord {
  id?: unknown;
  name?: unknown;
  magnet?: unknown;
  url?: unknown;
  torrent_file?: unknown;
  size?: unknown;
  seeds?: unknown;
  peers?: unknown;
  verified?: unknown;
}

function safeSiteUrl(value: unknown, pathPrefix: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== API_HOST ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(pathPrefix)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeMagnet(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return null;
    const validHash = url.searchParams.getAll("xt").some((topic) =>
      /^urn:btih:([a-z0-9]{32}|[a-f0-9]{40})$/i.test(topic),
    );
    return validHash ? value : null;
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("YourBittorrent returned an empty response body.");
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
        throw new Error("YourBittorrent response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseResults(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("status" in payload) ||
      payload.status !== "ok" || !("results" in payload) || !Array.isArray(payload.results)) {
    throw new Error("YourBittorrent returned an invalid JSON response.");
  }

  return payload.results.flatMap((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return [];
    const item = raw as TorrentRecord;
    const id = typeof item.id === "number" && Number.isSafeInteger(item.id) && item.id > 0
      ? String(item.id)
      : typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id)
        ? item.id
        : "";
    const title = typeof item.name === "string" ? item.name.trim() : "";
    const detailUrl = safeSiteUrl(item.url, "/torrent/");
    const magnetUri = safeMagnet(item.magnet);
    if (!id || !title || title.length > 500 || !detailUrl || !magnetUri) return [];

    const torrentUrl = safeSiteUrl(item.torrent_file, "/down/");
    const stats = [
      typeof item.size === "string" && item.size.length <= 40 ? "Size: " + item.size : "",
      typeof item.seeds === "number" && Number.isInteger(item.seeds) && item.seeds >= 0 ? "Seeds: " + item.seeds : "",
      typeof item.peers === "number" && Number.isInteger(item.peers) && item.peers >= 0 ? "Peers: " + item.peers : "",
      item.verified === true ? "Verified" : "",
    ].filter(Boolean);

    return [{
      id,
      sourceId: "yourbittorrent",
      sourceName: "YourBittorrent",
      category: "torrent" as const,
      title,
      url: detailUrl,
      magnetUri,
      ...(torrentUrl ? { torrentUrl } : {}),
      ...(stats.length ? { description: stats.join(" · ") } : {}),
    }];
  });
}

/**
 * Uses YourBittorrent's documented free JSON API and Adult category.
 * No HTML scraping, browser emulation, account, or API key is used.
 */
export const yourBittorrentProvider: ProviderAdapter = {
  id: "yourbittorrent-json",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["jav"],
  categories: ["torrent"],
  capabilities: ["magnet"],
  searchModes: ["number", "keyword"],
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("category", "7");
    url.searchParams.set("limit", "50");

    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await context.cache?.match(cacheKey);
    if (cached) return parseResults(JSON.parse(await readLimitedText(cached)));

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: context.signal,
    });
    if (!response.ok) {
      throw new Error("YourBittorrent API returned HTTP " + response.status + ".");
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("YourBittorrent API redirected to an unexpected host.");
      }
    }

    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("YourBittorrent response exceeded the size limit.");
    }
    if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      throw new Error("YourBittorrent returned an unexpected content type.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("YourBittorrent returned malformed JSON.", { cause: error });
      }
      throw error;
    }

    const results = parseResults(payload);
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