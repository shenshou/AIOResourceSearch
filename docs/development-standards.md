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
- Keep the agreed stack: Vue 3, TypeScript, Vite, Cloudflare Pages, Cloudflare Workers, and KV. Do not add Pinia, a UI framework, Tailwind, or another test framework solely for consistency with another project.

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
- The search request's AbortSignal must propagate to every active Provider. Per-source timeouts must abort the Provider signal; Providers must pass it to upstream Fetch calls and avoid starting cache writes or retries after cancellation.
- The result normalizer must discard optional fields not covered by the source's declared capabilities (metadata, image, Magnet, ED2K, Torrent). A Provider returning a field does not itself grant the source that capability.
- Deduplicate only by canonical detail URL. When multiple sources return that URL, preserve all source attributions and merge missing metadata/resource links without overwriting already selected values. Per-source result counts remain pre-deduplication counts.
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

## 8. Testing and verification

- Keep the current `tsx --test` / Node.js test-runner approach. Do not migrate frameworks without a demonstrated need and an explicit decision.
- Add tests at the layer where behavior is owned:
  - Provider tests for protocol parsing, mapping, URL validation, limits, and failure behavior.
  - Route tests for HTTP methods, validation, status codes, CORS, authorization, public-field filtering, and response contracts.
  - Shared-contract tests where a contract has non-trivial runtime behavior.
- Prefer deterministic fixtures and mocked network/KV boundaries for unit tests. Tests using mocks do not prove real Cloudflare runtime behavior or live source connectivity.
- For behavior changes, add regression coverage for the affected success and failure paths.
- Before a change is considered ready, CI must pass:
  1. ESLint for frontend, Worker, tests, and shared TypeScript.
  2. Worker unit tests.
  3. Frontend production build.
  4. Worker TypeScript type-check.
- Prettier provides the repository formatting configuration and the `npm run format` convenience command. Do not reformat unrelated files; format only the files in the current change when making focused edits. Prettier is not yet a CI gate because the existing codebase has not undergone a deliberate baseline formatting pass.
- Real Cloudflare integration, HTMLRewriter runtime behavior, KV propagation, and live Provider connectivity are separate verification gates and must be tested in a non-production environment when needed.

## 9. Change and review workflow

For each implementation task:

1. Inspect the current branch, relevant modules, contracts, tests, and existing documentation before editing.
2. Identify the responsibility boundary and expected behavior; avoid unrelated refactors.
3. Implement the smallest coherent change and update focused tests.
4. Update architecture/provider/operational documentation when behavior or contracts change.
5. Run the relevant local checks where available and confirm CI on the exact latest branch head.
6. Review the diff for duplicated logic, accidental contract changes, secret exposure, dead code, and scope creep.
7. Report what changed, files/modules affected, verification results, known limitations, and whether deployment is required.

- Keep work on the existing feature branch and PR unless a different workflow is explicitly requested.
- Do not merge the feature PR, deploy production resources, modify production KV, or enable unreviewed sources without explicit authorization.
- Do not ask the user to deploy early. Complete code-level work and CI first; request a non-production deployment only when a real-runtime verification gate requires it.

## 10. Documentation maintenance

- Update this document when a durable engineering rule changes.
- Update [architecture](./architecture.md) when system boundaries, data flow, runtime responsibilities, or security architecture change.
- Update [development roadmap](./development-roadmap.md) when phase status, deliverables, acceptance criteria, or project sequencing changes.
- Keep Provider-specific behavior in focused files under `docs/providers/`.
- Do not use the roadmap as a chronological work log; record implementation details in code, tests, and focused documentation.
