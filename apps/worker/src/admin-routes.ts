import type { SourceDefinition } from "@aio-resource-search/shared";
import type { Env } from "./env";
import { expectedVersion, json, readJsonBody, withEtag } from "./http";
import {
  readAdaptersConfig,
  readConfig,
  saveAdaptersConfig,
  saveConfig,
} from "./config-store";
import { validateAdapter, validateSource } from "./validation";
import { executeSourceTest } from "./providers/search";

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

export async function handleAdminAdapters(
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

export async function handleAdmin(
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

  const testMatch = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(test-connection|test-search)$/);
  if (testMatch && request.method === "POST") {
    const source = current.sources.find((item) => item.id === testMatch[1]);
    if (!source) return json({ error: { code: "source_not_found", message: "Source not found." } }, 404);
    if ((source.type ?? "provider") === "external-search") {
      return json({ error: { code: "external_search_not_testable", message: "External-search entries are browser-opened links and are never fetched by the Worker." } }, 422);
    }
    if (!source.enabled) {
      return json({ error: { code: "source_disabled", message: "Enable the source before running a Provider test." } }, 409);
    }

    const kind = testMatch[2];
    let mode = source.searchModes.includes("keyword") ? "keyword" as const : "number" as const;
    let query = mode === "keyword" ? "AIOResourceSearch connection check" : "AIO-TEST-001";
    if (kind === "test-search") {
      let body: unknown;
      try {
        body = await readJsonBody(request);
      } catch {
        return json({ error: { code: "invalid_json", message: "The request body must be valid JSON and within the size limit." } }, 400);
      }
      const value = body as { query?: unknown; mode?: unknown } | null;
      if (!value || typeof value.query !== "string" || !value.query.trim() || value.query.trim().length > 120) {
        return json({ error: { code: "invalid_query", message: "Query must contain 1 to 120 characters." } }, 422);
      }
      if (value.mode !== "number" && value.mode !== "keyword") {
        return json({ error: { code: "invalid_search_mode", message: "Mode must be number or keyword." } }, 422);
      }
      query = value.query.trim();
      mode = value.mode;
    }
    if (!source.searchModes.includes(mode)) {
      return json({ error: { code: "unsupported_search_mode", message: "This source does not support the selected search mode." } }, 422);
    }

    const adapters = await readAdaptersConfig(env);
    const adapter = adapters.adapters.find((item) => item.id === source.adapterId);
    if (!adapter || !adapter.enabled || !adapter.implemented) {
      return json({ error: { code: "adapter_unavailable", message: "The source adapter is disabled or has no Worker implementation." } }, 409);
    }

    const startedAt = Date.now();
    const result = await executeSourceTest(
      source,
      { query, mode },
      adapters,
      (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default,
      request.signal,
      env.RATE_LIMIT_COORDINATOR,
      env,
    );
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    if (result.status.status === "unavailable") {
      return json({ error: { code: result.status.errorCode ?? "adapter_unavailable", message: result.status.errorCode === "credential_unavailable" ? "The configured Worker Secret binding is missing or empty." : "The source and adapter configuration are incompatible." } }, 409);
    }
    const sampleResults = result.results.slice(0, 3).map((item) => ({
      title: item.title,
      url: item.url,
      ...(item.catalogNumber ? { catalogNumber: item.catalogNumber } : {}),
      ...(item.releaseDate ? { releaseDate: item.releaseDate } : {}),
    }));
    const successful = result.status.status === "ok";
    return json({
      sourceId: source.id,
      kind,
      status: successful ? "success" : result.status.status,
      elapsedMs,
      resultCount: result.status.resultCount,
      sampleResults,
      ...(!successful ? {
        errorCode: result.status.errorCode,
        message: result.status.status === "timeout"
          ? "Provider request timed out."
          : "Provider request failed. Check the source endpoint and upstream availability.",
      } : {}),
    }, 200);
  }

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

