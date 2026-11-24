# AIOResourceSearch

A multi-source resource search and aggregation platform.

## Project scope

AIOResourceSearch provides one search entry point for multiple independently adapted sources. Its core responsibilities are source integration, search orchestration, result normalization, deduplication, result presentation, and links supplied by authorized sources.

Source categories:

- JAV metadata sources
- BT / Torrent indexers
- Forums
- Other resource indexes

The application does not host media files. It does not include user accounts, cloud favorites, search history, a media library, or cross-device user-data synchronization.

The only planned browser-persisted preferences are the image-display toggle and theme.

## Architecture

- `apps/web`: Vue 3 + TypeScript + Vite frontend, deployed to Cloudflare Pages.
- `apps/worker`: Cloudflare Worker API, deployed independently.
- `packages/shared`: shared TypeScript contracts.
- Cloudflare KV: shared source configuration only. No D1 database is planned.

See [docs/architecture.md](docs/architecture.md) for boundaries and data flow.

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

The Worker requires a KV namespace binding before remote deployment. Create one:

```bash
npx wrangler kv namespace create SOURCES_KV
```

Copy the returned namespace ID into `apps/worker/wrangler.jsonc`, replacing the clearly marked placeholder. Do not commit API tokens or other secrets.

For local admin API testing, create `apps/worker/.dev.vars` with:

```dotenv
ADMIN_API_TOKEN=replace-with-a-long-random-local-secret
```

The file is ignored by Git. Configure the production token with:

```bash
npx wrangler secret put ADMIN_API_TOKEN --config apps/worker/wrangler.jsonc
```

Set `ALLOWED_ORIGINS` to the exact frontend origin(s) in the Worker environment. The checked-in value is for local Vite development only.

## Current implementation status

- [x] Initial monorepo structure
- [x] Shared source configuration contract
- [x] Worker health endpoint
- [x] Public enabled-source endpoint
- [x] Protected source configuration CRUD API backed by KV
- [ ] Frontend source-management interface
- [ ] Provider adapter registry and provider audits
- [ ] Search orchestration and result normalization
- [ ] Result presentation and resource-link actions
- [ ] Deployment and end-to-end verification

A configured source is not automatically searchable: its adapter must exist in code and its access method must be permitted by the source operator.

## Source access and safety

Only integrate sources and endpoints that permit the intended automated access and display. Public visibility alone does not establish permission. Do not bypass authentication, paywalls, access controls, or anti-bot protections. Do not ingest or distribute illegal content or non-consensual intimate material. Keep credentials in Worker secrets, never in source configuration committed to this public repository.
