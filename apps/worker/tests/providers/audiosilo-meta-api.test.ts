import assert from "node:assert/strict";
import { test } from "node:test";
import { audioSiloMetaProvider } from "../../src/providers/audiosilo-meta-api.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";
import fixture from "../fixtures/audiosilo-meta-works.json" with { type: "json" };

function context(fetch: typeof globalThis.fetch) {
  return {
    source: {
      id: "audiosilo-meta", name: "AudioSilo Meta", category: "other-index" as const,
      contentCategory: "audiobook" as const, enabled: false, searchModes: ["keyword" as const],
      capabilities: ["metadata" as const], timeoutMs: 8000,
    },
    fetch,
    signal: new AbortController().signal,
  };
}

test("declares a metadata-only AudioSilo Meta Provider on its dedicated shared lane", () => {
  assert.equal(audioSiloMetaProvider.id, "audiosilo-meta-api");
  assert.equal(getProviderAdapter("audiosilo-meta-api"), audioSiloMetaProvider);
  assert.equal(audioSiloMetaProvider.rateLimitLane, "audiosilo");
  assert.deepEqual(audioSiloMetaProvider.contentCategories, ["audiobook"]);
  assert.deepEqual(audioSiloMetaProvider.categories, ["other-index"]);
  assert.deepEqual(audioSiloMetaProvider.capabilities, ["metadata"]);
  assert.deepEqual(audioSiloMetaProvider.searchModes, ["keyword"]);
});

test("uses the documented works/search contract and maps only CC0 factual fields", async () => {
  let requestUrl = "";
  let userAgent = "";
  let redirect = "";
  const results = await audioSiloMetaProvider.search(
    { query: "Project Hail Mary", mode: "keyword" },
    context(async (input, init) => {
      requestUrl = String(input);
      userAgent = new Headers(init?.headers).get("User-Agent") ?? "";
      redirect = init?.redirect ?? "";
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }),
  );

  const url = new URL(requestUrl);
  assert.equal(url.origin + url.pathname, "https://meta.audiosilo.app/api/v1/works/search");
  assert.equal(url.searchParams.get("q"), "Project Hail Mary");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.match(userAgent, /^AIOResourceSearch\/0\.1\.0/);
  assert.equal(redirect, "manual");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    id: "audiosilo-project-hail-mary",
    sourceId: "audiosilo-meta",
    sourceName: "AudioSilo Meta",
    category: "other-index",
    contentCategory: "audiobook",
    title: "Project Hail Mary",
    url: "https://meta.audiosilo.app/works/project-hail-mary",
    externalLinks: [{ label: "AudioSilo Meta attribution", url: "https://meta.audiosilo.app" }],
    releaseDate: "2021-05-04",
    metadata: {
      authors: "Andy Weir",
      narrators: "Ray Porter",
      language: "en",
    },
  });
  assert.equal(results[0]?.description, undefined);
  assert.equal(results[0]?.imageUrl, undefined);
});

test("maps series facts while ignoring cover URLs and expressive community fields", async () => {
  const payload = {
    results: [{
      kind: "work",
      id: "the-way-of-kings",
      title: "The Way of Kings",
      authors: [{ id: "brandon-sanderson", name: "Brandon Sanderson" }],
      language: "en",
      series: { id: "stormlight-archive", name: "The Stormlight Archive", position: "1" },
      release_date: "2010",
      narrators: [{ id: "michael-kramer", name: "Michael Kramer" }, { id: "kate-reading", name: "Kate Reading" }],
      cover_url: "https://images.example.test/cover.jpg",
      characters: [{ name: "Community-only character" }],
      recaps: [{ text: "Community-only recap" }],
    }],
  };
  const results = await audioSiloMetaProvider.search(
    { query: "The Way of Kings", mode: "keyword" },
    context(async () => Response.json(payload)),
  );
  assert.deepEqual(results[0]?.metadata, {
    authors: "Brandon Sanderson",
    narrators: "Michael Kramer, Kate Reading",
    language: "en",
    series: "The Stormlight Archive",
    seriesPosition: "1",
  });
  assert.equal(results[0]?.imageUrl, undefined);
  assert.equal(results[0]?.description, undefined);
});

test("preserves valid partial release dates and drops invalid calendar values", async () => {
  const payload = {
    results: [
      {
        kind: "work", id: "year-only", title: "Year Only",
        authors: [], language: "en", series: null, release_date: "1998", narrators: [],
      },
      {
        kind: "work", id: "month-invalid", title: "Invalid Month",
        authors: [], language: "en", series: null, release_date: "2024-13", narrators: [],
      },
      {
        kind: "work", id: "day-invalid", title: "Invalid Day",
        authors: [], language: "en", series: null, release_date: "2024-02-30", narrators: [],
      },
    ],
  };
  const results = await audioSiloMetaProvider.search(
    { query: "date", mode: "keyword" },
    context(async () => Response.json(payload)),
  );
  assert.equal(results.length, 3);
  assert.equal(results[0]?.releaseDate, "1998");
  assert.equal(results[1]?.releaseDate, undefined);
  assert.equal(results[2]?.releaseDate, undefined);
});

test("rejects invalid envelopes, unexpected content types, redirects, and oversized responses", async () => {
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => Response.json({ works: [] }))),
    /invalid works search response/i,
  );
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("<html>blocked</html>", {
        headers: { "Content-Type": "text/html" },
      }))),
    /unexpected content type/i,
  );
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response(null, {
        status: 302, headers: { Location: "https://untrusted.example/" },
      }))),
    /HTTP 302/i,
  );
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(2 * 1024 * 1024),
        },
      }))),
    /size limit/i,
  );
});

test("rejects malformed JSON and reports upstream Retry-After on 429", async () => {
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("{", {
        headers: { "Content-Type": "application/json" },
      }))),
    /malformed JSON/i,
  );
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response(JSON.stringify({ error: "rate limit exceeded" }), {
        status: 429,
        headers: { "Retry-After": "3" },
      }))),
    /HTTP 429.*Retry-After: 3/i,
  );
});

test("rejects empty and overlong queries without an upstream request", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json(fixture);
  };
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "  ", mode: "keyword" }, context(fetcher)),
    /1–120 characters/,
  );
  await assert.rejects(
    audioSiloMetaProvider.search({ query: "x".repeat(121), mode: "keyword" }, context(fetcher)),
    /1–120 characters/,
  );
  assert.equal(calls, 0);
});

test("honors cancellation before issuing the API request", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));
  await assert.rejects(
    audioSiloMetaProvider.search(
      { query: "Project Hail Mary", mode: "keyword" },
      { ...context(async () => { throw new Error("must not fetch"); }), signal: controller.signal },
    ),
    /cancelled/i,
  );
});
