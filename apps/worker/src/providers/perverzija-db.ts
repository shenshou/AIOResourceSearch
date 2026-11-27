import type { ProviderAdapter } from "./types";

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

function durationLabel(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 86400) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function sceneRelationships(scene: SceneRecord) {
  const relationships = [
    ...(typeof scene.studio?.name === "string" && scene.studio.name.trim()
      ? [{ type: "studio" as const, name: scene.studio.name.trim() }]
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
  if (performers.length) parts.push(`Cast: ${performers.slice(0, 12).join(", ")}`);
  if (tags.length) parts.push(`Tags: ${tags.slice(0, 20).join(", ")}`);
  if (duration) parts.push(`Duration: ${duration}`);

  const description = parts.join(" · ").slice(0, 4000);
  return description || undefined;
}

function parseScenes(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("data" in payload) || !Array.isArray(payload.data)) {
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

    return [{
      id: String(scene.id),
      sourceId: "perverzija-db",
      sourceName: "Perverzija DB",
      category: "other-index" as const,
      title: scene.title.trim(),
      url: pageUrl,
      ...(typeof scene.release_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(scene.release_date)
        ? { releaseDate: scene.release_date }
        : {}),
      ...(sceneDescription(scene) ? { description: sceneDescription(scene) } : {}),
      ...(sceneRelationships(scene).length ? { relationships: sceneRelationships(scene) } : {}),
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
  version: "1.0.0",
  mechanism: "api",
  contentCategories: ["jav"],
  categories: ["other-index"],
  capabilities: ["metadata"],
  searchModes: ["number", "keyword"],
  async search(input, context) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.set("q", input.query);
    url.searchParams.set("per_page", "50");

    const response = await context.fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: context.signal,
    });

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

    let payload: unknown;
    try {
      const responseText = await readLimitedText(response);
      throwIfAborted(context.signal);
      payload = JSON.parse(responseText);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Perverzija DB returned malformed JSON.", { cause: error });
      }
      throw error;
    }

    return parseScenes(payload);
  },
};
