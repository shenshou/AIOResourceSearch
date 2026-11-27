import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://librivox.org/api/feed/audiobooks/";
const API_HOST = "librivox.org";
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
const MAX_RESULTS = 20;
const USER_AGENT = "AIOResourceSearch/0.1.0 (https://github.com/shenshou/AIOResourceSearch)";
const REQUEST_FIELDS = [
  "id",
  "title",
  "description",
  "language",
  "copyright_year",
  "num_sections",
  "url_librivox",
  "totaltime",
  "totaltimesecs",
  "authors",
].join(",");

interface LibriVoxAuthor {
  first_name?: unknown;
  last_name?: unknown;
}

interface LibriVoxBook {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  language?: unknown;
  copyright_year?: unknown;
  num_sections?: unknown;
  url_librivox?: unknown;
  totaltime?: unknown;
  totaltimesecs?: unknown;
  authors?: unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("LibriVox request was cancelled.", "AbortError");
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result && result.length <= maxLength ? result : undefined;
}

function plainText(value: unknown): string | undefined {
  const raw = boundedString(value, 20_000);
  if (!raw) return undefined;
  const result = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return result.slice(0, 4000) || undefined;
}

function parseAuthors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const author = item as LibriVoxAuthor;
    const first = boundedString(author.first_name, 150);
    const last = boundedString(author.last_name, 150);
    const name = [first, last].filter(Boolean).join(" ").trim();
    return name ? [name] : [];
  }).slice(0, 10);
}

function canonicalProjectUrl(value: unknown): string | undefined {
  const candidate = boundedString(value, 2048);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.hostname !== API_HOST ||
        url.username || url.password || url.search || url.hash) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function numericMetadata(value: unknown, max: number): string | undefined {
  const candidate = typeof value === "number" ? String(value) : boundedString(value, 20);
  if (!candidate || !/^\d+$/.test(candidate)) return undefined;
  const parsed = Number(candidate);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max ? String(parsed) : undefined;
}

function parseBook(record: LibriVoxBook) {
  const id = numericMetadata(record.id, 2_000_000_000);
  const title = boundedString(record.title, 500);
  const url = canonicalProjectUrl(record.url_librivox);
  if (!id || !title || !url) return [];

  const metadata: Record<string, string> = { librivoxId: id };
  const authors = parseAuthors(record.authors);
  if (authors.length) metadata.authors = authors.join(", ").slice(0, 1000);

  const language = boundedString(record.language, 80);
  if (language) metadata.language = language;

  const copyrightYear = numericMetadata(record.copyright_year, 2200);
  if (copyrightYear && Number(copyrightYear) >= 0) metadata.copyrightYear = copyrightYear;

  const sectionCount = numericMetadata(record.num_sections, 100_000);
  if (sectionCount) metadata.sectionCount = sectionCount;

  const runtime = boundedString(record.totaltime, 40);
  if (runtime && /^\d{1,3}:\d{2}:\d{2}$/.test(runtime)) metadata.runtime = runtime;

  const runtimeSeconds = numericMetadata(record.totaltimesecs, 10_000_000);
  if (runtimeSeconds) metadata.runtimeSeconds = runtimeSeconds;

  const description = plainText(record.description);
  return [{
    id: "librivox-" + id,
    sourceId: "librivox",
    sourceName: "LibriVox",
    category: "other-index" as const,
    contentCategory: "audiobook" as const,
    title,
    url,
    externalLinks: [{ label: "LibriVox attribution", url: "https://librivox.org" }],
    ...(description ? { description } : {}),
    metadata,
  }];
}

function parseResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("books" in payload) ||
      !Array.isArray(payload.books)) {
    throw new Error("LibriVox returned an invalid audiobook search response.");
  }
  return payload.books.slice(0, MAX_RESULTS).flatMap((record: unknown) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    return parseBook(record as LibriVoxBook);
  });
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("LibriVox returned an empty response body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("LibriVox response exceeded size limit.");
        throw new Error("LibriVox response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Metadata-only search against LibriVox's first-party audiobook catalogue.
 * Uses title-prefix matching, bounded results, canonical link-back, and the
 * shared five-second Durable Object lane. Audio, RSS, archive, and cover assets
 * are deliberately not requested or fetched.
 */
export const libriVoxProvider: ProviderAdapter = {
  id: "librivox-api",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["audiobook"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["keyword"],
  rateLimitLane: "librivox",
  async search(input, context) {
    const query = input.query.trim();
    if (!query || query.length > 120) {
      throw new Error("LibriVox search query must contain 1–120 characters.");
    }

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("title", "^" + query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(MAX_RESULTS));
    url.searchParams.set("offset", "0");
    for (const field of REQUEST_FIELDS.split(",")) {
      url.searchParams.append("fields[]", field);
    }

    throwIfAborted(context.signal);
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
      throw new Error("LibriVox API returned HTTP " + response.status + ".");
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("LibriVox API redirected to an unexpected host.");
      }
    }
    if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      throw new Error("LibriVox returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("LibriVox response exceeded the size limit.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("LibriVox returned malformed JSON.", { cause: error });
      }
      throw error;
    }
    throwIfAborted(context.signal);
    return parseResponse(payload);
  },
};
