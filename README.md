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


Adult/JAV-related search, metadata, and source management are a core product pillar of this project, not an optional category. The source inventory is intended to support progressive development of additional in-scope sources over time. Technical research may learn from other open-source implementations and is not limited to official APIs; implementation feasibility, access restrictions, and data-use permission must be evaluated separately. See [the source catalog governance policy](docs/source-catalog-policy.md).

## Source catalog

The candidate source inventory collected from Atlas, Lustpress, and FetchJAV is documented in [docs/source-catalog.md](./docs/source-catalog.md). Its retention, evidence, review, and reconciliation rules are defined in [docs/source-catalog-policy.md](./docs/source-catalog-policy.md) and are mandatory under [docs/development-standards.md](./docs/development-standards.md). Sources are not automatically enabled: each candidate must be checked for canonical URLs, search URL format, access policy, and Cloudflare Workers compatibility. A deferred or currently unreachable source remains in the inventory unless a documented removal criterion is met.

The platform distinguishes Worker-backed **Provider** sources from **External Search** entries. External Search only generates a user-opened HTTPS search link and does not trigger a Worker fetch.

## Architecture

- `apps/web`: Vue 3 + TypeScript + Vite frontend, deployed to Cloudflare Pages.
- `apps/worker`: Cloudflare Worker API, deployed independently.
- `packages/shared`: shared TypeScript contracts.
- Cloudflare KV: source and adapter management configuration in one namespace, stored under separate keys. No D1 database is planned.

See [docs/architecture.md](docs/architecture.md) for boundaries and data flow, [docs/development-standards.md](docs/development-standards.md) for implementation and review rules, and [docs/development-roadmap.md](docs/development-roadmap.md) for phases, delivery criteria, and outstanding verification. Age-assurance scope and implementation gates are recorded in [docs/age-assurance-readiness.md](docs/age-assurance-readiness.md). Reusable Vue component contracts are listed in [docs/frontend-components.md](docs/frontend-components.md). Shared upstream API quota handling is documented in [docs/provider-rate-limiting.md](docs/provider-rate-limiting.md), candidate API contracts and implementation gates are documented in [docs/provider-integration-readiness.md](docs/provider-integration-readiness.md), source-inventory governance is defined in [docs/source-catalog-policy.md](docs/source-catalog-policy.md), the MangaDex metadata-only implementation is specified in [docs/providers/mangadex-api.md](docs/providers/mangadex-api.md), and JAV work identity plus field-level merge behavior are specified in [docs/providers/jav-metadata-aggregation.md](docs/providers/jav-metadata-aggregation.md).

## Local development

Requirements: Node.js 20.19+ (Node.js 24 is suitable) and npm.

```bash
npm install
npm run dev:web
```

Run the static code checks with `npm run lint`. To format the frontend and shared TypeScript sources, use `npm run format` after reviewing the scope of the changes.

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

The file is ignored by Git and is used only by local Wrangler development. The hosted Cloudflare verification environment has not yet been provisioned. Do not run `wrangler secret put`, `wrangler deploy`, or create/update production KV resources as part of local setup: `wrangler secret put` creates a new Worker version and deploys it immediately. Hosted credentials and bindings must be configured only after a dedicated non-production Worker and test KV namespace have been designated; production rollout is a separate, explicitly approved phase.

Set `ALLOWED_ORIGINS` to the exact frontend origin(s) in the relevant Worker environment. The checked-in value is for local Vite development only.

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
- [x] Ten site-specific API/RSS Providers plus reusable HTML adapter; code registration, KV configuration, enablement, and Hosted Cloudflare verification are tracked separately
- [ ] Per-source HTML selector review and live Cloudflare connectivity verification
- [x] Search orchestration, per-source timeout/failure isolation, result validation, and URL deduplication
- [x] Frontend aggregated-search page, result presentation, and resource-link actions
- [x] Worker scheduler unit tests (availability, compatibility, normalization, deduplication, failure isolation, timeout, result cap, and concurrency)
- [ ] Deployment and end-to-end verification

Source and adapter metadata changes are runtime operations: they update KV and do not require a Pages or Worker deployment. KV is eventually consistent, so propagation may be delayed briefly. Adapter records are metadata only; the Worker accepts an adapter as usable only when its ID is registered in the compile-time Provider registry (`apps/worker/src/providers/registry.ts`). New adapter code or protocol support still requires a Worker deployment.

A configured source is not automatically searchable: its adapter must exist in code and its access method must be permitted by the source operator.

## Source access and safety

Public visibility alone does not establish permission for automated access or display. In the current development phase, do not implement or enable acquisition paths requiring bypass of authentication, paywalls, CAPTCHA, anti-bot protections, geo/IP restrictions, rate limits, or other access controls. These paths are deferred, not permanently excluded: a later phase may explicitly research and assess technical solutions under the source-specific legal, contractual, platform, authorization, security, and privacy review defined in [the source catalog governance policy](docs/source-catalog-policy.md). No future bypass or integration is pre-approved. Do not ingest or distribute illegal content or non-consensual intimate material. Keep credentials in Worker secrets, never in source configuration committed to this public repository.
