import type { HtmlSelectorConfig } from "@aio-resource-search/shared";

interface RewriterElement {
  getAttribute(name: string): string | null;
}

interface RewriterText {
  text: string;
}

interface RewriterHandlers {
  element?(element: RewriterElement): void;
  text?(text: RewriterText): void;
  end?(): void;
}

interface Rewriter {
  on(selector: string, handlers: RewriterHandlers): Rewriter;
  transform(response: Response): Response;
}

declare const HTMLRewriter: new () => Rewriter;

interface MutableItem {
  title: string;
  url: string;
  imageUrl?: string;
  description: string;
  magnetUri?: string;
  torrentUrl?: string;
  ed2kUri?: string;
  resourceLinks: Array<{ type: "magnet" | "torrent" | "ed2k"; url: string }>;
  metadata: Record<string, string>;
}

const MAX_PARSED_RESULTS = 50;

/**
 * Parse a bounded HTML response with Cloudflare's native HTMLRewriter.
 * Selectors are administrator configuration, never executable code.
 */
export async function parseHtmlResults(
  response: Response,
  selectors: HtmlSelectorConfig,
): Promise<Array<{ title: string; url: string; imageUrl?: string; description?: string; magnetUri?: string; torrentUrl?: string; ed2kUri?: string; resourceLinks?: Array<{ type: "magnet" | "torrent" | "ed2k"; url: string }>; metadata?: Record<string, string> }>> {
  const stack: MutableItem[] = [];
  const results: MutableItem[] = [];
  const rewriter = new HTMLRewriter()
    .on(selectors.result, {
      element() {
        if (stack.length < 4 && results.length + stack.length < MAX_PARSED_RESULTS) {
          stack.push({ title: "", url: "", description: "", resourceLinks: [], metadata: {} });
        }
      },
      end() {
        const item = stack.pop();
        if (!item) return;
        item.title = item.title.replace(/\s+/g, " ").trim();
        item.description = item.description.replace(/\s+/g, " ").trim();
        if (item.title && item.url && results.length < MAX_PARSED_RESULTS) results.push(item);
      },
    })
    .on(selectors.title, {
      text(text) {
        const item = stack[stack.length - 1];
        if (item && item.title.length < 500) item.title += text.text;
      },
    })
    .on(selectors.link, {
      element(element) {
        const item = stack[stack.length - 1];
        if (item && !item.url) item.url = element.getAttribute("href") ?? "";
      },
    });

  if (selectors.image) {
    rewriter.on(selectors.image, {
      element(element) {
        const item = stack[stack.length - 1];
        if (item && !item.imageUrl) {
          item.imageUrl = element.getAttribute("src") ??
            element.getAttribute("data-src") ??
            element.getAttribute("data-original") ??
            undefined;
        }
      },
    });
  }

  if (selectors.description) {
    rewriter.on(selectors.description, {
      text(text) {
        const item = stack[stack.length - 1];
        if (item && item.description.length < 4000) item.description += text.text;
      },
    });
  }

  for (const [key, selector] of Object.entries(selectors.fields ?? {}).slice(0, 20)) {
    if (!/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) || typeof selector !== "string" || !selector.trim()) continue;
    rewriter.on(selector, {
      text(text) {
        const item = stack[stack.length - 1];
        if (item && (item.metadata[key]?.length ?? 0) < 500) {
          item.metadata[key] = (item.metadata[key] ?? "") + text.text;
        }
      },
    });
  }

  if (selectors.magnet) {
    rewriter.on(selectors.magnet, {
      element(element) {
        const item = stack[stack.length - 1];
        const href = element.getAttribute("href");
        if (item && href?.startsWith("magnet:?")) {
          if (!item.magnetUri) item.magnetUri = href;
          if (!item.resourceLinks.some((link) => link.type === "magnet" && link.url === href) && item.resourceLinks.length < 30) {
            item.resourceLinks.push({ type: "magnet", url: href });
          }
        }
      },
    });
  }

  if (selectors.torrent) {
    rewriter.on(selectors.torrent, {
      element(element) {
        const item = stack[stack.length - 1];
        const href = element.getAttribute("href");
        if (item && href) {
          if (!item.torrentUrl) item.torrentUrl = href;
          if (!item.resourceLinks.some((link) => link.type === "torrent" && link.url === href) && item.resourceLinks.length < 30) {
            item.resourceLinks.push({ type: "torrent", url: href });
          }
        }
      },
    });
  }

  if (selectors.ed2k) {
    rewriter.on(selectors.ed2k, {
      element(element) {
        const item = stack[stack.length - 1];
        const href = element.getAttribute("href");
        if (item && href?.startsWith("ed2k://")) {
          if (!item.ed2kUri) item.ed2kUri = href;
          if (!item.resourceLinks.some((link) => link.type === "ed2k" && link.url === href) && item.resourceLinks.length < 30) {
            item.resourceLinks.push({ type: "ed2k", url: href });
          }
        }
      },
    });
  }

  // HTMLRewriter runs while the transformed response body is consumed.
  await rewriter.transform(response).arrayBuffer();
  return results.map((item) => ({
    title: item.title,
    url: item.url,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(item.magnetUri ? { magnetUri: item.magnetUri } : {}),
    ...(item.torrentUrl ? { torrentUrl: item.torrentUrl } : {}),
    ...(item.ed2kUri ? { ed2kUri: item.ed2kUri } : {}),
    ...(item.resourceLinks.length ? { resourceLinks: item.resourceLinks } : {}),
    ...(Object.keys(item.metadata).length ? { metadata: Object.fromEntries(Object.entries(item.metadata).map(([key, value]) => [key, value.replace(/\s+/g, " ").trim().slice(0, 500)]).filter(([, value]) => Boolean(value))) } : {}),
  }));
}
