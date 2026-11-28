import assert from "node:assert/strict";
import { test } from "node:test";
import { yourBittorrentProvider } from "../../src/providers/yourbittorrent-json.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";
import { createProviderContext, jsonResponse } from "./test-helpers.ts";

const magnet = "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567";
const source = { id: "yourbittorrent", name: "YourBittorrent", category: "torrent" as const, contentCategory: "jav" as const, enabled: true, searchModes: ["number" as const, "keyword" as const], capabilities: ["metadata" as const, "magnet" as const, "torrent" as const], timeoutMs: 10000 };
const context = (fetcher: typeof fetch) => createProviderContext(source, fetcher);
test("registers the JSON API adapter", () => {
  assert.equal(getProviderAdapter("yourbittorrent-json"), yourBittorrentProvider);
  assert.ok(yourBittorrentProvider.searchModes.includes("number"));
});
test("sends adult-category query and maps torrent results", async () => {
  let requested = "";
  const fetcher: typeof fetch = async (input) => {
    requested = String(input);
    return jsonResponse({ status: "ok", results: [{ id: 123, name: " Example ", magnet, url: "https://yourbittorrent.com/torrent/123", torrent_file: "https://yourbittorrent.com/down/123", size: "1.2 GB", seeds: 10, peers: 2, verified: true }] });
  };
  const results = await yourBittorrentProvider.search({ query: "ABP-123", mode: "number" }, context(fetcher));
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://yourbittorrent.com/api/search.json");
  assert.equal(url.searchParams.get("q"), "ABP-123");
  assert.equal(url.searchParams.get("category"), "7");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.id, "123");
  assert.equal(results[0]?.title, "Example");
  assert.equal(results[0]?.magnetUri, magnet);
  assert.equal(results[0]?.torrentUrl, "https://yourbittorrent.com/down/123");
  assert.match(results[0]?.description ?? "", /Verified/);
});
test("drops invalid magnet and untrusted result links", async () => {
  const fetcher: typeof fetch = async () => jsonResponse({ status: "ok", results: [
    { id: 1, name: "Bad magnet", magnet: "magnet:?xt=urn:btih:nope", url: "https://yourbittorrent.com/torrent/1" },
    { id: 2, name: "Bad host", magnet, url: "https://yourbittorrent.com.evil.test/torrent/2" },
  ] });
  assert.deepEqual(await yourBittorrentProvider.search({ query: "test", mode: "keyword" }, context(fetcher)), []);
});
test("rejects unexpected content types and invalid response envelopes", async () => {
  const wrongTypeFetcher: typeof fetch = async () => new Response("blocked", { headers: { "Content-Type": "text/html" } });
  const wrongType = yourBittorrentProvider.search({ query: "test", mode: "keyword" }, context(wrongTypeFetcher));
  await assert.rejects(wrongType, /unexpected content type/);
  const invalidEnvelope = yourBittorrentProvider.search({ query: "test", mode: "keyword" }, context(async () => jsonResponse({})));
  await assert.rejects(invalidEnvelope, /invalid JSON response/);
});
