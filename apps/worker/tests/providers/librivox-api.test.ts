import assert from "node:assert/strict";
import { test } from "node:test";
import { libriVoxProvider } from "../../src/providers/librivox-api.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";
import fixture from "../fixtures/librivox-audiobooks.json" with { type: "json" };

function context(fetch: typeof globalThis.fetch) {
  return {
    source: {
      id: "librivox", name: "LibriVox", category: "other-index" as const,
      contentCategory: "audiobook" as const, enabled: false, searchModes: ["keyword" as const],
      capabilities: ["metadata" as const], timeoutMs: 8000,
    },
    fetch,
    signal: new AbortController().signal,
  };
}

test("declares a metadata-only LibriVox Provider on the shared five-second lane", () => {
  assert.equal(libriVoxProvider.id, "librivox-api");
  assert.equal(getProviderAdapter("librivox-api"), libriVoxProvider);
  assert.equal(libriVoxProvider.rateLimitLane, "librivox");
  assert.deepEqual(libriVoxProvider.contentCategories, ["audiobook"]);
  assert.deepEqual(libriVoxProvider.categories, ["other-index"]);
  assert.deepEqual(libriVoxProvider.capabilities, ["metadata"]);
  assert.deepEqual(libriVoxProvider.searchModes, ["keyword"]);
});

test("uses the official title-prefix JSON contract and maps the real first-party fixture", async () => {
  let requestUrl = "";
  let userAgent = "";
  let redirect = "";
  const results = await libriVoxProvider.search(
    { query: "Letters of Two Brides", mode: "keyword" },
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
  assert.equal(url.origin + url.pathname, "https://librivox.org/api/feed/audiobooks/");
  assert.equal(url.searchParams.get("title"), "^Letters of Two Brides");
  assert.equal(url.searchParams.get("format"), "json");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.deepEqual(url.searchParams.get("fields")?.split(","), [
    "id", "title", "description", "language", "copyright_year", "num_sections",
    "url_librivox", "totaltime", "totaltimesecs", "authors",
  ]);
  assert.equal(url.searchParams.has("url_zip_file"), false);
  assert.equal(url.searchParams.has("coverart"), false);
  assert.match(userAgent, /^AIOResourceSearch\/0\.1\.0/);
  assert.equal(redirect, "manual");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    id: "librivox-52",
    sourceId: "librivox",
    sourceName: "LibriVox",
    category: "other-index",
    contentCategory: "audiobook",
    title: "Letters of Two Brides",
    url: "https://librivox.org/letters-of-two-brides-by-honore-de-balzac/",
    externalLinks: [{ label: "LibriVox attribution", url: "https://librivox.org" }],
    description: "Letters of Two Brides is an epistolary novel. The two brides are Louise de Chaulieu (Madame Gaston) and Renée de Maucombe (Madame l'Estorade). The women became friends during their education at a convent and upon leaving began a life-long correspondence. For a 17 year period, they exchange letters describing their lives. Michelle Crandall reads Renee’s letters, and Kara Shallenberg reads Louise’s. Letters from the men in their lives are read by Peter Yearsley, David Barnes, Denny Sayers, and Sean McKinley",
    metadata: {
      librivoxId: "52",
      authors: "Honoré de Balzac",
      language: "English",
      copyrightYear: "1902",
      sectionCount: "57",
      runtime: "9:09:20",
      runtimeSeconds: "32960",
    },
  });
});

test("drops malformed records and rejects untrusted project URLs", async () => {
  const mixed = {
    books: [
      ...fixture.books,
      { id: "bad", title: "Invalid ID", url_librivox: "https://librivox.org/item/" },
      { id: "53", title: "Untrusted URL", url_librivox: "https://evil.example/item/" },
      { id: "54", title: "Missing title", url_librivox: "https://librivox.org/item/" },
    ],
  };
  const results = await libriVoxProvider.search(
    { query: "Letters", mode: "keyword" },
    context(async () => Response.json(mixed)),
  );
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "librivox-52");
});

test("rejects invalid envelopes, unexpected content types, and upstream redirects", async () => {
  await assert.rejects(
    libriVoxProvider.search({ query: "test", mode: "keyword" },
      context(async () => Response.json({ results: [] }))),
    /invalid audiobook search response/i,
  );
  await assert.rejects(
    libriVoxProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("<html>blocked</html>", {
        headers: { "Content-Type": "text/html" },
      }))),
    /unexpected content type/i,
  );
  await assert.rejects(
    libriVoxProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response(null, {
        status: 302, headers: { Location: "https://untrusted.example/" },
      }))),
    /HTTP 302/i,
  );
});

test("rejects oversized declared response bodies and malformed JSON", async () => {
  await assert.rejects(
    libriVoxProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(2 * 1024 * 1024),
        },
      }))),
    /size limit/i,
  );
  await assert.rejects(
    libriVoxProvider.search({ query: "test", mode: "keyword" },
      context(async () => new Response("{", {
        headers: { "Content-Type": "application/json" },
      }))),
    /malformed JSON/i,
  );
});

test("rejects empty and overlong queries without an upstream request", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return Response.json(fixture);
  };
  await assert.rejects(
    libriVoxProvider.search({ query: "  ", mode: "keyword" }, context(fetcher)),
    /1–120 characters/,
  );
  await assert.rejects(
    libriVoxProvider.search({ query: "x".repeat(121), mode: "keyword" }, context(fetcher)),
    /1–120 characters/,
  );
  assert.equal(calls, 0);
});

test("honors cancellation before issuing the API request", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("cancelled", "AbortError"));
  await assert.rejects(
    libriVoxProvider.search(
      { query: "Letters", mode: "keyword" },
      { ...context(async () => { throw new Error("must not fetch"); }), signal: controller.signal },
    ),
    /cancelled/i,
  );
});
