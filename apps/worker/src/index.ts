import { getProviderAdapter, isProviderImplemented } from "./providers/registry";
import { executeSearch } from "./providers/search";
import type {
  CONTENT_CATEGORIES,
  FETCH_MECHANISMS,
  SEARCH_MODES,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  AdapterDefinition,
  AdaptersConfig,
  SourceDefinition,
  SourcesConfig,
} from "@aio-resource-search/shared";

interface KVNamespace {
  get(key: string, type: "text", options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Env {
  SOURCES_KV: KVNamespace;
  ADMIN_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

const CONFIG_KEY = "sources:config:v1";
const ADAPTER_CONFIG_KEY = "adapters:config:v1";
const MAX_CONFIG_BYTES = 64 * 1024;

const DEFAULT_CONFIG: SourcesConfig = {
  version: 0,
  updatedAt: null,
  sources: [],
};
const DEFAULT_ADAPTERS_CONFIG: AdaptersConfig = {
  version: 0,
  updatedAt: null,
  adapters: [],
};

const categories = ["jav", "torrent", "forum", "other-index"] satisfies readonly (typeof SOURCE_CATEGORIES)[number][];
const contentCategories = [...CONTENT_CATEGORIES];
const fetchMechanisms = [...FETCH_MECHANISMS];
const sourceTypes = ["provider", "external-search"] as const;
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
  headers.set("Access-Control-Expose-Headers", "ETag");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

async function readAdaptersConfig(env: Env): Promise<AdaptersConfig> {
  const raw = await env.SOURCES_KV.get(ADAPTER_CONFIG_KEY, "text", { cacheTtl: 30 });
  if (!raw) return { ...DEFAULT_ADAPTERS_CONFIG, adapters: [] };

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("adapters" in parsed) ||
    !Array.isArray(parsed.adapters)
  ) {
    throw new Error("Stored adapter configuration is invalid.");
  }

  const config = parsed as AdaptersConfig;
  return {
    ...config,
    adapters: config.adapters.map((adapter) => {
      const implementation = getProviderAdapter(adapter.id);
      const implemented = isProviderImplemented(adapter.id);
      return {
        ...adapter,
        mechanism: implementation?.mechanism ?? adapter.mechanism ?? "api",
        contentCategories: implementation?.contentCategories ?? adapter.contentCategories ?? ["jav"],
        implemented,
        enabled: Boolean(adapter.enabled && implemented),
      };
    }),
  };
}

async function readConfig(env: Env): Promise<SourcesConfig> {
  const raw = await env.SOURCES_KV.get(CONFIG_KEY, "text", { cacheTtl: 30 });
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

function publicSource(source: SourceDefinition): Omit<SourceDefinition, "credentialBinding" | "notes"> {
  const { credentialBinding: _credentialBinding, notes: _notes, ...safeSource } = source;
  return safeSource;
}

function publicAdapter(adapter: AdapterDefinition): Omit<AdapterDefinition, "notes"> {
  const { notes: _notes, ...safeAdapter } = adapter;
  return safeAdapter;
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
  if (value.contentCategory !== undefined && (typeof value.contentCategory !== "string" || !contentCategories.includes(value.contentCategory as (typeof CONTENT_CATEGORIES)[number]))) return null;
  const type = value.type === undefined ? "provider" : value.type;
  if (typeof type !== "string" || !sourceTypes.includes(type as (typeof sourceTypes)[number])) return null;
  if (type === "provider" &&
      (typeof value.adapterId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.adapterId))) return null;
  if (type === "provider" && value.providerSearchUrlTemplate !== undefined) {
    if (typeof value.providerSearchUrlTemplate !== "string" ||
        value.providerSearchUrlTemplate.length > 2048 ||
        (value.providerSearchUrlTemplate.match(/\{query\}/g) ?? []).length !== 1 ||
        typeof value.baseUrl !== "string") return null;
    try {
      const base = new URL(value.baseUrl);
      const target = new URL(value.providerSearchUrlTemplate.replace("{query}", "AIO_QUERY_TOKEN"));
      if (target.protocol !== "https:" || target.origin !== base.origin ||
          target.username || target.password || target.hostname.toLowerCase().includes("aio_query_token")) return null;
    } catch {
      return null;
    }
  }
  if (value.htmlSelectors !== undefined) {
    if (typeof value.htmlSelectors !== "object" || value.htmlSelectors === null || Array.isArray(value.htmlSelectors)) return null;
    const selectors = value.htmlSelectors as Record<string, unknown>;
    for (const key of ["result", "title", "link"]) {
      if (typeof selectors[key] !== "string" || !selectors[key].trim() || selectors[key].length > 200) return null;
    }
    for (const key of ["image", "description", "magnet"]) {
      if (selectors[key] !== undefined && (typeof selectors[key] !== "string" || !selectors[key].trim() || selectors[key].length > 200)) return null;
    }
    if (selectors.fields !== undefined) {
      if (typeof selectors.fields !== "object" || selectors.fields === null || Array.isArray(selectors.fields)) return null;
      const fields = Object.entries(selectors.fields as Record<string, unknown>);
      if (fields.length > 20 || fields.some(([key, selector]) =>
        !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) ||
        typeof selector !== "string" || !selector.trim() || selector.length > 200
      )) return null;
    }
  }
  if (type === "provider" && value.adapterId === "generic-html" &&
      (typeof value.baseUrl !== "string" || typeof value.providerSearchUrlTemplate !== "string" || !value.htmlSelectors)) return null;
  if (type === "provider" && value.adapterId !== "generic-html" &&
      (value.providerSearchUrlTemplate !== undefined || value.htmlSelectors !== undefined)) return null;
  if (type === "external-search" && (value.providerSearchUrlTemplate !== undefined || value.htmlSelectors !== undefined)) return null;
  if (type === "external-search" && value.searchUrlTemplate !== undefined) {
    if (typeof value.searchUrlTemplate !== "string" ||
        value.searchUrlTemplate.length > 2048 ||
        (value.searchUrlTemplate.match(/\{query\}/g) ?? []).length !== 1) return null;
    try {
      const templateUrl = new URL(value.searchUrlTemplate.replace("{query}", "AIO_QUERY_TOKEN"));
      if (templateUrl.protocol !== "https:" ||
          templateUrl.username ||
          templateUrl.password ||
          templateUrl.hostname.toLowerCase().includes("aio_query_token")) return null;
    } catch {
      return null;
    }
  }
  if (typeof value.enabled !== "boolean") return null;
  if (!Array.isArray(value.searchModes) || !value.searchModes.every((item) => searchModes.includes(item as SourceDefinition["searchModes"][number]))) return null;
  if (!Array.isArray(value.capabilities) || !value.capabilities.every((item) => capabilities.includes(item as SourceDefinition["capabilities"][number]))) return null;
  if (type === "external-search" &&
      (value.capabilities.length > 0 ||
       value.adapterId !== undefined ||
       value.credentialBinding !== undefined ||
       (value.searchUrlTemplate === undefined && typeof value.baseUrl !== "string" && value.enabled !== false))) return null;
  if (type === "provider" && value.searchUrlTemplate !== undefined) return null;
  if (typeof value.timeoutMs !== "number" || !Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 30000) return null;

  if (value.baseUrl !== undefined) {
    if (typeof value.baseUrl !== "string" || value.baseUrl.length > 2048) return null;
    try {
      const url = new URL(value.baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
      if (value.adapterId === "generic-html" &&
          (url.hostname === "localhost" || url.hostname.endsWith(".local") ||
           url.hostname.endsWith(".internal") || url.hostname.startsWith("[") ||
           /^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(url.hostname) || !url.hostname.includes("."))) return null;
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
    ...(typeof value.contentCategory === "string" ? { contentCategory: value.contentCategory as SourceDefinition["contentCategory"] } : {}),
    type: type as SourceDefinition["type"],
    ...(typeof value.adapterId === "string" ? { adapterId: value.adapterId } : {}),
    ...(typeof value.searchUrlTemplate === "string" ? { searchUrlTemplate: value.searchUrlTemplate } : {}),
    ...(typeof value.providerSearchUrlTemplate === "string" ? { providerSearchUrlTemplate: value.providerSearchUrlTemplate } : {}),
    ...(value.htmlSelectors && typeof value.htmlSelectors === "object" ? { htmlSelectors: value.htmlSelectors as SourceDefinition["htmlSelectors"] } : {}),
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

async function saveAdaptersConfig(
  env: Env,
  current: AdaptersConfig,
  adapters: AdapterDefinition[],
): Promise<AdaptersConfig> {
  const next: AdaptersConfig = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    adapters,
  };
  await env.SOURCES_KV.put(ADAPTER_CONFIG_KEY, JSON.stringify(next));
  return next;
}

function validateAdapter(input: unknown): AdapterDefinition | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;

  if (typeof value.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) return null;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.length > 80) return null;
  if (typeof value.description !== "string" || value.description.length > 500) return null;
  if (typeof value.version !== "string" || value.version.trim().length < 1 || value.version.length > 40) return null;
  if (typeof value.enabled !== "boolean") return null;
  if (value.mechanism !== undefined && (typeof value.mechanism !== "string" || !fetchMechanisms.includes(value.mechanism as (typeof fetchMechanisms)[number]))) return null;
  if (value.contentCategories !== undefined && (!Array.isArray(value.contentCategories) || value.contentCategories.length < 1 || !value.contentCategories.every((item) => contentCategories.includes(item as (typeof contentCategories)[number])))) return null;
  if (!Array.isArray(value.categories) || value.categories.length < 1 ||
      !value.categories.every((item) => categories.includes(item as SourceDefinition["category"]))) return null;
  if (!Array.isArray(value.capabilities) ||
      !value.capabilities.every((item) => capabilities.includes(item as SourceDefinition["capabilities"][number]))) return null;
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) return null;

  const implementation = getProviderAdapter(value.id);
  const implemented = isProviderImplemented(value.id);
  if (value.enabled && !implemented) return null;

  return {
    id: value.id,
    name: value.name.trim(),
    description: value.description.trim(),
    mechanism: (implementation?.mechanism ?? value.mechanism ?? "api") as AdapterDefinition["mechanism"],
    contentCategories: (implementation?.contentCategories ?? value.contentCategories ?? ["jav"]) as AdapterDefinition["contentCategories"],
    version: value.version.trim(),
    enabled: value.enabled,
    categories: [...new Set(value.categories as SourceDefinition["category"][])],
    capabilities: [...new Set(value.capabilities as SourceDefinition["capabilities"])],
    implemented,
    ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
  };
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

async function handleAdminAdapters(
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

  const current = await readAdaptersConfig(env);
  const path = url.pathname.replace(/^\/api\/admin\/adapters/, "").replace(/\/$/, "");

  if (path === "" && request.method === "GET") {
    return withEtag(json(current), current.version);
  }

  if (path === "" && request.method === "POST") {
    const version = expectedVersion(request);
    if (version === null) return json({ error: { code: "precondition_required", message: "Send the current ETag in If-Match." } }, 428);
    if (version !== current.version) return json({ error: { code: "version_conflict", message: "The adapter configuration has changed. Reload before editing.", currentVersion: current.version } }, 409);

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
    }
    const adapter = validateAdapter((body as { adapter?: unknown } | null)?.adapter);
    if (!adapter) return json({ error: { code: "invalid_adapter", message: "The adapter definition is invalid or cannot be enabled without a Worker implementation." } }, 422);
    if (current.adapters.some((item) => item.id === adapter.id)) {
      return json({ error: { code: "adapter_exists", message: "An adapter with this ID already exists." } }, 409);
    }
    if (current.adapters.length >= 100) return json({ error: { code: "adapter_limit", message: "The adapter limit has been reached." } }, 422);

    const next = await saveAdaptersConfig(env, current, [...current.adapters, adapter]);
    return withEtag(json(next, 201), next.version);
  }

  const match = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) return json({ error: { code: "not_found", message: "Route not found." } }, 404);
  const adapterId = match[1];
  const adapterIndex = current.adapters.findIndex((item) => item.id === adapterId);
  if (adapterIndex < 0) return json({ error: { code: "adapter_not_found", message: "Adapter not found." } }, 404);

  if (request.method !== "DELETE" && request.method !== "PATCH") {
    return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405);
  }

  const version = expectedVersion(request);
  if (version === null) return json({ error: { code: "precondition_required", message: "Send the current ETag in If-Match." } }, 428);
  if (version !== current.version) return json({ error: { code: "version_conflict", message: "The adapter configuration has changed. Reload before editing.", currentVersion: current.version } }, 409);

  if (request.method === "DELETE") {
    const sources = await readConfig(env);
    if (sources.sources.some((source) => (source.type ?? "provider") === "provider" && source.adapterId === adapterId)) {
      return json({ error: { code: "adapter_in_use", message: "This adapter is still referenced by one or more sources. Reassign or delete those sources first." } }, 409);
    }
    const next = await saveAdaptersConfig(env, current, current.adapters.filter((item) => item.id !== adapterId));
    return withEtag(json(next), next.version);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
  }
  const patch = (body as { adapter?: unknown } | null)?.adapter;
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return json({ error: { code: "invalid_adapter", message: "The request must contain an adapter object." } }, 422);
  }
  const updated = validateAdapter({ ...current.adapters[adapterIndex], ...(patch as Record<string, unknown>), id: adapterId });
  if (!updated) return json({ error: { code: "invalid_adapter", message: "The adapter definition is invalid or cannot be enabled without a Worker implementation." } }, 422);
  const sources = await readConfig(env);
  const linkedSources = sources.sources.filter((source) => (source.type ?? "provider") === "provider" && source.adapterId === adapterId);
  if (!updated.enabled && linkedSources.some((source) => source.enabled)) {
    return json({ error: { code: "adapter_has_enabled_sources", message: "Disable or reassign enabled sources before disabling this adapter." } }, 409);
  }
  if (linkedSources.some((source) =>
    !updated.categories.includes(source.category) ||
    !(updated.contentCategories ?? ["jav"]).includes(source.contentCategory ?? "jav") ||
    !source.capabilities.every((capability) => updated.capabilities.includes(capability))
  )) {
    return json({ error: { code: "adapter_incompatible_with_sources", message: "The updated adapter metadata would invalidate one or more linked source configurations." } }, 409);
  }
  const adapters = [...current.adapters];
  adapters[adapterIndex] = updated;
  const next = await saveAdaptersConfig(env, current, adapters);
  return withEtag(json(next), next.version);
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
    const rawSources = (body as { sources?: unknown } | null)?.sources;
    if (Array.isArray(rawSources)) {
      if (rawSources.length < 1 || rawSources.length > 100) {
        return json({ error: { code: "invalid_source_batch", message: "Import between 1 and 100 source candidates at a time." } }, 422);
      }
      const imported = rawSources.map(validateSource);
      if (imported.some((source) =>
        !source ||
        source.type !== "external-search" ||
        source.enabled !== false
      )) {
        return json({ error: { code: "invalid_source_batch", message: "Bulk import accepts only valid, disabled external-search candidates." } }, 422);
      }
      const sources = imported as SourceDefinition[];
      const ids = new Set<string>();
      for (const source of sources) {
        if (ids.has(source.id) || current.sources.some((item) => item.id === source.id)) {
          return json({ error: { code: "source_exists", message: `A source with ID "${source.id}" is already registered or duplicated in this import.` } }, 409);
        }
        ids.add(source.id);
      }
      if (current.sources.length + sources.length > 100) {
        return json({ error: { code: "source_limit", message: "The source limit would be exceeded by this import." } }, 422);
      }
      const next = await saveConfig(env, current, [...current.sources, ...sources]);
      return withEtag(json(next, 201), next.version);
    }

    const source = validateSource((body as { source?: unknown } | null)?.source);
    if (!source) return json({ error: { code: "invalid_source", message: "The source definition is invalid." } }, 422);
    if ((source.type ?? "provider") === "provider") {
      const adapters = await readAdaptersConfig(env);
      const selectedAdapter = adapters.adapters.find((adapter) => adapter.id === source.adapterId && adapter.enabled && adapter.implemented);
      if (!selectedAdapter) {
        return json({ error: { code: "adapter_unavailable", message: "Select an enabled adapter with a Worker implementation." } }, 422);
      }
      if (!selectedAdapter.categories.includes(source.category) ||
          !(selectedAdapter.contentCategories ?? ["jav"]).includes(source.contentCategory ?? "jav") ||
          !source.capabilities.every((capability) => selectedAdapter.capabilities.includes(capability))) {
        return json({ error: { code: "adapter_incompatible", message: "The selected adapter does not declare this source category or all requested capabilities." } }, 422);
      }
    }
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

  if (request.method !== "DELETE" && request.method !== "PATCH") {
    return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405);
  }

  const version = expectedVersion(request);
  if (version === null) return json({ error: { code: "precondition_required", message: "Send the current ETag in If-Match." } }, 428);
  if (version !== current.version) return json({ error: { code: "version_conflict", message: "The source configuration has changed. Reload before editing.", currentVersion: current.version } }, 409);

  if (request.method === "DELETE") {
    const next = await saveConfig(env, current, current.sources.filter((item) => item.id !== sourceId));
    return withEtag(json(next), next.version);
  }

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
  if ((updated.type ?? "provider") === "provider") {
    const adapters = await readAdaptersConfig(env);
    const selectedAdapter = adapters.adapters.find((adapter) => adapter.id === updated.adapterId && adapter.enabled && adapter.implemented);
    if (!selectedAdapter) {
      return json({ error: { code: "adapter_unavailable", message: "Select an enabled adapter with a Worker implementation." } }, 422);
    }
    if (!selectedAdapter.categories.includes(updated.category) ||
        !(selectedAdapter.contentCategories ?? ["jav"]).includes(updated.contentCategory ?? "jav") ||
        !updated.capabilities.every((capability) => selectedAdapter.capabilities.includes(capability))) {
      return json({ error: { code: "adapter_incompatible", message: "The selected adapter does not declare this source category or all requested capabilities." } }, 422);
    }
  }
  const sources = [...current.sources];
  sources[sourceIndex] = updated;
  const next = await saveConfig(env, current, sources);
  return withEtag(json(next), next.version);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/search" && request.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch {
      return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ error: { code: "invalid_search_request", message: "The request must contain a search object." } }, 400);
    }
    const value = body as Record<string, unknown>;
    if (typeof value.query !== "string" || !value.query.trim() || value.query.trim().length > 120) {
      return json({ error: { code: "invalid_query", message: "Query must contain 1 to 120 characters." } }, 422);
    }
    if (value.contentCategory !== undefined && value.contentCategory !== "all" && (typeof value.contentCategory !== "string" || !contentCategories.includes(value.contentCategory))) {
      return json({ error: { code: "invalid_content_category", message: "Content category is not supported." } }, 422);
    }
    if (value.mode !== "number" && value.mode !== "keyword") {
      return json({ error: { code: "invalid_search_mode", message: "Mode must be number or keyword." } }, 422);
    }

    const [sources, adapters] = await Promise.all([readConfig(env), readAdaptersConfig(env)]);
    const result = await executeSearch(
      { query: value.query.trim(), mode: value.mode, ...(typeof value.contentCategory === "string" ? { contentCategory: value.contentCategory as "all" | (typeof CONTENT_CATEGORIES)[number] } : {}) },
      sources,
      adapters,
      undefined,
      (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default,
    );
    return json(result);
  }

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

  if (url.pathname === "/api/adapters" && request.method === "GET") {
    const config = await readAdaptersConfig(env);
    return withEtag(json({
      version: config.version,
      adapters: config.adapters.filter((adapter) => adapter.enabled && adapter.implemented).map(publicAdapter),
    }), config.version);
  }

  if (url.pathname === "/api/admin/adapters" || url.pathname.startsWith("/api/admin/adapters/")) {
    return handleAdminAdapters(request, url, env);
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
