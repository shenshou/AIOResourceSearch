import assert from "node:assert/strict";
import { test } from "node:test";
import { torlockProvider } from "../../src/providers/torlock-torznab.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const magnet = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567";
const feed = (items: string) => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
const item = (detail = "https://www.torlock.com/torrent/123", magnetValue = magnet) => `<item><title><![CDATA[Example Torrent]]></title><guid>${detail}</guid><attr name="magneturl" value="${magnetValue}" /><attr name="seeders" value="20" /><attr name="peers" value="4" /><size>1024</size><pubDate>Mon, 16 Nov 2026 20:33:00 +0800</pubDate></item>`;
const source = { id: "torlock", name: "Torlock", category: "torrent" as const, contentCategory: "jav" as const, enabled: true, searchModes: ["number" as const, "keyword" as const], capabilities: ["metadata" as const, "magnet" as const], timeoutMs: 10000 };
const context = (fetcher: typeof fetch) => ({ source, fetch: fetcher, signal: new AbortController().signal });
test("registers Torlock Torznab adapter", () => {
  assert.equal(getProviderAdapter("torlock-torznab"), torlockProvider);
  assert.deepEqual(torlockProvider.searchModes, ["number", "keyword"]);
});
test("builds a Torznab request and maps RSS metadata", async () => {
  let requested = "";
  const results = await torlockProvider.search({ query: "ABP-123", mode: "number" }, context(async (input) => {
    requested = String(input);
    return new Response(feed(item()), { headers: { "Content-Type": "application/rss+xml" } });
  }));
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://www.torlock.com/torznab/api");
  assert.equal(url.searchParams.get("t"), "search");
  assert.equal(url.searchParams.get("q"), "ABP-123");
  assert.equal(url.searchParams.get("cat"), "6000");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.title, "Example Torrent");
  assert.equal(results[0]?.magnetUri, magnet);
  assert.match(results[0]?.description ?? "", /Seeds: 20/);
});
test("drops unsafe detail links and invalid magnets", async () => {
  const results = await torlockProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response(feed(item("https://evil.example/torrent/123", "magnet:?xt=urn:btih:bad")), { headers: { "Content-Type": "application/rss+xml" } })));
  assert.deepEqual(results, []);
});
test("rejects invalid RSS and unexpected content types", async () => {
  const invalidFeed = torlockProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response("<rss/>", { headers: { "Content-Type": "application/rss+xml" } })));
  await assert.rejects(invalidFeed, /invalid Torznab RSS/);
  const wrongType = torlockProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response("blocked", { headers: { "Content-Type": "text/html" } })));
  await assert.rejects(wrongType, /unexpected feed content type/);
});
