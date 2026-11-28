# AIOResourceSearch

AIOResourceSearch is a multi-category, multi-source resource search and aggregation platform. It provides one search entry point for independently adapted sources, normalizes metadata, deduplicates result URLs, and presents source-attributed destinations.

Adult/JAV-related search and source management are a core product pillar, not an optional category. The project also supports broader content categories through the same aggregation architecture.

## Product boundaries

- The application does not host, stream, or download media files.
- It is not a local media manager or download client.
- It does not provide user accounts, cloud favorites, search history, or cross-device personal-data synchronization.
- Worker-backed Provider sources are distinct from external-search entries. External-search entries only generate a user-opened HTTPS destination and are never fetched by the Worker.
- A source catalog entry is a research candidate, not an enabled or approved source.

## Documentation

Start at the **[Documentation Center](docs/README.md)**.

Key references:

- [User guide](docs/product/user-guide.md)
- [Administrator guide](docs/product/admin-guide.md)
- [UI design and shared components](docs/design/ui-system.md)
- [Worker API contract](docs/api/worker-api.md)
- [Deployment and operations runbook](docs/operations/runbook.md)
- [Documentation maintenance rules](docs/governance/documentation-standards.md)
- [Architecture](docs/architecture.md)
- [Development standards](docs/development-standards.md)
- [Source catalog governance](docs/source-catalog-policy.md)
- [Provider-specific documentation](docs/providers/)

## Architecture

- `apps/web`: Vue 3 + TypeScript + Vite frontend, deployed to Cloudflare Pages.
- `apps/worker`: Cloudflare Worker API and Provider implementations.
- `packages/shared`: shared TypeScript contracts.
- Cloudflare KV: source and adapter configuration, stored under separate versioned keys.
- Durable Objects: shared upstream rate-limit coordination where required.

Pages and Worker are separate deployable targets. Staging and Production use separate Pages projects, Workers, KV namespaces, Durable Object storage, origins, and administrator secrets. See [the deployment guide](docs/cloudflare-deployment.md) and [the operations runbook](docs/operations/runbook.md).

## Local development

Requirements: Node.js 20.19+ (Node.js 24 is suitable) and npm.

```bash
npm install
npm run dev:web
```

In a second terminal:

```bash
npm run dev:worker
```

Run static checks with:

```bash
npm run lint
npm run build
```

The frontend uses `http://localhost:8787` only in Vite development mode. Production builds require `VITE_API_BASE_URL` to be set to the corresponding Worker HTTPS origin; they do not fall back to the visitor's localhost. See [apps/web/.env.example](apps/web/.env.example) and [the Cloudflare deployment guide](docs/cloudflare-deployment.md).

The base `apps/worker/wrangler.jsonc` is for local development. Hosted environments use separate Staging and Production templates and KV namespaces. Never reuse a KV namespace between environments, and never commit API tokens or other secrets.

For local admin API testing, create the ignored `apps/worker/.dev.vars` file:

```dotenv
ADMIN_API_TOKEN=replace-with-a-long-random-local-secret
```

Do not run `wrangler secret put` or `wrangler deploy` as part of ordinary local setup. Secret updates deploy a new Worker version; hosted deployment and recovery must follow the environment-specific runbook.

## Source catalog and access policy

The candidate source inventory collected from Atlas, Lustpress, and FetchJAV is documented in [the source catalog](docs/source-catalog.md). Retention, evidence, review, and reconciliation rules are mandatory under [the source catalog governance policy](docs/source-catalog-policy.md) and [development standards](docs/development-standards.md).

Sources are not automatically enabled. Each candidate requires source-specific review of canonical URLs, search behavior, access rules, data use, and Cloudflare Workers compatibility. A deferred or currently unreachable candidate remains in the inventory unless a documented removal criterion is met.

Do not implement or enable acquisition paths that require bypassing authentication, paywalls, CAPTCHA, anti-bot protections, geographic/IP restrictions, rate limits, or other access controls. Such candidates may remain documented for future research, but no bypass is pre-approved. Do not ingest or distribute illegal content or non-consensual intimate material.

## Environment status

Deployment status changes independently of repository documentation. Consult the [operations runbook](docs/operations/runbook.md) for the dated handover snapshot, and verify current GitHub Actions and Cloudflare state before making operational decisions.
