import type { Env } from "./env";

const API_HOST = "www.eporner.com";
const REMOVAL_ENDPOINT = "https://www.eporner.com/api/v2/video/removed/";
const STATE_KEY = "eporner:removal-sync:v1";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const REMOVAL_PAGE_SIZE = 250;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const EPORNER_SYNC_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export interface EpornerRemovalSyncState {
  version: 1;
  since: string;
  after?: string;
  lastCompleteAt: string | null;
  lastAttemptAt: string;
  lastPageCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(value: unknown): EpornerRemovalSyncState | null {
  if (!isRecord(value) ||
      value.version !== 1 ||
      typeof value.since !== "string" ||
      !Number.isFinite(Date.parse(value.since)) ||
      !(value.lastCompleteAt === null ||
        (typeof value.lastCompleteAt === "string" && Number.isFinite(Date.parse(value.lastCompleteAt)))) ||
      typeof value.lastAttemptAt !== "string" ||
      !Number.isFinite(Date.parse(value.lastAttemptAt)) ||
      typeof value.lastPageCount !== "number" ||
      !Number.isSafeInteger(value.lastPageCount) ||
      value.lastPageCount < 0 ||
      (value.after !== undefined &&
        (typeof value.after !== "string" || value.after.length < 1 || value.after.length > 128))) {
    return null;
  }
  return {
    version: 1,
    since: value.since,
    ...(typeof value.after === "string" ? { after: value.after } : {}),
    lastCompleteAt: value.lastCompleteAt,
    lastAttemptAt: value.lastAttemptAt,
    lastPageCount: value.lastPageCount,
  };
}

export async function readEpornerRemovalSyncState(env: Pick<Env, "SOURCES_KV">): Promise<EpornerRemovalSyncState | null> {
  const raw = await env.SOURCES_KV.get(STATE_KEY, "text", { cacheTtl: 30 });
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Stored Eporner removal-sync state is malformed.");
  }
  const state = parseState(parsed);
  if (!state) throw new Error("Stored Eporner removal-sync state is invalid.");
  return state;
}

export function isEpornerRemovalSyncFresh(state: EpornerRemovalSyncState | null, now = Date.now()): boolean {
  if (!state?.lastCompleteAt || state.after) return false;
  const completedAt = Date.parse(state.lastCompleteAt);
  return Number.isFinite(completedAt) &&
    completedAt <= now + 60_000 &&
    now - completedAt <= EPORNER_SYNC_MAX_AGE_MS;
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Eporner removal feed returned an empty response body.");
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("Removal feed exceeded the response size limit.");
        throw new Error("Eporner removal feed exceeded the response size limit.");
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export interface EpornerRemovalSyncResult {
  complete: boolean;
  pageCount: number;
  removedCount: number;
  lastCompleteAt: string | null;
}

/** Consume one page per scheduled run; persist only cursor/timestamp state, never IDs or search results. */
export async function syncEpornerRemovalFeed(
  env: Pick<Env, "SOURCES_KV">,
  fetcher: typeof fetch,
  scheduledTime = Date.now(),
): Promise<EpornerRemovalSyncResult> {
  const existing = await readEpornerRemovalSyncState(env);
  const startedAt = new Date(scheduledTime).toISOString();
  const since = existing?.since ?? new Date(scheduledTime - DEFAULT_LOOKBACK_MS).toISOString();

  // Persist the bootstrap watermark before the first network attempt. If that
  // attempt fails, the next Cron run must retry the same window rather than
  // moving the 24-hour lookback forward and potentially skipping removals.
  if (!existing) {
    await env.SOURCES_KV.put(STATE_KEY, JSON.stringify({
      version: 1,
      since,
      lastCompleteAt: null,
      lastAttemptAt: startedAt,
      lastPageCount: 0,
    } satisfies EpornerRemovalSyncState));
  }

  const url = new URL(REMOVAL_ENDPOINT);
  url.searchParams.set("per_page", String(REMOVAL_PAGE_SIZE));
  if (existing?.after) url.searchParams.set("after", existing.after);
  else url.searchParams.set("since", since);

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "AIOResourceSearch/0.1.0 (+https://github.com/shenshou/AIOResourceSearch)",
    },
    redirect: "manual",
  });
  if (!response.ok) throw new Error("Eporner removal feed returned HTTP " + response.status + ".");
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== API_HOST) {
      throw new Error("Eporner removal feed redirected to an unexpected host.");
    }
  }
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Eporner removal feed exceeded the response size limit.");
  }
  if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    throw new Error("Eporner removal feed returned an unexpected content type.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readLimitedText(response));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Eporner removal feed returned malformed JSON.", { cause: error });
    throw error;
  }
  if (!isRecord(payload) ||
      typeof payload.has_more !== "boolean" ||
      !Array.isArray(payload.removed) ||
      payload.removed.length > REMOVAL_PAGE_SIZE ||
      (payload.has_more && (typeof payload.next !== "string" || !payload.next || payload.next.length > 128))) {
    throw new Error("Eporner removal feed returned an invalid response envelope.");
  }

  for (const item of payload.removed) {
    if (!isRecord(item) ||
        typeof item.id !== "string" ||
        !/^[A-Za-z0-9]{11}$/.test(item.id) ||
        typeof item.removed_at !== "string" ||
        !Number.isFinite(Date.parse(item.removed_at))) {
      throw new Error("Eporner removal feed contains an invalid removal record.");
    }
  }

  const lastCompleteAt = payload.has_more ? existing?.lastCompleteAt ?? null : startedAt;
  const nextState: EpornerRemovalSyncState = {
    version: 1,
    since: payload.has_more ? since : startedAt,
    ...(payload.has_more && typeof payload.next === "string" ? { after: payload.next } : {}),
    lastCompleteAt,
    lastAttemptAt: startedAt,
    lastPageCount: payload.removed.length,
  };

  await env.SOURCES_KV.put(STATE_KEY, JSON.stringify(nextState));
  return {
    complete: !payload.has_more,
    pageCount: 1,
    removedCount: payload.removed.length,
    lastCompleteAt,
  };
}
