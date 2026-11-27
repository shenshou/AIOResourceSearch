import assert from "node:assert/strict";
import { test } from "node:test";
import { mangaDexProvider } from "../../src/providers/mangadex-api.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const mangaId = "1d6f4b8c-2a31-4f10-9b8d-5c7e2a1f3d40";
const payload = {
  result: "ok",
  response: "collection",
  data: [{
    id: mangaId,
    type: "manga",
    attributes: {
      title: { ja: "ドロヘドロ", en: "Dorohedoro" },
      description: { en: "A manga about a mysterious city." },
      year: 2000,
      status: "completed",
      originalLanguage: "ja",
      contentRating: "suggestive",
      tags: [
        { id: "tag-1", type: "tag", attributes: { name: { en: "Action" } } },
        { id: "tag-2", type: "tag", attributes: { name: { en: "Fantasy" } } },
      ],
    },
  }],
};

function context(fetch: typeof globalThis.fetch, cache?: Cache) {
  return {
    source: {
      id: "mangadex", name: "MangaDex", category: "other-index" as const,
      contentCategory: "manga" as const, enabled: true, searchModes: ["keyword" as const],
      capabilities: ["metadata" as const], timeoutMs: 5000,
    },
    fetch,
    signal: new AbortController().signal,
    cache,
  };
}

test("declares a metadata-only MangaDex provider on the shared rate-limit lane", () => {
  assert.equal(mangaDexProvider.id, "mangadex-api");
  assert.equal(getProviderAdapter("mangadex-api"), mangaDexProvider);
  assert.equal(mangaDexProvider.rateLimitLane, "mangadex");
  assert.deepEqual(mangaDexProvider.contentCategories, ["manga"]);
  assert.deepEqual(mangaDexProvider.categories, ["other-index"]);
  assert.deepEqual(mangaDexProvider.capabilities, ["metadata"]);
  assert.deepEqual(mangaDexProvider.searchModes, ["keyword"]);
});

test("uses the documented GET /manga query contract and maps metadata", async () => {
  let requestUrl = "";
  let userAgent = "";
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    userAgent = new Headers(init?.headers).get("User-Agent") ?? "";
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };

  const results = await mangaDexProvider.search(
    { query: "Dorohedoro", mode: "keyword" },
    context(fetcher),
  );
  const url = new URL(requestUrl);
  assert.equal(url.origin + url.pathname, "https://api.mangadex.org/manga");
  assert.equal(url.searchParams.get("title"), "Dorohedoro");
  assert.equal(url.searchParams.has("title[]"), false);
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.deepEqual(url.searchParams.getAll("contentRating[]"), [
    "safe", "suggestive", "erotica", "pornographic",
  ]);
  assert.match(userAgent, /^AIOResourceSearch\/0\.1\.0/);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    id: mangaId,
    sourceId: "mangadex",
    sourceName: "MangaDex",
    category: "other-index",
    contentCategory: "manga",
    title: "Dorohedoro",
    url: "https://mangadex.org/title/" + mangaId,
    externalLinks: [{ label: "MangaDex attribution", url: "https://mangadex.org" }],
    description: "A manga about a mysterious city.",
    metadata: {
      status: "completed",
      originalLanguage: "ja",
      contentRating: "suggestive",
      year: "2000",
      tags: "Action, Fantasy",
    },
  });
});

test("drops malformed or unsupported records without inventing fields", async () => {
  const mixed = {
    result: "ok",
    data: [
      ...payload.data,
      { id: "not-a-uuid", type: "manga", attributes: { title: { en: "Invalid" } } },
      { id: mangaId, type: "chapter", attributes: { title: { en: "Not a manga" } } },
      { id: "2d6f4b8c-2a31-4f10-9b8d-5c7e2a1f3d40", type: "manga", attributes: { title: {} } },
    ],
  };
  const results = await mangaDexProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response(JSON.stringify(mixed), {
      headers: { "Content-Type": "application/json" },
    })),
  );
  assert.equal(results.length, 1);
  assert.equal(results[0]?.releaseDate, undefined);
  assert.equal(results[0]?.imageUrl, undefined);
  assert.equal(results[0]?.magnetUri, undefined);
});

test("uses cached metadata without issuing an upstream request", async () => {
  const cache = {
    match: async () => new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    }),
    put: async () => { throw new Error("cache hit must not write"); },
  } as unknown as Cache;
  let fetchCalls = 0;
  const results = await mangaDexProvider.search(
    { query: "Dorohedoro", mode: "keyword" },
    context(async () => {
      fetchCalls += 1;
      throw new Error("upstream should not be called on cache hit");
    }, cache),
  );
  assert.equal(fetchCalls, 0);
  assert.equal(results.length, 1);
});

test("keeps valid MangaDex results when cache lookup and write fail", async () => {
  let fetchCount = 0;
  const cache = {
    match: async () => { throw new Error("cache unavailable"); },
    put: async () => { throw new Error("cache write unavailable"); },
  } as unknown as Cache;

  const results = await mangaDexProvider.search(
    { query: "Dorohedoro", mode: "keyword" },
    context(async () => {
      fetchCount += 1;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }, cache),
  );

  assert.equal(fetchCount, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.title, "Dorohedoro");
});

test("rejects unexpected response content types and malformed envelopes", async () => {
  await assert.rejects(
    mangaDexProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response("<html>blocked</html>", {
        headers: { "Content-Type": "text/html" },
      })),
    ),
    /unexpected content type/i,
  );

  await assert.rejects(
    mangaDexProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response(JSON.stringify({ result: "error", errors: [] }), {
        headers: { "Content-Type": "application/json" },
      })),
    ),
    /invalid search response/i,
  );
});

test("rejects upstream redirects and does not follow them", async () => {
  await assert.rejects(
    mangaDexProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.example/" },
      })),
    ),
    /HTTP 302/i,
  );
});
