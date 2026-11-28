import assert from "node:assert/strict";
import { test } from "node:test";
import { perverzijaDbProvider } from "../../src/providers/perverzija-db.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

function context(fetch: typeof globalThis.fetch, cache?: Cache) {
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
    ...(cache ? { cache } : {}),
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


const sceneFixture = {
  id: 123,
  title: " Example scene ",
  release_date: "2026-10-25",
  duration: 3723,
  studio: { name: " Example Studio " },
  network: { name: "Example Network" },
  performers: [{ name: "Performer One" }, { name: "Performer Two" }],
  tags: [{ name: "Tag One" }],
  urls: {
    page: "https://db.perverzija.com/scene/123",
    watch: "https://tube.perverzija.com/watch/123",
  },
};

function response(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

test("maps scene metadata, relationships, duration, and attribution links", async () => {
  let requested = "";
  const fetcher: typeof fetch = async (input) => {
    requested = String(input);
    return response({ data: [sceneFixture] });
  };
  const results = await perverzijaDbProvider.search(
    { query: "Kira Noir & Co", mode: "keyword" },
    context(fetcher),
  );

  const url = new URL(requested);
  assert.equal(url.searchParams.get("q"), "Kira Noir & Co");
  assert.equal(url.searchParams.get("per_page"), "50");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "123");
  assert.equal(results[0]?.title, "Example scene");
  assert.equal(results[0]?.releaseDate, "2026-10-25");
  assert.match(results[0]?.description ?? "", /Duration: 01:02:03/);
  assert.deepEqual(results[0]?.relationships?.map(({ type, name }) => ({ type, name })), [
    { type: "studio", name: "Example Studio" },
    { type: "network", name: "Example Network" },
    { type: "performer", name: "Performer One" },
    { type: "performer", name: "Performer Two" },
    { type: "tag", name: "Tag One" },
  ]);
  assert.deepEqual(results[0]?.externalLinks, [{
    label: "观看页面",
    url: "https://tube.perverzija.com/watch/123",
  }]);
});

test("filters malformed records and untrusted result or watch URLs", async () => {
  const fetcher: typeof fetch = async () => response({ data: [
    sceneFixture,
    { ...sceneFixture, id: "124" },
    { ...sceneFixture, id: 125, title: " " },
    { ...sceneFixture, id: 126, urls: { ...sceneFixture.urls, page: "https://attacker.example/scene/126" } },
    { ...sceneFixture, id: 127, urls: { ...sceneFixture.urls, watch: "https://tube.perverzija.com.evil.test/watch/127" } },
  ] });
  const results = await perverzijaDbProvider.search(
    { query: "test", mode: "keyword" },
    context(fetcher),
  );
  assert.deepEqual(results.map(({ id }) => id), ["123"]);
});

test("omits invalid dates and bounds optional scene relationships", async () => {
  const fetcher: typeof fetch = async () => response({ data: [{
    ...sceneFixture,
    id: 200,
    release_date: "2026-02-30",
    duration: 90000,
    performers: Array.from({ length: 45 }, (_, i) => ({ name: `Performer ${i}` })),
    tags: Array.from({ length: 45 }, (_, i) => ({ name: `Tag ${i}` })),
  }] });
  const results = await perverzijaDbProvider.search(
    { query: "test", mode: "keyword" },
    context(fetcher),
  );
  assert.equal(results[0]?.releaseDate, undefined);
  assert.equal(results[0]?.description?.includes("Duration:"), false);
  assert.equal(results[0]?.relationships?.length, 40);
});

test("rejects wrong content type, malformed JSON, and invalid response envelopes", async () => {
  const wrongType: typeof fetch = async () => new Response("<html>blocked</html>", {
    headers: { "Content-Type": "text/html" },
  });
  await assert.rejects(
    perverzijaDbProvider.search({ query: "test", mode: "keyword" }, context(wrongType)),
    /unexpected content type/,
  );
  const malformed: typeof fetch = async () => new Response("{", {
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(
    perverzijaDbProvider.search({ query: "test", mode: "keyword" }, context(malformed)),
    /malformed JSON/,
  );
  const invalidEnvelope: typeof fetch = async () => response({ results: [] });
  await assert.rejects(
    perverzijaDbProvider.search({ query: "test", mode: "keyword" }, context(invalidEnvelope)),
    /invalid JSON response/,
  );
});

test("does not retry HTTP 429 responses", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response("rate limited", {
      status: 429,
      headers: { "Content-Type": "text/plain", "Retry-After": "60" },
    });
  };
  await assert.rejects(
    perverzijaDbProvider.search({ query: "test", mode: "keyword" }, context(fetcher)),
    /HTTP 429/,
  );
  assert.equal(calls, 1);
});

test("uses the cache for repeated queries and excludes unused image and player fields", async () => {
  let fetchCalls = 0;
  let cached: Response | null = null;
  const cache = {
    async match() { return cached?.clone() ?? undefined; },
    async put(_key: Request, value: Response) { cached = value.clone(); },
  } as unknown as Cache;
  const fetcher: typeof fetch = async () => {
    fetchCalls += 1;
    return response({ data: [{
      ...sceneFixture,
      cover: "https://images.example/cover.jpg",
      embed: "https://player.example/embed",
      player: { token: "private" },
    }] });
  };
  const first = await perverzijaDbProvider.search(
    { query: "same query", mode: "keyword" }, context(fetcher, cache),
  );
  const second = await perverzijaDbProvider.search(
    { query: "same query", mode: "keyword" }, context(fetcher, cache),
  );
  assert.equal(fetchCalls, 1);
  assert.deepEqual(second, first);
  const cachedPayload = await cached!.json() as { data: Array<Record<string, unknown>> };
  assert.equal("cover" in cachedPayload.data[0]!, false);
  assert.equal("embed" in cachedPayload.data[0]!, false);
  assert.equal("player" in cachedPayload.data[0]!, false);
});

test("ignores malformed cache entries and refreshes upstream", async () => {
  let calls = 0;
  const cache = {
    async match() { return new Response("{", { headers: { "Content-Type": "application/json" } }); },
    async put() {},
  } as unknown as Cache;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return response({ data: [sceneFixture] });
  };
  const results = await perverzijaDbProvider.search(
    { query: "cache refresh", mode: "keyword" }, context(fetcher, cache),
  );
  assert.equal(calls, 1);
  assert.equal(results.length, 1);
});

test("rejects oversized declared responses", async () => {
  const fetcher: typeof fetch = async () => new Response("{}", {
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(3 * 1024 * 1024),
    },
  });
  await assert.rejects(
    perverzijaDbProvider.search({ query: "test", mode: "keyword" }, context(fetcher)),
    /exceeded the size limit/,
  );
});
