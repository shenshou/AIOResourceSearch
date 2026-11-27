import { strict as assert } from "node:assert";

function requiredOrigin(name) {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`Missing required environment variable ${name}.`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`${name} must be an HTTPS origin without a path, query, fragment, or credentials.`);
  }
  return url.origin;
}

const workerOrigin = requiredOrigin("WORKER_URL");
const pagesOrigin = requiredOrigin("PAGES_ORIGIN");
const adminToken = process.env.ADMIN_API_TOKEN?.trim();
let passed = 0;

function pass(label) {
  passed += 1;
  process.stdout.write(`PASS ${label}\n`);
}

async function request(path, init = {}) {
  let response;
  try {
    response = await fetch(new URL(path, workerOrigin), {
      redirect: "manual",
      ...init,
    });
  } catch (error) {
    throw new Error(`Request ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return response;
}

async function json(response, label) {
  const contentType = response.headers.get("Content-Type") ?? "";
  assert.match(contentType, /application\/json/i, `${label}: expected JSON content type`);
  return await response.json();
}

const health = await request("/api/health", { headers: { Origin: pagesOrigin } });
assert.equal(health.status, 200, "health endpoint should return HTTP 200");
assert.equal(health.headers.get("Access-Control-Allow-Origin"), pagesOrigin, "health CORS origin should match Pages");
const healthBody = await json(health, "health");
assert.equal(healthBody.status, "ok");
assert.equal(healthBody.service, "aio-resource-search-api");
pass("Worker health and exact Pages CORS origin");

const untrusted = await request("/api/health", {
  headers: { Origin: "https://untrusted-aio-resource-search.invalid" },
});
assert.equal(untrusted.status, 403, "unlisted origins should be rejected");
const untrustedBody = await json(untrusted, "untrusted origin");
assert.equal(untrustedBody.error?.code, "origin_not_allowed");
pass("Unlisted origin rejected");

for (const path of ["/api/sources", "/api/adapters"]) {
  const response = await request(path, { headers: { Origin: pagesOrigin } });
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), pagesOrigin);
  const body = await json(response, path);
  assert.ok(Number.isSafeInteger(body.version) && body.version >= 0, `${path} should expose a configuration version`);
  const key = path === "/api/sources" ? "sources" : "adapters";
  assert.ok(Array.isArray(body[key]), `${path} should expose an array named ${key}`);
  pass(`${path} response shape and CORS`);
}

const preflight = await request("/api/admin/adapters", {
  method: "OPTIONS",
  headers: {
    Origin: pagesOrigin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Authorization,Content-Type,If-Match",
  },
});
assert.equal(preflight.status, 204, "admin preflight should return HTTP 204");
assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), pagesOrigin);
assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /Authorization/i);
assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /If-Match/i);
pass("Administrator CORS preflight");

const unauthorized = await request("/api/admin/adapters", {
  headers: { Origin: pagesOrigin },
});
assert.equal(
  unauthorized.status,
  401,
  unauthorized.status === 503
    ? "ADMIN_API_TOKEN is not configured on the staging Worker"
    : "admin endpoint should reject requests without a bearer token",
);
pass("Administrator endpoint rejects unauthenticated requests");

if (adminToken) {
  const authorized = await request("/api/admin/adapters", {
    headers: {
      Origin: pagesOrigin,
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert.equal(authorized.status, 200, "valid staging admin token should authorize configuration read");
  const etag = authorized.headers.get("ETag");
  assert.ok(etag && /^"\d+"$/.test(etag), "admin configuration should expose a numeric ETag");
  const body = await json(authorized, "admin adapters");
  assert.ok(Array.isArray(body.adapters));
  pass("Administrator token and versioned adapter configuration");
} else {
  process.stdout.write("SKIP authenticated admin read (set ADMIN_API_TOKEN to include it)\n");
}

process.stdout.write(`\nStaging smoke test completed: ${passed} checks passed. No KV writes or Provider upstream requests were made.\n`);
