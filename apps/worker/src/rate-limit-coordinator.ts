type RateLimitLane = "musicbrainz" | "mangadex" | "anibt" | "therarbg" | "eporner" | "librivox" | "audiosilo" | "perverzija";

interface SqlCursor<T> extends Iterable<T> {
  one(): T | null;
}

interface SqlStorage {
  exec<T = Record<string, unknown>>(query: string, ...bindings: Array<string | number | null>): SqlCursor<T>;
}

interface CoordinatorState {
  storage: { sql: SqlStorage };
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

const LANE_INTERVAL_MS: Record<RateLimitLane, number> = {
  musicbrainz: 1_000,
  mangadex: 400,
  // AniBT documents 60 Torznab requests per 60 seconds per IP; 1.1s spacing leaves headroom.
  anibt: 1_100,
  // The RarBg anonymous API allows 30 requests/minute/IP; leave headroom.
  therarbg: 2_100,
  // Eporner requests should be sequential; use a conservative shared one-second lane.
  eporner: 1_000,
  // LibriVox asks API clients to separate requests by several seconds.
  librivox: 5_000,
  // AudioSilo Meta documents a generous public quota; one-second spacing is conservative.
  audiosilo: 1_000,
  // Perverzija DB allows 120 requests/minute/IP; 600 ms leaves headroom at 100/minute.
  perverzija: 600,
};
const MAX_COOLDOWN_MS = 86_400_000;
const EPORNER_LOCK_LEASE_MS = 60_000;
const EPORNER_LOCK_RETRY_MS = 500;
const EPORNER_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function boundedCooldownDuration(durationMs: number): number {
  return Math.min(Math.max(1_000, durationMs), MAX_COOLDOWN_MS);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isLane(value: unknown): value is RateLimitLane {
  return value === "musicbrainz" || value === "mangadex" || value === "anibt" || value === "therarbg" || value === "eporner" || value === "librivox" || value === "audiosilo" || value === "perverzija";
}

function parseCooldownDuration(response: Response, now: number, lane: RateLimitLane): number | null {
  const quotaExhausted = response.headers.get("X-RateLimit-Remaining") === "0" ||
    response.headers.get("X-RateLimit-Remaining-Day") === "0";
  if (response.status !== 429 && response.status !== 503 && !quotaExhausted) return null;

  const mangaDexRetry = response.headers.get("X-RateLimit-Retry-After");
  if (mangaDexRetry && /^\d+(?:\.\d+)?$/.test(mangaDexRetry)) {
    const timestamp = Number(mangaDexRetry) * 1_000;
    if (Number.isFinite(timestamp)) return boundedCooldownDuration(timestamp - now);
  }

  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    if (/^\d+(?:\.\d+)?$/.test(retryAfter)) {
      const seconds = Number(retryAfter);
      return boundedCooldownDuration(
        Number.isFinite(seconds) ? seconds * 1_000 : Number.POSITIVE_INFINITY,
      );
    }
    const parsed = Date.parse(retryAfter);
    if (Number.isFinite(parsed)) return boundedCooldownDuration(parsed - now);
  }

  if (lane === "perverzija") {
    const reset = response.headers.get("X-RateLimit-Reset");
    if (reset && /^\\d+(?:\\.\\d+)?$/.test(reset)) {
      const seconds = Number(reset);
      if (Number.isFinite(seconds)) return boundedCooldownDuration(seconds * 1_000);
    }
  }

  const dayReset = response.headers.get("X-RateLimit-Reset-Day");
  if (response.headers.get("X-RateLimit-Remaining-Day") === "0" && dayReset && /^\d+$/.test(dayReset)) {
    const seconds = Number(dayReset);
    if (Number.isFinite(seconds)) return boundedCooldownDuration(seconds * 1_000);
  }

  return 1_000;
}

/**
 * Internal-only, per-upstream Durable Object coordinator.
 * SQLite stores lane timestamps plus a short-lived Eporner request lease; no query, result, media, or user data.
 */
export class RateLimitCoordinator {
  private readonly ready: Promise<void>;
  private epornerLockTableReady = false;

  constructor(private readonly ctx: CoordinatorState) {
    this.ready = ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS rate_limit_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          next_allowed_at INTEGER NOT NULL,
          cooldown_until INTEGER NOT NULL
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const path = new URL(request.url).pathname;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (!body || typeof body !== "object" || !("lane" in body) || !isLane(body.lane)) {
      return json({ error: "invalid_lane" }, 400);
    }

    const lane = body.lane;
    const now = Date.now();

    if (path === "/acquire") {
      if (lane !== "eporner" || !("leaseId" in body) ||
          typeof body.leaseId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.leaseId)) {
        return json({ error: "invalid_lease" }, 400);
      }
      const leaseId = body.leaseId;
      if (!this.epornerLockTableReady) {
        this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS eporner_request_lock (lane TEXT PRIMARY KEY, lease_id TEXT, lease_until INTEGER NOT NULL)");
        this.epornerLockTableReady = true;
      }
      this.ctx.storage.sql.exec(
        "INSERT OR IGNORE INTO eporner_request_lock (lane, lease_id, lease_until) VALUES (?, NULL, 0)",
        lane,
      );
      const acquired = Array.from(this.ctx.storage.sql.exec<{ lease_id: string }>(
        "UPDATE eporner_request_lock SET lease_id = ?, lease_until = ? WHERE lane = ? AND lease_until <= ? RETURNING lease_id",
        leaseId,
        now + EPORNER_LOCK_LEASE_MS,
        lane,
        now,
      ))[0];
      if (acquired) return json({ acquired: true, leaseId });
      const active = this.ctx.storage.sql.exec<{ lease_until: number }>(
        "SELECT lease_until FROM eporner_request_lock WHERE lane = ?",
        lane,
      ).one();
      return json({
        acquired: false,
        retryAt: Math.min(active?.lease_until ?? now + EPORNER_LOCK_RETRY_MS, now + EPORNER_LOCK_RETRY_MS),
      });
    }

    if (path === "/release") {
      if (lane !== "eporner" || !("leaseId" in body) ||
          typeof body.leaseId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.leaseId)) {
        return json({ error: "invalid_lease" }, 400);
      }
      const released = Array.from(this.ctx.storage.sql.exec<{ lane: string }>(
        "UPDATE eporner_request_lock SET lease_id = NULL, lease_until = 0 WHERE lane = ? AND lease_id = ? RETURNING lane",
        lane,
        body.leaseId,
      )).length > 0;
      return json({ released });
    }

    if (path === "/reserve") {
      const interval = LANE_INTERVAL_MS[lane];
      // One atomic UPSERT allocates a unique slot. No read-then-write race.
      const row = this.ctx.storage.sql.exec<{ scheduled_at: number }>(
        `INSERT INTO rate_limit_state (singleton, next_allowed_at, cooldown_until)
         VALUES (1, ? + ?, 0)
         ON CONFLICT(singleton) DO UPDATE SET
           next_allowed_at = MAX(rate_limit_state.next_allowed_at, rate_limit_state.cooldown_until, ?) + ?
         RETURNING next_allowed_at - ? AS scheduled_at`,
        now,
        interval,
        now,
        interval,
        interval,
      ).one();

      if (!row || !Number.isFinite(row.scheduled_at)) return json({ error: "reservation_failed" }, 503);
      return json({ scheduledAt: row.scheduled_at });
    }

    if (path === "/validate") {
      if (!("scheduledAt" in body) || typeof body.scheduledAt !== "number" ||
          !Number.isFinite(body.scheduledAt) || body.scheduledAt < 0) {
        return json({ error: "invalid_reservation" }, 400);
      }

      // Re-queue a slot if a 429 cooldown was extended after it was reserved.
      const rows = Array.from(this.ctx.storage.sql.exec<{ scheduled_at: number }>(
        `UPDATE rate_limit_state
         SET next_allowed_at = MAX(next_allowed_at, cooldown_until, ?) + ?
         WHERE singleton = 1 AND ? < cooldown_until
         RETURNING next_allowed_at - ? AS scheduled_at`,
        now,
        LANE_INTERVAL_MS[lane],
        body.scheduledAt,
        LANE_INTERVAL_MS[lane],
      ));
      const row = rows[0];

      return json({ scheduledAt: row?.scheduled_at ?? body.scheduledAt });
    }

    if (path === "/cooldown") {
      if (!("durationMs" in body) || typeof body.durationMs !== "number" ||
          !Number.isFinite(body.durationMs) || body.durationMs < 1_000 || body.durationMs > MAX_COOLDOWN_MS) {
        return json({ error: "invalid_cooldown" }, 400);
      }
      // Anchor relative cooldowns to the Durable Object clock, avoiding cross-isolate clock skew.
      const cooldownUntil = now + body.durationMs;

      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limit_state (singleton, next_allowed_at, cooldown_until)
         VALUES (1, 0, ?)
         ON CONFLICT(singleton) DO UPDATE SET
           cooldown_until = MAX(rate_limit_state.cooldown_until, ?),
           next_allowed_at = MAX(rate_limit_state.next_allowed_at, ?)`,
        cooldownUntil,
        cooldownUntil,
        cooldownUntil,
      );
      return json({ accepted: true });
    }

    return json({ error: "not_found" }, 404);
  }
}

export interface RateLimitCoordinatorNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Rate-limited request was cancelled.", "AbortError");
  }
}

async function bufferEpornerResponse(response: Response): Promise<Response> {
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "www.eporner.com") {
      throw new Error("Eporner API redirected to an unexpected host.");
    }
  }
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > EPORNER_MAX_RESPONSE_BYTES) {
    throw new Error("Eporner API response exceeded the size limit.");
  }
  if (!response.body) {
    return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > EPORNER_MAX_RESPONSE_BYTES) {
        await reader.cancel("Eporner API response exceeded the size limit.");
        throw new Error("Eporner API response exceeded the size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("Transfer-Encoding");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function coordinatorRequest(
  namespace: RateLimitCoordinatorNamespace,
  path: "reserve" | "validate" | "cooldown" | "acquire" | "release",
  lane: RateLimitLane,
  signal?: AbortSignal,
  cooldownMs?: number,
  scheduledAt?: number,
  leaseId?: string,
): Promise<{ scheduledAt?: number; acquired?: boolean; retryAt?: number }> {
  throwIfAborted(signal);
  const stub = namespace.get(namespace.idFromName(lane));
  const response = await stub.fetch(new Request("https://rate-limit-coordinator/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      path === "reserve" ? { lane }
        : path === "validate" ? { lane, scheduledAt }
          : path === "cooldown" ? { lane, durationMs: cooldownMs }
            : { lane, leaseId },
    ),
    signal,
  }));
  if (!response.ok) throw new Error("Rate-limit coordinator unavailable (HTTP " + response.status + ").");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new Error("Invalid rate-limit coordinator response.");
  if (path === "reserve" || path === "validate") {
    const scheduledAt = "scheduledAt" in payload ? payload.scheduledAt : undefined;
    if (typeof scheduledAt !== "number" || !Number.isFinite(scheduledAt)) {
      throw new Error("Invalid rate-limit reservation.");
    }
    return { scheduledAt };
  }
  if (path === "acquire") {
    const acquired = "acquired" in payload ? payload.acquired : undefined;
    const retryAt = "retryAt" in payload ? payload.retryAt : undefined;
    const returnedLeaseId = "leaseId" in payload ? payload.leaseId : undefined;
    if (typeof acquired !== "boolean" ||
        (acquired && returnedLeaseId !== leaseId) ||
        (!acquired && (typeof retryAt !== "number" || !Number.isFinite(retryAt)))) {
      throw new Error("Invalid Eporner request-lock response.");
    }
    return { acquired, ...(typeof retryAt === "number" ? { retryAt } : {}) };
  }
  return {};
}

function waitUntil(timestamp: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  const delay = timestamp - Date.now();
  if (delay <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(signal?.reason ?? new DOMException("Rate-limited request was cancelled.", "AbortError"));
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Wraps only real upstream fetches; Provider cache lookups happen before this function is called. */
export function createCoordinatedFetch(
  namespace: RateLimitCoordinatorNamespace,
  lane: RateLimitLane,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const requestSignal = init?.signal ?? signal;
    const reservation = await coordinatorRequest(namespace, "reserve", lane, requestSignal);
    let scheduledAt = reservation.scheduledAt!;
    while (true) {
      await waitUntil(scheduledAt, requestSignal);
      throwIfAborted(requestSignal);
      const checked = await coordinatorRequest(
        namespace,
        "validate",
        lane,
        requestSignal,
        undefined,
        scheduledAt,
      );
      if (checked.scheduledAt! <= scheduledAt) break;
      scheduledAt = checked.scheduledAt!;
    }
    throwIfAborted(requestSignal);

    const exclusiveLeaseId = lane === "eporner" ? crypto.randomUUID() : undefined;
    if (exclusiveLeaseId) {
      while (true) {
        const lock = await coordinatorRequest(
          namespace,
          "acquire",
          lane,
          requestSignal,
          undefined,
          undefined,
          exclusiveLeaseId,
        );
        if (lock.acquired) break;
        await waitUntil(lock.retryAt!, requestSignal);
      }
    }

    try {
      let response = await fetchImpl(input, init);
      const cooldownMs = parseCooldownDuration(response, Date.now(), lane);
      if (cooldownMs !== null) {
        // Persist upstream throttling even if the initiating client disconnects
        // after the response arrives; the Durable Object anchors it to its own clock.
        await coordinatorRequest(namespace, "cooldown", lane, undefined, cooldownMs);
      }
      if (lane === "eporner") response = await bufferEpornerResponse(response);
      return response;
    } finally {
      if (exclusiveLeaseId) {
        // Release independently of the client signal. If this operation fails,
        // the bounded lease expires and prevents a permanent lock.
        await coordinatorRequest(namespace, "release", lane, undefined, undefined, undefined, exclusiveLeaseId);
      }
    }
  };
}
