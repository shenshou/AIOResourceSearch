import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RateLimitCoordinator,
  createCoordinatedFetch,
  type RateLimitCoordinatorNamespace,
} from "../src/rate-limit-coordinator.ts";

function namespace(
  handler: (request: Request) => Promise<Response>,
  calls: string[] = [],
): RateLimitCoordinatorNamespace {
  return {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return handler(request);
      },
    }),
  };
}

test("reserves a slot before making the upstream request", async () => {
  const calls: string[] = [];
  const coordinator = namespace(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/reserve") {
      const body = await request.json() as { lane: string };
      assert.equal(body.lane, "mangadex");
      return Response.json({ scheduledAt: Date.now() });
    }
    if (path === "/validate") {
      const body = await request.json() as { scheduledAt: number };
      return Response.json({ scheduledAt: body.scheduledAt });
    }
    return Response.json({ accepted: true });
  }, calls);
  let upstreamCalls = 0;
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    new AbortController().signal,
    async () => {
      upstreamCalls += 1;
      return new Response("ok");
    },
  );

  const response = await coordinatedFetch("https://api.mangadex.org/manga");
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls, 1);
  assert.deepEqual(calls, ["/reserve", "/validate"]);
});

test("fails closed when the coordinator cannot reserve a slot", async () => {
  const coordinator = namespace(async () => new Response("unavailable", { status: 503 }));
  let upstreamCalls = 0;
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "musicbrainz",
    new AbortController().signal,
    async () => {
      upstreamCalls += 1;
      return new Response("must not be called");
    },
  );

  await assert.rejects(coordinatedFetch("https://musicbrainz.org/ws/2/artist/"), /coordinator unavailable/i);
  assert.equal(upstreamCalls, 0);
});

test("does not call upstream when a reserved slot wait is cancelled", async () => {
  const controller = new AbortController();
  const coordinator = namespace(async (request) => {
    if (new URL(request.url).pathname === "/reserve") {
      return Response.json({ scheduledAt: Date.now() + 60_000 });
    }
    return Response.json({ scheduledAt: Date.now() + 60_000 });
  });
  let upstreamCalls = 0;
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    controller.signal,
    async () => {
      upstreamCalls += 1;
      return new Response("must not be called");
    },
  );

  const pending = coordinatedFetch("https://api.mangadex.org/manga");
  controller.abort(new DOMException("Cancelled by client.", "AbortError"));
  await assert.rejects(pending, /cancelled/i);
  assert.equal(upstreamCalls, 0);
});

test("extends the lane cooldown after a 429 response", async () => {
  const calls: string[] = [];
  const coordinator = namespace(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/reserve") return Response.json({ scheduledAt: Date.now() });
    if (path === "/validate") {
      const body = await request.json() as { scheduledAt: number };
      return Response.json({ scheduledAt: body.scheduledAt });
    }
    const body = await request.json() as { lane: string; until: number };
    assert.equal(body.lane, "mangadex");
    assert.ok(body.until >= Date.now() + 1_000);
    return Response.json({ accepted: true });
  }, calls);
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    new AbortController().signal,
    async () => new Response("rate limited", {
      status: 429,
      headers: { "Retry-After": "2" },
    }),
  );

  const response = await coordinatedFetch("https://api.mangadex.org/manga");
  assert.equal(response.status, 429);
  assert.deepEqual(calls, ["/reserve", "/validate", "/cooldown"]);
});



test("honors an exhausted MangaDex quota on a successful response", async () => {
  const calls: string[] = [];
  const until = Math.floor((Date.now() + 3_000) / 1_000);
  const coordinator = namespace(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/reserve") return Response.json({ scheduledAt: Date.now() });
    if (path === "/validate") {
      const body = await request.json() as { scheduledAt: number };
      return Response.json({ scheduledAt: body.scheduledAt });
    }
    const body = await request.json() as { until: number };
    assert.ok(body.until >= until * 1_000);
    return Response.json({ accepted: true });
  }, calls);
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    new AbortController().signal,
    async () => new Response("ok", {
      status: 200,
      headers: {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Retry-After": String(until),
      },
    }),
  );

  const response = await coordinatedFetch("https://api.mangadex.org/manga");
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/reserve", "/validate", "/cooldown"]);
});

test("revalidates a queued slot when a cooldown was extended after reservation", async () => {
  let validations = 0;
  const coordinator = namespace(async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/reserve") return Response.json({ scheduledAt: Date.now() });
    if (path === "/validate") {
      const body = await request.json() as { scheduledAt: number };
      validations += 1;
      return Response.json({
        scheduledAt: validations === 1 ? Date.now() + 5 : body.scheduledAt,
      });
    }
    return Response.json({ accepted: true });
  });
  let upstreamCalls = 0;
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    new AbortController().signal,
    async () => {
      upstreamCalls += 1;
      return new Response("ok");
    },
  );

  const response = await coordinatedFetch("https://api.mangadex.org/manga");
  assert.equal(response.status, 200);
  assert.equal(validations, 2);
  assert.equal(upstreamCalls, 1);
});

test("keeps the reserved slot when validation UPDATE affects zero rows", async () => {
  const ctx = {
    storage: {
      sql: {
        exec<T>(query: string): { one(): T | null; [Symbol.iterator](): Iterator<T> } {
          if (/^\\s*UPDATE/i.test(query)) {
            return {
              one: () => { throw new Error("one() requires exactly one row"); },
              [Symbol.iterator]: function* () {},
            };
          }
          return {
            one: () => ({ scheduled_at: Date.now() } as T),
            [Symbol.iterator]: function* () {},
          };
        },
      },
    },
    blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback(),
  };
  const coordinator = new RateLimitCoordinator(ctx);
  const scheduledAt = Date.now() + 500;
  const response = await coordinator.fetch(new Request("https://coordinator/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lane: "mangadex", scheduledAt }),
  }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { scheduledAt });
});

test("uses one atomic SQLite UPSERT for reservation and rejects unknown lanes", async () => {
  const statements: string[] = [];
  const ctx = {
    storage: {
      sql: {
        exec<T>(query: string): { one(): T | null; [Symbol.iterator](): Iterator<T> } {
          statements.push(query);
          return {
            one: () => ({ scheduled_at: Date.now() } as T),
            [Symbol.iterator]: function* () { yield { scheduled_at: Date.now() } as T; },
          };
        },
      },
    },
    blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback(),
  };
  const coordinator = new RateLimitCoordinator(ctx);
  const response = await coordinator.fetch(new Request("https://coordinator/reserve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lane: "musicbrainz" }),
  }));

  assert.equal(response.status, 200);
  assert.match(statements[1] ?? "", /INSERT INTO rate_limit_state/i);
  assert.match(statements[1] ?? "", /ON CONFLICT\(singleton\) DO UPDATE/i);
  assert.doesNotMatch(statements[1] ?? "", /SELECT/i);

  const invalid = await coordinator.fetch(new Request("https://coordinator/reserve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lane: "arbitrary" }),
  }));
  assert.equal(invalid.status, 400);
});

test("persists an upstream cooldown even if the client cancels after the response", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const coordinator = namespace(async (request) => {
    const path = new URL(request.url).pathname;
    calls.push(path);
    if (path === "/reserve") return Response.json({ scheduledAt: Date.now() });
    if (path === "/validate") {
      const body = await request.json() as { scheduledAt: number };
      return Response.json({ scheduledAt: body.scheduledAt });
    }
    assert.equal(request.signal.aborted, false);
    return Response.json({ accepted: true });
  });
  const coordinatedFetch = createCoordinatedFetch(
    coordinator,
    "mangadex",
    controller.signal,
    async () => {
      const response = new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "2" },
      });
      controller.abort(new DOMException("Client disconnected.", "AbortError"));
      return response;
    },
  );

  const response = await coordinatedFetch("https://api.mangadex.org/manga");
  assert.equal(response.status, 429);
  assert.deepEqual(calls, ["/reserve", "/validate", "/cooldown"]);
});
