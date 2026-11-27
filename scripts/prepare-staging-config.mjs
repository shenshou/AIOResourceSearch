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

if (output.includes("REPLACE_WITH_") || /"triggers"\s*:/.test(output)) {
  throw new Error("The generated staging config still contains placeholders or an unexpected scheduled trigger.");
}

writeFileSync(outputPath, output, { encoding: "utf8" });
process.stdout.write("Prepared isolated staging Wrangler config. No Cloudflare resources were changed.\n");
