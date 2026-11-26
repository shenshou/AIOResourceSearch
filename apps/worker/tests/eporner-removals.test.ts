import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isEpornerRemovalSyncFresh,
  readEpornerRemovalSyncState,
  syncEpornerRemovalFeed,
} from "../src/eporner-removals.ts";

const KEY = "eporner:removal-sync:v1";
const now = Date.parse("2026-11-26T03:00:00.000Z");

function memoryEnv(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(KEY, initial);
  const writes: Array<{ key: string; value: string }> = [];
  return {
    env: {
      SOURCES_KV: {
        get: async (key: string) => values.get(key) ?? null,
        put: async (key: string, value: string) => {
          values.set(key, value);
          writes.push({ key, value });
        },
      },
    } as never,
    values,
    writes,
  };
}

test("reads and validates persisted sync state and freshness", async () => {
  const state = {
    version: 1,
    since: "2026-11-25T03:00:00.000Z",
    lastCompleteAt: "2026-11-26T02:00:00.000Z",
    lastAttemptAt: "2026-11-26T02:00:00.000Z",
    lastPageCount: 4,
  };
  const memory = memoryEnv(JSON.stringify(state));
  const loaded = await readEpornerRemovalSyncState(memory.env);
  assert.deepEqual(loaded, state);
  assert.equal(isEpornerRemovalSyncFresh(loaded, now), true);
  assert.equal(isEpornerRemovalSyncFresh(null, now), false);
  assert.equal(isEpornerRemovalSyncFresh({ ...state, after: "pending-cursor" }, now), false);
  assert.equal(isEpornerRemovalSyncFresh({ ...state, lastCompleteAt: "2026-11-24T00:00:00Z" }, now), false);
});

test("persists the continuation cursor after one page and completes on the next scheduled run", async () => {
  const memory = memoryEnv();
  let requested = "";
  const first = await syncEpornerRemovalFeed(memory.env, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({
      since: "2026-11-25T03:00:00.000Z",
      count: 1,
      has_more: true,
      next: "1794873600.18200456",
      removed: [{ id: "AbCdEfGhIjK", removed_at: "2026-11-26T02:00:00Z" }],
    }), { headers: { "Content-Type": "application/json" } });
  }, now);
  assert.equal(new URL(requested).searchParams.get("since"), "2026-11-25T03:00:00.000Z");
  assert.equal(new URL(requested).searchParams.get("per_page"), "250");
  assert.equal(first.complete, false);
  assert.equal(first.removedCount, 1);
  const pending = JSON.parse(memory.values.get(KEY)!);
  assert.equal(pending.after, "1794873600.18200456");
  assert.equal(pending.lastCompleteAt, null);

  const second = await syncEpornerRemovalFeed(memory.env, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ since: "2026-11-25T03:00:00.000Z", count: 0, has_more: false, removed: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }, now + 60 * 60 * 1000);
  assert.equal(new URL(requested).searchParams.get("after"), "1794873600.18200456");
  assert.equal(new URL(requested).searchParams.has("since"), false);
  assert.equal(second.complete, true);
  const completed = JSON.parse(memory.values.get(KEY)!);
  assert.equal(completed.after, undefined);
  assert.equal(completed.lastCompleteAt, new Date(now + 60 * 60 * 1000).toISOString());
});

test("does not advance the cursor when the upstream feed fails", async () => {
  const existing = {
    version: 1,
    since: "2026-11-25T03:00:00.000Z",
    after: "cursor-1",
    lastCompleteAt: "2026-11-25T04:00:00.000Z",
    lastAttemptAt: "2026-11-25T04:00:00.000Z",
    lastPageCount: 250,
  };
  const memory = memoryEnv(JSON.stringify(existing));
  await assert.rejects(
    syncEpornerRemovalFeed(memory.env, async () => new Response("unavailable", { status: 503 }), now),
    /HTTP 503/i,
  );
  assert.deepEqual(memory.writes, []);
  assert.deepEqual(JSON.parse(memory.values.get(KEY)!), existing);
});

test("rejects malformed removal records and unexpected content types", async () => {
  const memory = memoryEnv();
  await assert.rejects(
    syncEpornerRemovalFeed(memory.env, async () => new Response(JSON.stringify({
      has_more: false,
      removed: [{ id: "invalid", removed_at: "2026-11-26T00:00:00Z" }],
    }), { headers: { "Content-Type": "application/json" } }), now),
    /invalid removal record/i,
  );
  await assert.rejects(
    syncEpornerRemovalFeed(memory.env, async () => new Response("<html>challenge</html>", {
      headers: { "Content-Type": "text/html" },
    }), now),
    /unexpected content type/i,
  );
  assert.equal(memory.writes.length, 0);
});
