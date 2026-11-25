import { env } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";

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

function createStub(lane: "mangadex" | "musicbrainz"): CoordinatorStub {
  const id = coordinator.idFromName(lane + "-" + crypto.randomUUID());
  return coordinator.get(id);
}

async function post(
  stub: CoordinatorStub,
  path: "reserve" | "validate" | "cooldown",
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
  lane: "mangadex" | "musicbrainz",
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
    const cooldownUntil = Date.now() + 5_000;

    await post(mangaStub, "cooldown", {
      lane: "mangadex",
      until: cooldownUntil,
    });

    const musicSlot = await reserve(musicStub, "musicbrainz");
    const mangaSlot = await reserve(mangaStub, "mangadex");

    expect(musicSlot).toBeLessThan(cooldownUntil);
    expect(mangaSlot).toBeGreaterThanOrEqual(cooldownUntil);
  });

  it("re-queues a reserved slot when a later cooldown is applied", async () => {
    const stub = createStub("mangadex");
    const scheduledAt = await reserve(stub, "mangadex");
    const cooldownUntil = Date.now() + 2_000;

    await post(stub, "cooldown", {
      lane: "mangadex",
      until: cooldownUntil,
    });
    const validation = await post(stub, "validate", {
      lane: "mangadex",
      scheduledAt,
    });

    expect(validation.scheduledAt).toBeGreaterThanOrEqual(cooldownUntil);
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
