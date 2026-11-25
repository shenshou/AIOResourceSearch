export { RateLimitCoordinator } from "./rate-limit-coordinator";
import { executeSearch } from "./providers/search";
import { CONTENT_CATEGORIES } from "@aio-resource-search/shared";
import type { Env } from "./env";
import { getCorsHeaders, json, readJsonBody, withEtag } from "./http";
import { publicAdapter, publicSource, readAdaptersConfig, readConfig } from "./config-store";
import { handleAdmin, handleAdminAdapters } from "./admin-routes";

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
    if (value.contentCategory !== undefined && value.contentCategory !== "all" && (typeof value.contentCategory !== "string" || !CONTENT_CATEGORIES.includes(value.contentCategory as (typeof CONTENT_CATEGORIES)[number]))) {
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
      request.signal,
      env.RATE_LIMIT_COORDINATOR,
      env,
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
      if (request.signal.aborted) return new Response(null, { status: 499 });
      const response = json({ error: { code: "internal_error", message: "An unexpected server error occurred." } }, 500);
      cors.forEach((value, key) => response.headers.set(key, value));
      return response;
    }
  },
};
