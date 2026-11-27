import type { ProviderAdapter, NormalizedResource } from "./types";

const FEED_ENDPOINT = "https://share.dmhy.org/topics/rss/rss.xml";
const FEED_HOST = "share.dmhy.org";
const MAX_FEED_BYTES = 2 * 1024 * 1024;

function decodeXml(value: string): string {
  const decodeCodePoint = (raw: string, radix: number): string => {
    const codePoint = Number.parseInt(raw, radix);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "\uFFFD";
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

function readAttribute(xml: string, tagName: string, attributeName: string): string {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = new RegExp(`<(?:[\\w.-]+:)?${escapedTag}\\b([^>]*)/?>`, "i").exec(xml);
  if (!tag) return "";
  const attribute = new RegExp(`(?:^|\\s)${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag[1]);
  return attribute ? decodeXml(attribute[1] ?? attribute[2] ?? "") : "";
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("DMHY RSS returned an empty response body.");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FEED_BYTES) {
        await reader.cancel("RSS response exceeded size limit.");
        throw new Error("DMHY RSS response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function canonicalDetailUrl(value: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.hostname.toLowerCase() !== FEED_HOST ||
      url.username || url.password ||
      !/^\/topics\/view\/\d+_[^/]+\.html$/i.test(url.pathname)
    ) return null;
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function validMagnet(value: string): string | null {
  if (!value || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return null;
    const validHash = url.searchParams.getAll("xt")
      .some((item) => /^urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(item));
    return validHash ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseItems(xml: string, query: string): NormalizedResource[] {
  if (!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>/i.test(xml) ||
      !/<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(xml)) {
    throw new Error("DMHY returned an invalid RSS document.");
  }

  const searchUrl = new URL("https://share.dmhy.org/topics/list");
  searchUrl.searchParams.set("keyword", query);
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items.flatMap((item) => {
    const title = readTag(item, "title").trim();
    const detailUrl = canonicalDetailUrl(readTag(item, "guid")) ??
      canonicalDetailUrl(readTag(item, "link"));
    const magnetUri = validMagnet(readAttribute(item, "enclosure", "url"));
    if (!title || !detailUrl || !magnetUri) return [];

    const id = detailUrl.match(/\/topics\/view\/(\d+)_/)?.[1] ??
      magnetUri.match(/urn:btih:([^&]+)/i)?.[1] ??
      magnetUri;
    const published = readTag(item, "pubDate");
    const publishedTime = published ? Date.parse(published) : Number.NaN;
    const releaseDate = Number.isFinite(publishedTime)
      ? new Date(publishedTime).toISOString()
      : undefined;

    return [{
      id,
      sourceId: "dmhy-rss",
      sourceName: "動漫花園 (DMHY)",
      category: "torrent" as const,
      contentCategory: "anime" as const,
      title,
      url: detailUrl,
      magnetUri,
      ...(releaseDate ? { releaseDate } : {}),
      externalLinks: [{ label: "原站搜索", url: searchUrl.toString() }],
    }];
  });
}

/**
 * Uses DMHY's documented public keyword RSS endpoint. It does not fetch
 * detail pages, images, torrent files, cookies, or account-only feeds.
 */
export const dmhyRssProvider: ProviderAdapter = {
  id: "dmhy-rss",
  version: "1.0.0",
  mechanism: "rss",
  contentCategories: ["anime"],
  categories: ["torrent"],
  capabilities: ["metadata", "magnet"],
  searchModes: ["keyword"],
  async search(input, context) {
    const url = new URL(FEED_ENDPOINT);
    url.searchParams.set("keyword", input.query);
    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
      redirect: "manual",
      signal: context.signal,
    });
    if (!response.ok) throw new Error(`DMHY RSS returned HTTP ${response.status}.`);

    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname.toLowerCase() !== FEED_HOST) {
        throw new Error("DMHY RSS redirected to an unexpected host.");
      }
    }

    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
      throw new Error("DMHY RSS response exceeded the size limit.");
    }
    const contentType = (response.headers.get("Content-Type") ?? "").toLowerCase();
    if (!["application/rss+xml", "application/xml", "text/xml"].some((type) => contentType.includes(type))) {
      throw new Error("DMHY returned an unexpected RSS content type.");
    }

    const xml = await readLimitedText(response);
    if (context.signal.aborted) {
      throw context.signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
    }
    return parseItems(xml, input.query);
  },
};
