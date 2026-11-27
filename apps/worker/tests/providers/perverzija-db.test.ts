import assert from "node:assert/strict";
import { test } from "node:test";
import { perverzijaDbProvider } from "../../src/providers/perverzija-db.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

function context(fetch: typeof globalThis.fetch) {
  return {
    source: {
      id: "perverzija-db",
      name: "Perverzija DB",
      category: "other-index" as const,
      contentCategory: "jav" as const,
      enabled: true,
      searchModes: ["keyword" as const],
      capabilities: ["metadata" as const, "relationships" as const],
      timeoutMs: 10000,
    },
    fetch,
    signal: new AbortController().signal,
  };
}

test("declares Perverzija DB as keyword-only", () => {
  assert.equal(getProviderAdapter("perverzija-db"), perverzijaDbProvider);
  assert.deepEqual(perverzijaDbProvider.searchModes, ["keyword"]);
  assert.deepEqual(perverzijaDbProvider.capabilities, ["metadata", "relationships"]);
});

test("passes keyword text to the documented scenes q parameter", async () => {
  let requestedUrl = "";
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };

  const results = await perverzijaDbProvider.search(
    { query: "Kira Noir", mode: "keyword" },
    context(fetcher),
  );

  const url = new URL(requestedUrl);
  assert.equal(url.origin + url.pathname, "https://api.perverzija.com/v1/scenes");
  assert.equal(url.searchParams.get("q"), "Kira Noir");
  assert.equal(url.searchParams.get("per_page"), "50");
  assert.deepEqual(results, []);
});
