# Cloudflare Deployment and Verification Guide

## Current deployment status

The repository contains the application code and Wrangler configuration, but no hosted test environment has been provisioned. This guide is a runbook, not authorization to deploy. Do not use production KV, production secrets, or the production Worker during the first verification pass.

The repository currently has:
- A Vue 3 + Vite frontend in `apps/web`.
- A Cloudflare Worker API in `apps/worker`.
- A shared TypeScript workspace package in `packages/shared`.
- One KV namespace binding for source and adapter configuration.
- A SQLite-backed Durable Object export for coordinated upstream rate limits.

The regular GitHub Actions CI workflow is verification-only. A separate manual staging-only Worker deployment workflow is now provided; it is restricted to `feature/adapter-management` and the GitHub `staging` Environment. There is still no automatic Worker deployment on pushes and no production deployment workflow. Pages Git integration can deploy the frontend independently, but it does not deploy this Worker. Automatic production deployment remains deferred until staging verification and an explicit release decision.

## 1. Cloudflare Pages preview project

Use the repository root as the Pages root directory because the frontend imports the shared workspace package.

| Pages setting | Value |
|---|---|
| Root directory | `/` (repository root) |
| Build command | `npm run build --workspace @aio-resource-search/web` |
| Build output directory | `apps/web/dist` |
| Node.js version | `24` |
| Preview branch | `feature/adapter-management` |
| Production branch | `main` |

Set these build-time environment variables separately for Preview and Production:

| Variable | Preview | Production |
|---|---|---|
| `VITE_API_BASE_URL` | HTTPS origin of the staging Worker | HTTPS origin of the production Worker |
| `NODE_VERSION` | `24` | `24` |

The Pages build must not receive an admin token or any Worker secret. `VITE_*` variables are embedded into browser assets and are public.

The frontend now uses `http://localhost:8787` only when running in Vite development mode. A production build with no `VITE_API_BASE_URL` fails at API-request time with an explicit configuration error; it never silently calls the visitor's own localhost. The configured production value must be an HTTPS Worker origin without a path, query, fragment, username, or password.

Cloudflare Pages supports monorepo root-directory and build-output configuration; use the repository root rather than `apps/web` so npm workspaces can resolve `packages/shared`.

## 2. Prepare an isolated staging Worker configuration

Do not deploy `apps/worker/wrangler.jsonc` as-is. It currently contains:
- The generic Worker name `aio-resource-search-api`.
- A placeholder KV namespace ID.
- A local-only `ALLOWED_ORIGINS` value.
- A 15-minute Eporner removal-feed Cron trigger.

Copy the committed staging template to an ignored local file:

```bash
cp apps/worker/wrangler.staging.example.jsonc apps/worker/wrangler.staging.local.jsonc
```

The local file is ignored by Git. In that copy:

1. Confirm `name` remains `aio-resource-search-api-staging`.
2. Create a new, dedicated test KV namespace and replace the placeholder ID with that namespace's ID. Never reuse the production namespace.
3. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the Pages preview deployment. Do not use `*`.
4. Keep the `RATE_LIMIT_COORDINATOR` Durable Object binding and the `RateLimitCoordinator` SQLite export.
5. Keep `triggers.crons` absent in the initial smoke-test environment. The staging template deliberately omits the 15-minute Cron trigger so the Eporner removal-feed sync does not run during basic deployment verification. The scheduled workflow can be tested separately after the Worker and its rate-limit coordinator are verified.

The staging config must remain in `apps/worker` so its existing `main: "src/index.ts"` path resolves correctly. Do not commit this local config or the namespace ID.

For a pre-merge staging deployment from the feature branch, use the local Wrangler CLI path:

```powershell
npm install
npx wrangler login
npx wrangler kv namespace create SOURCES_KV
```

Copy the returned 32-character namespace ID and the Pages Preview origin into the environment, then generate the ignored staging config:

```powershell
$env:CLOUDFLARE_STAGING_KV_NAMESPACE_ID = "<returned-staging-namespace-id>"
$env:CLOUDFLARE_STAGING_ALLOWED_ORIGIN = "https://<your-pages-preview-domain>"
node scripts/prepare-staging-config.mjs
```

The preparation script validates both values, fills the staging template, and writes only the ignored local config. It does not create or modify Cloudflare resources.

From the repository root, validate the staging bundle without publishing it:

```bash
npm install
npx wrangler deploy --dry-run --config apps/worker/wrangler.staging.local.jsonc
```

Only after a separate staging deployment is explicitly approved should the staging Worker be published:

```bash
npx wrangler deploy --config apps/worker/wrangler.staging.local.jsonc
```

After the first staging deployment is approved, set the administrator token interactively:

```bash
npx wrangler secret put ADMIN_API_TOKEN --config apps/worker/wrangler.staging.local.jsonc
```

Wrangler prompts for the value. Do not place the token in a command argument, shell history, or chat.

Wrangler configuration is the source of truth for Worker variables and bindings. Dashboard variables can be overwritten by a later Wrangler deployment if they are not represented in the configuration. Keep the exact CORS origin in the staging config rather than relying on a dashboard-only value.

## 2.1 Optional GitHub Actions staging deployment

A staging-only workflow is available at `.github/workflows/deploy-staging-worker.yml`. It is manual (`workflow_dispatch` only), runs only when the selected ref is `feature/adapter-management`, executes lint/tests/build first, validates the generated Wrangler config, deploys only the staging Worker, and then sets the staging administrator secret. It has no production target and does not run on ordinary commits.

GitHub only exposes a `workflow_dispatch` workflow after its file exists on the repository's default branch. PR #1 is currently unmerged, so this workflow is prepared but will not yet appear as a runnable Actions workflow. Do not merge the feature PR just to expose it; use the local Wrangler CLI path above for pre-merge staging. After the workflow reaches the default branch, it can be manually dispatched against the feature branch.

Before using it:

1. Create a GitHub Environment named `staging`.
2. Add these Environment variables:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_STAGING_KV_NAMESPACE_ID` — the 32-character ID of the dedicated staging KV namespace.
   - `CLOUDFLARE_STAGING_ALLOWED_ORIGIN` — the exact HTTPS Pages preview origin.
3. Add these Environment secrets:
   - `CLOUDFLARE_API_TOKEN` — a least-privilege token for deploying the Worker and managing its required bindings.
   - `STAGING_ADMIN_API_TOKEN` — a unique long random administrator token for staging.
4. In GitHub Actions, select **Deploy staging Worker**, choose `feature/adapter-management`, and run it.

The workflow does not create the KV namespace; create it first and store its returned ID as the staging Environment variable. Consider configuring required reviewers on the GitHub `staging` Environment if deployment approval should be enforced by GitHub. The workflow is deliberately not wired to `push` or PR events.

The same staging config can also be prepared and deployed manually with the Wrangler CLI commands above. Do not configure production secrets or production namespace IDs in the `staging` Environment.

## 3. Configure the staging administrator secret

Use a unique, long random token for the staging Worker. Never reuse a production token, and never put the token in:
- `wrangler.jsonc` or any committed file.
- `VITE_*` frontend variables.
- KV source or adapter records.
- Browser local/session storage.

For local Wrangler development, use the ignored `apps/worker/.dev.vars` file.

For a hosted staging Worker, configure the secret only after the staging Worker has been designated and its first deployment is approved:

```bash
npx wrangler secret put ADMIN_API_TOKEN --config apps/worker/wrangler.staging.local.jsonc
```

This command creates and deploys a new Worker version. It is not a read-only configuration operation.

## 4. First-run KV initialization

A new KV namespace starts with no source or adapter configuration. The Worker intentionally returns empty configuration documents when these keys are absent:

- `sources:config:v1`
- `adapters:config:v1`

After the staging Worker and Pages preview are connected:

1. Open the Pages preview site and enter the staging administrator token in the Adapter Management view.
2. Select **登记内置适配器**. The authenticated endpoint registers all 13 compiled Worker adapters in KV. The operation is idempotent and uses the current ETag.
3. Every newly registered adapter remains disabled. No source is created, enabled, or searched by this operation.
4. Enable only an adapter needed by a separately reviewed source.
5. In Source Management, register the corresponding Provider source with its canonical endpoint, supported search modes, content category, capabilities, timeout, and any required Worker Secret binding.
6. Keep the source disabled until its own policy and technical review is complete. External-search candidates can be bulk-imported from the catalog, but they remain disabled and are never fetched by the Worker.

The source catalog is not a preconfigured live-source list. A catalog entry does not automatically become a KV source, Provider, or enabled search target.

## 5. Smoke-test sequence

Run the repository's read-only smoke-test script against the staging Worker:

```powershell
$env:WORKER_URL = "https://aio-resource-search-api-staging.<account>.workers.dev"
$env:PAGES_ORIGIN = "https://<your-pages-preview-domain>"
npm run smoke:worker
Remove-Item Env:WORKER_URL, Env:PAGES_ORIGIN
```

The script verifies health, exact-origin CORS, rejection of an unlisted origin, public source/adapter response shapes, administrator preflight, and that unauthenticated administrator requests are rejected. It performs no KV writes and makes no Provider upstream requests. To additionally test an authenticated administrator read in PowerShell, enter the token through a secure prompt:

```powershell
$secureToken = Read-Host "Staging admin token" -AsSecureString
$env:ADMIN_API_TOKEN = [System.Net.NetworkCredential]::new("", $secureToken).Password
npm run smoke:worker
Remove-Item Env:ADMIN_API_TOKEN
Remove-Variable secureToken
```

The script never prints the token.

The script complements rather than replaces the following manual checks:

1. `GET /api/health` — confirms the Worker is responding.
2. `GET /api/sources` — confirms the source KV binding is readable; an empty list is expected on first boot.
3. `GET /api/adapters` — confirms the adapter configuration endpoint; an empty list is expected until adapter registration and enablement.
4. Open Adapter Management and register built-in adapters. Confirm the newly registered adapters are all disabled.
5. Open Source Management and verify administrator authentication, read/write, ETag updates, stale-version conflict handling, and that secret-binding names are not exposed publicly.
6. Add one source only after its source-specific review. Use the administrator's **测试连接** and **测试搜索** actions to verify the actual Worker-to-provider request.
7. Verify CORS from the exact Pages preview origin and verify that an unlisted origin receives HTTP 403.
8. Verify the Durable Object coordinator with hosted, bounded test requests. Do not deliberately exhaust account quotas or enable paid services.
9. Test the generic HTML adapter against a reviewed source only after confirming the hosted HTMLRewriter behavior.

A successful health endpoint does not prove that KV, Durable Objects, CORS, admin authorization, Provider connectivity, or the frontend are working. Record each check separately.

## 6. Production is a separate release

Do not copy staging IDs or secrets into production. Production requires its own:
- Worker configuration and KV namespace.
- `ADMIN_API_TOKEN` secret.
- Exact Pages production origin in `ALLOWED_ORIGINS`.
- Pages Production `VITE_API_BASE_URL`.
- Source enablement review and jurisdiction-specific launch assessment.

Production deployment, production KV writes, source enablement, and PR merge remain separate release actions requiring explicit approval.

## Official Cloudflare references

- [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Wrangler configuration and environments](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Worker environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Durable Object class exports and SQLite storage](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Wrangler Worker secrets](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [GitHub Actions workflow_dispatch default-branch requirement](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
