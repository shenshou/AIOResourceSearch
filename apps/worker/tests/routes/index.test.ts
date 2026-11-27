import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../../src/index.ts";

interface TestEnv {
  SOURCES_KV: {
    get(key: string, type: "text", options?: { cacheTtl?: number }): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  ADMIN_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  __store: Map<string, string>;
  __writes: string[];
  RATE_LIMIT_COORDINATOR: {
    idFromName(name: string): string;
    get(id: string): { fetch(request: Request): Promise<Response> };
  };
}

function createEnv(values: Record<string, unknown> = {}, options: {
  adminToken?: string;
  allowedOrigins?: string;
} = {}): TestEnv {
  const store = new Map<string, string>(
    Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const writes: string[] = [];

  return {
    __store: store,
    __writes: writes,
    RATE_LIMIT_COORDINATOR: {
      idFromName(name) { return name; },
      get() {
        return {
          async fetch(request) {
            const path = new URL(request.url).pathname;
            if (path === "/reserve" || path === "/validate") {
              return Response.json({ scheduledAt: Date.now() - 1 });
            }
            if (path === "/acquire") return Response.json({ acquired: true });
            if (path === "/release") return Response.json({ released: true });
            return Response.json({});
          },
        };
      },
    },
    SOURCES_KV: {
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value) {
        writes.push(key);
        store.set(key, value);
      },
    },
    ...(options.adminToken ? { ADMIN_API_TOKEN: options.adminToken } : {}),
    ...(options.allowedOrigins ? { ALLOWED_ORIGINS: options.allowedOrigins } : {}),
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("GET /api/health returns the service health response", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/health"),
    createEnv(),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    status: "ok",
    service: "aio-resource-search-api",
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("OPTIONS requests return an empty preflight response", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/search", { method: "OPTIONS" }),
    createEnv(),
  );

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("requests from an unlisted origin are rejected", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/health", {
      headers: { Origin: "https://untrusted.example" },
    }),
    createEnv({}, { allowedOrigins: "https://app.example" }),
  );

  assert.equal(response.status, 403);
  const body = await readJson(response);
  assert.equal((body.error as Record<string, unknown>).code, "origin_not_allowed");
});

test("POST /api/search rejects malformed JSON", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    createEnv(),
  );

  assert.equal(response.status, 400);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "invalid_json");
});

test("POST /api/search cancels oversized streamed bodies without Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(70 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("https://worker.example/api/search", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const response = await worker.fetch(request, createEnv());

  assert.equal(response.status, 400);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "invalid_json");
  assert.equal(cancelled, true);
});

test("POST /api/search validates the query before reading configuration", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: " ", mode: "number" }),
    }),
    createEnv(),
  );

  assert.equal(response.status, 422);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "invalid_query");
});

test("GET /api/sources exposes enabled sources without private configuration fields", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/sources"),
    createEnv({
      "sources:config:v1": {
        version: 3,
        updatedAt: null,
        sources: [
          {
            id: "public-source",
            name: "Public source",
            category: "jav",
            type: "provider",
            adapterId: "perverzija-db",
            enabled: true,
            searchModes: ["number"],
            capabilities: ["metadata"],
            timeoutMs: 5000,
            credentialBinding: "SOURCE_CREDENTIAL_PRIVATE_API_TOKEN",
            notes: "Internal operator note",
          },
          {
            id: "disabled-source",
            name: "Disabled source",
            category: "jav",
            type: "external-search",
            baseUrl: "https://disabled.example",
            enabled: false,
            searchModes: ["number"],
            capabilities: [],
            timeoutMs: 5000,
          },
        ],
      },
    }),
  );

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(response.headers.get("ETag"), '"3"');
  const sources = body.sources as Array<Record<string, unknown>>;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, "public-source");
  assert.equal("credentialBinding" in sources[0], false);
  assert.equal("notes" in sources[0], false);
});

test("GET /api/sources fails closed on malformed or duplicate persisted sources", async () => {
  const malformed = await worker.fetch(
    new Request("https://worker.example/api/sources"),
    createEnv({
      "sources:config:v1": {
        version: 1,
        updatedAt: null,
        sources: [{ id: "broken-source" }],
      },
    }),
  );
  assert.equal(malformed.status, 500);
  assert.equal(((await readJson(malformed)).error as Record<string, unknown>).code, "internal_error");

  const duplicated = await worker.fetch(
    new Request("https://worker.example/api/sources"),
    createEnv({
      "sources:config:v1": {
        version: 1,
        updatedAt: null,
        sources: [
          {
            id: "same-source", name: "One", category: "jav", type: "external-search",
            enabled: false, searchModes: ["keyword"], capabilities: [], timeoutMs: 5000,
            baseUrl: "https://example.com",
          },
          {
            id: "same-source", name: "Two", category: "jav", type: "external-search",
            enabled: false, searchModes: ["keyword"], capabilities: [], timeoutMs: 5000,
            baseUrl: "https://example.net",
          },
        ],
      },
    }),
  );
  assert.equal(duplicated.status, 500);
});

test("GET /api/adapters exposes only enabled implemented adapters", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/adapters"),
    createEnv({
      "adapters:config:v1": {
        version: 2,
        updatedAt: null,
        adapters: [
          {
            id: "perverzija-db",
            name: "Perverzija DB",
            description: "Metadata provider",
            version: "1.0.0",
            enabled: true,
            categories: ["jav"],
            capabilities: ["metadata"],
            notes: "Internal note",
          },
          {
            id: "not-implemented",
            name: "Not implemented",
            description: "Placeholder",
            version: "1.0.0",
            enabled: true,
            categories: ["jav"],
            capabilities: ["metadata"],
          },
        ],
      },
    }),
  );

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(response.headers.get("ETag"), '"2"');
  const adapters = body.adapters as Array<Record<string, unknown>>;
  assert.equal(adapters.length, 1);
  assert.equal(adapters[0].id, "perverzija-db");
  assert.equal(adapters[0].implemented, true);
  assert.equal("notes" in adapters[0], false);
});

test("GET /api/adapters fails closed on malformed persisted adapter metadata", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/adapters"),
    createEnv({
      "adapters:config:v1": {
        version: 1,
        updatedAt: null,
        adapters: [{ id: "broken-adapter", enabled: true }],
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "internal_error");
});

test("admin endpoints reject requests without a bearer token", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/sources"),
    createEnv({}, { adminToken: "test-secret" }),
  );

  assert.equal(response.status, 401);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "unauthorized");
});

test("admin endpoints report missing server-side token configuration", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/adapters"),
    createEnv(),
  );

  assert.equal(response.status, 503);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "admin_not_configured");
});


test("admin source mutations require an If-Match version", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/sources", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
      body: JSON.stringify({ source: {} }),
    }),
    createEnv({}, { adminToken: "test-secret" }),
  );

  assert.equal(response.status, 428);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "precondition_required");
});

test("admin source mutations reject stale configuration versions", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/sources", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-secret",
        "If-Match": '"2"',
      },
      body: JSON.stringify({ source: {} }),
    }),
    createEnv({
      "sources:config:v1": { version: 3, updatedAt: null, sources: [] },
    }, { adminToken: "test-secret" }),
  );

  assert.equal(response.status, 409);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "version_conflict");
});

test("an adapter referenced by a Provider source cannot be deleted", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/adapters/perverzija-db", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer test-secret",
        "If-Match": '"2"',
      },
    }),
    createEnv({
      "adapters:config:v1": {
        version: 2,
        updatedAt: null,
        adapters: [{
          id: "perverzija-db",
          name: "Perverzija DB",
          description: "Metadata provider",
          version: "1.0.0",
          enabled: true,
          categories: ["jav"],
          capabilities: ["metadata"],
        }],
      },
      "sources:config:v1": {
        version: 4,
        updatedAt: null,
        sources: [{
          id: "linked-source",
          name: "Linked source",
          category: "jav",
          type: "provider",
          adapterId: "perverzija-db",
          enabled: false,
          searchModes: ["number"],
          capabilities: ["metadata"],
          timeoutMs: 5000,
        }],
      },
    }, { adminToken: "test-secret" }),
  );

  assert.equal(response.status, 409);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "adapter_in_use");
});

test("an adapter with enabled linked sources cannot be disabled", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/adapters/perverzija-db", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer test-secret",
        "If-Match": '"2"',
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adapter: { enabled: false } }),
    }),
    createEnv({
      "adapters:config:v1": {
        version: 2,
        updatedAt: null,
        adapters: [{
          id: "perverzija-db",
          name: "Perverzija DB",
          description: "Metadata provider",
          version: "1.0.0",
          enabled: true,
          categories: ["jav"],
          capabilities: ["metadata"],
        }],
      },
      "sources:config:v1": {
        version: 4,
        updatedAt: null,
        sources: [{
          id: "linked-source",
          name: "Linked source",
          category: "jav",
          type: "provider",
          adapterId: "perverzija-db",
          enabled: true,
          searchModes: ["number"],
          capabilities: ["metadata"],
          timeoutMs: 5000,
        }],
      },
    }, { adminToken: "test-secret" }),
  );

  assert.equal(response.status, 409);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "adapter_has_enabled_sources");
});


const adminTestSource = {
  id: "perverzija-source",
  name: "Perverzija DB",
  category: "other-index",
  contentCategory: "jav",
  type: "provider",
  adapterId: "perverzija-db",
  enabled: true,
  searchModes: ["number", "keyword"],
  capabilities: ["metadata"],
  timeoutMs: 5000,
};
const adminTestAdapter = {
  id: "perverzija-db",
  name: "Perverzija DB",
  description: "Metadata provider",
  version: "1.0.0",
  enabled: true,
  categories: ["other-index"],
  contentCategories: ["jav"],
  capabilities: ["metadata"],
};

function adminTestValues(source = adminTestSource, adapter = adminTestAdapter) {
  return {
    "sources:config:v1": { version: 7, updatedAt: null, sources: [source] },
    "adapters:config:v1": { version: 3, updatedAt: null, adapters: [adapter] },
  };
}

function adminTestRequest(path: string, body?: unknown, signal?: AbortSignal) {
  return new Request(`https://worker.example/api/admin/sources/${path}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer test-secret",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
}

test("admin source test endpoints require administrator authorization", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/admin/sources/perverzija-source/test-connection", { method: "POST" }),
    createEnv(adminTestValues(), { adminToken: "test-secret" }),
  );
  assert.equal(response.status, 401);
  assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "unauthorized");
});

test("source diagnostics reject unknown sources and unsupported source search modes", async () => {
  const env = createEnv(adminTestValues({ ...adminTestSource, searchModes: ["keyword"] }), { adminToken: "test-secret" });
  const missing = await worker.fetch(adminTestRequest("missing-source/test-connection"), env);
  assert.equal(missing.status, 404);
  assert.equal(((await readJson(missing)).error as Record<string, unknown>).code, "source_not_found");

  const unsupported = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "number" }), env);
  assert.equal(unsupported.status, 422);
  assert.equal(((await readJson(unsupported)).error as Record<string, unknown>).code, "unsupported_search_mode");
  assert.equal(env.__writes.length, 0);
});

test("external-search test requests are rejected without fetching the destination", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error("External destination must not be fetched.");
  };
  try {
    const externalSource = {
      id: "external-entry", name: "External entry", category: "other-index",
      type: "external-search", enabled: true, baseUrl: "https://example.com",
      searchModes: ["keyword"], capabilities: [], timeoutMs: 5000,
    };
    const env = createEnv({ "sources:config:v1": { version: 1, updatedAt: null, sources: [externalSource] } }, { adminToken: "test-secret" });
    const response = await worker.fetch(adminTestRequest("external-entry/test-connection"), env);
    assert.equal(response.status, 422);
    assert.equal(((await readJson(response)).error as Record<string, unknown>).code, "external_search_not_testable");
    assert.equal(fetched, false);
    assert.equal(env.__writes.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("disabled sources and disabled or unimplemented adapters are rejected before upstream fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error("No upstream request expected.");
  };
  try {
    const disabledSource = { ...adminTestSource, enabled: false };
    const disabledEnv = createEnv(adminTestValues(disabledSource), { adminToken: "test-secret" });
    const disabledResponse = await worker.fetch(adminTestRequest("perverzija-source/test-connection"), disabledEnv);
    assert.equal(disabledResponse.status, 409);
    assert.equal(((await readJson(disabledResponse)).error as Record<string, unknown>).code, "source_disabled");

    const disabledAdapterEnv = createEnv(adminTestValues(adminTestSource, { ...adminTestAdapter, enabled: false }), { adminToken: "test-secret" });
    const disabledAdapterResponse = await worker.fetch(adminTestRequest("perverzija-source/test-connection"), disabledAdapterEnv);
    assert.equal(disabledAdapterResponse.status, 409);
    assert.equal(((await readJson(disabledAdapterResponse)).error as Record<string, unknown>).code, "adapter_unavailable");

    const unimplementedAdapterEnv = createEnv(adminTestValues(
      { ...adminTestSource, adapterId: "future-adapter" },
      { ...adminTestAdapter, id: "future-adapter" },
    ), { adminToken: "test-secret" });
    const unimplementedResponse = await worker.fetch(adminTestRequest("perverzija-source/test-connection"), unimplementedAdapterEnv);
    assert.equal(unimplementedResponse.status, 409);
    assert.equal(((await readJson(unimplementedResponse)).error as Record<string, unknown>).code, "adapter_unavailable");

    const incompatibleEnv = createEnv(adminTestValues({ ...adminTestSource, category: "jav" }), { adminToken: "test-secret" });
    const incompatibleResponse = await worker.fetch(adminTestRequest("perverzija-source/test-connection"), incompatibleEnv);
    assert.equal(incompatibleResponse.status, 409);
    assert.equal(((await readJson(incompatibleResponse)).error as Record<string, unknown>).code, "adapter_incompatible");
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("connection test executes one bounded Provider smoke search and returns at most three samples without KV writes", async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response(JSON.stringify({
      data: [1, 2, 3, 4].map((id) => ({
        id,
        title: `Scene ${id}`,
        urls: {
          page: `https://db.perverzija.com/scene/${id}`,
          watch: `https://tube.perverzija.com/${id}`,
        },
      })),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const env = createEnv(adminTestValues(), { adminToken: "test-secret" });
    const sourceConfigBefore = env.__store.get("sources:config:v1");
    const adapterConfigBefore = env.__store.get("adapters:config:v1");
    const response = await worker.fetch(adminTestRequest("perverzija-source/test-connection"), env);
    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.status, "success");
    assert.equal(body.kind, "test-connection");
    assert.equal(body.resultCount, 4);
    assert.equal((body.sampleResults as unknown[]).length, 3);
    assert.equal(typeof body.elapsedMs, "number");
    assert.equal(requested.length, 1);
    assert.match(requested[0], /api\.perverzija\.com\/v1\/scenes\?q=/);
    assert.equal(env.__writes.length, 0);
    assert.equal(env.__store.get("sources:config:v1"), sourceConfigBefore);
    assert.equal(env.__store.get("adapters:config:v1"), adapterConfigBefore);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("test search validates the query and selected mode before calling the Provider", async () => {
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const env = createEnv(adminTestValues(), { adminToken: "test-secret" });
    const invalidQuery = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: " ", mode: "keyword" }), env);
    assert.equal(invalidQuery.status, 422);
    assert.equal(((await readJson(invalidQuery)).error as Record<string, unknown>).code, "invalid_query");

    const unsupportedMode = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "invalid" }), env);
    assert.equal(unsupportedMode.status, 422);
    assert.equal(((await readJson(unsupportedMode)).error as Record<string, unknown>).code, "invalid_search_mode");
    assert.equal(fetched, false);

    const valid = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "number" }), env);
    assert.equal(valid.status, 200);
    const body = await readJson(valid);
    assert.equal(body.kind, "test-search");
    assert.equal(body.status, "success");
    assert.equal(body.resultCount, 0);
    assert.equal(fetched, true);
    assert.equal(env.__writes.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Provider test reports upstream failure and cancellation without persisting configuration", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("unavailable", { status: 503, headers: { "Content-Type": "text/plain" } });
  try {
    const env = createEnv(adminTestValues(), { adminToken: "test-secret" });
    const failed = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "number" }), env);
    assert.equal(failed.status, 200);
    const failureBody = await readJson(failed);
    assert.equal(failureBody.status, "error");
    assert.equal(failureBody.errorCode, "provider_failed");
    assert.equal(env.__writes.length, 0);

    globalThis.fetch = async () => new Promise<Response>(() => undefined);
    const timeoutEnv = createEnv(adminTestValues({ ...adminTestSource, timeoutMs: 1000 }), { adminToken: "test-secret" });
    const timedOut = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "number" }), timeoutEnv);
    assert.equal(timedOut.status, 200);
    const timeoutBody = await readJson(timedOut);
    assert.equal(timeoutBody.status, "timeout");
    assert.equal(timeoutBody.errorCode, "provider_timeout");
    assert.equal(timeoutEnv.__writes.length, 0);

    const controller = new AbortController();
    controller.abort(new DOMException("Cancelled by test.", "AbortError"));
    const cancelled = await worker.fetch(adminTestRequest("perverzija-source/test-search", { query: "ABP-123", mode: "number" }, controller.signal), env);
    assert.equal(cancelled.status, 499);
    assert.equal(env.__writes.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
