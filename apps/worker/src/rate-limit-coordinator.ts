type RateLimitLane = "musicbrainz" | "mangadex" | "anibt" | "therarbg";

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
};
const MAX_COOLDOWN_MS = 86_400_000;

function boundedCooldownUntil(timestamp: number, now: number): number {
  return Math.min(Math.max(now + 1_000, timestamp), now + MAX_COOLDOWN_MS);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isLane(value: unknown): value is RateLimitLane {
  return value === "musicbrainz" || value === "mangadex" || value === "anibt" || value === "therarbg";
}

function parseCooldownUntil(response: Response, now: number): number | null {
  const quotaExhausted = response.headers.get("X-RateLimit-Remaining") === "0" ||
    response.headers.get("X-RateLimit-Remaining-Day") === "0";
  if (response.status !== 429 && response.status !== 503 && !quotaExhausted) return null;

  const mangaDexRetry = response.headers.get("X-RateLimit-Retry-After");
  if (mangaDexRetry && /^\d+(?:\.\d+)?$/.test(mangaDexRetry)) {
    const timestamp = Number(mangaDexRetry) * 1_000;
    if (Number.isFinite(timestamp)) return boundedCooldownUntil(timestamp, now);
  }

  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    if (/^\d+(?:\.\d+)?$/.test(retryAfter)) {
      const seconds = Number(retryAfter);
      return boundedCooldownUntil(
        Number.isFinite(seconds) ? now + seconds * 1_000 : Number.POSITIVE_INFINITY,
        now,
      );
    }
    const parsed = Date.parse(retryAfter);
    if (Number.isFinite(parsed)) return boundedCooldownUntil(parsed, now);
  }

  const dayReset = response.headers.get("X-RateLimit-Reset-Day");
  if (response.headers.get("X-RateLimit-Remaining-Day") === "0" && dayReset && /^\\d+$/.test(dayReset)) {
    const seconds = Number(dayReset);
    if (Number.isFinite(seconds)) return boundedCooldownUntil(now + seconds * 1_000, now);
  }

  return now + 1_000;
}

/**
 * Internal-only, per-upstream Durable Object coordinator.
 * The SQLite row contains timestamps only; no query, result, or user data.
 */
export class RateLimitCoordinator {
  private readonly ready: Promise<void>;

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
      if (!("until" in body) || typeof body.until !== "number" ||
          !Number.isFinite(body.until) || body.until <= now || body.until > now + 86_400_000) {
        return json({ error: "invalid_cooldown" }, 400);
      }

      this.ctx.storage.sql.exec(
        `INSERT INTO rate_limit_state (singleton, next_allowed_at, cooldown_until)
         VALUES (1, 0, ?)
         ON CONFLICT(singleton) DO UPDATE SET
           cooldown_until = MAX(rate_limit_state.cooldown_until, ?),
           next_allowed_at = MAX(rate_limit_state.next_allowed_at, ?)`,
        body.until,
        body.until,
        body.until,
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

async function coordinatorRequest(
  namespace: RateLimitCoordinatorNamespace,
  path: "reserve" | "validate" | "cooldown",
  lane: RateLimitLane,
  signal?: AbortSignal,
  until?: number,
  scheduledAt?: number,
): Promise<{ scheduledAt?: number }> {
  throwIfAborted(signal);
  const stub = namespace.get(namespace.idFromName(lane));
  const response = await stub.fetch(new Request("https://rate-limit-coordinator/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      path === "reserve" ? { lane }
        : path === "validate" ? { lane, scheduledAt }
          : { lane, until },
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

    const response = await fetchImpl(input, init);
    const cooldownUntil = parseCooldownUntil(response, Date.now());
    if (cooldownUntil !== null) {
      // Persist upstream throttling even if the initiating client disconnects
      // after the response arrives; otherwise the shared lane can lose a 429.
      await coordinatorRequest(namespace, "cooldown", lane, undefined, cooldownUntil);
    }
    return response;
  };
}
