import assert from "node:assert/strict";
import { test } from "node:test";
import { listProviderAdapters } from "../../src/providers/registry.ts";

test("all compiled Provider adapters satisfy the shared registry contract", () => {
  const adapters = listProviderAdapters();
  assert.equal(adapters.length, 13);
  const ids = adapters.map((adapter) => adapter.id);
  assert.equal(new Set(ids).size, ids.length, "adapter IDs must be unique");
  for (const adapter of adapters) {
    assert.match(adapter.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(adapter.version, /^\d+\.\d+\.\d+$/);
    assert.ok(adapter.categories.length > 0, adapter.id + " must declare source categories");
    assert.ok(adapter.capabilities.length > 0, adapter.id + " must declare capabilities");
    assert.ok(adapter.searchModes.length > 0, adapter.id + " must declare search modes");
    assert.ok(adapter.searchModes.every((mode) => mode === "keyword" || mode === "number"));
    assert.ok(adapter.contentCategories && adapter.contentCategories.length > 0, adapter.id + " must declare content categories");
  }
});
