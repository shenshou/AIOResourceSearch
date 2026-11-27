# Cloudflare Deployment and Verification Guide

## Current deployment status

The repository uses two isolated Cloudflare Pages projects and two isolated Worker environments. The Git branch model is feature/fix → develop (Staging) → main (Production). No Pages project, KV namespace, Worker, or production secret is created by GitHub code changes alone. This guide is a runbook; provisioning Cloudflare resources and enabling deployment remain account-side setup steps.

The repository currently has:
- A Vue 3 + Vite frontend in `apps/web`.
- A Cloudflare Worker API in `apps/worker`.
- A shared TypeScript workspace package in `packages/shared`.
- One KV namespace binding for source and adapter configuration.
- A SQLite-backed Durable Object export for coordinated upstream rate limits.

GitHub Actions validates PRs targeting develop or main. The Staging Worker workflow validates and deploys develop; the Production Worker workflow deploys only the exact main commit after its CI workflow succeeds. Both deployments are guarded by an explicit GitHub Environment variable (STAGING_DEPLOY_ENABLED or PRODUCTION_DEPLOY_ENABLED) so missing Cloudflare setup cannot accidentally publish. Cloudflare Pages Git integration independently deploys two Pages projects from the same repository: the Staging project's production branch is develop, and the Production project's production branch is main.

## 1. Two Cloudflare Pages websites

Create two separate Pages projects connected to the same GitHub repository, shenshou/AIOResourceSearch. Cloudflare Pages supports multiple projects from one repository; each project must have a unique project name. Configure each project's production branch independently.

Use the repository root as each Pages project's root directory because the frontend imports the shared workspace package.

| Setting | Staging Pages project | Production Pages project |
|---|---|---|
| Suggested project name | aio-resource-search-staging | aio-resource-search |
| Git repository | shenshou/AIOResourceSearch | Same repository |
| Production branch | develop | main |
| Root directory | / (repository root) | / (repository root) |
| Build command | npm run build --workspace @aio-resource-search/web | Same |
| Build output directory | apps/web/dist | Same |
| Node.js version | 24 | 24 |
| Production VITE_API_BASE_URL | Staging Worker HTTPS origin | Production Worker HTTPS origin |

Both projects use the same source tree but different branch and environment settings. A push to develop updates the Staging website; a push to main updates the Production website. The Staging project's preview branch controls may include feature/* and fix/* so PR previews can be reviewed before merging. The Production project's preview deployments should be disabled or restricted; never expose a preview build configured with production credentials or production-only endpoints.

Set VITE_API_BASE_URL in each project's Production build environment to its corresponding Worker origin. If you enable Preview deployments for the Staging project, set its Preview VITE_API_BASE_URL to the Staging Worker as well. Do not set any admin token in Pages: VITE_* variables are embedded in public browser assets.

Configure build watch paths on both projects to avoid duplicate builds for unrelated repository changes. At minimum include apps/web/**, packages/shared/**, the root package manifests/lockfile, and any frontend build configuration used by Vite. Exclude Worker-only and docs-only changes where possible. Cloudflare Pages otherwise builds on changes anywhere in the connected repository by default.

The frontend uses http://localhost:8787 only in Vite development mode. A production build without VITE_API_BASE_URL fails at API-request time with an explicit configuration error; it never silently calls the visitor's own localhost. Each configured API origin must be HTTPS and must not contain a path, query, fragment, username, or password.

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
3. Set `ALLOWED_ORIGINS` to the exact HTTPS origin of the Staging Pages website. Do not use `*`.
4. Keep the `RATE_LIMIT_COORDINATOR` Durable Object binding and the `RateLimitCoordinator` SQLite export.
5. Keep `triggers.crons` absent in the initial smoke-test environment. The staging template deliberately omits the 15-minute Cron trigger so the Eporner removal-feed sync does not run during basic deployment verification. The scheduled workflow can be tested separately after the Worker and its rate-limit coordinator are verified.

The staging config must remain in `apps/worker` so its existing `main: "src/index.ts"` path resolves correctly. Do not commit this local config or the namespace ID.

For initial Staging bootstrap before the GitHub Environment is configured, use the local Wrangler CLI path. This is an alternative to the automated workflow, not a separate permanent deployment process:

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

The regular full CI generates both Staging and Production Wrangler configs with non-secret fixture values and invokes Wrangler `--dry-run` against each. This validates both binding/export contracts and Worker bundles without authenticating to Cloudflare or deploying resources.

From the repository root, validate the staging bundle without publishing it:

```bash
npm install
npx wrangler deploy --dry-run --config apps/worker/wrangler.staging.local.jsonc
```

When the GitHub Staging Environment is configured and STAGING_DEPLOY_ENABLED is true, the develop workflow publishes the Staging Worker automatically. For a one-time manual bootstrap or recovery, the local CLI command is:

```bash
npx wrangler deploy --config apps/worker/wrangler.staging.local.jsonc
```

After the first staging deployment is approved, set the administrator token interactively:

```bash
npx wrangler secret put ADMIN_API_TOKEN --config apps/worker/wrangler.staging.local.jsonc
```

Wrangler prompts for the value. Do not place the token in a command argument, shell history, or chat.

Wrangler configuration is the source of truth for Worker variables and bindings. Dashboard variables can be overwritten by a later Wrangler deployment if they are not represented in the configuration. Keep the exact CORS origin in the staging config rather than relying on a dashboard-only value.

## 2.1 Automatic Staging Worker deployment

The workflow at .github/workflows/deploy-staging-worker.yml is triggered by relevant Worker/shared-code pushes to develop and can also be manually dispatched against develop once the workflow is present on the default branch. It runs lint, Worker unit tests, Durable Object runtime tests, frontend build/type-check, config generation, and Wrangler dry-run before deploying only aio-resource-search-api-staging. It never targets Production resources. Until this workflow is available from the default branch, the develop push trigger is the automatic path; use local Wrangler only if the initial hosted setup must happen earlier.

Before enabling automatic deployment, create a GitHub Environment named staging and configure:

**Environment variables**
- STAGING_DEPLOY_ENABLED=true — deployment guard; set this to true only after all Staging values are ready.
- CLOUDFLARE_ACCOUNT_ID — 32-character Cloudflare account ID.
- CLOUDFLARE_STAGING_KV_NAMESPACE_ID — ID of the dedicated Staging KV namespace.
- CLOUDFLARE_STAGING_ALLOWED_ORIGIN — exact HTTPS origin of the Staging Pages project.

**Environment secrets**
- CLOUDFLARE_API_TOKEN — least-privilege token for deploying the Staging Worker and managing its required bindings.

The workflow deliberately does not set ADMIN_API_TOKEN on every deployment. Set the Staging administrator secret once, after the first Staging Worker deployment, using wrangler secret put (see the next section). Secret rotation is a separate deliberate operation. Never reuse the Production administrator token.

The workflow does not create the KV namespace or Pages project. Create those resources in Cloudflare first, then set the Environment values. Until STAGING_DEPLOY_ENABLED=true is set, pushes to develop will not deploy a Worker.

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

Run the repository's read-only smoke-test script against the Staging Worker:

```powershell
$env:WORKER_URL = "https://aio-resource-search-api-staging.<account>.workers.dev"
$env:PAGES_ORIGIN = "https://<your-staging-pages-domain>"
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

## 6. Production Worker deployment

Production is isolated from Staging. It has its own Worker, KV namespace, Durable Object storage, administrator secret, and Pages origin. Never copy Staging IDs or secrets into Production.

The committed template is apps/worker/wrangler.production.example.jsonc. The generator scripts/prepare-production-config.mjs validates the Production KV namespace ID and exact HTTPS Pages origin, then writes the ignored local file apps/worker/wrangler.production.local.jsonc. It preserves the existing 15-minute Eporner removal-feed Cron schedule used by the Production Worker; the Staging template intentionally has no Cron trigger.

To prepare and validate the Production configuration locally (without deploying):

~~~powershell
$env:CLOUDFLARE_PRODUCTION_KV_NAMESPACE_ID = "<production-kv-namespace-id>"
$env:CLOUDFLARE_PRODUCTION_ALLOWED_ORIGIN = "https://<production-pages-domain>"
node scripts/prepare-production-config.mjs
npx wrangler deploy --dry-run --config apps/worker/wrangler.production.local.jsonc
~~~

The Production GitHub Actions workflow is .github/workflows/deploy-production-worker.yml. It listens for a successful CI workflow run on main and deploys the exact commit verified by that run when Worker-affecting files changed. It also supports a manual dispatch restricted to main, which forces a Worker deployment. It does not deploy on PRs or feature/develop branches.

Before enabling Production deployment, create a GitHub Environment named production and configure:

**Environment variables**
- PRODUCTION_DEPLOY_ENABLED=true — deployment guard; leave unset/false until the first Production deployment is explicitly ready.
- CLOUDFLARE_ACCOUNT_ID — Cloudflare account ID.
- CLOUDFLARE_PRODUCTION_KV_NAMESPACE_ID — ID of the dedicated Production KV namespace.
- CLOUDFLARE_PRODUCTION_ALLOWED_ORIGIN — exact HTTPS origin of the Production Pages project.

**Environment secrets**
- CLOUDFLARE_API_TOKEN — least-privilege token for deploying the Production Worker.

Set the Production ADMIN_API_TOKEN once after the first Production Worker deployment, using wrangler secret put ADMIN_API_TOKEN --config apps/worker/wrangler.production.local.jsonc. Keep it different from the Staging token. Do not put it in GitHub Pages variables, VITE_* settings, source configuration, or the repository.

After the Pages projects, Worker configuration, KV namespaces, and secrets are provisioned, the release flow is:

1. Merge a completed feature PR into develop; Pages deploys the Staging site and the Staging Worker workflow runs.
2. Validate the Staging site, admin CRUD, ETag behavior, CORS, KV isolation, Durable Object behavior, and the required Provider connectivity.
3. Open a release PR from develop to main and merge only after acceptance.
4. Pages deploys the Production site from main. After the main-branch CI succeeds, the Production Worker workflow deploys the matching verified commit.

The PRODUCTION_DEPLOY_ENABLED guard remains false until the Production account resources and secrets have been deliberately configured. GitHub code changes alone do not provision or deploy Cloudflare resources. Production KV initialization, built-in Adapter registration, and source enablement remain separate controlled operations.

## Official Cloudflare references

- [Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pages monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- [Wrangler configuration and environments](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Worker environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Durable Object class exports and SQLite storage](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [Wrangler Worker secrets](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [GitHub Actions workflow_dispatch default-branch requirement](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
