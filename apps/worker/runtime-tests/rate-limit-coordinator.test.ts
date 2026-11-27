import { env } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createCoordinatedFetch } from "../src/rate-limit-coordinator";

interface CoordinatorStub {
  fetch(request: Request): Promise<Response>;
}

interface CoordinatorNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): CoordinatorStub;
}

const coordinator = (env as unknown as {
  RATE_LIMIT_COORDINATOR: CoordinatorNamespace;
}).RATE_LIMIT_COORDINATOR;

function createStub(lane: "mangadex" | "musicbrainz" | "eporner" | "librivox"): CoordinatorStub {
  const id = coordinator.idFromName(lane + "-" + crypto.randomUUID());
  return coordinator.get(id);
}

async function post(
  stub: CoordinatorStub,
  path: "reserve" | "validate" | "cooldown" | "acquire" | "release",
  body: Record<string, string | number>,
): Promise<Record<string, unknown>> {
  const response = await stub.fetch(new Request("https://coordinator/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  expect(response.status).toBe(200);
  return await response.json() as Record<string, unknown>;
}

async function reserve(
  stub: CoordinatorStub,
  lane: "mangadex" | "musicbrainz" | "librivox",
): Promise<number> {
  const result = await post(stub, "reserve", { lane });
  expect(typeof result.scheduledAt).toBe("number");
  return result.scheduledAt as number;
}

describe("RateLimitCoordinator in the local Workers runtime", () => {
  it("allocates non-overlapping slots for concurrent reservations on one lane", async () => {
    const stub = createStub("mangadex");
    const slots = await Promise.all(
      Array.from({ length: 12 }, () => reserve(stub, "mangadex")),
    );
    const ordered = slots.sort((left, right) => left - right);

    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index] - ordered[index - 1]).toBeGreaterThanOrEqual(400);
    }
  });

  it("keeps cooldown state isolated between lane objects", async () => {
    const mangaStub = createStub("mangadex");
    const musicStub = createStub("musicbrainz");
    const mangaBaseline = await reserve(mangaStub, "mangadex");
    const musicFirst = await reserve(musicStub, "musicbrainz");

    await post(mangaStub, "cooldown", {
      lane: "mangadex",
      durationMs: 5_000,
    });

    const musicNext = await reserve(musicStub, "musicbrainz");
    const mangaNext = await reserve(mangaStub, "mangadex");

    expect(musicNext - musicFirst).toBe(1_000);
    expect(mangaNext).toBeGreaterThanOrEqual(mangaBaseline + 5_000);
  });

  it("re-queues a reserved slot when a later cooldown is applied", async () => {
    const stub = createStub("mangadex");
    const scheduledAt = await reserve(stub, "mangadex");

    await post(stub, "cooldown", {
      lane: "mangadex",
      durationMs: 2_000,
    });
    const validation = await post(stub, "validate", {
      lane: "mangadex",
      scheduledAt,
    });

    expect(validation.scheduledAt).toBeGreaterThanOrEqual(scheduledAt + 2_000);
  });



  it("enforces the MusicBrainz one-second interval in SQLite", async () => {
    const stub = createStub("musicbrainz");
    const slots = await Promise.all(
      Array.from({ length: 4 }, () => reserve(stub, "musicbrainz")),
    );
    const ordered = slots.sort((left, right) => left - right);

    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index] - ordered[index - 1]).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("enforces five-second LibriVox spacing in SQLite", async () => {
    const stub = createStub("librivox");
    const slots = await Promise.all(
      Array.from({ length: 4 }, () => reserve(stub, "librivox")),
    );
    const ordered = slots.sort((left, right) => left - right);

    for (let index = 1; index < ordered.length; index += 1) {
      expect(ordered[index] - ordered[index - 1]).toBeGreaterThanOrEqual(5_000);
    }
  });

  it("holds the global Eporner lease until the complete upstream body is buffered", async () => {
    const id = coordinator.idFromName("eporner-runtime-" + crypto.randomUUID());
    const stub = coordinator.get(id);
    const namespace = {
      idFromName: () => id,
      get: () => stub,
    };
    let releaseBody!: () => void;
    const bodyGate = new Promise<void>((resolve) => { releaseBody = () => resolve(); });
    let markFetchStarted!: () => void;
    const fetchStarted = new Promise<void>((resolve) => { markFetchStarted = resolve; });
    const upstreamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        await bodyGate;
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    });
    const coordinatedFetch = createCoordinatedFetch(
      namespace,
      "eporner",
      new AbortController().signal,
      async () => {
        markFetchStarted();
        return new Response(upstreamBody, { headers: { "Content-Type": "application/json" } });
      },
    );

    const pending = coordinatedFetch("https://www.eporner.com/api/v2/video/search/");
    await fetchStarted;

    const secondLease = crypto.randomUUID();
    const blocked = await post(stub, "acquire", { lane: "eporner", leaseId: secondLease });
    expect(blocked.acquired).toBe(false);

    releaseBody();
    const response = await pending;
    expect(await response.text()).toBe("ok");

    const acquired = await post(stub, "acquire", { lane: "eporner", leaseId: secondLease });
    expect(acquired.acquired).toBe(true);
    const released = await post(stub, "release", { lane: "eporner", leaseId: secondLease });
    expect(released.released).toBe(true);
  });

  it("persists a LibriVox Retry-After cooldown across its dedicated SQLite lane", async () => {
    const id = coordinator.idFromName("librivox");
    const stub = coordinator.get(id);
    const namespace = {
      idFromName: (name: string) => coordinator.idFromName(name),
      get: (objectId: unknown) => coordinator.get(objectId),
    };
    const clockProbe = await reserve(stub, "librivox");
    const clockOffset = clockProbe - Date.now() - 5_000;
    let upstreamAt = 0;
    const coordinatedFetch = createCoordinatedFetch(
      namespace,
      "librivox",
      new AbortController().signal,
      async () => {
        upstreamAt = Date.now();
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "10" },
        });
      },
    );

    const response = await coordinatedFetch("https://librivox.org/api/feed/audiobooks/");
    expect(response.status).toBe(429);
    const nextSlot = await reserve(stub, "librivox");
    // Compare timestamps in the Durable Object clock domain.
    expect(nextSlot).toBeGreaterThanOrEqual(upstreamAt + clockOffset + 14_900);
  });

  it("persists a real upstream 429 cooldown through the coordinated fetch path", async () => {
    // The coordinated fetch resolves the canonical production lane ID via idFromName("mangadex").
    const id = coordinator.idFromName("mangadex");
    const stub = coordinator.get(id);
    const namespace = {
      idFromName: (name: string) => coordinator.idFromName(name),
      get: (objectId: unknown) => coordinator.get(objectId),
    };
    const clockProbe = await reserve(stub, "mangadex");
    const clockOffset = clockProbe - Date.now() - 400;
    let upstreamAt = 0;
    const coordinatedFetch = createCoordinatedFetch(
      namespace,
      "mangadex",
      new AbortController().signal,
      async () => {
        upstreamAt = Date.now();
        return new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "2" },
        });
      },
    );

    const response = await coordinatedFetch("https://api.mangadex.org/manga");
    expect(response.status).toBe(429);

    const nextSlot = await reserve(stub, "mangadex");
    expect(nextSlot).toBeGreaterThanOrEqual(upstreamAt + clockOffset + 2_300);
  });

  it("persists SQLite reservation state after Durable Object eviction", async () => {
    const stub = createStub("mangadex");
    const firstSlot = await reserve(stub, "mangadex");

    await evictDurableObject(
      stub as Parameters<typeof evictDurableObject>[0],
    );

    const nextSlot = await reserve(stub, "mangadex");
    expect(nextSlot).toBeGreaterThanOrEqual(firstSlot + 400);
  });
});
