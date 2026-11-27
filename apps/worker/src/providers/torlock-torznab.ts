import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://www.torlock.com/torznab/api";
const ALLOWED_HOSTS = new Set(["www.torlock.com", "torlock2.com"]);
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const CACHE_TTL_SECONDS = 60;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, raw: string) => {
      const n = Number.parseInt(raw, 10);
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "\uFFFD";
    })
    .replace(/&#x([\da-f]+);/gi, (_m, raw: string) => {
      const n = Number.parseInt(raw, 16);
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "\uFFFD";
    }).trim();
}

function readTag(xml: string, name: string): string {
  const match = new RegExp("<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?" + name + "\\s*>", "i").exec(xml);
  return match ? decodeXml(match[1]) : "";
}

function readAttribute(xml: string, name: string): string {
  const match = new RegExp("\\b" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i").exec(xml);
  return match ? decodeXml(match[2]) : "";
}

function safeDetailUrl(value: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password || !url.pathname.startsWith("/torrent/")) return null;
    return url.toString();
  } catch { return null; }
}

function safeMagnet(value: string): string | null {
  if (!value || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return null;
    return url.searchParams.getAll("xt").some((topic) => /^urn:btih:([a-z0-9]{32}|[a-f0-9]{40})$/i.test(topic)) ? value : null;
  } catch { return null; }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Torlock returned an empty response body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("Response too large.");
        throw new Error("Torlock response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

function parseItems(xml: string) {
  if (!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>/i.test(xml) || !/<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(xml)) {
    throw new Error("Torlock returned an invalid Torznab RSS document.");
  }
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const title = readTag(item, "title");
    const guid = readTag(item, "guid");
    const link = readTag(item, "link");
    const attrs = item.match(/<(?:[\w.-]+:)?attr\b[^>]*>/gi) ?? [];
    const attr = (key: string) => attrs.find((tag) => readAttribute(tag, "name").toLowerCase() === key) ?? "";
    const magnet = safeMagnet(readAttribute(attr("magneturl"), "value") || (link.startsWith("magnet:") ? link : ""));
    const detail = safeDetailUrl(guid) ?? safeDetailUrl(link);
    if (!title || !magnet || !detail) return [];
    const seeders = readAttribute(attr("seeders"), "value");
    const peers = readAttribute(attr("peers"), "value");
    const size = readTag(item, "size");
    const stats = [
      /^\d+$/.test(seeders) ? "Seeds: " + seeders : "",
      /^\d+$/.test(peers) ? "Peers: " + peers : "",
      /^\d+$/.test(size) ? "Size: " + size : "",
    ].filter(Boolean);
    const pubDate = readTag(item, "pubDate");
    return [{
      id: detail, sourceId: "torlock", sourceName: "Torlock", category: "torrent" as const,
      title: title.slice(0, 500), url: detail, magnetUri: magnet,
      ...(pubDate ? { releaseDate: pubDate } : {}),
      ...(stats.length ? { description: stats.join(" · ") } : {}),
    }];
  });
}

/** Uses the documented Torznab endpoint and edge cache; never scrapes HTML. */
export const torlockProvider: ProviderAdapter = {
  id: "torlock-torznab", version: "1.0.0", categories: ["torrent"], capabilities: ["metadata", "magnet"],
  searchModes: ["number", "keyword"],
  mechanism: "api",
  contentCategories: ["jav"],
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("t", "search");
    url.searchParams.set("q", input.query);
    url.searchParams.set("cat", "6000");
    url.searchParams.set("limit", "50");
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
      const cachedXml = await readLimitedText(cached);
      throwIfAborted(context.signal);
      return parseItems(cachedXml);
    }

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
      redirect: "manual",
      signal: context.signal,
    });
    throwIfAborted(context.signal);
    if (!response.ok) throw new Error("Torlock Torznab returned HTTP " + response.status + ".");
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(finalUrl.hostname)) throw new Error("Torlock redirected to an unexpected host.");
    }
    const length = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error("Torlock response exceeded the size limit.");
    if (!/xml|rss/i.test(response.headers.get("Content-Type") ?? "")) throw new Error("Torlock returned an unexpected feed content type.");
    const xml = await readLimitedText(response);
    throwIfAborted(context.signal);
    const results = parseItems(xml);
    throwIfAborted(context.signal);
    if (context.cache) {
      try {
        await context.cache.put(cacheKey, new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
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