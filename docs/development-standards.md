# Development Standards

This document defines the implementation and review standards for AIOResourceSearch. It is the day-to-day engineering reference; the [architecture](./architecture.md) defines system boundaries, while the [development roadmap](./development-roadmap.md) tracks delivery phases and acceptance criteria.

## 1. Engineering principles

1. **High cohesion, low coupling.** A module should own a clear responsibility and expose a small, intentional interface.
2. **Separate orchestration from implementation.** Route handlers coordinate HTTP concerns; services own application workflows; adapters own source-specific protocol behavior; presentation components render supplied state.
3. **Make data flow explicit.** Prefer props, function arguments, return values, and typed contracts over hidden global state or implicit cross-module mutation.
4. **Do not split by line count.** Extract a file or component only when a stable responsibility boundary, independent reuse, or materially better testability justifies it.
5. **Prefer incremental changes.** Avoid broad rewrites, unnecessary dependencies, formatting churn, or architecture changes unrelated to the task.
6. **Preserve observable behavior.** Existing API contracts, security checks, user-facing behavior, and stored configuration formats must remain compatible unless a deliberate change is documented and tested.

## 2. Repository and dependency boundaries

- Keep the monorepo responsibilities clear:
  - `apps/web`: Vue user interface, browser preferences, and API client.
  - `apps/worker`: HTTP API, authorization, configuration persistence, search orchestration, and Provider implementations.
  - `packages/shared`: framework-independent contracts shared across applications.
- Shared contracts must not depend on Vue, browser APIs, Cloudflare runtime APIs, or Worker implementation details.
- The frontend must not import Worker implementation modules. The Worker must not depend on frontend state or UI libraries.
- Add a dependency only when it solves a concrete requirement. Check existing packages and platform capabilities first; do not introduce duplicate libraries.
- Keep the agreed stack: Vue 3, TypeScript, Vite, Cloudflare Pages, Cloudflare Workers, and KV. Do not add Pinia, a UI framework, Tailwind, or another test framework solely for consistency with another project. A separate Workers Vitest runtime suite is an approved, narrowly scoped exception because Node test doubles cannot verify real `workerd` / SQLite Durable Object behavior; it must not replace or slow down the existing Node unit suite.

## 3. Module and code organization

- Organize modules around domain responsibilities and stable boundaries, not arbitrary file-size thresholds.
- Keep entry points thin: initialize dependencies, dispatch to the relevant module, and translate uncaught failures into safe responses.
- Keep HTTP parsing, status codes, headers, CORS, and response serialization out of Provider implementations.
- Keep source-specific URL construction, request protocol handling, parsing, and source-field mapping inside the corresponding Provider.
- Keep shared validation and normalization rules in one authoritative implementation. Do not duplicate slightly different validators across routes, UI components, or adapters.
- Extract a service or utility only when it has a coherent contract and meaningful independent responsibility. Avoid one-function wrapper files and premature abstraction.
- Use descriptive names that communicate domain intent. Avoid generic catch-all modules that accumulate unrelated behavior.

## 4. TypeScript and data contracts

- Prefer explicit types at module boundaries and public function signatures.
- Treat external JSON, HTTP bodies, KV values, and Provider responses as untrusted input; validate them before use.
- Avoid `any`. Use `unknown` at untrusted boundaries and narrow it with validation.
- Keep shared API and domain contracts in `packages/shared`; update producers, consumers, tests, and documentation together when a contract changes.
- Keep normalized result fields stable and use the extensible metadata map for category-specific attributes rather than repeatedly expanding common fields for one source.
- Make optional fields genuinely optional; do not fabricate values to satisfy a type.
- Avoid unsafe type assertions when runtime validation can establish the type.

## 5. Worker and Provider standards

- Route handlers own HTTP method/path dispatch, request validation, status codes, and response shape. Business workflows should be delegated when a meaningful boundary exists.
- Configuration access and persistence must go through the configuration-store boundary. Keep KV keys and version/ETag semantics centralized.
- Administrator authorization must remain server-side. Secrets belong in Worker secrets; never expose them through public responses, KV configuration, logs, or browser persistence.
- Public source/adapter responses must continue filtering private operator notes and credential-binding metadata.
- Provider implementations must be registered in the compile-time registry. KV metadata must never execute or dynamically load arbitrary code.
- For a registered implementation, mechanism, version, supported source categories, content categories, and capabilities are implementation-owned facts. Normalize these fields from the registry when reading or validating adapter metadata; KV may manage descriptive/admin fields and enabled state, but must not override runtime capabilities.
- A source's declared capabilities must match the fields its configuration can actually extract. For generic HTML, image and Magnet capabilities require their corresponding selectors, and undeclared optional fields must not be returned even if a parser supplies them.
- Each Provider must validate upstream status, response shape, result URLs, and supported resource links; apply bounded response sizes, timeouts, and safe redirect handling appropriate to its protocol.
- A source configuration must declare at least one search mode; a Worker-backed Provider source must also declare at least one result capability. Enforce these invariants at the Worker boundary even when the UI already validates them.
- The search request's AbortSignal must propagate to every active Provider. Per-source timeouts must abort the Provider signal; Providers must pass it to upstream Fetch calls and check cancellation after asynchronous cache reads/body parsing and immediately before cache writes.
- Cache only successful, validated upstream responses with a documented TTL. Cache keys must include every parameter that changes the upstream response (including the encoded query and category); never cache credentials, user-specific data, errors, or partially parsed responses. A cache hit must still pass the same parser and result validation as a network response.
- Cloudflare Cache API entries are edge-location scoped and do not provide a distributed lock or request coalescing. Concurrent cache misses may issue duplicate upstream requests; do not describe this cache as a global rate limiter.
- The result normalizer must discard optional fields not covered by the source's declared capabilities (metadata, image, Magnet, ED2K, Torrent). A Provider returning a field does not itself grant the source that capability.
- Treat KV content as untrusted persisted input. Validate the configuration envelope, each source/adapter record, and duplicate IDs when reading it; never rely solely on TypeScript casts or on the fact that writes normally pass through admin validation.
- Deduplicate by canonical detail URL; JAV results may additionally match by a conservatively normalized catalogue number. When multiple sources identify the same work, the first valid non-empty value in configured source order remains authoritative for conflicting fields, later sources fill only missing fields, and metadata keys follow the same first-value-wins rule. Blank optional metadata values are discarded during normalization. Preserve all source attributions; merge unique resource links. Per-source result counts remain pre-deduplication counts.
- Provider failures must be isolated so one unavailable source does not fail the entire search.
- Do not bypass authentication, paywalls, CAPTCHA, anti-bot challenges, geo restrictions, rate limits, or other access controls.
- External-search entries only produce user-opened HTTPS destinations; they must not silently become Worker fetches.

## 6. Vue and frontend standards

- Use Vue 3 Composition API and TypeScript consistently with the existing codebase.
- Keep page/container components responsible for page-level coordination, request lifecycle, and state that belongs to that page.
- Keep display components focused on rendering explicit props and emitting explicit events. They should not independently fetch data or reach into unrelated global state.
- Keep state at the narrowest scope that satisfies its consumers. Use component-local state for local interactions; consider a shared store only when multiple views genuinely need the same mutable state.
- Do not introduce Pinia merely to move every `ref` into a global store.
- Separate API transport from page presentation. API clients own HTTP details; composables may own reusable stateful workflows when there is a real reuse or isolation benefit.
- Avoid splitting a page into many tiny components solely to reduce its line count. Extract repeated UI or a coherent interaction with a stable interface.
- Reusable components should document their purpose, props, emitted events, slots (if any), and a concise usage example in [frontend-components.md](./frontend-components.md). One-off components do not need ceremonial documentation.
- Preserve the existing custom CSS and design-token approach. Avoid introducing a styling framework without a concrete need.

## 7. Error handling and security

- Validate all user input and persisted configuration at trust boundaries.
- Return stable, intentional error codes and appropriate HTTP status codes; do not leak stack traces, secret values, internal notes, or upstream response bodies to public clients.
- Catch failures at boundaries where the application can recover or return a safe response. Do not silently swallow errors that should be observable in tests or diagnostics.
- Keep CORS restricted to explicitly configured origins.
- Use HTTPS for external source and result URLs where required by the source contract.
- Bound network work: timeouts, concurrency, response sizes, result counts, and cache lifetime must be explicit and justified.
- Treat source visibility as distinct from permission to automate access, republish metadata, or display images. Record unresolved policy or technical questions and keep uncertain sources disabled.
- Free-account authentication is eligible when the source permits the intended automation. Use only credentials legitimately issued to the operator.
- During the current development phase, do not implement or enable automatic acquisition paths requiring access-control bypass (including login/authentication gates, paywalls, CAPTCHA, anti-bot/Cloudflare challenges, geo/IP restrictions, or rate limits). Keep affected sources and techniques in [deferred-source-backlog.md](./deferred-source-backlog.md), with the specific blocker and future reassessment conditions.
- This is a phase-based deferral, not a permanent exclusion. Later phases may explicitly research and evaluate technical solutions, subject to source-specific legal, contractual, platform, authorization, security, privacy, and operational review. No future implementation is pre-approved by this rule; until a later phase is expressly approved, the current-phase boundary remains binding.
- Source credentials must use Worker Secret bindings. Never store credential values in KV, source catalog entries, repository files, browser storage, public API responses, or logs. Missing configured credentials must fail closed before an upstream request.

## 8. Testing and verification

- Keep `tsx --test` / Node.js as the default fast unit-test runner. Do not migrate the existing suite. The dedicated `@cloudflare/vitest-plugin` suite is limited to local Workers Runtime / Durable Object integration behavior that Node test doubles cannot establish.
- Add tests at the layer where behavior is owned:
  - Provider tests for protocol parsing, mapping, URL validation, limits, and failure behavior.
  - Route tests for HTTP methods, validation, status codes, CORS, authorization, public-field filtering, and response contracts.
  - Shared-contract tests where a contract has non-trivial runtime behavior.
- Prefer deterministic fixtures and mocked network/KV boundaries for unit tests. Tests using mocks do not prove real Cloudflare runtime behavior or live source connectivity.
- For behavior changes, add regression coverage for the affected success and failure paths.
- Before a change is considered ready, the complete CI suite must pass:
  1. ESLint for frontend, Worker, tests, and shared TypeScript.
  2. Worker unit tests (`tsx --test`).
  3. Local Worker Durable Object runtime integration tests (`vitest` / `workerd`).
  4. Frontend production build.
  5. Worker TypeScript type-check.
- Prettier provides the repository formatting configuration and the `npm run format` convenience command. Do not reformat unrelated files; format only the files in the current change when making focused edits. Prettier is not yet a CI gate because the existing codebase has not undergone a deliberate baseline formatting pass.
- Real Cloudflare integration, HTMLRewriter runtime behavior, KV propagation, and live Provider connectivity are separate verification gates and must be tested in a non-production environment when needed.

### CI scheduling and efficiency

- **Run the complete CI suite only after a complete large module is finished.** A large module is an end-to-end capability or phase-sized workstream whose implementation, focused regression tests, documentation, integration, and acceptance review are complete. Do not run CI between sub-tasks, small commits, source-review batches, or partial implementations inside that module, and do not ask the user to trigger CI during the module. Perform focused local checks while developing; once the entire large module is complete, publish the accumulated work and run one full CI against the exact latest branch head.
- PR creation/reopening/ready-for-review may trigger the initial automatic verification. After that initial run, subsequent PR commits intentionally do **not** trigger CI automatically. Do not manually dispatch CI until the current large module is complete; then run the `CI` workflow once against the latest feature-branch head. A manual dispatch always runs the complete suite, including for documentation-only changes.
- Keep automatic CI on pushes to `main`. This protects the default branch while avoiding repeated full verification during active feature-branch development.
- **Create one Git commit per coherent task/module update.** When a task changes multiple files, do not use the GitHub Contents API (`create_file` / `update_file`) once per file on the PR branch: each successful call creates a separate commit. Stage the complete file set and publish it as one commit instead (for API-based edits, use the Git Data API to create the blobs/tree/commit and update the branch ref once). If several local commits are useful during development, push them together as one batch rather than pushing after each commit.
- Before publishing a branch update, review the complete diff and confirm that implementation, focused regression tests, and relevant documentation for the current workstream are included. Do not create placeholder, formatting-only, or documentation-only commits merely to advance the workflow; attach those edits to the related task whenever practical.
- If complete CI fails, first inspect the failing job and perform targeted diagnosis and local verification. After correcting the cause, run the complete CI suite again to validate the fix; do not repeatedly rerun it without a code or configuration change.
- The latest code-affecting commit on the PR branch must be covered by a successful complete CI run before the PR is considered ready to merge. That run is scheduled only after the current large module is complete; documentation-only commits after that successful run do not invalidate it.
- GitHub Actions must use concurrency groups that isolate each PR (and branch push) and cancel superseded in-progress runs. This prevents stale runs from consuming CI time when a newer run for the same PR/ref has started.
- Keep one comprehensive CI workflow, but separate cheap change detection from the expensive verification job. Initial PR events inspect the PR diff; pushes to main inspect the pushed commit range. A manual `workflow_dispatch` always runs the complete suite against the selected ref.
- PR `synchronize` is deliberately excluded from automatic triggers. This reduces workflow-run creation during active development; it does not debounce or combine GitHub events. The completed task/module is verified by one deliberate manual dispatch instead.
- For automatic PR/main runs, skip the expensive verification job only when every inspected changed path is documentation-only (`docs/**`, `*.md`, or `*.mdx`). If any source, test, package/configuration, lockfile, workflow, or other non-documentation file changed, run the complete suite. If GitHub API inspection fails, a commit range is incomplete/truncated, or ancestry cannot be established, fail open to running full CI.
- Do not use PR-level `paths-ignore` as the sole documentation optimization: GitHub evaluates the aggregate PR diff, so a later docs-only commit can still match earlier code changes already present in the PR. The commit-range detector avoids rerunning full CI when those code changes have already passed.
- A documentation-only PR update after the initial PR event does not start a workflow automatically. If a manual run is explicitly requested, it runs the full suite. Automatic documentation-only runs (for example, an initial PR event or a push to main) may still create a short workflow run for change detection; the `verify` job is skipped and GitHub reports a skipped job as successful, including when it is a required check. Keep the full CI check as the merge gate.
- Use dependency caching and `npm ci` only after the repository has a committed, maintained npm lockfile. Until then, retain the currently valid install command rather than introducing a cache configuration or clean-install command that assumes a missing lockfile.
- Set a reasonable job timeout so a stalled workflow cannot consume runner time indefinitely.

## 9. Change and review workflow

For each implementation task:

1. Inspect the current branch, relevant modules, contracts, tests, and existing documentation before editing.
2. Identify the responsibility boundary and expected behavior; avoid unrelated refactors.
3. Implement the smallest coherent change and update focused tests.
4. Update architecture/provider/operational documentation when behavior or contracts change.
5. Run relevant focused local checks throughout the large module; do not run or request CI for partial work. After the entire large module is complete, run and confirm complete CI on the exact latest branch head.
6. Review the diff for duplicated logic, accidental contract changes, secret exposure, dead code, and scope creep.
7. Report what changed, files/modules affected, verification results, known limitations, and whether deployment is required.

For an ongoing project, a user message such as “continue” means proceed autonomously with the next logical implementation/research step. Do not interrupt the workflow with routine preference, sequencing, or confirmation questions. Ask only when a genuinely blocking input is missing or an operation is irreversible / externally consequential and requires explicit authorization.

- Keep work on the existing feature branch and PR unless a different workflow is explicitly requested.
- Do not merge the feature PR, deploy production resources, modify production KV, or enable unreviewed sources without explicit authorization.
- Do not ask the user to deploy early. Complete code-level work and CI first; request a non-production deployment only when a real-runtime verification gate requires it.

## 10. Documentation maintenance

- Update this document when a durable engineering rule changes.
- Update [architecture](./architecture.md) when system boundaries, data flow, runtime responsibilities, or security architecture change.
- Update [development roadmap](./development-roadmap.md) when phase status, deliverables, acceptance criteria, or project sequencing changes.
- Keep Provider-specific behavior in focused files under `docs/providers/`.
- Treat [source-catalog-policy.md](./source-catalog-policy.md) as the canonical source-inventory governance policy; keep the catalog, review log, and deferred backlog consistent with it.
- Do not use the roadmap as a chronological work log; record implementation details in code, tests, and focused documentation.


## 11. Source catalog governance

- The source inventory is a durable record of candidate sources, not a list of currently approved or operational Providers. Follow the eleven principles in [source-catalog-policy.md](./source-catalog-policy.md) for every source discovery, review, status change, and removal.
- Never delete a source solely because it is unreachable, lacks a documented API/RSS, has unresolved terms, is blocked by ordinary network controls, or is deferred. Retain it with an evidence-based disposition and a concrete reconsideration condition.
- Preserve provenance from Atlas, Lustpress, FetchJAV, and other discovery paths. Reconcile raw upstream entries at source level, documenting deduplication, multi-category identities, exclusions, and unresolved gaps; do not infer completeness from tag counts.
- Record first-party evidence separately from third-party reports and observations. Never guess canonical domains, aliases, successor sites, mirrors, endpoints, or feed contracts.
- Assess source reachability, permission for automated access, metadata/image/link reuse rights, Provider implementation, KV configuration, enabled state, deployment, and Hosted Cloudflare verification as separate facts.
- Investigate supported acquisition methods individually (official API, RSS/Atom, documented JSON/feed, permitted HTML, or user-opened external navigation). A missing API does not justify deleting the source or assuming scraping is permitted.
- In the current development phase, do not implement or enable access paths requiring authentication/paywall/CAPTCHA/anti-bot/Cloudflare challenge/geo-IP/rate-limit or other access-control bypass. Keep blocked candidates in the catalog and [deferred-source-backlog.md](./deferred-source-backlog.md); record the exact blocker and future reassessment conditions. This is not a permanent ban: later phases may research and assess solutions under Principle 11 of the canonical policy.
- Preserve permitted external links independently from Worker automation. External Search must remain user-initiated HTTPS navigation and must never become a hidden Worker fetch.
- Keep [source-review.md](./source-review.md), [source-catalog.md](./source-catalog.md), and [deferred-source-backlog.md](./deferred-source-backlog.md) aligned with the canonical policy. A documentation status must never be represented as a runtime capability unless the code and configuration actually provide it.

- Adult/JAV-related search, metadata, source discovery, and source management are a core product pillar. Do not add blanket adult-content hiding, global filtering, or mass source removal. If a jurisdiction-specific legal requirement applies, implement the narrowest applicable scope and preserve unrelated regions and non-adult categories.
- Technical research is not restricted to official APIs or feeds. Study other open-source projects and public acquisition implementations for reusable adapter, request, parsing, normalization, pagination, and caching techniques. Evaluate technical feasibility separately from source permission and data-use rights; third-party code or observable requests do not authorize access or circumvention. Do not implement access-control-bypass paths in the current phase; preserve them as future research candidates under Principle 11 of the canonical policy.
- Treat unimplemented in-scope catalog entries as the long-term source-development backlog. Progressively review and develop them in prioritized batches; do not let "not implemented" become silent permanent abandonment. Record blockers, reconsideration criteria, and any genuine scope exclusion.
