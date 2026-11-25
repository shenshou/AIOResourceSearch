import assert from "node:assert/strict";
import { test } from "node:test";
import { musicBrainzProvider } from "../../src/providers/musicbrainz-api.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const releaseGroupId = "70664047-2545-4e46-b75f-4556f2a7b83e";
const payload = {
  created: "2026-11-25T00:00:00Z",
  count: 1,
  offset: 0,
  "release-groups": [{
    id: releaseGroupId,
    title: "Main Tenance",
    "first-release-date": "1998",
    "primary-type": "Single",
    "artist-credit": [{
      artist: { id: "a8fa58d8-f60b-4b83-be7c-aea1af11596b", name: "Fred Giannelli" },
      name: "Fred Giannelli",
    }],
  }],
};

function context(fetch: typeof globalThis.fetch, cache?: Cache) {
  return {
    source: {
      id: "musicbrainz", name: "MusicBrainz", category: "other-index" as const,
      contentCategory: "music" as const, enabled: true, searchModes: ["keyword" as const],
      capabilities: ["metadata" as const], timeoutMs: 5000,
    },
    fetch,
    signal: new AbortController().signal,
    cache,
  };
}

test("declares a metadata-only MusicBrainz provider on the shared one-second lane", () => {
  assert.equal(musicBrainzProvider.id, "musicbrainz-api");
  assert.equal(getProviderAdapter("musicbrainz-api"), musicBrainzProvider);
  assert.equal(musicBrainzProvider.rateLimitLane, "musicbrainz");
  assert.deepEqual(musicBrainzProvider.contentCategories, ["music"]);
  assert.deepEqual(musicBrainzProvider.categories, ["other-index"]);
  assert.deepEqual(musicBrainzProvider.capabilities, ["metadata"]);
  assert.deepEqual(musicBrainzProvider.searchModes, ["keyword"]);
});

test("uses the documented release-group JSON search contract and maps core metadata", async () => {
  let requestUrl = "";
  let userAgent = "";
  let redirect = "";
  const results = await musicBrainzProvider.search(
    { query: "Main Tenance", mode: "keyword" },
    context(async (input, init) => {
      requestUrl = String(input);
      userAgent = new Headers(init?.headers).get("User-Agent") ?? "";
      redirect = init?.redirect ?? "";
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }),
  );

  const url = new URL(requestUrl);
  assert.equal(url.origin + url.pathname, "https://musicbrainz.org/ws/2/release-group");
  assert.equal(url.searchParams.get("query"), "Main Tenance");
  assert.equal(url.searchParams.get("fmt"), "json");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(url.searchParams.get("dismax"), "true");
  assert.match(userAgent, /^AIOResourceSearch\/0\.1\.0/);
  assert.equal(redirect, "manual");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    id: releaseGroupId,
    sourceId: "musicbrainz",
    sourceName: "MusicBrainz",
    category: "other-index",
    contentCategory: "music",
    title: "Main Tenance",
    url: "https://musicbrainz.org/release-group/" + releaseGroupId,
    externalLinks: [{ label: "MusicBrainz attribution", url: "https://musicbrainz.org" }],
    metadata: {
      musicBrainzId: releaseGroupId,
      artist: "Fred Giannelli",
      primaryType: "Single",
      firstReleaseDate: "1998",
      year: "1998",
    },
  });
  assert.equal(results[0]?.releaseDate, undefined);
  assert.equal(results[0]?.imageUrl, undefined);
});

test("preserves full-precision release dates but does not invent a day for partial dates", async () => {
  const fullDate = {
    "release-groups": [{
      id: releaseGroupId,
      title: "A Record",
      "first-release-date": "2001-02-03",
      "artist-credit": [],
    }],
  };
  const results = await musicBrainzProvider.search(
    { query: "A Record", mode: "keyword" },
    context(async () => new Response(JSON.stringify(fullDate), {
      headers: { "Content-Type": "application/json" },
    })),
  );
  assert.equal(results[0]?.releaseDate, "2001-02-03");
  assert.equal(results[0]?.metadata?.year, "2001");
});

test("drops malformed records and ignores supplementary tags and ratings", async () => {
  const mixed = {
    "release-groups": [
      ...payload["release-groups"],
      { id: "not-a-mbid", title: "Invalid" },
      { id: releaseGroupId, title: "" },
    ],
  };
  const results = await musicBrainzProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response(JSON.stringify(mixed), {
      headers: { "Content-Type": "application/json" },
    })),
  );
  assert.equal(results.length, 1);
  assert.equal(results[0]?.metadata?.tags, undefined);
  assert.equal(results[0]?.metadata?.rating, undefined);
});

test("uses cached metadata without making an upstream request", async () => {
  const cache = {
    match: async () => new Response(JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
    }),
    put: async () => { throw new Error("cache hit must not write"); },
  } as unknown as Cache;
  let fetchCalls = 0;
  const results = await musicBrainzProvider.search(
    { query: "Main Tenance", mode: "keyword" },
    context(async () => {
      fetchCalls += 1;
      throw new Error("upstream should not be called on cache hit");
    }, cache),
  );
  assert.equal(fetchCalls, 0);
  assert.equal(results.length, 1);
});

test("keeps valid results when cache lookup and write fail", async () => {
  const cache = {
    match: async () => { throw new Error("cache unavailable"); },
    put: async () => { throw new Error("cache write unavailable"); },
  } as unknown as Cache;
  let fetchCalls = 0;
  const results = await musicBrainzProvider.search(
    { query: "Main Tenance", mode: "keyword" },
    context(async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
      });
    }, cache),
  );
  assert.equal(fetchCalls, 1);
  assert.equal(results.length, 1);
});

test("rejects invalid envelopes, unexpected content types, and upstream redirects", async () => {
  await assert.rejects(
    musicBrainzProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response(JSON.stringify({ artists: [] }), {
        headers: { "Content-Type": "application/json" },
      })),
    ),
    /invalid release-group search response/i,
  );
  await assert.rejects(
    musicBrainzProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response("<html>blocked</html>", {
        headers: { "Content-Type": "text/html" },
      })),
    ),
    /unexpected content type/i,
  );
  await assert.rejects(
    musicBrainzProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.example/" },
      })),
    ),
    /HTTP 302/i,
  );
});

test("rejects oversized declared response bodies", async () => {
  await assert.rejects(
    musicBrainzProvider.search(
      { query: "test", mode: "keyword" },
      context(async () => new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(3 * 1024 * 1024),
        },
      })),
    ),
    /size limit/i,
  );
});
