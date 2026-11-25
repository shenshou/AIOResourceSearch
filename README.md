# AIOResourceSearch

A multi-category, multi-mechanism resource search and aggregation platform.

## Project scope

AIOResourceSearch provides one search entry point for multiple independently adapted sources. Its core responsibilities are source integration, search orchestration, result normalization, deduplication, result presentation, and links supplied by authorized sources.

Source categories:

- JAV / adult video metadata
- Anime and animation
- Films and television
- Manga and comics
- Novels and books
- Games
- Music
- General public resource indexes

Content categories are independent from source kinds (JAV site, torrent index, forum, or other index).

The application does not host media files. It does not include user accounts, cloud favorites, search history, a media library, or cross-device user-data synchronization.

The only planned browser-persisted preferences are the image-display toggle and theme.

## Source catalog

The candidate source inventory collected from Atlas, Lustpress, and FetchJAV is documented in [docs/source-catalog.md](./docs/source-catalog.md). Sources are not automatically enabled: each candidate must be checked for canonical URLs, search URL format, access policy, and Cloudflare Workers compatibility.

The platform distinguishes Worker-backed **Provider** sources from **External Search** entries. External Search only generates a user-opened HTTPS search link and does not trigger a Worker fetch.

## Architecture

- `apps/web`: Vue 3 + TypeScript + Vite frontend, deployed to Cloudflare Pages.
- `apps/worker`: Cloudflare Worker API, deployed independently.
- `packages/shared`: shared TypeScript contracts.
- Cloudflare KV: source and adapter management configuration in one namespace, stored under separate keys. No D1 database is planned.

See [docs/architecture.md](docs/architecture.md) for boundaries and data flow, [docs/development-standards.md](docs/development-standards.md) for implementation and review rules, and [docs/development-roadmap.md](docs/development-roadmap.md) for phases, delivery criteria, and outstanding verification.

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

The frontend defaults to `http://localhost:8787` for the Worker API. Override it with `VITE_API_BASE_URL` (see [apps/web/.env.example](apps/web/.env.example)).

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
- [x] Frontend source-management interface (CRUD, enable/disable, in-memory admin token)
- [x] Adapter metadata contract and KV-backed administration API
- [x] Adapter-management UI (CRUD, implementation status, enable/disable)
- [x] Runtime Provider interface and compile-time adapter registry
- [x] Content-category model and category-filtered search
- [x] API, RSS, and configurable HTML acquisition mechanisms
- [x] Four site-specific API/RSS providers plus reusable HTML adapter
- [ ] Per-source HTML selector review and live Cloudflare connectivity verification
- [x] Search orchestration, per-source timeout/failure isolation, result validation, and URL deduplication
- [x] Frontend aggregated-search page, result presentation, and resource-link actions
- [x] Worker scheduler unit tests (availability, compatibility, normalization, deduplication, failure isolation, timeout, result cap, and concurrency)
- [ ] Deployment and end-to-end verification

Source and adapter metadata changes are runtime operations: they update KV and do not require a Pages or Worker deployment. KV is eventually consistent, so propagation may be delayed briefly. Adapter records are metadata only; the Worker accepts an adapter as usable only when its ID is registered in the compile-time Provider registry (`apps/worker/src/providers/registry.ts`). New adapter code or protocol support still requires a Worker deployment.

A configured source is not automatically searchable: its adapter must exist in code and its access method must be permitted by the source operator.

## Source access and safety

Only integrate sources and endpoints that permit the intended automated access and display. Public visibility alone does not establish permission. Do not bypass authentication, paywalls, access controls, or anti-bot protections. Do not ingest or distribute illegal content or non-consensual intimate material. Keep credentials in Worker secrets, never in source configuration committed to this public repository.
