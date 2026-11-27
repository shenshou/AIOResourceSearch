import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AdapterDefinition,
  AdaptersConfig,
  SourceDefinition,
  SourcesConfig,
} from "@aio-resource-search/shared";
import { executeSearch } from "../../src/providers/search.ts";
import { listProviderAdapters } from "../../src/providers/registry.ts";
import { SOURCE_CATALOG } from "../../../web/src/modules/sources/sourceCatalog.ts";
import type { Env } from "../../src/env.ts";
import { genericHtmlProvider } from "../../src/providers/generic-html.ts";
import { perverzijaDbProvider } from "../../src/providers/perverzija-db.ts";
import { sukebeiRssProvider } from "../../src/providers/sukebei-rss.ts";
import { torlockProvider } from "../../src/providers/torlock-torznab.ts";
import { anibtTorznabProvider } from "../../src/providers/anibt-torznab.ts";
import { yourBittorrentProvider } from "../../src/providers/yourbittorrent-json.ts";
import { theRarBgProvider } from "../../src/providers/the-rarbg-json.ts";
import type { NormalizedResource, ProviderAdapter } from "../../src/providers/types.ts";

test("compile-time Provider registry contains the expected adapter allowlist", () => {
  const registeredIds = listProviderAdapters().map((adapter) => adapter.id).sort();
  assert.deepEqual(registeredIds, [
    "anibt-torznab",
    "audiosilo-meta-api",
    "dmhy-rss",
    "eporner-api",
    "generic-html",
    "librivox-api",
    "mangadex-api",
    "musicbrainz-api",
    "perverzija-db",
    "sukebei-rss",
    "the-rarbg-json",
    "torlock-torznab",
    "yourbittorrent-json",
  ]);
});

const adapterMetadata: AdapterDefinition = {
  id: "test-adapter",
  name: "Test adapter",
  description: "Adapter used by scheduler unit tests.",
  version: "1.0.0",
  enabled: true,
  categories: ["jav"],
  capabilities: ["metadata", "image", "magnet", "ed2k", "torrent"],
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
    capabilities: ["metadata", "image", "magnet", "ed2k", "torrent"],
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
const resolve = (item: ProviderAdapter) => () => item;

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
    kind: "search",
    url: "https://example.com/search?q=ABP%20123",
  }]);
});

test("returns an external search link for a Provider without changing Worker execution", async () => {
  let providerCalls = 0;
  const configuredProvider = source({
    id: "dual-mode-source",
    name: "Dual-mode source",
    externalSearchUrlTemplate: "https://example.com/search?q={query}",
    externalSearchBaseUrl: "https://example.com",
  });
  const result = await executeSearch(
    { query: "ABP 123", mode: "number" },
    sourceConfig(configuredProvider),
    adapters,
    resolve(provider(async () => {
      providerCalls += 1;
      return [resource({ url: "https://example.com/provider-result" })];
    })),
  );

  assert.equal(providerCalls, 1);
  assert.equal(result.sources[0]?.status, "ok");
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.externalSearches, [{
    sourceId: "dual-mode-source",
    sourceName: "Dual-mode source",
    category: "jav",
    kind: "search",
    url: "https://example.com/search?q=ABP%20123",
  }]);
});

test("returns a homepage link for a Provider when only an external homepage is configured", async () => {
  const configuredProvider = source({
    id: "provider-with-homepage",
    name: "Provider with homepage",
    externalSearchBaseUrl: "https://example.com",
  });
  const result = await executeSearch(
    request,
    sourceConfig(configuredProvider),
    adapters,
    resolve(provider()),
  );
  assert.equal(result.sources[0]?.status, "ok");
  assert.deepEqual(result.externalSearches, [{
    sourceId: "provider-with-homepage",
    sourceName: "Provider with homepage",
    category: "jav",
    kind: "homepage",
    url: "https://example.com/",
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
    kind: "homepage",
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


test("rate-limited Providers fail closed when the shared coordinator is missing", async () => {
  let upstreamFetchCalls = 0;
  const rateLimited = provider(async (_input, context) => {
    await context.fetch("https://api.mangadex.org/manga", { signal: context.signal });
    upstreamFetchCalls += 1;
    return [];
  }, { rateLimitLane: "mangadex" });

  const result = await executeSearch(
    request,
    sourceConfig(source()),
    adapters,
    resolve(rateLimited),
  );

  assert.equal(result.sources[0]?.status, "error");
  assert.equal(result.sources[0]?.errorCode, "provider_failed");
  assert.equal(upstreamFetchCalls, 0);
});

function perverzijaAdapterConfig(): AdaptersConfig {
  return {
    version: 1,
    updatedAt: null,
    adapters: [{
      ...adapterMetadata,
      id: "perverzija-db",
      version: "1.1.0",
      categories: ["other-index"],
      contentCategories: ["jav"],
      capabilities: ["metadata"],
    }],
  };
}

function perverzijaSourceDefinition(): SourceDefinition {
  return source({
    id: "perverzija-db",
    name: "Perverzija DB",
    category: "other-index",
    contentCategory: "jav",
    adapterId: "perverzija-db",
    capabilities: ["metadata"],
    searchModes: ["number", "keyword"],
  });
}

test("Perverzija DB Provider fails closed on a cache miss when its coordinator is unavailable", async () => {
  const result = await executeSearch(
    request,
    sourceConfig(perverzijaSourceDefinition()),
    perverzijaAdapterConfig(),
    resolve(perverzijaDbProvider),
  );

  assert.equal(result.sources[0]?.status, "error");
  assert.equal(result.sources[0]?.errorCode, "provider_failed");
  assert.equal(result.results.length, 0);
});

test("Perverzija DB cache hits work without reserving a coordinator slot", async () => {
  const cacheUrl = new URL("https://api.perverzija.com/v1/scenes");
  cacheUrl.searchParams.set("q", request.query);
  cacheUrl.searchParams.set("per_page", "50");
  const cache = {
    match: async (key: Request) => key.url === cacheUrl.toString()
      ? new Response(JSON.stringify(perverzijaFixture), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        })
      : undefined,
    put: async () => {},
  } as unknown as Cache;

  const result = await executeSearch(
    request,
    sourceConfig(perverzijaSourceDefinition()),
    perverzijaAdapterConfig(),
    resolve(perverzijaDbProvider),
    cache,
  );

  assert.equal(result.sources[0]?.status, "ok");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.sourceId, "perverzija-db");
  assert.equal(result.results[0]?.relationships?.length, 3);
});

test("normalizes provider-owned fields and validates optional resource links", async () => {
  const magnet = "magnet:?dn=example&xt=urn:btih:01234567890123456789012345678901";
  const result = await executeSearch(
    request,
    sourceConfig(source({ capabilities: ["metadata", "magnet", "torrent"] })),
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

test("drops optional result fields that the source has not declared", async () => {
  const result = await executeSearch(
    request,
    sourceConfig(source({ capabilities: ["metadata"] })),
    adapters,
    resolve(provider(async () => [resource({
      imageUrl: "https://example.com/image.jpg",
      magnetUri: "magnet:?xt=urn:btih:01234567890123456789012345678901",
      ed2kUri: "ed2k://|file|example.bin|10|0123456789abcdef0123456789abcdef|/",
      torrentUrl: "https://example.com/file.torrent",
      relationships: [{ type: "performer", name: "Must not leak without metadata capability" }],
    })])),
  );

  assert.equal(result.results[0]?.relationships, undefined);
  assert.equal(result.results[0]?.imageUrl, undefined);
  assert.equal(result.results[0]?.magnetUri, undefined);
  assert.equal(result.results[0]?.ed2kUri, undefined);
  assert.equal(result.results[0]?.torrentUrl, undefined);
});

test("configured source order wins even when providers complete out of order", async () => {
  const sharedProvider = provider(async (_input, context) => {
    await new Promise((resolve) => setTimeout(resolve, context.source.id === "first" ? 25 : 0));
    return [resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      url: `https://${context.source.id}.example/item/ssis-001`,
      description: context.source.id === "first" ? "Configured first" : "Completed first",
    })];
  });
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
  assert.equal(result.results[0]?.description, "Configured first");
  assert.deepEqual(result.sources.map((item) => item.sourceId), ["first", "second"]);
});

test("deduplicates equivalent canonical result URLs across sources", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      url: context.source.id === "first"
        ? "https://example.com/item#section"
        : "https://example.com/item/",
      ...(context.source.id === "second"
        ? { description: "Additional source description", metadata: { author: "Second source" } }
        : {}),
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
  assert.deepEqual(result.results[0]?.sourceAttributions, [
    { sourceId: "first", sourceName: "First source", category: "jav" },
    { sourceId: "second", sourceName: "Second source", category: "jav" },
  ]);
  assert.equal(result.results[0]?.description, "Additional source description");
  assert.deepEqual(result.results[0]?.metadata, { author: "Second source" });
  assert.equal(result.meta.totalResults, 1);
  assert.equal(result.sources.length, 2);
  assert.deepEqual(result.sources.map((item) => item.resultCount), [1, 1]);
});

test("keeps the first source's label for duplicate external URLs", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      url: `https://${context.source.id}.example/item/ssis-001`,
      externalLinks: [{
        label: context.source.id === "first" ? "Original label" : "Later label",
        url: "https://shared.example/details",
      }],
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

  assert.deepEqual(result.results[0]?.externalLinks, [{
    label: "Original label",
    url: "https://shared.example/details",
  }]);
});

test("keeps the first source's conflicting metadata and fills only missing fields", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      title: context.source.id === "first" ? "First source title" : "Conflicting later title",
      catalogNumber: "SSIS-001",
      releaseDate: context.source.id === "first" ? "2026-01-01" : "2026-02-02",
      description: context.source.id === "first" ? "First source description" : "Conflicting later description",
      metadata: context.source.id === "first"
        ? { director: "Director A", author: "First author" }
        : { director: "Director B", author: "Second author", studio: "Studio B" },
      imageUrl: context.source.id === "first"
        ? "https://first.example/cover.jpg"
        : "https://second.example/cover.jpg",
      url: `https://${context.source.id}.example/item/ssis-001`,
    }),
  ]);
  const result = await executeSearch(
    request,
    sourceConfig(
      source({ id: "first", name: "First source", capabilities: ["metadata", "image"] }),
      source({ id: "second", name: "Second source", capabilities: ["metadata", "image"] }),
    ),
    adapters,
    resolve(sharedProvider),
  );

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.sourceId, "first");
  assert.equal(result.results[0]?.title, "First source title");
  assert.equal(result.results[0]?.url, "https://first.example/item/ssis-001");
  assert.equal(result.results[0]?.releaseDate, "2026-01-01");
  assert.equal(result.results[0]?.description, "First source description");
  assert.equal(result.results[0]?.imageUrl, "https://first.example/cover.jpg");
  assert.deepEqual(result.results[0]?.metadata, {
    director: "Director A",
    author: "First author",
    studio: "Studio B",
  });
});

test("discards blank optional metadata so later sources can fill those fields", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: context.source.id === "first" ? "   " : "SSIS-001",
      releaseDate: context.source.id === "first" ? "  " : "2026-02-02",
      description: context.source.id === "first" ? "  " : "Useful description",
      metadata: context.source.id === "first"
        ? { director: "   ", author: " First author " }
        : { director: "Director B", author: "Second author" },
      url: `https://${context.source.id}.example/item/ssis-001`,
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
  assert.equal(result.results[0]?.catalogNumber, "SSIS-001");
  assert.equal(result.results[0]?.releaseDate, "2026-02-02");
  assert.equal(result.results[0]?.description, "Useful description");
  assert.deepEqual(result.results[0]?.metadata, {
    author: "First author",
    director: "Director B",
  });
});

test("deduplicates repeated relationships within a single source result", async () => {
  const result = await executeSearch(
    request,
    sourceConfig(source({ capabilities: ["metadata"] })),
    adapters,
    resolve(provider(async () => [resource({
      relationships: [
        { type: "performer", name: "Performer A" },
        { type: "performer", name: "  Performer   A ", url: "https://example.com/performer/a" },
        { type: "tag", name: "Drama" },
        { type: "tag", name: "Drama" },
      ],
    })])),
  );

  assert.deepEqual(result.results[0]?.relationships, [
    { type: "performer", name: "Performer A", url: "https://example.com/performer/a" },
    { type: "tag", name: "Drama" },
  ]);
});

test("relationship identity normalizes Unicode compatibility and repeated whitespace", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      url: `https://${context.source.id}.example/item/ssis-001`,
      relationships: context.source.id === "first"
        ? [{ type: "performer", name: "Ａｎｎａ   Smith" }]
        : [{ type: "performer", name: "Anna Smith", url: "https://second.example/performer/anna" }],
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

  assert.deepEqual(result.results[0]?.relationships, [
    { type: "performer", name: "Ａｎｎａ Smith", url: "https://second.example/performer/anna" },
  ]);
});

test("relationship cap does not prevent later sources from filling existing relationship URLs", async () => {
  const firstRelationships = Array.from({ length: 40 }, (_, index) => ({
    type: "performer" as const,
    name: `Performer ${index + 1}`,
  }));
  const secondRelationships = [
    { type: "performer" as const, name: "Performer 1", url: "https://second.example/performer/1" },
    { type: "performer" as const, name: "Performer 40", url: "https://second.example/performer/40" },
    { type: "performer" as const, name: "Performer 41", url: "https://second.example/performer/41" },
  ];
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      url: `https://${context.source.id}.example/item/ssis-001`,
      relationships: context.source.id === "first" ? firstRelationships : secondRelationships,
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

  const relationships = result.results[0]?.relationships ?? [];
  assert.equal(relationships.length, 40);
  assert.equal(relationships[0]?.url, "https://second.example/performer/1");
  assert.equal(relationships[39]?.url, "https://second.example/performer/40");
  assert.equal(relationships.some((item) => item.name === "Performer 41"), false);
});

test("normalizes and merges structured work relationships without fuzzy matching", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      url: `https://${context.source.id}.example/item/ssis-001`,
      relationships: context.source.id === "first"
        ? [
            { type: "performer", name: "  Performer A  " },
            { type: "studio", name: "Studio One" },
            { type: "performer", name: "   " },
            { type: "director", name: "Invalid URL", url: "http://invalid.example/person" },
          ]
        : [
            { type: "performer", name: "performer a", url: "https://second.example/performer/a" },
            { type: "performer", name: "Performer B", url: "https://second.example/performer/b" },
            { type: "studio", name: "Studio Two" },
          ],
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
  assert.deepEqual(result.results[0]?.relationships, [
    { type: "performer", name: "Performer A", url: "https://second.example/performer/a" },
    { type: "studio", name: "Studio One" },
    { type: "performer", name: "Performer B", url: "https://second.example/performer/b" },
  ]);
});

test("deduplicates JAV results by normalized catalogue number across different detail URLs", async () => {
  const sharedProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: context.source.id === "first" ? "ssis-001" : "SSIS 001",
      url: context.source.id === "first"
        ? "https://first.example/item/ssis-001"
        : "https://second.example/title/SSIS001",
      ...(context.source.id === "second"
        ? { description: "Metadata from the second catalogue" }
        : {}),
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
  assert.equal(result.results[0]?.catalogNumber, "ssis-001");
  assert.deepEqual(result.results[0]?.sourceAttributions, [
    { sourceId: "first", sourceName: "First source", category: "jav" },
    { sourceId: "second", sourceName: "Second source", category: "jav" },
  ]);
  assert.equal(result.results[0]?.description, "Metadata from the second catalogue");
  assert.equal(result.sources[0]?.resultCount, 1);
  assert.equal(result.sources[1]?.resultCount, 1);
});

test("does not reassign a catalogue identity when a canonical URL conflicts", async () => {
  const records: Record<string, { catalogNumber: string; url: string }> = {
    first: { catalogNumber: "SSIS-001", url: "https://first.example/item" },
    second: { catalogNumber: "ABP-002", url: "https://second.example/item" },
    conflicting: { catalogNumber: "ABP-002", url: "https://first.example/item" },
    fourth: { catalogNumber: "ABP-002", url: "https://fourth.example/item" },
  };
  const sharedProvider = provider(async (_input, context) => {
    const record = records[context.source.id];
    if (!record) throw new Error("Missing test fixture for source.");
    return [resource({
      id: context.source.id,
      catalogNumber: record.catalogNumber,
      url: record.url,
    })];
  });
  const result = await executeSearch(
    request,
    sourceConfig(
      source({ id: "first", name: "First source" }),
      source({ id: "second", name: "Second source" }),
      source({ id: "conflicting", name: "Conflicting source" }),
      source({ id: "fourth", name: "Fourth source" }),
    ),
    adapters,
    resolve(sharedProvider),
  );

  assert.equal(result.results.length, 2);
  assert.deepEqual(result.results[0]?.sourceAttributions?.map((item) => item.sourceId), [
    "first",
    "conflicting",
  ]);
  assert.deepEqual(result.results[1]?.sourceAttributions?.map((item) => item.sourceId), [
    "second",
    "fourth",
  ]);
  assert.equal(result.results[0]?.catalogNumber, "SSIS-001");
  assert.equal(result.results[1]?.catalogNumber, "ABP-002");
});

test("does not use JAV catalogue-number identity for non-JAV content", async () => {
  const crossCategoryProvider = provider(async (_input, context) => [
    resource({
      id: context.source.id,
      catalogNumber: "SSIS-001",
      contentCategory: "anime",
      url: `https://${context.source.id}.example/item`,
    }),
  ], { contentCategories: ["anime"] });
  const result = await executeSearch(
    request,
    sourceConfig(
      source({ id: "first", name: "First source", contentCategory: "anime" }),
      source({ id: "second", name: "Second source", contentCategory: "anime" }),
    ),
    { version: 1, updatedAt: null, adapters: [{
      ...adapterMetadata,
      contentCategories: ["anime"],
    }] },
    resolve(crossCategoryProvider),
  );

  assert.equal(result.results.length, 2);
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

test("enforces per-source timeouts and aborts the Provider signal", async () => {
  let observedSignal: AbortSignal | undefined;
  const hangingProvider = provider((_input, context) => {
    observedSignal = context.signal;
    return new Promise<NormalizedResource[]>(() => {});
  });
  const result = await executeSearch(
    request,
    sourceConfig(source({ timeoutMs: 10 })),
    adapters,
    resolve(hangingProvider),
  );

  assert.equal(result.sources[0]?.status, "timeout");
  assert.equal(result.sources[0]?.errorCode, "provider_timeout");
  assert.equal(result.meta.failedSources, 1);
  assert.equal(observedSignal?.aborted, true);
});

test("aborts in-flight providers and stops scheduling when the client cancels", async () => {
  const controller = new AbortController();
  const observedSignals: AbortSignal[] = [];
  let started = 0;
  const hangingProvider = provider((_input, context) => {
    started += 1;
    observedSignals.push(context.signal);
    return new Promise<NormalizedResource[]>(() => {});
  });
  const pending = executeSearch(
    request,
    sourceConfig(
      ...Array.from({ length: 15 }, (_, index) => source({ id: "source-" + index })),
    ),
    adapters,
    resolve(hangingProvider),
    undefined,
    controller.signal,
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort(new DOMException("Client cancelled search.", "AbortError"));
  await assert.rejects(pending, /cancelled/i);
  assert.equal(started, 10);
  assert.equal(observedSignals.length, 10);
  assert.ok(observedSignals.every((signal) => signal.aborted));
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

function perverzijaContext(fetchImpl: typeof fetch, cache?: Cache) {
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
    cache,
  };
}

test("searches the documented Perverzija DB JSON API and maps attributed metadata", async () => {
  assert.equal(perverzijaDbProvider.version, "1.1.0");
  assert.equal(perverzijaDbProvider.rateLimitLane, "perverzija");
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
  assert.deepEqual(resources[0]?.relationships, [
    { type: "studio", name: "Sample Studio" },
    { type: "performer", name: "Sample Performer" },
    { type: "tag", name: "Drama" },
  ]);
  assert.deepEqual(resources[0]?.externalLinks, [{
    label: "观看页面",
    url: "https://tube.perverzija.com/watch/sample-scene",
  }]);
  assert.equal(resources[0]?.imageUrl, undefined);
});

test("caches valid Perverzija metadata for five minutes and skips the upstream lane on hits", async () => {
  const entries = new Map<string, Response>();
  const cache = {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => { entries.set(key.url, response.clone()); },
  } as unknown as Cache;
  let fetchCalls = 0;
  const fetcher: typeof fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify(perverzijaFixture), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=1800",
      },
    });
  };

  const first = await perverzijaDbProvider.search(
    { query: "sample", mode: "keyword" },
    perverzijaContext(fetcher, cache),
  );
  const second = await perverzijaDbProvider.search(
    { query: "sample", mode: "keyword" },
    perverzijaContext(fetcher, cache),
  );

  assert.equal(fetchCalls, 1);
  assert.deepEqual(second, first);
  assert.equal(entries.size, 1);
  assert.equal(entries.values().next().value?.headers.get("Cache-Control"), "public, max-age=300");
});

test("refreshes a Perverzija cache entry with an invalid response envelope", async () => {
  let fetchCalls = 0;
  const cache = {
    match: async () => new Response(JSON.stringify({ unexpected: [] }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    }),
    put: async () => {},
  } as unknown as Cache;
  const resources = await perverzijaDbProvider.search(
    { query: "sample", mode: "keyword" },
    perverzijaContext(async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify(perverzijaFixture), {
        headers: { "Content-Type": "application/json" },
      });
    }, cache),
  );

  assert.equal(fetchCalls, 1);
  assert.equal(resources.length, 1);
});

test("omits impossible Perverzija calendar dates without discarding the scene", async () => {
  const invalidDateFixture = {
    data: [{
      ...perverzijaFixture.data[0],
      release_date: "2026-02-30",
    }],
  };
  const resources = await perverzijaDbProvider.search(
    { query: "sample", mode: "keyword" },
    perverzijaContext(async () => new Response(JSON.stringify(invalidDateFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  );

  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.releaseDate, undefined);
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

function torlockContext(fetchImpl: typeof fetch, cache?: Cache, signal?: AbortSignal) {
  return {
    source: source({
      id: "torlock",
      name: "Torlock",
      category: "torrent",
      adapterId: "torlock-torznab",
      capabilities: ["magnet"],
    }),
    signal: signal ?? new AbortController().signal,
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
  assert.match(resources[0]?.magnetUri ?? "", /^magnet:\?xt=urn:btih:/);
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

test("keeps valid Torlock results when cache lookup and write fail", async () => {
  let fetchCount = 0;
  const cache = {
    match: async () => { throw new Error("cache unavailable"); },
    put: async () => { throw new Error("cache write unavailable"); },
  } as unknown as Cache;

  const resources = await torlockProvider.search(
    { query: "ABP-123", mode: "number" },
    torlockContext(async () => {
      fetchCount += 1;
      return new Response(torlockFixture, {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      });
    }, cache),
  );

  assert.equal(fetchCount, 1);
  assert.equal(resources.length, 1);
});

test("does not fetch or write cache when cancellation occurs during cache lookup", async () => {
  const controller = new AbortController();
  let fetchCount = 0;
  let putCount = 0;
  const cache = {
    match: async () => {
      controller.abort(new DOMException("Cancelled during cache lookup.", "AbortError"));
      return null;
    },
    put: async () => { putCount += 1; },
  } as unknown as Cache;

  await assert.rejects(
    torlockProvider.search(
      { query: "ABP-123", mode: "number" },
      torlockContext(async () => {
        fetchCount += 1;
        throw new Error("Cancelled search must not fetch upstream.");
      }, cache, controller.signal),
    ),
    /Cancelled during cache lookup/,
  );
  assert.equal(fetchCount, 0);
  assert.equal(putCount, 0);
});

test("does not write a Torlock cache entry when cancellation occurs during upstream fetch", async () => {
  const controller = new AbortController();
  let putCount = 0;
  const cache = {
    match: async () => null,
    put: async () => { putCount += 1; },
  } as unknown as Cache;

  await assert.rejects(
    torlockProvider.search(
      { query: "ABP-123", mode: "number" },
      torlockContext(async () => {
        controller.abort(new DOMException("Cancelled during fetch.", "AbortError"));
        return new Response(torlockFixture, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml" },
        });
      }, cache, controller.signal),
    ),
    /Cancelled during fetch/,
  );
  assert.equal(putCount, 0);
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

  const unsafe = torlockFixture.replaceAll(
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


const yourBittorrentFixture = {
  status: "ok",
  endpoint: "search",
  page: 1,
  limit: 20,
  count: 1,
  total_found: 1,
  query: "ABP-123",
  results: [{
    id: 38839040,
    name: "ABP-123 Sample Release",
    infohash: "0123456789012345678901234567890123456789",
    magnet: "magnet:?xt=urn:btih:0123456789012345678901234567890123456789&dn=ABP-123",
    torrent_file: "https://yourbittorrent.com/down/38839040.torrent",
    url: "https://yourbittorrent.com/torrent/38839040/abp-123-sample.html",
    category: "Adult",
    category_id: 7,
    size_bytes: 123456789,
    size: "117.7 MB",
    seeds: 47,
    peers: 3,
    verified: true,
    added: 1795564800,
    added_iso: "2026-11-25T00:00:00+00:00",
  }],
};

function yourBittorrentContext(fetchImpl: typeof fetch, cache?: Cache, signal?: AbortSignal) {
  return {
    source: source({
      id: "yourbittorrent",
      name: "YourBittorrent",
      category: "torrent",
      adapterId: "yourbittorrent-json",
      capabilities: ["magnet"],
    }),
    signal: signal ?? new AbortController().signal,
    fetch: fetchImpl,
    ...(cache ? { cache } : {}),
  };
}

test("site Providers declare metadata when they emit metadata fields", () => {
  assert.ok(sukebeiRssProvider.capabilities.includes("metadata"));
  assert.ok(torlockProvider.capabilities.includes("metadata"));
  assert.ok(yourBittorrentProvider.capabilities.includes("metadata"));
});

test("YourBittorrent declares metadata, Magnet, and torrent-file capabilities", () => {
  assert.deepEqual(yourBittorrentProvider.capabilities, ["metadata", "magnet", "torrent"]);
});

test("searches YourBittorrent's documented JSON API using the Adult category and maps links", async () => {
  let requestedUrl = "";
  let cacheTtl = "";
  const cache = {
    match: async () => null,
    put: async (_request: RequestInfo | URL, response: Response) => {
      cacheTtl = response.headers.get("Cache-Control") ?? "";
    },
  } as unknown as Cache;

  const resources = await yourBittorrentProvider.search(
    { query: "ABP-123", mode: "number" },
    yourBittorrentContext(async (input, init) => {
      requestedUrl = String(input);
      assert.equal(init?.redirect, "manual");
      return new Response(JSON.stringify(yourBittorrentFixture), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }, cache),
  );

  const parsedUrl = new URL(requestedUrl);
  assert.equal(parsedUrl.origin, "https://yourbittorrent.com");
  assert.equal(parsedUrl.pathname, "/api/search.json");
  assert.equal(parsedUrl.searchParams.get("q"), "ABP-123");
  assert.equal(parsedUrl.searchParams.get("category"), "7");
  assert.equal(parsedUrl.searchParams.get("limit"), "50");
  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.title, "ABP-123 Sample Release");
  assert.equal(resources[0]?.url, "https://yourbittorrent.com/torrent/38839040/abp-123-sample.html");
  assert.equal(resources[0]?.torrentUrl, "https://yourbittorrent.com/down/38839040.torrent");
  assert.match(resources[0]?.magnetUri ?? "", /^magnet:\?xt=urn:btih:/);
  assert.match(resources[0]?.description ?? "", /Seeds: 47/);
  assert.match(resources[0]?.description ?? "", /Verified/);
  assert.equal(resources[0]?.releaseDate, undefined);
  assert.equal(cacheTtl, "public, max-age=900");
});

test("uses cached YourBittorrent JSON without another upstream request", async () => {
  let fetchCount = 0;
  const cache = {
    match: async () => new Response(JSON.stringify(yourBittorrentFixture), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    put: async () => {
      throw new Error("Cache hit must not write a new entry.");
    },
  } as unknown as Cache;

  const resources = await yourBittorrentProvider.search(
    { query: "ABP-123", mode: "number" },
    yourBittorrentContext(async () => {
      fetchCount += 1;
      throw new Error("Unexpected upstream fetch.");
    }, cache),
  );

  assert.equal(fetchCount, 0);
  assert.equal(resources.length, 1);
});

test("keeps valid YourBittorrent results when cache lookup and write fail", async () => {
  let fetchCount = 0;
  const cache = {
    match: async () => { throw new Error("cache unavailable"); },
    put: async () => { throw new Error("cache write unavailable"); },
  } as unknown as Cache;

  const resources = await yourBittorrentProvider.search(
    { query: "ABP-123", mode: "number" },
    yourBittorrentContext(async () => {
      fetchCount += 1;
      return new Response(JSON.stringify(yourBittorrentFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }, cache),
  );

  assert.equal(fetchCount, 1);
  assert.equal(resources.length, 1);
});

test("does not fetch or write YourBittorrent cache when cancellation occurs during cache lookup", async () => {
  const controller = new AbortController();
  let fetchCount = 0;
  let putCount = 0;
  const cache = {
    match: async () => {
      controller.abort(new DOMException("Cancelled during cache lookup.", "AbortError"));
      return null;
    },
    put: async () => { putCount += 1; },
  } as unknown as Cache;

  await assert.rejects(
    yourBittorrentProvider.search(
      { query: "ABP-123", mode: "number" },
      yourBittorrentContext(async () => {
        fetchCount += 1;
        throw new Error("Cancelled search must not fetch upstream.");
      }, cache, controller.signal),
    ),
    /Cancelled during cache lookup/,
  );
  assert.equal(fetchCount, 0);
  assert.equal(putCount, 0);
});

test("does not write YourBittorrent cache when cancellation occurs during upstream fetch", async () => {
  const controller = new AbortController();
  let putCount = 0;
  const cache = {
    match: async () => null,
    put: async () => { putCount += 1; },
  } as unknown as Cache;

  await assert.rejects(
    yourBittorrentProvider.search(
      { query: "ABP-123", mode: "number" },
      yourBittorrentContext(async () => {
        controller.abort(new DOMException("Cancelled during fetch.", "AbortError"));
        return new Response(JSON.stringify(yourBittorrentFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }, cache, controller.signal),
    ),
    /Cancelled during fetch/,
  );
  assert.equal(putCount, 0);
});

test("drops YourBittorrent records with untrusted detail or torrent URLs", async () => {
  const unsafe = {
    ...yourBittorrentFixture,
    results: [{
      ...yourBittorrentFixture.results[0],
      url: "https://evil.example/torrent/38839040",
      torrent_file: "https://evil.example/down/38839040.torrent",
    }],
  };
  const resources = await yourBittorrentProvider.search(
    { query: "ABP-123", mode: "number" },
    yourBittorrentContext(async () => new Response(JSON.stringify(unsafe), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })),
  );
  assert.deepEqual(resources, []);
});

test("rejects malformed YourBittorrent JSON and does not retry server errors", async () => {
  await assert.rejects(
    yourBittorrentProvider.search(
      { query: "ABP-123", mode: "number" },
      yourBittorrentContext(async () => new Response("{bad", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })),
    ),
    /malformed JSON/,
  );

  let requestCount = 0;
  await assert.rejects(
    yourBittorrentProvider.search(
      { query: "ABP-123", mode: "number" },
      yourBittorrentContext(async () => {
        requestCount += 1;
        return new Response("Unavailable", { status: 503 });
      }),
    ),
    /HTTP 503/,
  );
  assert.equal(requestCount, 1);
});

test("filters provider sources by user-facing content category", async () => {
  const categoryProvider = provider(
    async (_input, context) => [resource({ id: context.source.id, url: `https://example.com/${context.source.id}` })],
    { contentCategories: ["jav", "anime"] },
  );
  const result = await executeSearch(
    { query: "test", mode: "keyword", contentCategory: "anime" },
    sourceConfig(
      source({ id: "adult", contentCategory: "jav" }),
      source({ id: "anime", contentCategory: "anime" }),
    ),
    adapters,
    resolve(categoryProvider),
  );

  assert.deepEqual(result.sources.map((item) => item.sourceId), ["anime"]);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0]?.contentCategory, "anime");
});

test("generic HTML adapter requests only the configured HTTPS origin and normalizes parsed cards", async () => {
  let requestedUrl = "";
  let redirectMode = "";
  const results = await genericHtmlProvider.search(
    { query: "Blue Sky 01", mode: "keyword" },
    {
      source: source({
        id: "html-source",
        name: "HTML source",
        adapterId: "generic-html",
        baseUrl: "https://example.com",
        providerSearchUrlTemplate: "https://example.com/search?q={query}",
        htmlSelectors: { result: "article.result", title: ".title", link: "a.title", image: "img.cover" },
        capabilities: ["metadata", "image"],
      }),
      signal: new AbortController().signal,
      fetch: async (input, init) => {
        requestedUrl = String(input);
        redirectMode = String(init?.redirect);
        return new Response("<html><body>fixture</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
      parseHtml: async () => [{
        title: "Example HTML result",
        url: "/item/1",
        imageUrl: "/cover.jpg",
        description: "Example description",
        metadata: { releaseDate: "2026-11-25", author: "Example author" },
      }],
    },
  );

  assert.match(requestedUrl, /q=Blue%20Sky%2001/);
  assert.equal(redirectMode, "manual");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.url, "https://example.com/item/1");
  assert.equal(results[0]?.imageUrl, "https://example.com/cover.jpg");
  assert.deepEqual(results[0]?.metadata, { releaseDate: "2026-11-25", author: "Example author" });
});

test("generic HTML adapter only extracts optional fields declared by the source", async () => {
  let receivedImageSelector: string | undefined;
  let receivedMagnetSelector: string | undefined;
  const sourceConfig = source({
    adapterId: "generic-html",
    baseUrl: "https://example.com",
    providerSearchUrlTemplate: "https://example.com/search?q={query}",
    htmlSelectors: {
      result: "article",
      title: "h2",
      link: "a",
      image: "img.cover",
      magnet: "a.magnet",
    },
    capabilities: ["metadata"],
  });

  const resources = await genericHtmlProvider.search(
    { query: "test", mode: "keyword" },
    {
      source: sourceConfig,
      signal: new AbortController().signal,
      fetch: async () => new Response("<html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
      parseHtml: async (_response, selectors) => {
        receivedImageSelector = selectors.image;
        receivedMagnetSelector = selectors.magnet;
        return [{
          title: "Result",
          url: "/item",
          imageUrl: "https://cdn.example/image.jpg",
          magnetUri: "magnet:?xt=urn:btih:01234567890123456789012345678901",
        }];
      },
    },
  );

  assert.equal(receivedImageSelector, undefined);
  assert.equal(receivedMagnetSelector, undefined);
  assert.equal(resources[0]?.imageUrl, undefined);
  assert.equal(resources[0]?.magnetUri, undefined);
});

test("generic HTML adapter rejects declared optional capabilities without matching selectors", async () => {
  await assert.rejects(
    genericHtmlProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({
          adapterId: "generic-html",
          baseUrl: "https://example.com",
          providerSearchUrlTemplate: "https://example.com/search?q={query}",
          htmlSelectors: { result: "article", title: "h2", link: "a" },
          capabilities: ["metadata", "magnet"],
        }),
        signal: new AbortController().signal,
        fetch: async () => new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
        parseHtml: async () => [],
      },
    ),
    /require matching image or Magnet selectors/,
  );
});

test("generic HTML adapter rejects cross-origin search templates and redirects", async () => {
  const base = source({
    adapterId: "generic-html",
    baseUrl: "https://example.com",
    providerSearchUrlTemplate: "https://other.example/search?q={query}",
    htmlSelectors: { result: "article", title: "h2", link: "a" },
  });
  await assert.rejects(
    genericHtmlProvider.search(
      { query: "test", mode: "keyword" },
      { source: base, signal: new AbortController().signal, fetch, parseHtml: async () => [] },
    ),
    /configured HTTPS source origin/,
  );

  const redirectSource = {
    ...base,
    providerSearchUrlTemplate: "https://example.com/search?q={query}",
  };
  await assert.rejects(
    genericHtmlProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: redirectSource,
        signal: new AbortController().signal,
        fetch: async () => new Response(null, { status: 302, headers: { Location: "https://other.example/" } }),
        parseHtml: async () => [],
      },
    ),
    /redirected/,
  );
});

test("generic HTML adapter enforces the streamed 2 MiB response limit", async () => {
  await assert.rejects(
    genericHtmlProvider.search(
      { query: "test", mode: "keyword" },
      {
        source: source({
          adapterId: "generic-html",
          baseUrl: "https://example.com",
          providerSearchUrlTemplate: "https://example.com/search?q={query}",
          htmlSelectors: { result: "article", title: "h2", link: "a" },
        }),
        signal: new AbortController().signal,
        fetch: async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
        parseHtml: async () => [],
      },
    ),
    /2 MiB limit/,
  );
});

test("generic HTML adapter drops detail links outside the configured source host", async () => {
  const results = await genericHtmlProvider.search(
    { query: "test", mode: "keyword" },
    {
      source: source({
        adapterId: "generic-html",
        baseUrl: "https://example.com",
        providerSearchUrlTemplate: "https://example.com/search?q={query}",
        htmlSelectors: { result: "article", title: "h2", link: "a" },
      }),
      signal: new AbortController().signal,
      fetch: async () => new Response("<html></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
      parseHtml: async () => [{ title: "Untrusted result", url: "https://other.example/item" }],
    },
  );

  assert.deepEqual(results, []);
});

 
test("resolves only the configured Worker secret binding and passes it to the matching Provider", async () => {
  let receivedCredential: string | undefined;
  const configuredSource = source({ credentialBinding: "TEST_SOURCE_TOKEN" });
  const authenticatedProvider = provider(async (_input, context) => {
    receivedCredential = context.credential;
    return [resource({ sourceId: configuredSource.id, sourceName: configuredSource.name })];
  });

  const result = await executeSearch(
    request,
    sourceConfig(configuredSource),
    adapters,
    resolve(authenticatedProvider),
    undefined,
    undefined,
    undefined,
    { TEST_SOURCE_TOKEN: "test-secret-value" } as Env,
  );

  assert.equal(receivedCredential, "test-secret-value");
  assert.equal(result.sources[0]?.status, "ok");
  assert.equal(JSON.stringify(result).includes("test-secret-value"), false);
});

test("fails closed when a source secret binding is configured but missing", async () => {
  let providerCalled = false;
  const configuredSource = source({ credentialBinding: "MISSING_SOURCE_TOKEN" });
  const authenticatedProvider = provider(async () => {
    providerCalled = true;
    return [];
  });

  const result = await executeSearch(
    request,
    sourceConfig(configuredSource),
    adapters,
    resolve(authenticatedProvider),
    undefined,
    undefined,
    undefined,
    {} as Env,
  );

  assert.equal(providerCalled, false);
  assert.equal(result.sources[0]?.status, "unavailable");
  assert.equal(result.sources[0]?.errorCode, "credential_unavailable");
});


const anibtFixture = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed">
  <channel>
    <title>AniBT</title>
    <item>
      <title>Example Anime 05 [1080p]</title>
      <guid>https://anibt.net/release/rel_Example_123</guid>
      <link>https://anibt.net/api/torrent/rel_Example_123.torrent</link>
      <pubDate>Tue, 25 Nov 2026 00:00:00 +0000</pubDate>
      <size>123456789</size>
      <torznab:attr name="seeders" value="42"/>
      <torznab:attr name="peers" value="7"/>
    </item>
  </channel>
</rss>`;

function anibtContext(fetchImpl: typeof fetch, cache?: Cache) {
  return {
    source: source({
      id: "anibt",
      name: "AniBT",
      category: "torrent",
      contentCategory: "anime",
      adapterId: "anibt-torznab",
      capabilities: ["metadata", "torrent"],
      searchModes: ["keyword"],
    }),
    signal: new AbortController().signal,
    fetch: fetchImpl,
    ...(cache ? { cache } : {}),
  };
}

test("AniBT Provider uses the documented anonymous Torznab keyword endpoint and maps public torrent results", async () => {
  let requestedUrl = "";
  let cacheCalls = 0;
  const cache = {
    match: async () => { cacheCalls += 1; return null; },
    put: async () => { cacheCalls += 1; },
  } as unknown as Cache;

  const results = await anibtTorznabProvider.search(
    { query: "Frieren", mode: "keyword" },
    anibtContext(async (input, init) => {
      requestedUrl = String(input);
      assert.equal(init?.method, "GET");
      assert.equal(init?.redirect, "manual");
      return new Response(anibtFixture, {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      });
    }, cache),
  );

  const url = new URL(requestedUrl);
  assert.equal(url.origin, "https://anibt.net");
  assert.equal(url.pathname, "/torznab/api");
  assert.equal(url.searchParams.get("t"), "search");
  assert.equal(url.searchParams.get("q"), "Frieren");
  assert.equal(url.searchParams.get("cat"), "5070");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "rel_Example_123");
  assert.equal(results[0]?.url, "https://anibt.net/release/rel_Example_123");
  assert.equal(results[0]?.torrentUrl, "https://anibt.net/api/torrent/rel_Example_123.torrent");
  assert.equal(results[0]?.releaseDate, "2026-11-25T00:00:00.000Z");
  assert.deepEqual(results[0]?.metadata, { seeders: "42", peers: "7", sizeBytes: "123456789" });
  assert.equal(cacheCalls, 0);
});

test("AniBT rejects unsafe torrent hosts and malformed Torznab responses", async () => {
  const unsafe = anibtFixture.replace(
    "https://anibt.net/api/torrent/rel_Example_123.torrent",
    "https://evil.example/api/torrent/rel_Example_123.torrent",
  );
  const dropped = await anibtTorznabProvider.search(
    { query: "Frieren", mode: "keyword" },
    anibtContext(async () => new Response(unsafe, {
      status: 200,
      headers: { "Content-Type": "application/rss+xml" },
    })),
  );
  assert.deepEqual(dropped, []);

  await assert.rejects(
    anibtTorznabProvider.search(
      { query: "Frieren", mode: "keyword" },
      anibtContext(async () => new Response('<error code="201" description="Bad query"/>', {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      })),
    ),
    /protocol error 201/,
  );
});

test("AniBT enforces its documented UTF-8 query bound and does not retry upstream failures", async () => {
  let requests = 0;
  await assert.rejects(
    anibtTorznabProvider.search(
      { query: "界".repeat(54), mode: "keyword" },
      anibtContext(async () => { requests += 1; return new Response(anibtFixture); }),
    ),
    /160-byte UTF-8 limit/,
  );
  await assert.rejects(
    anibtTorznabProvider.search(
      { query: "Frieren", mode: "keyword" },
      anibtContext(async () => {
        requests += 1;
        return new Response("Unavailable", { status: 503 });
      }),
    ),
    /HTTP 503/,
  );
  assert.equal(requests, 1);
});

test("AniBT Provider is registered with anime torrent and .torrent capabilities", async () => {
  assert.equal(anibtTorznabProvider.id, "anibt-torznab");
  assert.equal(anibtTorznabProvider.rateLimitLane, "anibt");
  assert.deepEqual(anibtTorznabProvider.contentCategories, ["anime"]);
  assert.deepEqual(anibtTorznabProvider.capabilities, ["metadata", "torrent"]);
});


test("The RarBg searches only the requested content category and validates torrent identities", async () => {
  const hash = "0123456789012345678901234567890123456789";
  let requestedUrl = "";
  const resources = await theRarBgProvider.search(
    { query: "sample query", mode: "keyword" },
    {
      source: source({
        id: "rarbg-anime",
        name: "The RarBg Anime",
        category: "torrent",
        contentCategory: "anime",
        adapterId: "the-rarbg-json",
      }),
      signal: new AbortController().signal,
      fetch: async (input, init) => {
        requestedUrl = String(input);
        assert.equal(init?.redirect, "manual");
        return new Response(JSON.stringify({
          total: 1,
          page: 1,
          pageSize: 50,
          pages: 1,
          results: [{
            id: "release-1",
            name: "Example Anime Release",
            infoHash: hash,
            magnet: "magnet:?xt=urn:btih:" + hash + "&dn=Example",
            category: "Anime",
            size: 1024,
            seeders: 12,
            leechers: 3,
            added: 1_700_000_000,
            qualityScore: 88,
            tags: ["1080p", "HEVC"],
            url: "https://therarbg.com/post-detail/abc123/example-release/",
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  );

  const url = new URL(requestedUrl);
  assert.equal(url.hostname, "therarbg.com");
  assert.equal(url.pathname, "/api/v1/search/");
  assert.equal(url.searchParams.get("category"), "Anime");
  assert.equal(url.searchParams.get("q"), "sample query");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("clean"), "1");
  assert.equal(resources.length, 1);
  assert.equal(resources[0]?.id, hash);
  assert.equal(resources[0]?.magnetUri, "magnet:?xt=urn:btih:" + hash + "&dn=Example");
  assert.equal(resources[0]?.metadata?.qualityScore, "88");
  assert.equal(resources[0]?.metadata?.addedAt, new Date(1_700_000_000 * 1000).toISOString());
  assert.equal(resources[0]?.releaseDate, undefined);
});


test("The RarBg maps each supported content category to its documented API category", async () => {
  const cases = [["jav", "XXX"], ["anime", "Anime"], ["film-tv", "Movies,TV"], ["game", "Games"], ["music", "Music"]] as const;
  for (const [contentCategory, expectedCategory] of cases) {
    let requestedCategory = "";
    await theRarBgProvider.search(
      { query: "category check", mode: "keyword" },
      {
        source: source({ id: "rarbg-" + contentCategory, name: "The RarBg " + contentCategory, category: "torrent", contentCategory, adapterId: "the-rarbg-json" }),
        signal: new AbortController().signal,
        fetch: async (input) => {
          requestedCategory = new URL(String(input)).searchParams.get("category") ?? "";
          return Response.json({ results: [] });
        },
      },
    );
    assert.equal(requestedCategory, expectedCategory);
  }
});

test("The RarBg rejects mismatched hashes, untrusted detail URLs, and unsupported categories", async () => {
  const hash = "0123456789012345678901234567890123456789";
  const resources = await theRarBgProvider.search(
    { query: "sample", mode: "keyword" },
    {
      source: source({
        id: "rarbg-jav",
        name: "The RarBg",
        category: "torrent",
        contentCategory: "jav",
        adapterId: "the-rarbg-json",
      }),
      signal: new AbortController().signal,
      fetch: async (input) => {
        const url = new URL(String(input));
        assert.equal(url.searchParams.get("category"), "XXX");
        return Response.json({
          results: [
            {
              name: "Mismatched hash",
              infoHash: hash,
              magnet: "magnet:?xt=urn:btih:ffffffffffffffffffffffffffffffffffffffff",
              url: "https://therarbg.com/post-detail/1/item/",
            },
            {
              name: "Untrusted detail",
              infoHash: hash,
              magnet: "magnet:?xt=urn:btih:" + hash,
              url: "https://evil.example/post-detail/1/item/",
            },
          ],
        });
      },
    },
  );
  assert.deepEqual(resources, []);

  await assert.rejects(
    theRarBgProvider.search(
      { query: "sample", mode: "keyword" },
      {
        source: source({ contentCategory: "manga", category: "torrent" }),
        signal: new AbortController().signal,
        fetch: async () => { throw new Error("must not fetch unsupported categories"); },
      },
    ),
    /does not support this content category/,
  );
});

test("runtime source catalog Provider references exactly match the compile-time registry", () => {
  const catalogIds = SOURCE_CATALOG.map((source) => source.id);
  assert.equal(new Set(catalogIds).size, catalogIds.length, "source catalog IDs must be unique");

  const catalogProviderIds = [
    ...new Set(
      SOURCE_CATALOG.flatMap((source) => (source.type === "provider" && source.adapterId ? [source.adapterId] : [])),
    ),
  ].sort();
  const registeredProviderIds = listProviderAdapters()
    .map((adapter) => adapter.id)
    .filter((id) => id !== "generic-html")
    .sort();

  assert.deepEqual(
    catalogProviderIds,
    registeredProviderIds,
    "every concrete Provider must be referenced by the source catalog, and every catalog Provider must be registered",
  );
});
