import assert from "node:assert/strict";
import { test } from "node:test";
import { theRarBgProvider } from "../../src/providers/the-rarbg-json.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";
import { createProviderContext, jsonResponse } from "./test-helpers.ts";
import type { SourceDefinition } from "@aio-resource-search/shared";

const hash = "0123456789abcdef0123456789abcdef01234567";
const magnet = `magnet:?xt=urn:btih:${hash}`;
const source = { id: "the-rarbg-jav", name: "The RarBg · JAV", category: "torrent" as const, contentCategory: "jav" as const, enabled: true, searchModes: ["keyword" as const, "number" as const], capabilities: ["metadata" as const, "magnet" as const], timeoutMs: 10000 };
const context = (fetcher: typeof fetch, selectedSource: SourceDefinition = source) => createProviderContext(selectedSource, fetcher);
test("registers The RarBg JSON adapter and declares supported categories", () => {
  assert.equal(getProviderAdapter("the-rarbg-json"), theRarBgProvider);
  assert.ok(theRarBgProvider.contentCategories.includes("jav"), "JAV category must remain supported");
  assert.ok(theRarBgProvider.searchModes.includes("number"));
});
test("sends category-aware JSON search and maps validated torrent metadata", async () => {
  let requested = "";
  const fetcher: typeof fetch = async (input) => {
    requested = String(input);
    return jsonResponse({ results: [{ infoHash: hash, name: " Example release ", magnet, url: "https://therarbg.com/post-detail/123", seeders: 12, leechers: 3, size: 2048, category: "XXX", qualityScore: 90, tags: ["jav", "1080p"], imdb: "tt1234567" }] });
  };
  const results = await theRarBgProvider.search({ query: "ABP-123", mode: "number" }, context(fetcher));
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://therarbg.com/api/v1/search/");
  assert.equal(url.searchParams.get("q"), "ABP-123");
  assert.equal(url.searchParams.get("category"), "XXX");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, hash);
  assert.equal(results[0]?.title, "Example release");
  assert.equal(results[0]?.magnetUri, magnet);
  assert.equal(results[0]?.metadata?.qualityScore, "90");
  assert.equal(results[0]?.metadata?.imdbId, "tt1234567");
});
test("drops mismatched magnets and untrusted detail URLs", async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ results: [
    { infoHash: hash, name: "Bad magnet", magnet: "magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", url: "https://therarbg.com/post-detail/1" },
    { infoHash: hash, name: "Bad host", magnet, url: "https://evil.example/post-detail/1" },
  ] });
  assert.deepEqual(await theRarBgProvider.search({ query: "test", mode: "keyword" }, context(fetcher)), []);
});
test("rejects unsupported categories and invalid JSON envelopes", async () => {
  await assert.rejects(theRarBgProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response("{}"), { ...source, contentCategory: "manga" })), /does not support/);
  const invalidFetcher: typeof fetch = async () => jsonResponse({});
  const invalidEnvelope = theRarBgProvider.search({ query: "test", mode: "keyword" }, context(invalidFetcher));
  await assert.rejects(invalidEnvelope, /invalid JSON response/);
});
