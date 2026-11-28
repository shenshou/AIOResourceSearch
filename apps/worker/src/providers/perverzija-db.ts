import type { ProviderAdapter, ProviderContext } from "./types";

const API_ENDPOINT = "https://api.perverzija.com/v1/scenes";
const API_HOST = "api.perverzija.com";
const DATABASE_HOST = "db.perverzija.com";
const WATCH_HOST = "tube.perverzija.com";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

interface SceneRecord {
  id?: unknown;
  title?: unknown;
  release_date?: unknown;
  duration?: unknown;
  studio?: { name?: unknown } | null;
  network?: { name?: unknown } | null;
  performers?: Array<{ name?: unknown }> | null;
  tags?: Array<{ name?: unknown }> | null;
  urls?: {
    page?: unknown;
    watch?: unknown;
  } | null;
}

function safeUrl(value: unknown, hostname: string, pathPrefix: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== hostname ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(pathPrefix)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Perverzija DB returned an empty response body.");

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
        throw new Error("Perverzija DB response exceeded the size limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function isScenesEnvelope(payload: unknown): payload is { data: unknown[] } {
  return typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray(payload.data);
}

function sanitizeSceneEntity(value: unknown): { name?: unknown } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  return { name: (value as Record<string, unknown>).name };
}

function sanitizeSceneEntities(value: unknown): Array<{ name?: unknown }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    const entity = sanitizeSceneEntity(item);
    return entity ? [entity] : [];
  });
}

function sanitizeScenesPayload(payload: unknown): { data: unknown[] } {
  if (!isScenesEnvelope(payload)) {
    throw new Error("Perverzija DB returned an invalid JSON response.");
  }
  return {
    data: payload.data.map((raw) => {
      if (typeof raw !== "object" || raw === null) return raw;
      const record = raw as Record<string, unknown>;
      const urls = typeof record.urls === "object" && record.urls !== null
        ? record.urls as Record<string, unknown>
        : {};
      return {
        id: record.id,
        title: record.title,
        release_date: record.release_date,
        duration: record.duration,
        studio: sanitizeSceneEntity(record.studio),
        network: sanitizeSceneEntity(record.network),
        performers: sanitizeSceneEntities(record.performers),
        tags: sanitizeSceneEntities(record.tags),
        urls: { page: urls.page, watch: urls.watch },
      };
    }),
  };
}

async function fetchJson(url: string, context: ProviderContext): Promise<unknown> {
  throwIfAborted(context.signal);
  const cacheKey = new Request(url, { method: "GET" });
  if (context.cache) {
    try {
      const cached = await context.cache.match(cacheKey);
      if (cached) {
        try {
          const cachedPayload: unknown = JSON.parse(await readLimitedText(cached));
          if (!isScenesEnvelope(cachedPayload)) throw new Error("Invalid cached scene response.");
          throwIfAborted(context.signal);
          return cachedPayload;
        } catch {
          throwIfAborted(context.signal);
          // Ignore a malformed/oversized cache entry and fetch a fresh response.
        }
      }
    } catch {
      throwIfAborted(context.signal);
      // Cache is an optimization; an unavailable cache must not fail a live request.
    }
  }

  const response = await context.fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: context.signal,
  });
  throwIfAborted(context.signal);
  if (!response.ok) {
    // In particular, do not retry 429 in a tight loop; the API supplies Retry-After.
    throw new Error(`Perverzija DB returned HTTP ${response.status}.`);
  }
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
      throw new Error("Perverzija DB redirected to an unexpected host.");
    }
  }

  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Perverzija DB response exceeded the size limit.");
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Perverzija DB returned an unexpected content type.");
  }

  const responseText = await readLimitedText(response);
  throwIfAborted(context.signal);
  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
    if (!isScenesEnvelope(payload)) throw new Error("Perverzija DB returned an invalid JSON response.");
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Perverzija DB returned malformed JSON.", { cause: error });
    }
    throw error;
  }

  if (context.cache) {
    try {
      await context.cache.put(cacheKey, new Response(JSON.stringify(sanitizeScenesPayload(payload)), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      }));
    } catch {
      // A cache write failure must not discard valid upstream results.
    }
  }
  throwIfAborted(context.signal);
  return payload;
}

function durationLabel(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 86400) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function sceneRelationships(scene: SceneRecord) {
  const relationships = [
    ...(typeof scene.studio?.name === "string" && scene.studio.name.trim()
      ? [{ type: "studio" as const, name: scene.studio.name.trim() }]
      : []),
    ...(typeof scene.network?.name === "string" && scene.network.name.trim()
      ? [{ type: "network" as const, name: scene.network.name.trim() }]
      : []),
    ...(Array.isArray(scene.performers)
      ? scene.performers.flatMap((performer) =>
          typeof performer?.name === "string" && performer.name.trim()
            ? [{ type: "performer" as const, name: performer.name.trim() }]
            : [])
      : []),
    ...(Array.isArray(scene.tags)
      ? scene.tags.flatMap((tag) =>
          typeof tag?.name === "string" && tag.name.trim()
            ? [{ type: "tag" as const, name: tag.name.trim() }]
            : [])
      : []),
  ];
  return relationships.slice(0, 40);
}

function sceneDescription(scene: SceneRecord): string | undefined {
  const parts: string[] = [];
  const studio = typeof scene.studio?.name === "string" ? scene.studio.name.trim() : "";
  const network = typeof scene.network?.name === "string" ? scene.network.name.trim() : "";
  const performers = Array.isArray(scene.performers)
    ? scene.performers.flatMap((performer) =>
        typeof performer?.name === "string" && performer.name.trim() ? [performer.name.trim()] : [])
    : [];
  const tags = Array.isArray(scene.tags)
    ? scene.tags.flatMap((tag) =>
        typeof tag?.name === "string" && tag.name.trim() ? [tag.name.trim()] : [])
    : [];
  const duration = durationLabel(scene.duration);

  if (studio) parts.push(`Studio: ${studio}`);
  if (network) parts.push(`Network: ${network}`);
  if (performers.length) parts.push(`Cast: ${performers.slice(0, 12).join(", ")}`);
  if (tags.length) parts.push(`Tags: ${tags.slice(0, 20).join(", ")}`);
  if (duration) parts.push(`Duration: ${duration}`);

  const description = parts.join(" · ").slice(0, 4000);
  return description || undefined;
}

function parseScenes(payload: unknown) {
  if (!isScenesEnvelope(payload)) {
    throw new Error("Perverzija DB returned an invalid JSON response.");
  }

  return payload.data.flatMap((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) return [];
    const scene = raw as SceneRecord;
    if (
      typeof scene.id !== "number" ||
      !Number.isSafeInteger(scene.id) ||
      scene.id < 1 ||
      typeof scene.title !== "string" ||
      !scene.title.trim() ||
      scene.title.length > 500
    ) return [];

    // The DB page is the primary result link and the visible attribution destination.
    const pageUrl = safeUrl(scene.urls?.page, DATABASE_HOST, "/scene/");
    const watchUrl = safeUrl(scene.urls?.watch, WATCH_HOST, "/");
    if (!pageUrl || !watchUrl) return [];

    const relationships = sceneRelationships(scene);
    const description = sceneDescription(scene);
    return [{
      id: String(scene.id),
      sourceId: "perverzija-db",
      sourceName: "Perverzija DB",
      category: "other-index" as const,
      title: scene.title.trim(),
      url: pageUrl,
      ...(isDateOnly(scene.release_date) ? { releaseDate: scene.release_date } : {}),
      ...(description ? { description } : {}),
      ...(relationships.length ? { relationships } : {}),
      externalLinks: [{ label: "观看页面", url: watchUrl }],
    }];
  });
}

/**
 * Uses Perverzija DB's documented, free v1 metadata API.
 * The DB page is used as the primary link to satisfy its visible attribution terms.
 * Cover images and embed/player fields are intentionally not consumed.
 */
export const perverzijaDbProvider: ProviderAdapter = {
  id: "perverzija-db",
  version: "1.1.0",
  mechanism: "api",
  contentCategories: ["jav"],
  categories: ["other-index"],
  capabilities: ["metadata", "relationships"],
  searchModes: ["keyword"],
  rateLimitLane: "perverzija",
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("per_page", "50");

    const payload = await fetchJson(url.toString(), context);
    return parseScenes(payload);
  },
};
