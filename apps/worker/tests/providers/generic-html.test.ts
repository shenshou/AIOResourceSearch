import assert from "node:assert/strict";
import { test } from "node:test";
import { genericHtmlProvider } from "../../src/providers/generic-html.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";
import type { SourceDefinition } from "@aio-resource-search/shared";

const baseSource = {
  id: "generic-example", name: "Generic Example", category: "torrent" as const, contentCategory: "jav" as const,
  enabled: true, searchModes: ["number" as const, "keyword" as const], capabilities: ["metadata" as const, "magnet" as const],
  timeoutMs: 10000, baseUrl: "https://example.test",
  providerSearchUrlTemplate: "https://example.test/search?q={query}",
  htmlSelectors: { result: ".result", title: ".title", link: "a.detail", magnet: "a.magnet" },
};
const extracted = [
  { title: " Valid result ", url: "/detail/1", magnetUri: "magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567" },
  { title: "Hostile result", url: "https://evil.example/detail/2" },
];
const context = (fetcher: typeof fetch, source: SourceDefinition = baseSource) => ({
  source, fetch: fetcher, signal: new AbortController().signal,
  parseHtml: async () => extracted,
});
test("registers a configurable HTML adapter", () => {
  assert.equal(getProviderAdapter("generic-html"), genericHtmlProvider);
  assert.equal(genericHtmlProvider.mechanism, "html");
  assert.deepEqual(genericHtmlProvider.searchModes, ["number", "keyword"]);
});
test("uses configured same-origin HTTPS template and normalizes parsed results", async () => {
  let requested = "";
  const results = await genericHtmlProvider.search({ query: "ABP 123", mode: "number" }, context(async (input) => {
    requested = String(input);
    return new Response("<html>fixture</html>", { headers: { "Content-Type": "text/html" } });
  }));
  assert.equal(requested, "https://example.test/search?q=ABP%20123");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.title, "Valid result");
  assert.equal(results[0]?.url, "https://example.test/detail/1");
  assert.equal(results[0]?.magnetUri, extracted[0]?.magnetUri);
});
test("rejects cross-origin templates, redirects, and missing capability selectors", async () => {
  await assert.rejects(genericHtmlProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response() , { ...baseSource, providerSearchUrlTemplate: "https://evil.example/?q={query}" })), /configured HTTPS source origin/);
  const redirect = genericHtmlProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response(null, { status: 302, headers: { Location: "https://example.test/elsewhere" } })));
  await assert.rejects(redirect, /redirected/);
  const missingSelector = genericHtmlProvider.search({ query: "test", mode: "keyword" }, context(async () => new Response("<html/>", { headers: { "Content-Type": "text/html" } }), { ...baseSource, htmlSelectors: { result: ".r", title: ".t", link: "a" } }));
  await assert.rejects(missingSelector, /matching optional-field selectors/);
});
