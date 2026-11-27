# Development Roadmap

This document is the project-level execution plan. It tracks delivery phases, acceptance criteria, dependencies, and outstanding verification. It complements (but does not replace) the architecture, source catalog, and source-review documents.

## Product objective

Deliver a maintainable, multi-category, multi-source search aggregator with a Vue frontend and a Cloudflare Worker API. The system searches only reviewed sources through implemented adapters, normalizes and deduplicates results, attributes every result to its source, and exposes user-opened external links where Worker-side retrieval is unavailable or not permitted.

The product does not host media, manage personal libraries, provide accounts, save search history/favorites, or synchronize user data.

## Delivery principles

- Continue autonomously when the user says “continue”; avoid routine confirmation questions. Ask only for genuinely blocking information or explicit authorization for irreversible/external operations.
- Do not run or request CI for partial work. Complete the entire large module (implementation, tests, documentation, integration, and acceptance review) first, then run one full CI against the latest branch head. Focused local checks continue during development.

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

The project-wide source governance rules are defined in [source-catalog-policy.md](./source-catalog-policy.md). In particular, Principle 11 makes access-control work a phase-based deferral: the current phase does not implement or enable such paths, while later phases may explicitly research and assess them; no future implementation is pre-approved.

## Phase 0 — Product and architecture baseline

**Status: Complete**

Deliverables:
- [x] Monorepo with apps/web, apps/worker, and packages/shared.
- [x] Vue 3 + TypeScript + Vite frontend and Cloudflare Worker API.
- [x] Shared source, adapter, category, and API contracts.
- [x] Cloudflare KV configuration model with separate source and adapter keys.
- [x] Nine content categories and independent source-kind classification, including the first-class audiobook category.
- [x] Explicit separation of Worker-backed Providers and browser-opened external-search entries.
- [x] Product non-goals and access-policy boundaries documented.

Acceptance:
- Frontend, Worker, and shared contracts remain independently understandable.
- No D1 database, media hosting, user accounts, cloud favorites/history, or arbitrary code execution from KV is introduced.

## Phase 1 — Core search and source administration

**Status: Implemented; live deployment verification remains open**

Deliverables:
- [x] Source configuration CRUD, enable/disable, validation, ETag/revision preconditions, and administrator-only Provider test actions.
- [x] Adapter metadata CRUD and implementation-registry checks.
- [x] Protected administration endpoints using the Worker secret.
- [x] Public source and adapter listings with private fields filtered.
- [x] Search orchestration, per-source timeout/failure isolation, normalization, deduplication, and result caps.
- [x] Frontend source and adapter management screens.
- [x] Add administrator-only source connection smoke checks and query-based Provider test searches with timeout, error, elapsed-time, result-count, and capped-sample feedback; external-search destinations are never fetched. See [source-testing.md](./source-testing.md).
- [x] External-search URL generation without fetching the destination.
- [x] Support independent user-opened external search/homepage links on Provider source records without coupling them to Worker requests.
- [ ] Verify KV propagation and management flows in a non-production Cloudflare environment.

Acceptance:
- Configuration changes take effect through KV without rebuilding Pages or redeploying the Worker.
- New executable adapters still require a Worker code deployment.
- Admin-only fields and credentials never appear in public responses or browser persistence.
- Stale configuration writes are rejected through version preconditions; documentation continues to state that KV is not a transactional lock.

## Phase 2 — Engineering quality and maintainability

**Status: In progress — frontend baseline and static checks established; further review ongoing**

### 2.1 Worker boundaries
- [x] Add HTTP route-level tests for health, CORS, malformed search requests, public filtering, and admin authorization/configuration.
- [x] Split the Worker entry point along real responsibility boundaries: HTTP response/CORS utilities, configuration access, validation, and source/adapter administration.
- [x] Keep the entry point as a thin composition layer.
- [x] Add focused tests for source/adapter validation, ETag preconditions, and adapter-reference/enablement invariants.
- [x] Make registered Provider mechanism/version/categories/capabilities authoritative over editable KV metadata.
- [x] Bind generic HTML image and Magnet extraction to each source's declared capabilities and configured selectors.
- [x] Propagate client cancellation to active Provider requests and retain per-source timeout isolation.
- [x] Guard cache reads, upstream response parsing, and cache writes against cancelled/timed-out Provider work.
- [x] Document cache-key completeness, explicit TTLs, edge-local cache behavior, and the absence of distributed request coalescing/rate limiting.
- [x] Enforce declared capabilities during result normalization, not only during adapter resolution.
- [x] Preserve source attribution and merge missing metadata/resource links when canonical URLs deduplicate.
- [x] Validate persisted KV configuration envelopes and individual records when reading them; reject malformed records and duplicate IDs.

Acceptance:
- Existing API paths, HTTP methods, status codes, response shapes, ETag behavior, CORS behavior, authentication, KV keys, and validation rules remain unchanged.
- Worker tests, frontend production build, and Worker type-check pass in CI.
- No duplicate validation or parallel configuration implementation is introduced.

### 2.2 Frontend boundaries
- [x] Audit SearchPage.vue and extract the search request lifecycle/state into a focused composable; keep page-specific presentation and interactions in the page component.
- [x] Review current navigation and view switching. Keep the existing three-view switch for now: there are no nested routes, deep-link requirements, or route-driven refresh needs that justify Vue Router.
- [x] Review state ownership before considering Pinia. Keep search and management data local to their views; the administrator token remains in the existing module-scoped shared session. No cross-view state requirement currently justifies Pinia.
- [x] Establish a small reusable UI foundation for repeated primitives and interaction patterns; the shared administrator login panel is the first documented component.
- [x] Evaluate Lucide Vue Next, ESLint, and Prettier against existing dependencies and code style. ESLint and Prettier are installed; Prettier is available as a developer command but is not yet a CI gate. Lucide Vue Next was evaluated and deferred because current icon usage does not justify another dependency.
- [x] Add ESLint to CI without broad formatting churn; keep the existing Worker test runner and test structure.

Acceptance:
- Container/page components coordinate data and state; display components receive explicit props and emit explicit events.
- No unnecessary global state or component fragmentation.
- Shared components have documented purpose, props, events, slots (where applicable), and concise usage examples.
- Existing visual behavior and accessibility are not regressed. A dedicated accessibility pass remains a later explicit quality task.

### 2.3 Documentation and delivery hygiene
- [x] Add this project-level roadmap and link it from the README.
- [x] Add a dedicated development standards document and link it from the README.
- [ ] Keep implementation status and phase acceptance criteria current as work lands.
- [x] Document new adapter contracts and operational behavior alongside code changes, including administrator source diagnostics.

## Phase 3 — Source coverage and adapter ecosystem

**Status: Partially implemented; ongoing source review**

Deliverables:
- [x] Provider registry and shared result contract.
- [ ] Complete the JAV metadata aggregation module: normalized catalogue-number identity with conflict-safe alias registration, deterministic first-valid-value field merging, stable first-source external-link labels, and the shared structured-relationship contract/UI are implemented. Perverzija DB maps its documented performer, studio, network, and tag fields with calendar-date validation, uses a shared 600 ms rate-limit lane, caches valid responses for 300 seconds, and has cache/coordinator integration coverage; Eporner maps documented performers, categories, and comma-separated keywords into structured relationships; relationship caps preserve later URL enrichment. Remaining work: review any additional eligible Provider mappings, finish orchestration and edge-case regression coverage, then perform integrated verification and acceptance review. See [JAV metadata aggregation](./providers/jav-metadata-aggregation.md).
- [x] API, RSS/Atom, and generic HTML acquisition mechanisms.
- [x] Twelve site-specific Provider implementations (including the metadata-only MangaDex, MusicBrainz, Eporner, LibriVox, and AudioSilo Meta Providers) and the reusable generic-html adapter.
- [x] Candidate source catalog and evidence-based review log.
- [ ] Expand reviewed, permitted source coverage for anime, film/TV, manga, novels, games, music, and general resources; audiobook metadata coverage now includes LibriVox and AudioSilo Meta at code level.
- [ ] For each candidate, record the canonical endpoint, acquisition method, access/usage conditions, supported fields, attribution requirements, quotas/cache guidance, and Worker compatibility.
- [ ] Implement additional adapters only when a stable interface and permitted automated access are established.
- [x] Define the authenticated-source boundary: source-scoped Worker Secret bindings are injected only into the matching Provider; missing secrets fail closed. Free-account authentication is allowed only where ordinary authenticated access is permitted.
- [x] Create a deferred-source backlog for sources whose current acquisition path requires addressing access controls. Current-phase implementation remains deferred; later phases may explicitly research technical approaches under Principle 11, subject to source-specific legal, contractual, authorization, security, privacy, and operational review.
- [x] Implement the SQLite-backed Durable Object rate-limit coordinator, Worker binding contract, per-Provider lane opt-in, cancellation-aware wait, cooldown handling, and fail-closed fetch wrapper. Keep it dormant until a Provider opts in; see [provider-rate-limiting.md](./provider-rate-limiting.md).
- [x] Add a dedicated Workers Vitest integration suite against the existing Wrangler configuration; verify SQLite concurrency, lane isolation, cooldown revalidation, upstream 429 cooldown persistence, and Durable Object eviction/recovery in the local workerd runtime while retaining the existing Node test suite unchanged.
- [ ] Verify hosted Cloudflare binding behavior and Free-plan quota accounting in a separate non-production environment before enabling MangaDex or MusicBrainz.
- [x] Prepare API integration readiness analysis for Bangumi, MangaDex, and MangaUpdates in [provider-integration-readiness.md](./provider-integration-readiness.md); record current deferrals and conditions before further implementation or enablement.
- [x] Implement and register the metadata-only MangaDex Provider; keep it unconfigured in KV and disabled pending runtime verification and policy gates.
- [ ] Keep Bangumi keyword search deferred while its public subject-search endpoint remains marked experimental; use only stable public endpoints or external-search.
- [ ] Add per-source fixtures and tests; keep uncertain sources as disabled candidates or external-search entries.
- [ ] Implement Provider-specific authentication only after reviewing the source terms, credential type, canonical host, expiry/rotation behavior, and redirect handling.
- [ ] Complete the jurisdiction/scope assessment for the intended public launch markets. Determine whether applicable age-assurance rules cover this metadata-search service and document any required, proportionate controls. Do not treat DOB entry, an 18+ checkbox, or a browser-stored flag as statutory age verification. Do not globally disable adult discovery merely because this assessment is pending.
- [ ] Follow the product and launch-scope decisions in [Age-assurance readiness](./age-assurance-readiness.md); apply any required controls only to the jurisdictions/features for which the review establishes an obligation.
- [x] Implement Eporner through its documented public API with metadata-only search, an active-status check for every result, and a 15-minute cursor-based removal-feed sync. The Worker stores only the feed cursor/timestamps in KV, not removed IDs or search results. The Provider fails closed when the feed is stale or has an incomplete cursor. Keep the source disabled until the first successful hosted sync and non-production Cloudflare verification; public enablement remains subject to source-specific policy review and the project's jurisdiction-specific launch assessment.

Acceptance:
- A catalog entry is never represented as an implemented Provider unless its adapter is registered and tested.
- No paid API is introduced.
- In the current development phase, no login, paywall, CAPTCHA, anti-bot challenge, geo restriction, rate limit, or other access-control bypass path is implemented or enabled. Any later research or implementation requires an explicit phase decision and source-specific review under Principle 11.
- Source-specific permissions, attribution, removal/takedown procedures, and content/legal scope are reviewed before enabling.
- New content categories are supported by actual source coverage, not merely by a category selector or generic type definitions.

## Phase 4 — Real Cloudflare integration verification

**Status: Not started; requires a dedicated test environment**

Deliverables:
- [ ] Create or designate a non-production Cloudflare Pages + Worker test environment.
- [ ] Bind a test KV namespace and the SQLite rate-limit Durable Object; configure test-only ADMIN_API_TOKEN and exact ALLOWED_ORIGINS.
- [ ] Verify Durable Object slot spacing, cooldown revalidation, restart persistence, cancellation, and quota accounting in a hosted non-production environment. Do not deliberately exhaust shared account quotas or switch to a Paid plan to complete verification.
- [ ] Verify public API, admin CRUD, ETag conflicts, CORS, KV propagation, and source-scoped Worker Secret injection end to end.
- [ ] Verify the real Cloudflare HTMLRewriter runtime with representative HTML fixtures and at least one reviewed source configuration.
- [ ] Test live Provider connectivity individually, recording success, failure, response behavior, and any source-side restrictions.
- [ ] Keep providers disabled when ordinary Worker requests are blocked or terms/permissions remain unclear; do not attempt access-control workarounds in the current phase.

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

Current branch implementation snapshot:

| Area | Status |
|---|---|
| Monorepo, shared contracts, architecture | Implemented |
| Search orchestration, capability-aware normalization, request cancellation, and source-attributed deduplication | Implemented |
| Source and adapter administration | Implemented; live Cloudflare verification pending |
| API / RSS / HTML acquisition mechanisms | Implemented at code level |
| Site-specific Providers | Twelve implemented and registered; all remain unconfigured/disabled pending source-specific policy and hosted verification |
| Generic HTML adapter | Implemented; per-source selectors and real runtime verification pending |
| Shared rate-limit coordinator | Implemented in Worker code and Wrangler config; MangaDex and AniBT declare lanes but no enabled KV source invokes them; hosted concurrency/quota verification pending |
| Worker route tests | Added; further boundary-focused coverage planned |
| Worker entry-point modularization | Initial responsibility split implemented; follow-up review ongoing |
| Frontend maintainability improvements | Initial shared login component and manager request-race guards implemented; ongoing review |
| Non-JAV category source coverage | Requires source discovery and review |
| Local Workers / Durable Object runtime integration tests | Implemented; CI run [#45785271608](https://github.com/shenshou/AIOResourceSearch/actions/runs/45785271608) passed code commit `0d8e045c2ced777e0b28847ef87186ef71a91b2a`, including the Durable Object runtime suite and AniBT lane extension. The later `2444fe37` change only updates this roadmap; hosted Cloudflare verification remains pending |
| Authenticated Provider credential injection | Code path implemented using source-scoped Worker Secret bindings; CI passed, hosted verification pending |
| AniBT Torznab Provider | Implemented with shared 1.1-second lane and no-store behavior; disabled pending hosted/policy verification |
| Eporner metadata Provider | Implemented with active-status checks, 1-second shared lane plus exclusive request lease, and 15-minute removal-feed cursor sync; disabled pending hosted sync/runtime and launch-scope review |
| LibriVox metadata Provider | Implemented and registered; metadata-only audiobook search, 5-second shared lane, 20-result cap, canonical project-page links; CI run [#45947452308](https://github.com/shenshou/AIOResourceSearch/actions/runs/45947452308) passed commit `3e79f7892d7c1fb88ea0a6da03a8f1b2bc80405a`; source/adapter remain unconfigured and disabled; hosted verification pending |
| AudioSilo Meta metadata Provider | Implemented and registered; CC0 factual WorkResult fields only, no community-layer/cover/description reuse, 1-second shared lane, 20-result cap, canonical work-page links; full CI [#45949235669](https://github.com/shenshou/AIOResourceSearch/actions/runs/45949235669) passed on `c0745998e51d10a8481ca113941270b1da1ed007`; hosted verification pending; source/adapter remain unconfigured and disabled |
| Real Cloudflare integration testing | Not started; LibriVox, AudioSilo Meta, and other Providers still require non-production hosted verification |
| Production release | Not started |

## Related documents

- [README](../README.md) — project overview, local development, and concise status.
- [Architecture](./architecture.md) — system boundaries, data flow, and technical constraints.
- [Frontend components](./frontend-components.md) — reusable Vue component contracts and usage examples.
- [Development standards](./development-standards.md) — coding, module, frontend, testing, security, and review standards.
- [Source catalog](./source-catalog.md) — candidate source inventory and registration rules.
- [Source review log](./source-review.md) — evidence and decisions for individual sources.
- [Provider documentation](./providers/) — implementation details for site-specific adapters.
- [Source testing](./source-testing.md) — authenticated Provider connection smoke checks and query-based diagnostics.
- [Deferred source backlog](./deferred-source-backlog.md) — sources held back until ordinary permitted access becomes available.

## Change control

Update this roadmap when a phase changes status, a deliverable is completed or descoped, or a new cross-cutting decision changes the project sequence. Keep task-level implementation details in code, tests, and focused documents; do not turn this roadmap into a chronological chat log.
