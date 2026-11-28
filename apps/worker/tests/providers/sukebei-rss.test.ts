import assert from "node:assert/strict";
import { test } from "node:test";
import { sukebeiRssProvider } from "../../src/providers/sukebei-rss.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const magnet = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567";
const source = { id: "sukebei", name: "Sukebei", category: "torrent" as const, contentCategory: "jav" as const, enabled: true, searchModes: ["number" as const, "keyword" as const], capabilities: ["metadata" as const, "magnet" as const], timeoutMs: 10000 };
const context = (fetcher: typeof fetch) => ({ source, fetch: fetcher, signal: new AbortController().signal });
const feed = (guid: string, link = magnet) => `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Example &amp; Release]]></title><guid>${guid}</guid><link>${link}</link><pubDate>Mon, 16 Nov 2026 20:33:00 +0800</pubDate></item></channel></rss>`;
test("registers the public RSS adapter", () => {
  assert.equal(getProviderAdapter("sukebei-rss"), sukebeiRssProvider);
  assert.equal(sukebeiRssProvider.mechanism, "rss");
});
test("queries the public magnet feed and maps detail, magnet and attribution links", async () => {
  let requested = "";
  const results = await sukebeiRssProvider.search({ query: "ABP-123", mode: "number" }, context(async (input) => {
    requested = String(input);
    return new Response(feed("https://sukebei.nyaa.net/view/123"), { headers: { "Content-Type": "application/rss+xml" } });
  }));
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://sukebei.nyaa.net/feed/magnet");
  assert.equal(url.searchParams.get("q"), "ABP-123");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.url, "https://sukebei.nyaa.net/view/123");
  assert.equal(results[0]?.magnetUri, magnet);
  assert.equal(results[0]?.externalLinks?.[0]?.url, "https://sukebei.nyaa.net/?q=ABP-123");
});
test("rejects an untrusted detail host and unexpected feed format", async () => {
  const results = await sukebeiRssProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response(feed("https://evil.example/view/not-numeric"), { headers: { "Content-Type": "application/rss+xml" } })));
  assert.deepEqual(results, []);
  const htmlFetcher: typeof fetch = async () => new Response("<html>blocked</html>", { headers: { "Content-Type": "text/html" } });
  const unexpectedFormat = sukebeiRssProvider.search({ query: "test", mode: "keyword" }, context(htmlFetcher));
  await assert.rejects(unexpectedFormat, /unexpected feed format/);
});
