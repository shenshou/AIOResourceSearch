import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://anibt.net/torznab/api";
const ALLOWED_HOST = "anibt.net";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_QUERY_BYTES = 160;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

function decodeXml(value: string): string {
  return value
    .replace(new RegExp("<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>", "g"), "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(new RegExp("&#(\\d+);", "g"), (_match, raw: string) => {
      const codePoint = Number.parseInt(raw, 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : String.fromCodePoint(0xfffd);
    })
    .replace(new RegExp("&#x([\\da-f]+);", "gi"), (_match, raw: string) => {
      const codePoint = Number.parseInt(raw, 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff &&
        !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint)
        : String.fromCodePoint(0xfffd);
    })
    .trim();
}

function readTag(xml: string, name: string): string {
  const match = new RegExp(
    "<(?:[\\w.-]+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?" + name + "\\s*>",
    "i",
  ).exec(xml);
  return match ? decodeXml(match[1]) : "";
}

function readAttribute(xml: string, name: string): string {
  const match = new RegExp("\\b" + name + "\\s*=\\s*([\\"'])([\\s\\S]*?)\\1", "i").exec(xml);
  return match ? decodeXml(match[2]) : "";
}

function safeTorrentUrl(value: string): { url: string; releaseId: string } | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value, API_ENDPOINT);
    const match = new RegExp("^/api/torrent/(rel_[A-Za-z0-9_-]{5,100})[.]torrent$").exec(url.pathname);
    if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST || url.port ||
        url.username || url.password || !match || url.search || url.hash) return null;
    return { url: url.toString(), releaseId: match[1] };
  } catch {
    return null;
  }
}

function safeDetailUrl(value: string, releaseId: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== ALLOWED_HOST || url.port ||
        url.username || url.password || url.pathname !== "/release/" + releaseId ||
        url.search || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AniBT returned an empty Torznab response body.");
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
        throw new Error("AniBT Torznab response exceeded the 2 MiB limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseItems(xml: string) {
  if (new RegExp("<(?:[\\w.-]+:)?error\\b", "i").test(xml)) {
    const errorTag = new RegExp("<(?:[\\w.-]+:)?error\\b[^>]*>", "i").exec(xml)?.[0] ?? "";
    const code = readAttribute(errorTag, "code");
    throw new Error("AniBT Torznab protocol error" + (code ? " " + code : "") + ".");
  }
  if (!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>/i.test(xml) ||
      !/<\/channel\s*>[\s\S]*<\/rss\s*>/i.test(xml)) {
    throw new Error("AniBT returned an invalid Torznab RSS document.");
  }

  const items = xml.match(new RegExp("<item\\b[\\s\\S]*?</item>", "gi")) ?? [];
  return items.flatMap((item) => {
    const title = readTag(item, "title");
    const guid = readTag(item, "guid");
    const link = readTag(item, "link");
    const enclosureTag = new RegExp("<enclosure\\b[^>]*>", "i").exec(item)?.[0] ?? "";
    const torrent = safeTorrentUrl(readAttribute(enclosureTag, "url")) ??
      safeTorrentUrl(link);
    if (!title || !torrent) return [];

    const detailUrl = safeDetailUrl(guid, torrent.releaseId);
    const attrTags = item.match(new RegExp("<(?:[\\w.-]+:)?attr\\b[^>]*>", "gi")) ?? [];
    const readAttrValue = (key: string) => {
      const tag = attrTags.find((candidate) => readAttribute(candidate, "name").toLowerCase() === key);
      return tag ? readAttribute(tag, "value") : "";
    };
    const seeders = readAttrValue("seeders");
    const peers = readAttrValue("peers");
    const size = readTag(item, "size");
    const pubDate = readTag(item, "pubDate");
    const timestamp = pubDate ? Date.parse(pubDate) : Number.NaN;
    const metadata: Record<string, string> = {};
    if (new RegExp("^\\d+$").test(seeders)) metadata.seeders = seeders;
    if (new RegExp("^\\d+$").test(peers)) metadata.peers = peers;
    if (new RegExp("^\\d+$").test(size)) metadata.sizeBytes = size;

    return [{
      id: torrent.releaseId,
      sourceId: "anibt",
      sourceName: "AniBT",
      category: "torrent" as const,
      title: title.slice(0, 500),
      url: detailUrl ?? torrent.url,
      torrentUrl: torrent.url,
      ...(Number.isFinite(timestamp) ? { releaseDate: new Date(timestamp).toISOString() } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {}),
    }];
  });
}

/**
 * Public, keyless AniBT Torznab search. Its documented no-store behavior is
 * respected: this Provider does not read or write the edge cache.
 */
export const anibtTorznabProvider: ProviderAdapter = {
  id: "anibt-torznab",
  version: "1.0.0",
  rateLimitLane: "anibt",
  mechanism: "api",
  contentCategories: ["anime"],
  categories: ["torrent"],
  capabilities: ["metadata", "torrent"],
  searchModes: ["keyword"],
  async search(input, context) {
    if (!input.query.trim()) throw new Error("AniBT requires a non-empty keyword.");
    if (new TextEncoder().encode(input.query).byteLength > MAX_QUERY_BYTES) {
      throw new Error("AniBT keyword exceeds the documented 160-byte UTF-8 limit.");
    }

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("t", "search");
    url.searchParams.set("q", input.query);
    url.searchParams.set("cat", "5070");
    url.searchParams.set("limit", "50");

    throwIfAborted(context.signal);
    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8" },
      redirect: "manual",
      signal: context.signal,
    });
    throwIfAborted(context.signal);
    if (!response.ok) throw new Error("AniBT Torznab returned HTTP " + response.status + ".");
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== ALLOWED_HOST) {
        throw new Error("AniBT Torznab responded from an unexpected host.");
      }
    }
    const contentLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new Error("AniBT Torznab response exceeded the 2 MiB limit.");
    }
    if (!/xml|rss/i.test(response.headers.get("Content-Type") ?? "")) {
      throw new Error("AniBT returned an unexpected Torznab content type.");
    }

    const xml = await readLimitedText(response);
    throwIfAborted(context.signal);
    const results = parseItems(xml);
    throwIfAborted(context.signal);
    return results;
  },
};
