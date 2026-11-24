import type {
  SEARCH_MODES,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  SourceDefinition,
  SourcesConfig,
} from "@aio-resource-search/shared";

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  SOURCES_KV: KVNamespace;
  ADMIN_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

const CONFIG_KEY = "sources:config:v1";
const MAX_CONFIG_BYTES = 64 * 1024;
const DEFAULT_CONFIG: SourcesConfig = {
  version: 0,
  updatedAt: null,
  sources: [],
};

const categories = ["jav", "torrent", "forum", "other-index"] satisfies readonly (typeof SOURCE_CATEGORIES)[number][];
const searchModes = ["number", "keyword"] satisfies readonly (typeof SEARCH_MODES)[number][];
const capabilities = ["metadata", "image", "magnet", "ed2k", "torrent", "forum-post"] satisfies readonly (typeof SOURCE_CAPABILITIES)[number][];

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function getCorsHeaders(request: Request, env: Env): Headers | Response {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (!origin) return headers;

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowedOrigins.includes(origin)) {
    return json({ error: { code: "origin_not_allowed", message: "This origin is not allowed." } }, 403);
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

async function readConfig(env: Env): Promise<SourcesConfig> {
  const raw = await env.SOURCES_KV.get(CONFIG_KEY, "text");
  if (!raw) return { ...DEFAULT_CONFIG, sources: [] };

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("sources" in parsed) ||
    !Array.isArray(parsed.sources)
  ) {
    throw new Error("Stored source configuration is invalid.");
  }

  return parsed as SourcesConfig;
}

function withEtag(response: Response, version: number): Response {
  const headers = new Headers(response.headers);
  headers.set("ETag", `"${version}"`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function publicSource(source: SourceDefinition): Omit<SourceDefinition, "credentialBinding"> {
  const { credentialBinding: _credentialBinding, ...safeSource } = source;
  return safeSource;
}

async function authorize(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_API_TOKEN) return false;
  const authorization = request.headers.get("Authorization") ?? "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!suppliedToken) return false;

  const encoder = new TextEncoder();
  const [expectedDigest, suppliedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_API_TOKEN)),
    crypto.subtle.digest("SHA-256", encoder.encode(suppliedToken)),
  ]);
  const expected = new Uint8Array(expectedDigest);
  const supplied = new Uint8Array(suppliedDigest);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ supplied[index];
  }
  return difference === 0;
}

function validateSource(input: unknown): SourceDefinition | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;

  if (typeof value.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) return null;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.length > 80) return null;
  if (typeof value.category !== "string" || !categories.includes(value.category as SourceDefinition["category"])) return null;
  if (typeof value.adapterId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.adapterId)) return null;
  if (typeof value.enabled !== "boolean") return null;
  if (!Array.isArray(value.searchModes) || !value.searchModes.every((item) => searchModes.includes(item as SourceDefinition["searchModes"][number]))) return null;
  if (!Array.isArray(value.capabilities) || !value.capabilities.every((item) => capabilities.includes(item as SourceDefinition["capabilities"][number]))) return null;
  if (typeof value.timeoutMs !== "number" || !Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 30000) return null;

  if (value.baseUrl !== undefined) {
    if (typeof value.baseUrl !== "string" || value.baseUrl.length > 2048) return null;
    try {
      const url = new URL(value.baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    } catch {
      return null;
    }
  }

  if (value.credentialBinding !== undefined) {
    if (typeof value.credentialBinding !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(value.credentialBinding)) return null;
  }

  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) return null;

  return {
    id: value.id,
    name: value.name.trim(),
    category: value.category as SourceDefinition["category"],
    adapterId: value.adapterId,
    enabled: value.enabled,
    ...(typeof value.baseUrl === "string" ? { baseUrl: value.baseUrl } : {}),
    searchModes: value.searchModes as SourceDefinition["searchModes"],
    capabilities: value.capabilities as SourceDefinition["capabilities"],
    timeoutMs: value.timeoutMs,
    ...(typeof value.credentialBinding === "string" ? { credentialBinding: value.credentialBinding } : {}),
    ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
  };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > MAX_CONFIG_BYTES) throw new Error("Request body is too large.");
  const text = await request.text();
  if (text.length > MAX_CONFIG_BYTES) throw new Error("Request body is too large.");
  return JSON.parse(text);
}

function expectedVersion(request: Request): number | null {
  const raw = request.headers.get("If-Match");
  if (!raw) return null;
  const value = raw.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

async function saveConfig(env: Env, current: SourcesConfig, sources: SourceDefinition[]): Promise<SourcesConfig> {
  const next: SourcesConfig = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    sources,
  };
  await env.SOURCES_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

async function handleAdmin(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  if (!env.ADMIN_API_TOKEN) {
    return json({ error: { code: "admin_not_configured", message: "ADMIN_API_TOKEN is not configured." } }, 503);
  }
  if (!(await authorize(request, env))) {
    return json({ error: { code: "unauthorized", message: "Administrator authorization is required." } }, 401);
  }

  const current = await readConfig(env);
  const path = url.pathname.replace(/^\/api\/admin\/sources/, "").replace(/\/$/, "");

  if (path === "" && request.method === "GET") {
    return withEtag(json(current), current.version);
  }

  if (path === "" && request.method === "POST") {
    const version = expectedVersion(request);
    if (version === null) return json({ error: { code: "precondition_required", message: "Send the current ETag in If-Match." } }, 428);
    if (version !== current.version) return json({ error: { code: "version_conflict", message: "The source configuration has changed. Reload before editing.", currentVersion: current.version } }, 409);

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
    }
    const source = validateSource((body as { source?: unknown } | null)?.source);
    if (!source) return json({ error: { code: "invalid_source", message: "The source definition is invalid." } }, 422);
    if (current.sources.some((item) => item.id === source.id)) {
      return json({ error: { code: "source_exists", message: "A source with this ID already exists." } }, 409);
    }
    if (current.sources.length >= 100) return json({ error: { code: "source_limit", message: "The source limit has been reached." } }, 422);

    const next = await saveConfig(env, current, [...current.sources, source]);
    return withEtag(json(next, 201), next.version);
  }

  const match = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) return json({ error: { code: "not_found", message: "Route not found." } }, 404);
  const sourceId = match[1];
  const sourceIndex = current.sources.findIndex((item) => item.id === sourceId);
  if (sourceIndex < 0) return json({ error: { code: "source_not_found", message: "Source not found." } }, 404);

  const version = expectedVersion(request);
  if (version === null) return json({ error: { code: "precondition_required", message: "Send the current ETag in If-Match." } }, 428);
  if (version !== current.version) return json({ error: { code: "version_conflict", message: "The source configuration has changed. Reload before editing.", currentVersion: current.version } }, 409);

  if (request.method === "DELETE") {
    const next = await saveConfig(env, current, current.sources.filter((item) => item.id !== sourceId));
    return withEtag(json(next), next.version);
  }

  if (request.method === "PATCH") {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
    }
    const patch = (body as { source?: unknown } | null)?.source;
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
      return json({ error: { code: "invalid_source", message: "The request must contain a source object." } }, 422);
    }
    const updated = validateSource({ ...current.sources[sourceIndex], ...(patch as Record<string, unknown>), id: sourceId });
    if (!updated) return json({ error: { code: "invalid_source", message: "The updated source definition is invalid." } }, 422);
    if (current.sources.some((item) => item.id === updated.id && item.id !== sourceId)) {
      return json({ error: { code: "source_exists", message: "A source with this ID already exists." } }, 409);
    }
    const sources = [...current.sources];
    sources[sourceIndex] = updated;
    const next = await saveConfig(env, current, sources);
    return withEtag(json(next), next.version);
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ status: "ok", service: "aio-resource-search-api" });
  }

  if (url.pathname === "/api/sources" && request.method === "GET") {
    const config = await readConfig(env);
    return withEtag(json({
      version: config.version,
      sources: config.sources.filter((source) => source.enabled).map(publicSource),
    }), config.version);
  }

  if (url.pathname === "/api/admin/sources") {
    return handleAdmin(request, url, env);
  }

  if (url.pathname.startsWith("/api/admin/sources/")) {
    return handleAdmin(request, url, env);
  }

  return json({ error: { code: "not_found", message: "Route not found." } }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = getCorsHeaders(request, env);
    if (cors instanceof Response) return cors;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const response = await route(request, env);
      const headers = new Headers(response.headers);
      cors.forEach((value, key) => headers.set(key, value));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      const response = json({ error: { code: "internal_error", message: "An unexpected server error occurred." } }, 500);
      cors.forEach((value, key) => response.headers.set(key, value));
      return response;
    }
  },
};
