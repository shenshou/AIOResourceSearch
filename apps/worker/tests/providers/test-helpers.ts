import type { SourceDefinition } from "@aio-resource-search/shared";
import type { ProviderContext } from "../../src/providers/types.ts";

/**
 * Builds an isolated ProviderContext for adapter tests.
 * Per-test overrides remain available for adapter-specific dependencies such as Cache and parseHtml.
 */
export function createProviderContext(
  source: SourceDefinition,
  fetcher: typeof fetch,
  overrides: Partial<ProviderContext> = {},
): ProviderContext {
  return {
    ...overrides,
    source,
    fetch: fetcher,
    signal: overrides.signal ?? new AbortController().signal,
  };
}

/** Creates a JSON response fixture while preserving caller-supplied status and headers. */
export function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { ...init, headers });
}

/** Creates an XML/RSS response fixture; callers choose the protocol-specific media type. */
export function xmlResponse(body: string, contentType = "application/rss+xml; charset=utf-8", init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", contentType);
  return new Response(body, { ...init, headers });
}
