# Development Roadmap

This document is the project-level execution plan. It tracks delivery phases, acceptance criteria, dependencies, and outstanding verification. It complements (but does not replace) the architecture, source catalog, and source-review documents.

## Product objective

Deliver a maintainable, multi-category, multi-source search aggregator with a Vue frontend and a Cloudflare Worker API. The system searches only reviewed sources through implemented adapters, normalizes and deduplicates results, attributes every result to its source, and exposes user-opened external links where Worker-side retrieval is unavailable or not permitted.

The product does not host media, manage personal libraries, provide accounts, save search history/favorites, or synchronize user data.

## Delivery principles

1. Preserve the agreed product boundary and the Vue 3 + TypeScript + Vite / Cloudflare Pages + Workers + KV architecture.
2. Keep content categories independent from source kinds and acquisition mechanisms.
3. Prefer documented APIs and public RSS/Atom feeds. Use HTML parsing only after per-source review; external-search links are not Worker scraping.
4. Keep executable adapter code in the Worker bundle. KV stores configuration and administrative metadata only.
5. Preserve high cohesion, low coupling, explicit data flow, and clear separation between request orchestration, business logic, and presentation.
6. Do not split files merely to reduce line count. Extract modules only when they establish a stable responsibility boundary or improve testability.
7. Make changes incrementally. Preserve existing API paths, payload contracts, security checks, and user-visible behavior unless a separately reviewed change explicitly requires otherwise.
8. Keep the current test approach (tsx --test / Node test runner). Do not introduce another test framework without a concrete need and an explicit decision.
9. Do not deploy production resources, change production KV, merge the feature PR, or enable unreviewed sources as part of ordinary implementation work.
10. Treat live Cloudflare connectivity, real HTMLRewriter behavior, and source-specific access permission as separate verification gates; unit tests alone cannot prove them.

## Phase 0 — Product and architecture baseline

**Status: Complete**

Deliverables:
- [x] Monorepo with apps/web, apps/worker, and packages/shared.
- [x] Vue 3 + TypeScript + Vite frontend and Cloudflare Worker API.
- [x] Shared source, adapter, category, and API contracts.
- [x] Cloudflare KV configuration model with separate source and adapter keys.
- [x] Eight content categories and independent source-kind classification.
- [x] Explicit separation of Worker-backed Providers and browser-opened external-search entries.
- [x] Product non-goals and access-policy boundaries documented.

Acceptance:
- Frontend, Worker, and shared contracts remain independently understandable.
- No D1 database, media hosting, user accounts, cloud favorites/history, or arbitrary code execution from KV is introduced.

## Phase 1 — Core search and source administration

**Status: Implemented; live deployment verification remains open**

Deliverables:
- [x] Source configuration CRUD, enable/disable, validation, and ETag/revision preconditions.
- [x] Adapter metadata CRUD and implementation-registry checks.
- [x] Protected administration endpoints using the Worker secret.
- [x] Public source and adapter listings with private fields filtered.
- [x] Search orchestration, per-source timeout/failure isolation, normalization, deduplication, and result caps.
- [x] Frontend source and adapter management screens.
- [x] External-search URL generation without fetching the destination.
- [ ] Verify KV propagation and management flows in a non-production Cloudflare environment.

Acceptance:
- Configuration changes take effect through KV without rebuilding Pages or redeploying the Worker.
- New executable adapters still require a Worker code deployment.
- Admin-only fields and credentials never appear in public responses or browser persistence.
- Stale configuration writes are rejected through version preconditions; documentation continues to state that KV is not a transactional lock.

## Phase 2 — Engineering quality and maintainability

**Status: In progress**

### 2.1 Worker boundaries
- [x] Add HTTP route-level tests for health, CORS, malformed search requests, public filtering, and admin authorization/configuration.
- [x] Split the Worker entry point along real responsibility boundaries: HTTP response/CORS utilities, configuration access, validation, and source/adapter administration.
- [x] Keep the entry point as a thin composition layer.
- [ ] Add focused tests around configuration validation and critical management invariants where extraction makes them independently testable.

Acceptance:
- Existing API paths, HTTP methods, status codes, response shapes, ETag behavior, CORS behavior, authentication, KV keys, and validation rules remain unchanged.
- Worker tests, frontend production build, and Worker type-check pass in CI.
- No duplicate validation or parallel configuration implementation is introduced.

### 2.2 Frontend boundaries
- [ ] Audit SearchPage.vue and separate request orchestration/state from result presentation only where responsibilities are genuinely mixed.
- [ ] Review current navigation and view switching; introduce Vue Router if route depth, direct linking, refresh behavior, or navigation complexity justifies it.
- [ ] Review state ownership before considering Pinia. Do not move local component state into a global store without a cross-view sharing requirement.
- [ ] Establish a small reusable UI foundation for repeated primitives and interaction patterns; avoid creating abstractions for one-off elements.
- [ ] Evaluate Lucide Vue Next, ESLint, and Prettier against existing dependencies and code style before adding them. Adopt incrementally and avoid broad formatting churn.

Acceptance:
- Container/page components coordinate data and state; display components receive explicit props and emit explicit events.
- No unnecessary global state or component fragmentation.
- Shared components have documented purpose, props, events, slots (where applicable), and concise usage examples.
- Existing visual behavior and accessibility are not regressed. A dedicated accessibility pass remains a later explicit quality task.

### 2.3 Documentation and delivery hygiene
- [x] Add this project-level roadmap and link it from the README.
- [x] Add a dedicated development standards document and link it from the README.
- [ ] Keep implementation status and phase acceptance criteria current as work lands.
- [ ] Document new adapter contracts and operational behavior alongside code changes.

## Phase 3 — Source coverage and adapter ecosystem

**Status: Partially implemented; ongoing source review**

Deliverables:
- [x] Provider registry and shared result contract.
- [x] API, RSS/Atom, and generic HTML acquisition mechanisms.
- [x] Four site-specific Provider implementations and the reusable generic-html adapter.
- [x] Candidate source catalog and evidence-based review log.
- [ ] Expand reviewed, permitted source coverage for anime, film/TV, manga, novels, games, music, and general resources.
- [ ] For each candidate, record the canonical endpoint, acquisition method, access/usage conditions, supported fields, attribution requirements, quotas/cache guidance, and Worker compatibility.
- [ ] Implement additional adapters only when a stable interface and permitted automated access are established.
- [ ] Add per-source fixtures and tests; keep uncertain sources as disabled candidates or external-search entries.

Acceptance:
- A catalog entry is never represented as an implemented Provider unless its adapter is registered and tested.
- No paid API is introduced.
- No login, paywall, CAPTCHA, anti-bot challenge, geo restriction, rate limit, or other access control is bypassed.
- Source-specific permissions, attribution, removal/takedown procedures, and content/legal scope are reviewed before enabling.
- New content categories are supported by actual source coverage, not merely by a category selector or generic type definitions.

## Phase 4 — Real Cloudflare integration verification

**Status: Not started; requires a dedicated test environment**

Deliverables:
- [ ] Create or designate a non-production Cloudflare Pages + Worker test environment.
- [ ] Bind a test KV namespace and configure test-only ADMIN_API_TOKEN and exact ALLOWED_ORIGINS.
- [ ] Verify public API, admin CRUD, ETag conflicts, CORS, and KV propagation end to end.
- [ ] Verify the real Cloudflare HTMLRewriter runtime with representative HTML fixtures and at least one reviewed source configuration.
- [ ] Test live Provider connectivity individually, recording success, failure, response behavior, and any source-side restrictions.
- [ ] Keep providers disabled when ordinary Worker requests are blocked or terms/permissions remain unclear; do not attempt bypasses.

Acceptance:
- Tests run against the actual Cloudflare runtime, not only mocks.
- No production KV or production secrets are used for test runs.
- A source is enabled only after its technical and policy checks pass.
- Failures are documented as source/environment limitations rather than hidden through retries or bypass logic.

## Phase 5 — Release readiness and production rollout

**Status: Not started**

Deliverables:
- [ ] Complete regression review across search, source management, adapter management, and browser preferences.
- [ ] Verify frontend Pages and Worker deployment settings independently.
- [ ] Confirm production KV namespace binding, ADMIN_API_TOKEN secret, and exact CORS origins.
- [ ] Review source enablement state; unreviewed candidates remain disabled.
- [ ] Publish deployment and rollback instructions.
- [ ] Deploy only after an explicit release decision.

Acceptance:
- CI is green for the release commit.
- Test-environment verification is complete and known limitations are documented.
- Production configuration and secrets are checked without committing secret values.
- Rollback steps and the deployed commit are recorded.

## Current implementation snapshot

As of the roadmap introduction:

| Area | Status |
|---|---|
| Monorepo, shared contracts, architecture | Implemented |
| Search orchestration and result normalization | Implemented |
| Source and adapter administration | Implemented; live Cloudflare verification pending |
| API / RSS / HTML acquisition mechanisms | Implemented at code level |
| Site-specific Providers | Four implemented; live verification pending |
| Generic HTML adapter | Implemented; per-source selectors and real runtime verification pending |
| Worker route tests | Added; further boundary-focused coverage planned |
| Worker entry-point modularization | Initial responsibility split implemented; follow-up review ongoing |
| Frontend maintainability improvements | Planned after audit |
| Non-JAV category source coverage | Requires source discovery and review |
| Real Cloudflare integration testing | Not started |
| Production release | Not started |

## Related documents

- [README](../README.md) — project overview, local development, and concise status.
- [Architecture](./architecture.md) — system boundaries, data flow, and technical constraints.
- [Development standards](./development-standards.md) — coding, module, frontend, testing, security, and review standards.
- [Source catalog](./source-catalog.md) — candidate source inventory and registration rules.
- [Source review log](./source-review.md) — evidence and decisions for individual sources.
- [Provider documentation](./providers/) — implementation details for site-specific adapters.

## Change control

Update this roadmap when a phase changes status, a deliverable is completed or descoped, or a new cross-cutting decision changes the project sequence. Keep task-level implementation details in code, tests, and focused documents; do not turn this roadmap into a chronological chat log.
