import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AdapterDefinition,
  AdaptersConfig,
  SourceDefinition,
  SourcesConfig,
} from "@aio-resource-search/shared";
import { executeSearch } from "../../src/providers/search.ts";
import { perverzijaDbProvider } from "../../src/providers/perverzija-db.ts";
import { sukebeiRssProvider } from "../../src/providers/sukebei-rss.ts";
import { torlockProvider } from "../../src/providers/torlock-torznab.ts";
import type { NormalizedResource, ProviderAdapter } from "../../src/providers/types.ts";

const adapterMetadata: AdapterDefinition = {
  id: "test-adapter",
  name: "Test adapter",
  description: "Adapter used by scheduler unit tests.",
  version: "1.0.0",
  enabled: true,
  categories: ["jav"],
  capabilities: ["metadata", "magnet"],
  implemented: true,
};

const adapters: AdaptersConfig = {
  version: 1,
  updatedAt: null,
  adapters: [adapterMetadata],
};

function source(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: "test-source",
    name: "Test source",
    category: "jav",
    adapterId: "test-adapter",
    enabled: true,
    searchModes: ["number", "keyword"],
    capabilities: ["metadata"],
    timeoutMs: 1000,
    ...overrides,
  };
}

function sourceConfig(...sources: SourceDefinition[]): SourcesConfig {
  return { version: 1, updatedAt: null, sources };
}

function provider(
  search: ProviderAdapter["search"] = async () => [],
  overrides: Partial<ProviderAdapter> = {},
): ProviderAdapter {
  return {
    id: "test-adapter",
    version: "1.0.0",
    categories: ["jav"],
    capabilities: ["metadata", "magnet"],
    searchModes: ["number", "keyword"],
    search,
    ...overrides,
  };
}

function resource(overrides: Partial<NormalizedResource> = {}): NormalizedResource {
  return {
    id: "result-1",
    sourceId: "provider-controlled-source-id",
    sourceName: "Provider-controlled name",
    category: "jav",
    title: "  Example result  ",
    url: "https://example.com/item",
    ...overrides,
  };
}

const request = { query: "ABP-123", mode: "number" as const };
const resolve = (item: ProviderAdapter) => (_adapterId: string) => item;

test("ignores disabled sources and returns an empty successful response", async () => {
  const result = await executeSearch(
    request,
    sourceConfig(source({ enabled: false })),
    adapters,
    resolve(provider()),
  );

  assert.deepEqual(result.results, []);
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.meta, {
    totalResults: 0,
    successfulSources: 0,
    failedSources: 0,
  });
});

test("builds external search destinations without invoking a provider", async () => {
  const external = source({
    id: "external-index",
    name: "External index",
    type: "external-search",
    adapterId: undefined,
    searchUrlTemplate: "https://example.com/search?q={query}",
  });
  const result = await executeSearch(
    { query: "ABP 123", mode: "number" },
    sourceConfig(external),
    { version: 0, updatedAt: null, adapters: [] },
  );

  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.results, []);
  assert.deepEqual(result.externalSearches, [{
    sourceId: "external-index",
    sourceName: "External index",
    category: "jav",
    url: "https://example.com/search?q=ABP%20123",
  }]);
});

test("returns a homepage link for a browse-only external source", async () => {
  const external = source({
    id: "browse-only",
    name: "Browse-only source",
    type: "external-search",
    adapterId: undefined,
    baseUrl: "https://example.com",
    capabilities: [],
  });
  const result = await executeSearch(
    { query: "some query", mode: "keyword" },
    sourceConfig(external),
    { version: 0, updatedAt: null, adapters: [] },
  );

  assert.deepEqual(result.externalSearches, [{
    sourceId: "browse-only",
    sourceName: "Browse-only source",
    category: "jav",
    url: "https://example.com/",
  }]);
  assert.equal(result.meta.failedSources, 0);
});

test("reports an unavailable adapter when no implementation is registered", async () => {
  const result = await executeSearch(
    request,
    sourceConfig(source()),
    adapters,
    () => null,
  );

  assert.equal(result.sources[0]?.status, "unavailable");
  assert.equal(result.sources[0]?.errorCode, "adapter_unavailable");
  assert.equal(result.meta.failedSources, 1);
});

test("reports adapter incompatibility when required capabilities are missing", async () => {
  const incompatibleProvider = provider(async () => [], { capabilities: ["metadata"] });
  const result = await executeSearch(
    request,
    sourceConfig(source({ capabilities: ["magnet"] })),
    adapters,
    resolve(incompatibleProvider),
  );

  assert.equal(result.sources[0]?.status, "unavailable");
  assert.equal(result.sources[0]?.errorCode, "adapter_incompatible");
});

test("normalizes provider-owned fields and validates optional resource links", async () => {
  const magnet = "magnet:?dn=example&xt=urn:btih:01234567890123456789012345678901";
  const result = await executeSearch(
    request,
    sourceConfig(source()),
    adapters,
    resolve(provider(async () => [
      resource({
        magnetUri: magnet,
        imageUrl: "http://insecure.example/image.jpg",
        torrentUrl: "https://example.com/file.torrent",
        externalLinks: [
          { label: "Valid", url: "https://example.com/details" },
          { label: "Insecure", url: "http://example.com/details" },
        ],
      }),
    ])),
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.sourceId, "test-source");
  assert.equal(result.results[0]?.sourceName, "Test source");
  assert.equal(result.results[0]?.title, "Example result");
  assert.equal(result.results[0]?.magnetUri, magnet);
  assert.equal(result.results[0]?.imageUrl, undefined);
  assert.equal(result.results[0]?.torrentUrl, "https://example.com/file.torrent");
  assert.deepEqual(result.results[0]?.externalLinks, [
    { label: "Valid", url: "https://example.com/details" },
  ]);
});

test("deduplicates equivalent canonical result URLs across sources", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      url: context.source.id === "first"
        ? "https://example.com/item#section"
        : "https://example.com/item/",
    }),
  ]);
  const result = await executeSearch(
    request,
    sourceConfig(
      source({ id: "first", name: "First source" }),
      source({ id: "second", name: "Second source" }),
    ),
    adapters,
    resolve(sharedProvider),
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.sourceId, "first");
  assert.equal(result.meta.totalResults, 1);
  assert.equal(result.sources.length, 2);
});

test("isolates provider failures so healthy sources still return results", async () => {
  const resilientProvider = provider(async (_input, context) => {
    if (context.source.id === "broken") throw new Error("simulated provider failure");
    return [resource({ id: "healthy-result", url: "https://example.com/healthy" })];
  });
  const result = await executeSearch(
    request,
    sourceConfig(
      source({ id: "broken", name: "Broken source" }),
      source({ id: "healthy", name: "Healthy source" }),
    ),
    adapters,
    resolve(resilientProvider),
  );

  assert.equal(result.sources[0]?.status, "error");
  assert.equal(result.sources[0]?.errorCode, "provider_failed");
  assert.equal(result.sources[1]?.status, "ok");
  assert.equal(result.results.length, 1);
});

test("enforces per-source timeouts even when a provider ignores AbortSignal", async () => {
  const hangingProvider = provider(() => new Promise<NormalizedResource[]>(() => {}));
  const result = await executeSearch(
    request,
    sourceConfig(source({ timeoutMs: 10 })),
    adapters,
    resolve(hangingProvider),
  );

  assert.equal(result.sources[0]?.status, "timeout");
  assert.equal(result.sources[0]?.errorCode, "provider_timeout");
  assert.equal(result.meta.failedSources, 1);
});

test("limits each source to 50 results", async () => {
  const manyResultsProvider = provider(async () =>
    Array.from({ length: 55 }, (_, index) =>
      resource({ id: `result-${index}`, url: `https://example.com/item/${index}` }),
    ),
  );
  const result = await executeSearch(
    request,
    sourceConfig(source()),
    adapters,
    resolve(manyResultsProvider),
  );

  assert.equal(result.results.length, 50);
  assert.equal(result.sources[0]?.resultCount, 50);
});

test("caps concurrent provider calls at ten", async () => {
  let active = 0;
  let maximumActive = 0;
  const concurrentProvider = provider(async (_input, context) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
    active -= 1;
    return [resource({ id: context.source.id, url: `https://example.com/${context.source.id}` })];
  });
  const sources = Array.from({ length: 12 }, (_, index) =>
    source({ id: `source-${index}`, name: `Source ${index}` }),
  );

  const result = await executeSearch(
    request,
    sourceConfig(...sources),
    adapters,
    resolve(concurrentProvider),
  );

  assert.equal(result.sources.length, 12);
  assert.equal(result.results.length, 12);
  assert.equal(maximumActive, 10);
});

test("parses Sukebei's documented RSS magnet feed without browser or cookie emulation", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:nyaa="https://sukebei.nyaa.net/xmlns/nyaa"><channel>
    <item>
      <title><![CDATA[ABP-123 Sample Release]]></title>
      <guid isPermaLink="true">https://sukebei.nyaa.si/view/123456</guid>
      <link>magnet:?xt=urn:btih:0123456789012345678901234567890123456789&amp;dn=ABP-123</link>
      <pubDate>Tue, 25 Nov 2026 00:00:00 +0000</pubDate>
      <nyaa:infoHash>0123456789012345678901234567890123456789</nyaa:infoHash>
    </item>
  </channel></rss>`;
  let requestedUrl = "";
  const resources = await sukebeiRssProvider.search(
    { query: "ABP-123", mode: "number" },
    {
      source: source({
        id: "sukebei",
        name: "Sukebei",
        category: "torrent",
        adapterId: "sukebei-rss",
        capabilities: ["magnet"],
      }),
      signal: new AbortController().signal,
      fetch: async (input) => {
        requestedUrl = String(input);
        return new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        });
      },
    },
  );

  assert.match(requestedUrl, /^https:\/\/sukebei\.nyaa\.net\/feed\/magnet\?/);
  assert.match(requestedUrl, /q=ABP-123/);
  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.id, "123456");
  assert.equal(resources[0]?.title, "ABP-123 Sample Release");
  assert.equal(resources[0]?.url, "https://sukebei.nyaa.net/view/123456");
  assert.match(resources[0]?.magnetUri ?? "", /^magnet:\?xt=urn:btih:/);
});

test("rejects malformed Sukebei feed responses", async () => {
  await assert.rejects(
    sukebeiRssProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({ id: "sukebei", category: "torrent", adapterId: "sukebei-rss" }),
        signal: new AbortController().signal,
        fetch: async () => new Response("<html>challenge page</html>", { status: 200 }),
      },
    ),
    /unexpected feed format/,
  );
});

test("fails closed when Sukebei returns a non-success HTTP status", async () => {
  await assert.rejects(
    sukebeiRssProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({ id: "sukebei", category: "torrent", adapterId: "sukebei-rss" }),
        signal: new AbortController().signal,
        fetch: async () => new Response("Unavailable", { status: 503 }),
      },
    ),
    /HTTP 503/,
  );
});


test("rejects RSS-shaped responses without a complete channel document", async () => {
  await assert.rejects(
    sukebeiRssProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({ id: "sukebei", category: "torrent", adapterId: "sukebei-rss" }),
        signal: new AbortController().signal,
        fetch: async () => new Response("<rss><channel><item></item></channel>", { status: 200 }),
      },
    ),
    /invalid RSS document/,
  );
});

test("enforces the RSS response byte limit while streaming", async () => {
  await assert.rejects(
    sukebeiRssProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({ id: "sukebei", category: "torrent", adapterId: "sukebei-rss" }),
        signal: new AbortController().signal,
        fetch: async () => new Response(
          `<rss><channel>${"x".repeat(2 * 1024 * 1024)}</channel></rss>`,
          { status: 200 },
        ),
      },
    ),
    /exceeded the size limit/,
  );
});

test("does not follow redirects to a different host", async () => {
  let redirectMode: RequestRedirect | undefined;
  await assert.rejects(
    sukebeiRssProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({ id: "sukebei", category: "torrent", adapterId: "sukebei-rss" }),
        signal: new AbortController().signal,
        fetch: async (_input, init) => {
          redirectMode = init?.redirect;
          return new Response(null, { status: 302, headers: { Location: "https://example.com/feed" } });
        },
      },
    ),
    /HTTP 302/,
  );
  assert.equal(redirectMode, "manual");
});


const perverzijaFixture = {
  data: [{
    id: 1611928,
    title: "Studio - Performer - Sample Scene",
    release_date: "2026-11-20",
    duration: 3661,
    studio: { slug: "sample-studio", name: "Sample Studio" },
    performers: [{ slug: "sample-performer", name: "Sample Performer", gender: "female" }],
    tags: [{ slug: "drama", name: "Drama" }],
    urls: {
      page: "https://db.perverzija.com/scene/1611928-sample-scene",
      watch: "https://tube.perverzija.com/watch/sample-scene",
    },
  }],
};

function perverzijaContext(fetchImpl: typeof fetch) {
  return {
    source: source({
      id: "perverzija-db",
      name: "Perverzija DB",
      category: "other-index",
      adapterId: "perverzija-db",
      capabilities: ["metadata"],
    }),
    signal: new AbortController().signal,
    fetch: fetchImpl,
  };
}

test("searches the documented Perverzija DB JSON API and maps attributed metadata", async () => {
  let requestedUrl = "";
  let redirectMode: RequestRedirect | undefined;
  const resources = await perverzijaDbProvider.search(
    { query: "sample scene", mode: "keyword" },
    perverzijaContext(async (input, init) => {
      requestedUrl = String(input);
      redirectMode = init?.redirect;
      return new Response(JSON.stringify(perverzijaFixture), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }),
  );

  const parsedUrl = new URL(requestedUrl);
  assert.equal(parsedUrl.origin, "https://api.perverzija.com");
  assert.equal(parsedUrl.pathname, "/v1/scenes");
  assert.equal(parsedUrl.searchParams.get("q"), "sample scene");
  assert.equal(parsedUrl.searchParams.get("per_page"), "50");
  assert.equal(redirectMode, "manual");
  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.id, "1611928");
  assert.equal(resources[0]?.category, "other-index");
  assert.equal(resources[0]?.url, "https://db.perverzija.com/scene/1611928-sample-scene");
  assert.equal(resources[0]?.releaseDate, "2026-11-20");
  assert.match(resources[0]?.description ?? "", /Studio: Sample Studio/);
  assert.match(resources[0]?.description ?? "", /Cast: Sample Performer/);
  assert.match(resources[0]?.description ?? "", /Duration: 01:01:01/);
  assert.deepEqual(resources[0]?.externalLinks, [{
    label: "观看页面",
    url: "https://tube.perverzija.com/watch/sample-scene",
  }]);
  assert.equal(resources[0]?.imageUrl, undefined);
});

test("rejects Perverzija records with untrusted attribution or watch URLs", async () => {
  const unsafeFixture = {
    data: [{
      ...perverzijaFixture.data[0],
      urls: {
        page: "https://evil.example/scene/123",
        watch: "https://tube.perverzija.com/watch/sample-scene",
      },
    }],
  };
  const resources = await perverzijaDbProvider.search(
    { query: "sample", mode: "keyword" },
    perverzijaContext(async () => new Response(JSON.stringify(unsafeFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  );
  assert.deepEqual(resources, []);
});

test("does not retry Perverzija rate limits or follow redirects", async () => {
  let requestCount = 0;
  await assert.rejects(
    perverzijaDbProvider.search(
      { query: "sample", mode: "keyword" },
      perverzijaContext(async (_input, init) => {
        requestCount += 1;
        assert.equal(init?.redirect, "manual");
        return new Response(JSON.stringify({ error: { code: "rate_limited" } }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "10" },
        });
      }),
    ),
    /HTTP 429/,
  );
  assert.equal(requestCount, 1);
});

test("rejects malformed Perverzija JSON responses", async () => {
  await assert.rejects(
    perverzijaDbProvider.search(
      { query: "sample", mode: "keyword" },
      perverzijaContext(async () => new Response("{invalid", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })),
    ),
    /malformed JSON/,
  );
});


const torlockFixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>Torlock</title>
    <item>
      <title>ABP-123 Example torrent</title>
      <guid>https://www.torlock.com/torrent/12345/example.html</guid>
      <link>https://www.torlock.com/torrent/12345/example.html</link>
      <pubDate>Tue, 25 Nov 2026 00:00:00 +0000</pubDate>
      <size>123456789</size>
      <torznab:attr name="magneturl" value="magnet:?xt=urn:btih:0123456789012345678901234567890123456789&amp;dn=ABP-123"/>
      <torznab:attr name="seeders" value="42"/>
      <torznab:attr name="peers" value="7"/>
    </item>
  </channel>
</rss>`;

function torlockContext(fetchImpl: typeof fetch, cache?: Cache) {
  return {
    source: source({
      id: "torlock",
      name: "Torlock",
      category: "torrent",
      adapterId: "torlock-torznab",
      capabilities: ["magnet"],
    }),
    signal: new AbortController().signal,
    fetch: fetchImpl,
    ...(cache ? { cache } : {}),
  };
}

test("searches Torlock's documented Torznab endpoint with the Adult category and caches the feed", async () => {
  let requestedUrl = "";
  let cachedResponse: Response | null = null;
  let cacheTtl = "";
  const cache = {
    match: async () => null,
    put: async (_request: RequestInfo | URL, response: Response) => {
      cachedResponse = response;
      cacheTtl = response.headers.get("Cache-Control") ?? "";
    },
  } as unknown as Cache;

  const resources = await torlockProvider.search(
    { query: "ABP-123", mode: "number" },
    torlockContext(async (input, init) => {
      requestedUrl = String(input);
      assert.equal(init?.redirect, "manual");
      return new Response(torlockFixture, {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      });
    }, cache),
  );

  const parsedUrl = new URL(requestedUrl);
  assert.equal(parsedUrl.origin, "https://www.torlock.com");
  assert.equal(parsedUrl.pathname, "/torznab/api");
  assert.equal(parsedUrl.searchParams.get("t"), "search");
  assert.equal(parsedUrl.searchParams.get("q"), "ABP-123");
  assert.equal(parsedUrl.searchParams.get("cat"), "6000");
  assert.equal(parsedUrl.searchParams.get("limit"), "50");
  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.url, "https://www.torlock.com/torrent/12345/example.html");
  assert.match(resources[0]?.magnetUri ?? "", /^magnet:\\?xt=urn:btih:/);
  assert.match(resources[0]?.description ?? "", /Seeds: 42/);
  assert.equal(cacheTtl, "public, max-age=60");
  assert.ok(cachedResponse instanceof Response);
});

test("uses a cached Torlock response without making another upstream request", async () => {
  let fetchCount = 0;
  const cache = {
    match: async () => new Response(torlockFixture, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml" },
    }),
    put: async () => {
      throw new Error("Cache hit must not write a new entry.");
    },
  } as unknown as Cache;

  const resources = await torlockProvider.search(
    { query: "ABP-123", mode: "number" },
    torlockContext(async () => {
      fetchCount += 1;
      throw new Error("Unexpected upstream fetch.");
    }, cache),
  );

  assert.equal(fetchCount, 0);
  assert.equal(resources.length, 1);
});

test("rejects malformed Torlock RSS and drops untrusted detail links", async () => {
  await assert.rejects(
    torlockProvider.search(
      { query: "test", mode: "keyword" },
      torlockContext(async () => new Response("<rss><channel><item></item></channel>", {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      })),
    ),
    /invalid Torznab RSS document/,
  );

  const unsafe = torlockFixture.replace(
    "https://www.torlock.com/torrent/12345/example.html",
    "https://evil.example/torrent/12345/example.html",
  );
  const resources = await torlockProvider.search(
    { query: "test", mode: "keyword" },
    torlockContext(async () => new Response(unsafe, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml" },
    })),
  );
  assert.deepEqual(resources, []);
});

test("does not retry Torlock rate limits", async () => {
  let requestCount = 0;
  await assert.rejects(
    torlockProvider.search(
      { query: "test", mode: "keyword" },
      torlockContext(async () => {
        requestCount += 1;
        return new Response("Rate limited", { status: 429 });
      }),
    ),
    /HTTP 429/,
  );
  assert.equal(requestCount, 1);
});
