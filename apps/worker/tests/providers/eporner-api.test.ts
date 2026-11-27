import assert from "node:assert/strict";
import { test } from "node:test";
import { epornerApiProvider } from "../../src/providers/eporner-api.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const activeId = "AbCdEfGhIjK";
const removedId = "LmNoPqRsTuV";
const searchPayload = {
  count: 2,
  videos: [
    {
      id: activeId,
      title: "Sample adult metadata title",
      url: "https://www.eporner.com/video-AbCdEfGhIjK/sample-title/",
      keywords: "sample, metadata",
      views: 12345,
      rate: "4.13",
      length_sec: 2539,
      added: "2026-11-17 21:41:44",
      categories: [{ id: 49, name: "Japanese", slug: "japanese", url: "https://www.eporner.com/cat/japanese/", image: "https://category-cdn.example/japanese.jpg" }],
      pornstars: [{ id: 4211, name: "Sample Performer", url: "https://www.eporner.com/pornstar/sample-performer/", image: "https://profile-cdn.example/performer.jpg" }],
      embed: "https://www.eporner.com/embed/AbCdEfGhIjK/",
      default_thumb: { src: "https://static-ca-cdn.eporner.com/thumb.jpg" },
    },
    {
      id: removedId,
      title: "Removed sample",
      url: "https://www.eporner.com/video-LmNoPqRsTuV/removed-sample/",
    },
  ],
};
const statusPayload = {
  count: 2,
  videos: [
    { id: activeId, status: "active" },
    { id: removedId, status: "removed", removed_at: "2026-11-17T00:04:12Z" },
  ],
};
const freshSyncState = {
  version: 1 as const,
  since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  lastCompleteAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  lastAttemptAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  lastPageCount: 2,
};

function context(fetcher: typeof fetch, cache?: Cache, syncState: unknown = freshSyncState) {
  return {
    source: {
      id: "eporner", name: "Eporner", category: "other-index" as const,
      contentCategory: "jav" as const, enabled: true,
      searchModes: ["keyword" as const], capabilities: ["metadata" as const],
      timeoutMs: 10000,
    },
    fetch: fetcher,
    signal: new AbortController().signal,
    cache,
    getEpornerSyncState: async () => syncState as typeof freshSyncState | null,
  };
}

test("registers a metadata-only adult keyword Provider on the shared Eporner lane", () => {
  assert.equal(getProviderAdapter("eporner-api"), epornerApiProvider);
  assert.equal(epornerApiProvider.version, "1.1.0");
  assert.equal(epornerApiProvider.mechanism, "api");
  assert.deepEqual(epornerApiProvider.contentCategories, ["jav"]);
  assert.deepEqual(epornerApiProvider.categories, ["other-index"]);
  assert.deepEqual(epornerApiProvider.capabilities, ["metadata", "relationships"]);
  assert.deepEqual(epornerApiProvider.searchModes, ["keyword"]);
  assert.equal(epornerApiProvider.rateLimitLane, "eporner");
});

test("uses documented search and status endpoints, suppresses removed IDs, and maps text metadata only", async () => {
  const requests: URL[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    return new Response(JSON.stringify(url.pathname.endsWith("/video/search/") ? searchPayload : statusPayload), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const results = await epornerApiProvider.search(
    { query: "sample phrase", mode: "keyword" },
    context(fetcher),
  );

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.origin + requests[0]?.pathname, "https://www.eporner.com/api/v2/video/search/");
  assert.equal(requests[0]?.searchParams.get("query"), "sample phrase");
  assert.equal(requests[0]?.searchParams.get("per_page"), "50");
  assert.equal(requests[0]?.searchParams.get("thumbs"), "none");
  assert.equal(requests[0]?.searchParams.get("gay"), "1");
  assert.equal(requests[0]?.searchParams.get("fields"), "pornstars,categories");
  assert.equal(requests[1]?.origin + requests[1]?.pathname, "https://www.eporner.com/api/v2/video/status/");
  assert.equal(requests[1]?.searchParams.get("id"), activeId + "," + removedId);
  assert.deepEqual(results, [{
    id: activeId,
    sourceId: "eporner",
    sourceName: "Eporner",
    category: "other-index",
    contentCategory: "jav",
    title: "Sample adult metadata title",
    url: "https://www.eporner.com/video-AbCdEfGhIjK/sample-title/",
    description: "sample, metadata",
    relationships: [
      { type: "performer", name: "Sample Performer", url: "https://www.eporner.com/pornstar/sample-performer/" },
      { type: "genre", name: "Japanese", url: "https://www.eporner.com/cat/japanese/" },
      { type: "tag", name: "sample" },
      { type: "tag", name: "metadata" },
    ],
    metadata: {
      keywords: "sample, metadata",
      views: "12345",
      rating: "4.13",
      durationSeconds: "2539",
      addedAtSource: "2026-11-17 21:41:44",
    },
  }]);
});

test("rejects untrusted Eporner relationship URLs while retaining validated names", async () => {
  const payload = {
    videos: [{
      ...searchPayload.videos[0],
      categories: [
        { name: "Japanese", url: "https://www.eporner.com/cat/japanese/" },
        { name: "Spoofed category", url: "https://evil.example/cat/spoofed/" },
      ],
      pornstars: [
        { name: "Valid Performer", url: "https://www.eporner.com/pornstar/valid-performer/" },
        { name: "Spoofed Performer", url: "https://evil.example/pornstar/spoofed/" },
        { name: "Name Only Performer", url: "http://www.eporner.com/pornstar/name-only/" },
      ],
    }],
  };
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify(url.pathname.endsWith("/video/search/")
      ? payload
      : { videos: [{ id: activeId, status: "active" }] }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const results = await epornerApiProvider.search(
    { query: "sample", mode: "keyword" },
    context(fetcher),
  );

  assert.deepEqual(results[0]?.relationships, [
    { type: "performer", name: "Valid Performer", url: "https://www.eporner.com/pornstar/valid-performer/" },
    { type: "performer", name: "Spoofed Performer" },
    { type: "performer", name: "Name Only Performer" },
    { type: "genre", name: "Japanese", url: "https://www.eporner.com/cat/japanese/" },
    { type: "genre", name: "Spoofed category" },
    { type: "tag", name: "sample" },
    { type: "tag", name: "metadata" },
  ]);
});

test("fails closed when the daily removal feed has not completed a fresh sync", async () => {
  let fetchCalls = 0;
  await assert.rejects(
    epornerApiProvider.search(
      { query: "sample", mode: "keyword" },
      context(async () => {
        fetchCalls += 1;
        throw new Error("upstream must not be called");
      }, undefined, null),
    ),
    /removal feed/i,
  );
  assert.equal(fetchCalls, 0);
});

test("fails closed when the status API omits an ID", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify(url.pathname.endsWith("/video/search/")
      ? searchPayload
      : { videos: [{ id: activeId, status: "active" }] }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  await assert.rejects(
    epornerApiProvider.search({ query: "sample", mode: "keyword" }, context(fetcher)),
    /omitted/i,
  );
});

test("rejects untrusted detail URLs and does not consume images or embed markup", async () => {
  const payload = {
    videos: [{
      id: activeId,
      title: "Valid title",
      url: "https://evil.example/video-AbCdEfGhIjK/title/",
      default_thumb: { src: "https://evil.example/image.jpg" },
      embed: "https://evil.example/embed",
    }],
  };
  let fetchCalls = 0;
  const results = await epornerApiProvider.search(
    { query: "sample", mode: "keyword" },
    context(async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  assert.deepEqual(results, []);
  assert.equal(fetchCalls, 1);
});

test("rejects redirects, unexpected content types, and upstream 503 responses", async () => {
  await assert.rejects(
    epornerApiProvider.search(
      { query: "sample", mode: "keyword" },
      context(async () => new Response(null, { status: 302, headers: { Location: "https://evil.example/" } })),
    ),
    /HTTP 302/i,
  );
  await assert.rejects(
    epornerApiProvider.search(
      { query: "sample", mode: "keyword" },
      context(async () => new Response("<html>blocked</html>", { headers: { "Content-Type": "text/html" } })),
    ),
    /unexpected content type/i,
  );
  await assert.rejects(
    epornerApiProvider.search(
      { query: "sample", mode: "keyword" },
      context(async () => new Response(JSON.stringify({}), {
        status: 503,
        headers: { "Content-Type": "application/problem+json", "Retry-After": "60" },
      })),
    ),
    /HTTP 503/i,
  );
});

test("caches only the allowlisted metadata fields, never embed or image fields", async () => {
  const stored: string[] = [];
  const cache = {
    match: async () => undefined,
    put: async (_key: Request, response: Response) => {
      stored.push(await response.text());
    },
  } as unknown as Cache;
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify(url.pathname.endsWith("/video/search/")
      ? searchPayload
      : statusPayload), {
      headers: { "Content-Type": "application/json" },
    });
  };
  await epornerApiProvider.search(
    { query: "sample", mode: "keyword" },
    context(fetcher, cache),
  );
  assert.equal(stored.length, 2);
  assert.equal(stored.some((value) => value.includes("embed")), false);
  assert.equal(stored.some((value) => value.includes("default_thumb")), false);
  assert.equal(stored.some((value) => value.includes("static-ca-cdn")), false);
  assert.equal(stored.some((value) => value.includes("Sample Performer")), true);
  assert.equal(stored.some((value) => value.includes("Japanese")), true);
  assert.equal(stored.some((value) => value.includes("profile-cdn")), false);
  assert.equal(stored.some((value) => value.includes("category-cdn")), false);
});
