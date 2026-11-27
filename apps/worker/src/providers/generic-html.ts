import { CONTENT_CATEGORIES, SOURCE_CATEGORIES } from "@aio-resource-search/shared";
import type { ProviderAdapter } from "./types";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 50;

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new DOMException("Provider request was cancelled.", "AbortError");
  }
}

async function readBoundedHtml(response: Response): Promise<Response> {
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_HTML_BYTES) throw new Error("HTML response exceeds the 2 MiB limit.");
  if (!response.body) throw new Error("HTML response body is empty.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("HTML response exceeds the 2 MiB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(bytes, { status: response.status, headers: response.headers });
}

function resolvePageUrl(value: string, baseUrl: URL): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname.toLowerCase() !== baseUrl.hostname.toLowerCase()) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function validMagnet(value: string | undefined): string | undefined {
  if (!value || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "magnet:") return undefined;
    const validHash = url.searchParams.getAll("xt").some((topic) =>
      /^urn:btih:([a-z0-9]{32}|[a-f0-9]{40})$/i.test(topic),
    );
    return validHash ? value : undefined;
  } catch {
    return undefined;
  }
}

function validTorrentUrl(value: string | undefined, baseUrl: URL): string | undefined {
  if (!value || value.length > 4096) return undefined;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function validEd2k(value: string | undefined): string | undefined {
  return value && value.length <= 4096 &&
    /^ed2k:\/\/\|file\|[^|]{1,255}\|\d+\|[a-f0-9]{32}\|/i.test(value)
    ? value
    : undefined;
}

/**
 * Configurable HTML search adapter.
 *
 * It only reads a public search page on the configured source host. It does
 * not execute page scripts, emulate a browser, solve challenges, or follow
 * redirects. CSS selectors are declarative configuration, not code.
 */
export const genericHtmlProvider: ProviderAdapter = {
  id: "generic-html",
  version: "1.0.0",
  mechanism: "html",
  contentCategories: [...CONTENT_CATEGORIES],
  categories: [...SOURCE_CATEGORIES],
  capabilities: ["metadata", "image", "magnet", "torrent", "ed2k"],
  searchModes: ["number", "keyword"],
  async search(input, context) {
    const { source, parseHtml, signal } = context;
    if (!source.baseUrl || !source.providerSearchUrlTemplate || !source.htmlSelectors || !parseHtml) {
      throw new Error("HTML source requires a base URL, search URL template, CSS selectors, and HTML parser.");
    }
    if ((source.providerSearchUrlTemplate.match(/\{query\}/g) ?? []).length !== 1) {
      throw new Error("HTML search URL template must contain exactly one {query} placeholder.");
    }

    const baseUrl = new URL(source.baseUrl);
    const targetUrl = new URL(
      source.providerSearchUrlTemplate.replace("{query}", encodeURIComponent(input.query)),
    );
    if (targetUrl.protocol !== "https:" || targetUrl.origin !== baseUrl.origin ||
        targetUrl.username || targetUrl.password) {
      throw new Error("HTML search URL must use the configured HTTPS source origin.");
    }

    const response = await context.fetch(targetUrl.toString(), {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("HTML source redirected; redirects are not followed.");
    }
    if (!response.ok) throw new Error(`HTML source returned HTTP ${response.status}.`);
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.origin !== baseUrl.origin) throw new Error("HTML response origin changed.");
    }
    const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("HTML source did not return an HTML document.");
    }

    const supportsImage = source.capabilities.includes("image");
    const supportsMagnet = source.capabilities.includes("magnet");
    const supportsTorrent = source.capabilities.includes("torrent");
    const supportsEd2k = source.capabilities.includes("ed2k");
    if ((supportsImage && !source.htmlSelectors.image) ||
        (supportsMagnet && !source.htmlSelectors.magnet) ||
        (supportsTorrent && !source.htmlSelectors.torrent) ||
        (supportsEd2k && !source.htmlSelectors.ed2k)) {
      throw new Error("HTML source capabilities require matching optional-field selectors.");
    }

    const selectors = {
      ...source.htmlSelectors,
      ...(!supportsImage ? { image: undefined } : {}),
      ...(!supportsMagnet ? { magnet: undefined } : {}),
      ...(!supportsTorrent ? { torrent: undefined } : {}),
      ...(!supportsEd2k ? { ed2k: undefined } : {}),
    };
    const boundedResponse = await readBoundedHtml(response);
    throwIfAborted(signal);
    const extracted = await parseHtml(boundedResponse, selectors);
    throwIfAborted(signal);
    const resources = [];
    for (const item of extracted.slice(0, MAX_RESULTS)) {
      const url = resolvePageUrl(item.url, baseUrl);
      const title = item.title.trim().slice(0, 500);
      if (!url || !title) continue;
      let imageUrl: string | undefined;
      if (supportsImage && item.imageUrl) {
        try {
          const image = new URL(item.imageUrl, baseUrl);
          if (image.protocol === "https:" && !image.username && !image.password) imageUrl = image.toString();
        } catch {
          // Ignore malformed optional image URLs.
        }
      }
      resources.push({
        id: url,
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        title,
        url,
        ...(imageUrl ? { imageUrl } : {}),
        ...(item.description ? { description: item.description.slice(0, 4000) } : {}),
        ...(item.metadata ? { metadata: item.metadata } : {}),
        ...(supportsMagnet && validMagnet(item.magnetUri) ? { magnetUri: validMagnet(item.magnetUri) } : {}),
        ...(supportsTorrent && validTorrentUrl(item.torrentUrl, baseUrl) ? { torrentUrl: validTorrentUrl(item.torrentUrl, baseUrl) } : {}),
        ...(supportsEd2k && validEd2k(item.ed2kUri) ? { ed2kUri: validEd2k(item.ed2kUri) } : {}),
      });
    }
    return resources;
  },
};
