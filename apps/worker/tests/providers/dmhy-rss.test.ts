import assert from "node:assert/strict";
import { test } from "node:test";
import { dmhyRssProvider } from "../../src/providers/dmhy-rss.ts";
import { getProviderAdapter } from "../../src/providers/registry.ts";

const magnet = "magnet:?xt=urn:btih:WCEZZOUBYIFBBFCU5IDPHOC7WVAKQ32B";
const feed = (items: string) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>DMHY</title>${items}</channel></rss>`;
const item = (overrides: { title?: string; guid?: string; link?: string; magnet?: string; date?: string } = {}) => `
  <item>
    <title><![CDATA[${overrides.title ?? "[字幕组] 示例动画 [01][1080p]"}]]></title>
    <link>${overrides.link ?? "http://share.dmhy.org/topics/view/731088_Example.html"}</link>
    <guid isPermaLink="true">${overrides.guid ?? "http://share.dmhy.org/topics/view/731088_Example.html"}</guid>
    <pubDate>${overrides.date ?? "Mon, 16 Nov 2026 20:33:00 +0800"}</pubDate>
    <enclosure url="${overrides.magnet ?? magnet}" length="1" type="application/x-bittorrent"/>
  </item>`;

function context(fetcher: typeof fetch) {
  return {
    source: {
      id: "dmhy", name: "動漫花園", category: "torrent" as const,
      contentCategory: "anime" as const, enabled: true,
      searchModes: ["keyword" as const], capabilities: ["metadata" as const, "magnet" as const],
      timeoutMs: 10000,
    },
    fetch: fetcher,
    signal: new AbortController().signal,
  };
}

test("registers a keyword-only anime torrent RSS provider", () => {
  assert.equal(getProviderAdapter("dmhy-rss"), dmhyRssProvider);
  assert.equal(dmhyRssProvider.mechanism, "rss");
  assert.deepEqual(dmhyRssProvider.contentCategories, ["anime"]);
  assert.deepEqual(dmhyRssProvider.categories, ["torrent"]);
  assert.deepEqual(dmhyRssProvider.capabilities, ["metadata", "magnet"]);
  assert.deepEqual(dmhyRssProvider.searchModes, ["keyword"]);
});

test("uses the official HTTPS keyword RSS endpoint and maps result metadata", async () => {
  let requested = "";
  const fetcher: typeof fetch = async (input) => {
    requested = String(input);
    return new Response(feed(item()), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  };
  const results = await dmhyRssProvider.search(
    { query: "葬送のフリーレン 简 1080", mode: "keyword" },
    context(fetcher),
  );
  const url = new URL(requested);
  assert.equal(url.origin + url.pathname, "https://share.dmhy.org/topics/rss/rss.xml");
  assert.equal(url.searchParams.get("keyword"), "葬送のフリーレン 简 1080");
  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    id: "731088",
    sourceId: "dmhy-rss",
    sourceName: "動漫花園 (DMHY)",
    category: "torrent",
    contentCategory: "anime",
    title: "[字幕组] 示例动画 [01][1080p]",
    url: "https://share.dmhy.org/topics/view/731088_Example.html",
    magnetUri: magnet,
    releaseDate: "2026-11-16T12:33:00.000Z",
    externalLinks: [{
      label: "原站搜索",
      url: "https://share.dmhy.org/topics/list?keyword=%E8%91%AC%E9%80%81%E3%81%AE%E3%83%95%E3%83%AA%E3%83%BC%E3%83%AC%E3%83%B3+%E7%AE%80+1080",
    }],
  });
});

test("drops entries with an untrusted detail host or invalid magnet", async () => {
  const hostile = item({ guid: "https://evil.example/topics/view/1_Evil.html", link: "https://evil.example/topics/view/1_Evil.html" });
  const noMagnet = item({ magnet: "magnet:?xt=urn:btih:not-a-hash" });
  const results = await dmhyRssProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response(feed(hostile + noMagnet), {
      headers: { "Content-Type": "application/rss+xml" },
    })),
  );
  assert.deepEqual(results, []);
});

test("rejects redirects, unexpected content types, and malformed feeds", async () => {
  const redirect = await dmhyRssProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response(null, { status: 302, headers: { Location: "https://evil.example/feed" } })),
  ).catch((error: unknown) => error);
  assert.match(String(redirect), /HTTP 302/);

  const html = await dmhyRssProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response("<html>blocked</html>", { headers: { "Content-Type": "text/html" } })),
  ).catch((error: unknown) => error);
  assert.match(String(html), /unexpected RSS content type/);

  const malformed = await dmhyRssProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response("<rss><channel>", { headers: { "Content-Type": "application/xml" } })),
  ).catch((error: unknown) => error);
  assert.match(String(malformed), /invalid RSS document/);
});

test("rejects oversized responses before parsing", async () => {
  const body = "x".repeat(2 * 1024 * 1024 + 1);
  const result = await dmhyRssProvider.search(
    { query: "test", mode: "keyword" },
    context(async () => new Response(body, {
      headers: { "Content-Type": "application/rss+xml" },
    })),
  ).catch((error: unknown) => error);
  assert.match(String(result), /size limit/);
});
