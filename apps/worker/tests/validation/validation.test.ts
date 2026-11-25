import assert from "node:assert/strict";
import { test } from "node:test";
import { validateAdapter, validateSource } from "../../src/validation.ts";

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: "example-source",
    name: "Example source",
    category: "jav",
    type: "provider",
    adapterId: "perverzija-db",
    enabled: true,
    searchModes: ["number"],
    capabilities: ["metadata"],
    timeoutMs: 5000,
    ...overrides,
  };
}

function adapter(overrides: Record<string, unknown> = {}) {
  return {
    id: "perverzija-db",
    name: "Perverzija DB",
    description: "Metadata provider",
    version: "1.0.0",
    enabled: true,
    categories: ["jav"],
    capabilities: ["metadata"],
    ...overrides,
  };
}

test("validateSource preserves compatibility with legacy sources without contentCategory", () => {
  const result = validateSource(source());

  assert.ok(result);
  assert.equal(result.type, "provider");
  assert.equal(result.contentCategory, undefined);
  assert.equal(result.id, "example-source");
});

test("validateSource rejects invalid source IDs", () => {
  assert.equal(validateSource(source({ id: "Invalid ID" })), null);
});

test("validateSource rejects unsupported content categories", () => {
  assert.equal(validateSource(source({ contentCategory: "podcast" })), null);
});

test("validateSource rejects provider search templates that leave the configured origin", () => {
  assert.equal(validateSource(source({
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://other.example/search?q={query}",
  })), null);
});

test("validateSource requires exactly one query placeholder in provider templates", () => {
  assert.equal(validateSource(source({
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://source.example/search?q={query}&again={query}",
  })), null);
});

test("validateSource rejects loopback hosts for generic HTML sources", () => {
  assert.equal(validateSource(source({
    adapterId: "generic-html",
    baseUrl: "https://127.0.0.1",
    providerSearchUrlTemplate: "https://127.0.0.1/search?q={query}",
    htmlSelectors: { result: ".result", title: ".title", link: "a" },
  })), null);
});

test("validateSource requires the essential generic HTML selectors", () => {
  assert.equal(validateSource(source({
    adapterId: "generic-html",
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://source.example/search?q={query}",
    htmlSelectors: { result: ".result", title: ".title" },
  })), null);
});

test("validateSource accepts a valid generic HTML source and bounded metadata selectors", () => {
  const result = validateSource(source({
    adapterId: "generic-html",
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://source.example/search?q={query}",
    htmlSelectors: {
      result: ".result",
      title: ".title",
      link: "a.detail",
      image: "img.cover",
      fields: { releaseDate: ".date", author: ".author" },
    },
    capabilities: ["metadata", "image"],
    },
  }));

  assert.ok(result);
  assert.equal(result.adapterId, "generic-html");
  assert.equal(result.htmlSelectors?.fields?.releaseDate, ".date");
});

test("validateSource requires generic HTML image and Magnet selectors to match declared capabilities", () => {
  const base = {
    adapterId: "generic-html",
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://source.example/search?q={query}",
    htmlSelectors: { result: ".result", title: ".title", link: "a", image: "img.cover" },
  };

  assert.equal(validateSource(source(base)), null);
  assert.equal(validateSource(source({
    ...base,
    capabilities: ["metadata", "image"],
  }))?.capabilities.includes("image"), true);
  assert.equal(validateSource(source({
    ...base,
    htmlSelectors: { ...base.htmlSelectors, magnet: "a.magnet" },
    capabilities: ["metadata", "image", "magnet"],
  }))?.capabilities.includes("magnet"), true);
  assert.equal(validateSource(source({
    ...base,
    capabilities: ["metadata", "image", "magnet"],
  })), null);
});

test("validateSource rejects more than 20 custom HTML metadata fields", () => {
  const fields = Object.fromEntries(
    Array.from({ length: 21 }, (_, index) => [`field${index}`, `.field-${index}`]),
  );

  assert.equal(validateSource(source({
    adapterId: "generic-html",
    baseUrl: "https://source.example",
    providerSearchUrlTemplate: "https://source.example/search?q={query}",
    htmlSelectors: { result: ".result", title: ".title", link: "a", fields },
  })), null);
});

test("validateSource requires external-search destinations to use HTTPS", () => {
  assert.equal(validateSource(source({
    type: "external-search",
    adapterId: undefined,
    capabilities: [],
    baseUrl: "http://source.example",
  })), null);
});

test("validateAdapter accepts an enabled adapter with a registered implementation", () => {
  const result = validateAdapter(adapter());

  assert.ok(result);
  assert.equal(result.implemented, true);
  assert.equal(result.enabled, true);
});

test("validateAdapter rejects enabling an adapter without a Worker implementation", () => {
  assert.equal(validateAdapter(adapter({
    id: "not-implemented",
    enabled: true,
  })), null);
});

test("validateAdapter allows an unimplemented adapter to remain disabled", () => {
  const result = validateAdapter(adapter({
    id: "not-implemented",
    enabled: false,
  }));

  assert.ok(result);
  assert.equal(result.implemented, false);
  assert.equal(result.enabled, false);
});

test("validateAdapter uses the registered implementation as the source of truth", () => {
  const result = validateAdapter(adapter({
    categories: ["jav"],
    capabilities: ["metadata", "ed2k"],
    version: "99.0.0",
  }));

  assert.ok(result);
  assert.deepEqual(result.categories, ["other-index"]);
  assert.deepEqual(result.capabilities, ["metadata"]);
  assert.equal(result.version, "1.0.0");
});

test("validateAdapter removes duplicate categories and capabilities", () => {
  const result = validateAdapter(adapter({
    categories: ["jav", "jav"],
    capabilities: ["metadata", "metadata"],
  }));

  assert.ok(result);
  assert.deepEqual(result.categories, ["jav"]);
  assert.deepEqual(result.capabilities, ["metadata"]);
});
