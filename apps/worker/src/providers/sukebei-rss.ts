import type { ProviderAdapter } from "./types";

const FEED_ENDPOINT = "https://sukebei.nyaa.net/feed/magnet";
const MAX_FEED_BYTES = 2 * 1024 * 1024;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim();
}

function readTag(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, "i").exec(xml);
  return match ? decodeXml(match[1]) : "";
}

function detailUrl(guid: string, itemId: string): string | null {
  if (guid) {
    try {
      const parsed = new URL(guid);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "sukebei.nyaa.net" &&
        /^\/view\/\d+\/?$/.test(parsed.pathname)
      ) {
        return parsed.toString();
      }
    } catch {
      // Continue with a numeric RSS item identifier, if present.
    }
  }

  if (/^\d+$/.test(itemId)) {
    return `https://sukebei.nyaa.net/view/${itemId}`;
  }
  return null;
}

function parseItems(xml: string, query: string) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const searchUrl = new URL(FEED_ENDPOINT);
  searchUrl.searchParams.set("q", query);

  return items.flatMap((item) => {
    const title = readTag(item, "title");
    const guid = readTag(item, "guid");
    const rawLink = readTag(item, "link");
    const magnetUri = rawLink.startsWith("magnet:")
      ? rawLink
      : readTag(item, "magnet");
    const hash = readTag(item, "infoHash") || readTag(item, "infohash");
    const stableId = guid.match(/\/(\d+)\/?$/)?.[1] ?? guid;
    const url = detailUrl(guid, stableId);

    if (!title || !magnetUri.startsWith("magnet:") || !url) return [];

    return [{
      id: stableId || hash || magnetUri,
      sourceId: "sukebei",
      sourceName: "Sukebei",
      category: "torrent" as const,
      title,
      url,
      magnetUri,
      ...(readTag(item, "pubDate") ? { releaseDate: readTag(item, "pubDate") } : {}),
      externalLinks: [{ label: "原站搜索", url: searchUrl.toString() }],
    }];
  });
}

/**
 * Uses Sukebei's documented public RSS magnet feed. No HTML scraping,
 * cookies, browser emulation, CAPTCHA handling, or access-control bypass.
 */
export const sukebeiRssProvider: ProviderAdapter = {
  id: "sukebei-rss",
  version: "1.0.0",
  categories: ["torrent"],
  capabilities: ["magnet"],
  searchModes: ["number", "keyword"],
  async search(input, context) {
    const url = new URL(FEED_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("limit", "50");

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
      signal: context.signal,
    });
    if (!response.ok) {
      throw new Error(`Sukebei RSS returned HTTP ${response.status}.`);
    }

    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (declaredLength > MAX_FEED_BYTES) {
      throw new Error("Sukebei RSS response exceeded the size limit.");
    }

    const xml = await response.text();
    if (xml.length > MAX_FEED_BYTES) {
      throw new Error("Sukebei RSS response exceeded the size limit.");
    }
    if (!/<rss\b|<feed\b/i.test(xml)) {
      throw new Error("Sukebei returned an unexpected feed format.");
    }

    return parseItems(xml, input.query);
  },
};
