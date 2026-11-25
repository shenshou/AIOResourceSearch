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
}

function createEnv(values: Record<string, unknown> = {}, options: {
  adminToken?: string;
  allowedOrigins?: string;
} = {}): TestEnv {
  const store = new Map<string, string>(
    Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]),
  );

  return {
    SOURCES_KV: {
      async get(key) {
        return store.get(key) ?? null;
      },
      async put(key, value) {
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
  assert.equal((await readJson(response)).error && ((await readJson(response)).error as Record<string, unknown>).code, "origin_not_allowed");
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
            credentialBinding: "PRIVATE_API_TOKEN",
            notes: "Internal operator note",
          },
          {
            id: "disabled-source",
            name: "Disabled source",
            category: "jav",
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
