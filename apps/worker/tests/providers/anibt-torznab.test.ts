import assert from "node:assert/strict";
import { test } from "node:test";
import { anibtTorznabProvider } from "../../src/providers/anibt-torznab.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const torrentUrl = "https://anibt.net/api/torrent/rel_12345.torrent";
const feed = (items: string) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
const item = (guid = "https://anibt.net/release/rel_12345", enclosure = torrentUrl) => `<item><title><![CDATA[Example &amp; Release]]></title><guid>${guid}</guid><enclosure url="${enclosure}" /><size>2048</size><pubDate>Mon, 16 Nov 2026 20:33:00 +0800</pubDate><attr name="seeders" value="12" /><attr name="peers" value="3" /></item>`;
const source = { id: "anibt", name: "AniBT", category: "torrent" as const, contentCategory: "anime" as const, enabled: true, searchModes: ["keyword" as const], capabilities: ["metadata" as const, "torrent" as const], timeoutMs: 10000 };
const context = (fetcher: typeof fetch) => ({ source, fetch: fetcher, signal: new AbortController().signal });
test("registers a keyword-only Torznab adapter", () => {
  assert.equal(getProviderAdapter("anibt-torznab"), anibtTorznabProvider);
  assert.deepEqual(anibtTorznabProvider.searchModes, ["keyword"]);
});
test("builds the Torznab query and maps a valid RSS item", async () => {
  let requested = "";
  const results = await anibtTorznabProvider.search({ query: "葬送のフリーレン", mode: "keyword" }, context(async (input) => {
    requested = String(input);
    return new Response(feed(item()), { headers: { "Content-Type": "application/rss+xml" } });
  }));
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://anibt.net/torznab/api");
  assert.equal(url.searchParams.get("t"), "search");
  assert.equal(url.searchParams.get("q"), "葬送のフリーレン");
  assert.equal(url.searchParams.get("cat"), "5070");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "rel_12345");
  assert.equal(results[0]?.url, "https://anibt.net/release/rel_12345");
  assert.equal(results[0]?.torrentUrl, torrentUrl);
  assert.equal(results[0]?.metadata?.seeders, "12");
});
test("drops hostile release and torrent URLs", async () => {
  const xml = feed(item("https://evil.example/release/rel_12345", "https://evil.example/api/torrent/rel_12345.torrent"));
  const results = await anibtTorznabProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response(xml, { headers: { "Content-Type": "application/rss+xml" } })));
  assert.deepEqual(results, []);
});
test("rejects empty query, oversized UTF-8 query and protocol errors", async () => {
  await assert.rejects(anibtTorznabProvider.search({ query: " ", mode: "keyword" }, context(async () => new Response())), /non-empty/);
  await assert.rejects(anibtTorznabProvider.search({ query: "字".repeat(100), mode: "keyword" }, context(async () => new Response())), /160-byte/);
  const protocolFetcher: typeof fetch = async () => new Response('<error code="100" />', { headers: { "Content-Type": "application/xml" } });
  const protocolError = anibtTorznabProvider.search({ query: "test", mode: "keyword" }, context(protocolFetcher));
  await assert.rejects(protocolError, /protocol error 100/);
});
