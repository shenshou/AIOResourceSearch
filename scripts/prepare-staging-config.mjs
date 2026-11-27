import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const templatePath = resolve(repositoryRoot, "apps/worker/wrangler.staging.example.jsonc");
const outputPath = resolve(repositoryRoot, "apps/worker/wrangler.staging.local.jsonc");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}

const namespaceId = required("CLOUDFLARE_STAGING_KV_NAMESPACE_ID");
if (!/^[a-f0-9]{32}$/i.test(namespaceId)) {
  throw new Error("CLOUDFLARE_STAGING_KV_NAMESPACE_ID must be a 32-character hexadecimal KV namespace ID.");
}

const allowedOriginValue = required("CLOUDFLARE_STAGING_ALLOWED_ORIGIN");
let allowedOrigin;
try {
  const parsed = new URL(allowedOriginValue);
  if (
    parsed.protocol !== "https:" ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("not an HTTPS origin");
  }
  allowedOrigin = parsed.origin;
} catch {
  throw new Error("CLOUDFLARE_STAGING_ALLOWED_ORIGIN must be an HTTPS origin without a path, query, fragment, or credentials.");
}

const template = readFileSync(templatePath, "utf8");
const output = template
  .replace("REPLACE_WITH_STAGING_KV_NAMESPACE_ID", namespaceId)
  .replace("https://REPLACE_WITH_PAGES_PREVIEW_ORIGIN", allowedOrigin);

if (output.includes("REPLACE_WITH_")) {
  throw new Error("The generated staging config still contains an unresolved placeholder.");
}

const config = JSON.parse(output);
if (
  config.name !== "aio-resource-search-api-staging" ||
  config.main !== "src/index.ts" ||
  config.vars?.ALLOWED_ORIGINS !== allowedOrigin ||
  !config.kv_namespaces?.some((binding) => binding.binding === "SOURCES_KV" && binding.id === namespaceId) ||
  !config.durable_objects?.bindings?.some((binding) => binding.name === "RATE_LIMIT_COORDINATOR" && binding.class_name === "RateLimitCoordinator") ||
  config.exports?.RateLimitCoordinator?.storage !== "sqlite" ||
  config.triggers?.crons?.length
) {
  throw new Error("The generated config does not match the isolated staging Worker contract.");
}

writeFileSync(outputPath, output, { encoding: "utf8" });
process.stdout.write("Prepared isolated staging Wrangler config. No Cloudflare resources were changed.\n");
