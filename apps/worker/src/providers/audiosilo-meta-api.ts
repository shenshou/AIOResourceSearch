import type { ProviderAdapter } from "./types";

const API_ENDPOINT = "https://meta.audiosilo.app/api/v1/works/search";
const API_HOST = "meta.audiosilo.app";
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
const MAX_RESULTS = 20;
const USER_AGENT = "AIOResourceSearch/0.1.0 (https://github.com/shenshou/AIOResourceSearch)";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface PersonRef {
  id?: unknown;
  name?: unknown;
}

interface SeriesRef {
  id?: unknown;
  name?: unknown;
  position?: unknown;
}

interface WorkResult {
  kind?: unknown;
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  language?: unknown;
  series?: unknown;
  release_date?: unknown;
  narrators?: unknown;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("AudioSilo Meta request was cancelled.", "AbortError");
  }
}

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result && result.length <= maxLength ? result : undefined;
}

function parsePeople(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const person = item as PersonRef;
    const id = boundedString(person.id, 120);
    const name = boundedString(person.name, 200);
    return id && SLUG_PATTERN.test(id) && name ? [name] : [];
  }).slice(0, 15);
}

function parseSeries(value: unknown): { name?: string; position?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const series = value as SeriesRef;
  const id = boundedString(series.id, 120);
  const name = boundedString(series.name, 200);
  const position = boundedString(series.position, 80);
  if (!id || !SLUG_PATTERN.test(id)) return {};
  return {
    ...(name ? { name } : {}),
    ...(position ? { position } : {}),
  };
}

function parseReleaseDate(value: unknown): string | undefined {
  const date = boundedString(value, 10);
  if (!date || !/^\\d{4}(?:-\\d{2}(?:-\\d{2})?)?$/.test(date)) return undefined;
  if (date.length === 10) {
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return undefined;
  }
  if (date.length === 7 && Number(date.slice(5, 7)) > 12) return undefined;
  return date;
}

function parseWork(record: WorkResult) {
  if (record.kind !== "work") return [];
  const id = boundedString(record.id, 120);
  const title = boundedString(record.title, 500);
  if (!id || !SLUG_PATTERN.test(id) || !title) return [];

  const authors = parsePeople(record.authors);
  const narrators = parsePeople(record.narrators);
  const series = parseSeries(record.series);
  const language = boundedString(record.language, 80);
  const releaseDate = parseReleaseDate(record.release_date);
  const metadata: Record<string, string> = {};
  if (authors.length) metadata.authors = authors.join(", ").slice(0, 500);
  if (narrators.length) metadata.narrators = narrators.join(", ").slice(0, 500);
  if (language) metadata.language = language;
  if (series.name) metadata.series = series.name;
  if (series.position) metadata.seriesPosition = series.position;

  return [{
    id: "audiosilo-" + id,
    sourceId: "audiosilo-meta",
    sourceName: "AudioSilo Meta",
    category: "other-index" as const,
    contentCategory: "audiobook" as const,
    title,
    url: "https://" + API_HOST + "/works/" + encodeURIComponent(id),
    externalLinks: [{ label: "AudioSilo Meta attribution", url: "https://" + API_HOST }],
    ...(releaseDate ? { releaseDate } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
  }];
}

function parseResponse(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("results" in payload) ||
      !Array.isArray(payload.results)) {
    throw new Error("AudioSilo Meta returned an invalid works search response.");
  }
  return payload.results.slice(0, MAX_RESULTS).flatMap((record: unknown) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    return parseWork(record as WorkResult);
  });
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("AudioSilo Meta returned an empty response body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("AudioSilo Meta response exceeded size limit.");
        throw new Error("AudioSilo Meta response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/**
 * Metadata-only audiobook search against AudioSilo Meta's CC0 factual core.
 * Uses only WorkResult fields documented as CC0 facts. It deliberately ignores
 * cover URLs and never requests work details, descriptions, characters, recaps,
 * genres, chapters, or community-layer fields.
 */
export const audioSiloMetaProvider: ProviderAdapter = {
  id: "audiosilo-meta-api",
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["audiobook"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["keyword"],
  rateLimitLane: "audiosilo",
  async search(input, context) {
    const query = input.query.trim();
    if (!query || query.length > 120) {
      throw new Error("AudioSilo Meta search query must contain 1–120 characters.");
    }

    const url = new URL(API_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(MAX_RESULTS));

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
      const retryAfter = boundedString(response.headers.get("Retry-After"), 80);
      throw new Error(
        "AudioSilo Meta API returned HTTP " + response.status +
        (retryAfter ? " (Retry-After: " + retryAfter + ")." : "."),
      );
    }
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
        throw new Error("AudioSilo Meta API redirected to an unexpected host.");
      }
    }
    if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
      throw new Error("AudioSilo Meta returned an unexpected content type.");
    }
    const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error("AudioSilo Meta response exceeded the size limit.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(await readLimitedText(response));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("AudioSilo Meta returned malformed JSON.", { cause: error });
      }
      throw error;
    }
    throwIfAborted(context.signal);
    return parseResponse(payload);
  },
};
