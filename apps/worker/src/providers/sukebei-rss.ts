import type { ProviderAdapter } from "./types";

const FEED_ENDPOINT = "https://sukebei.nyaa.net/feed/magnet";
const MAX_FEED_BYTES = 2 * 1024 * 1024;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

function decodeXml(value: string): string {
  const decodeCodePoint = (raw: string, radix: number): string => {
    const codePoint = Number.parseInt(raw, radix);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return "\uFFFD";
    }
    return String.fromCodePoint(codePoint);
  };

  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => decodeCodePoint(code, 10))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => decodeCodePoint(code, 16))
    .trim();
}

function readTag(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<(?:[\\w.-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`,
    "i",
  ).exec(xml);
  return match ? decodeXml(match[1]) : "";
}

async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("RSS response exceeded size limit.");
        throw new Error("Sukebei RSS response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
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
  if (!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>/i.test(xml) || !/<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(xml)) {
    throw new Error("Sukebei returned an invalid RSS document.");
  }

  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const searchUrl = new URL("https://sukebei.nyaa.net/");
  searchUrl.searchParams.set("q", query);

  return items.flatMap((item) => {
    const title = readTag(item, "title");
    const guid = readTag(item, "guid");
    const rawLink = readTag(item, "link");
    const magnetUri = rawLink.startsWith("magnet:")
      ? rawLink
      : readTag(item, "magnet");
    const stableId = guid.match(/\/(\d+)\/?$/)?.[1] ?? guid;
    const url = detailUrl(guid, stableId);

    if (!title || !magnetUri.startsWith("magnet:") || !url) return [];

    return [{
      id: stableId || magnetUri,
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
  version: "1.0.1",
  mechanism: "rss",
  contentCategories: ["jav"],
  categories: ["torrent"],
  capabilities: ["metadata", "magnet"],
  searchModes: ["number", "keyword"],
  async search(input, context) {
    const url = new URL(FEED_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("limit", "50");

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
      redirect: "manual",
      signal: context.signal,
    });
    if (!response.ok) {
      throw new Error(`Sukebei RSS returned HTTP ${response.status}.`);
    }

    const finalUrl = response.url;
    if (finalUrl) {
      const parsedFinalUrl = new URL(finalUrl);
      if (parsedFinalUrl.protocol !== "https:" || parsedFinalUrl.hostname !== "sukebei.nyaa.net") {
        throw new Error("Sukebei RSS redirected to an unexpected host.");
      }
    }

    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
      throw new Error("Sukebei RSS response exceeded the size limit.");
    }

    const xml = await readTextLimited(response, MAX_FEED_BYTES);
    throwIfAborted(context.signal);
    if (!/<rss\b/i.test(xml)) {
      throw new Error("Sukebei returned an unexpected feed format.");
    }

    return parseItems(xml, input.query);
  },
};
