import type { Env } from "./env";

const MAX_CONFIG_BYTES = 64 * 1024;

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function getCorsHeaders(request: Request, env: Env): Headers | Response {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (!origin) return headers;

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowedOrigins.includes(origin)) {
    return json({ error: { code: "origin_not_allowed", message: "This origin is not allowed." } }, 403);
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match");
  headers.set("Access-Control-Expose-Headers", "ETag");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function withEtag(response: Response, version: number): Response {
  const headers = new Headers(response.headers);
  headers.set("ETag", `"${version}"`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new Error("Request body has an invalid Content-Length.");
    }
    if (contentLength > MAX_CONFIG_BYTES) throw new Error("Request body is too large.");
  }

  if (!request.body) return JSON.parse("");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_CONFIG_BYTES) {
        await reader.cancel("Request body is too large.");
        throw new Error("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function expectedVersion(request: Request): number | null {
  const raw = request.headers.get("If-Match");
  if (!raw) return null;
  const value = raw.trim().replace(/^W\\//, "").replace(/^"|"$/g, "");
  if (!/^\\d+$/.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) ? version : null;
}
