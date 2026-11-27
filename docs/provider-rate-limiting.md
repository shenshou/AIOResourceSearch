# Shared Upstream Rate-Limiting Design

## Purpose

Some public metadata APIs impose limits on the application or source IP, not on one Worker invocation. The current search scheduler's maximum of ten concurrent Providers is a fan-out bound; it is not an upstream rate limiter.

The current Cloudflare Cache API is edge-local. Workers KV is eventually consistent and does not provide compare-and-swap transactions. Neither can enforce a strict cross-request, cross-isolate quota. Do not use either as a distributed lock or global rate limiter.

This document defines the implementation gate for APIs whose terms require coordinated outbound pacing. The Worker-side coordinator infrastructure and the reviewed metadata Providers are implemented and registered on the feature branch. Their source/adapter configurations remain disabled and unconfigured in KV; no Cloudflare deployment or production binding has been applied.

## Current API requirements

| API | Requirement | Design target |
|---|---|---|
| MusicBrainz `/ws/2` | Average maximum 1 request/second per source IP; identifying User-Agent required | Shared lane: 1,000 ms |
| MangaDex REST | Initial documented limit 5 requests/second/IP, with endpoint-specific limits | Shared lane: 400 ms; honor response headers |
| AniBT Torznab | 60 requests / 60 seconds / IP; documented no-store behavior | Shared lane: 1,100 ms; no edge cache |
| The RarBg anonymous API | 30 requests/minute/IP | Shared lane: 2,100 ms |
| Eporner API v2 | Sequential requests; one-second shared pacing and exclusive response-body lease | Shared lane: 1,000 ms plus exclusive lease |
| LibriVox API | Requests should be separated by several seconds | Shared lane: 5,000 ms |
| AudioSilo Meta `/api/v1` | Public deployment documents a per-client token bucket; 429 includes `Retry-After` | Shared lane: 1,000 ms; no edge cache |
| Perverzija DB v1 | 120 requests/minute/IP; 429 includes `Retry-After`; API recommends caching for at least a few minutes | Shared lane: 600 ms (100 requests/minute); Cache API TTL 300 seconds |
| Bangumi API v0 | Search endpoint remains experimental | Keep external-search until a stable API contract is suitable |

MusicBrainz documents its numeric 1 request/second ceiling against source IP, while also applying User-Agent-specific throttling. The project-wide lane is a conservative application-level control and must not be enforced independently per Worker instance. MangaDex documents an initial 5 requests/second per IP plus endpoint-specific limits; the project target is deliberately more conservative. Actual quota headers and newer official policy always take precedence over these starting intervals.

AudioSilo's published quota is per client address, whereas the Worker uses one shared application-wide lane. The one-second interval is an intentionally conservative global ceiling (one request/second across the app), not a statement of AudioSilo's upstream quota. It can be relaxed after representative hosted traffic and quota behavior are measured.

## Implemented coordinator infrastructure

The feature branch now contains:

- `apps/worker/src/rate-limit-coordinator.ts`: a SQLite-backed `RateLimitCoordinator` Durable Object, a narrow internal `/reserve`, `/validate`, and `/cooldown` interface, plus Eporner-only `/acquire` and `/release` lease endpoints, and a Worker-side coordinated-fetch wrapper.
- `apps/worker/wrangler.jsonc`: a `RATE_LIMIT_COORDINATOR` binding and declarative SQLite class export. `apps/worker/src/index.ts` re-exports the class from the Worker entry point, as Wrangler requires. This is repository configuration only; it does not create a Cloudflare namespace until deployment.
- `apps/worker/src/env.ts`: the typed binding contract.
- `apps/worker/src/providers/types.ts`: optional compile-time `rateLimitLane` metadata on a Provider.
- `apps/worker/src/providers/search.ts` and `src/index.ts`: inject the coordinator-backed fetch only for Providers that declare a lane.

Reservation is allocated using one SQLite UPSERT with `RETURNING`; it does not perform a read-then-write sequence. The rate-limit table stores timestamps per lane. Eporner also uses a separate exclusive-lock row containing only a short-lived lease ID and expiry timestamp; no query, result, media, or user data is stored. A request first reserves a slot, waits locally in the Worker, then revalidates the slot. Revalidation can move a queued request behind a newly extended cooldown, avoiding the common case where a 429 arrives after later requests have already reserved slots. For interval-only lanes, the coordinator cannot retroactively stop a request that has already passed validation and started its upstream fetch. Eporner additionally acquires an exclusive DO lease before starting and holds it until the response body has been fully buffered (with a 2 MiB cap), then releases it; its 30-second request timeout is shorter than the 60-second lease.

The fetch wrapper supports standard `Retry-After` (seconds or HTTP date) and MangaDex's `X-RateLimit-Retry-After` Unix timestamp. It also honors `X-RateLimit-Remaining: 0` on otherwise successful responses when a retry timestamp is supplied. It applies a conservative one-second fallback for 429/503 without a usable header. A coordinator error or missing binding fails closed: the rate-limited Provider's upstream fetch is not called. Provider cache lookups remain outside the wrapper, so a cache hit does not reserve a slot. Aborting while waiting prevents the upstream fetch; an already reserved slot may be wasted rather than unsafely released. Parsed cooldowns are sent to the Durable Object as bounded relative durations, not Worker-generated absolute timestamps; the Durable Object anchors each cooldown to its own clock to avoid cross-isolate clock skew shortening `Retry-After`.

The MangaDex Provider declares the `mangadex` lane, AniBT declares the `anibt` lane, and Perverzija DB declares the `perverzija` lane. Source configuration and enablement remain separate gates. The infrastructure remains dormant in production until the Worker and Durable Object are deployed and an approved MangaDex source is explicitly enabled.

## Cost and operational implications

The implementation is designed for Cloudflare Workers Free and does not require a Paid plan. Current published Free allowances include 100,000 Durable Object requests/day, 13,000 GB-s/day, 5 million SQLite rows read/day, 100,000 rows written/day, and 5 GB total SQLite storage per account (with a 1 GB per-object limit). On the Free plan, exceeding a Free limit causes further operations of that type to fail; it does not convert the account to Paid or create overage billing. Cloudflare states Workers Free users are not charged for SQLite storage. These limits can still make the coordinator unavailable under excessive traffic, in which case dependent Providers fail closed.

Other lanes use two DO requests per uncached upstream request (reserve and validate), plus an additional cooldown request after 429/503. Perverzija cache hits do not reserve a lane slot; cache misses use the same two-request coordinated-fetch path. Eporner adds acquire/release requests for its exclusive lease (four DO requests per uncached upstream request, plus cooldown when applicable). SQLite state remains bounded to one timestamp row per lane and one Eporner lock row. No paid plan, paid add-on, spending-limit change, deployment, or production namespace creation is part of this code change. Do not upgrade the Cloudflare plan to keep this feature running; if Free quotas are exceeded, leave the dependent Provider unavailable until the next daily reset or reduce traffic.

Official pricing and limits:
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/changelog/post/2025-12-12-durable-objects-sqlite-storage-billing/

## Verification still required before enabling

The current unit tests exercise the Worker fetch wrapper, fail-closed behavior, cancellation, cooldown propagation, lane validation, and the single-statement UPSERT shape using a test double. They do not prove real SQLite concurrency semantics or Cloudflare runtime behavior.

Before enabling any rate-limited Provider, still verify in a non-production Cloudflare environment:

1. Concurrent reservations on one lane receive non-overlapping slots.
2. Different lane object IDs do not block one another.
3. The timestamp row survives object eviction/restart.
4. Cooldown revalidation correctly re-queues pending reservations under actual concurrency.
5. Actual Workers cancellation and Durable Object binding failures fail closed.
6. Cache hits do not reserve a slot in the real Provider.
7. Existing unrelated Providers retain their current concurrency behavior.
8. Free-plan quotas and storage limits are respected under representative load.

## Verification layers and test strategy

The project deliberately separates three levels of evidence:

1. **Existing Node unit tests** (`tsx --test`) exercise the coordinator wrapper and SQL interaction through test doubles. They remain the fast default suite, but do not execute the Durable Object inside Cloudflare's `workerd` runtime.
2. **Local Workers runtime integration tests** are implemented with the official Workers Vitest integration (`@cloudflare/vitest-plugin`) and the repository's existing `apps/worker/wrangler.jsonc`. This runs the Worker and Durable Object in the local `workerd` runtime and supports direct Durable Object access, SQLite assertions, and explicit eviction through `cloudflare:test`. It is a separate test command (`npm run test:worker:runtime`); it does not replace or slow down the existing Node suite. The current declarative Wrangler `exports` configuration is consumed directly, without legacy `migrations` or changes to the production binding model.
3. **Hosted non-production Cloudflare verification** remains a separate gate. Local `workerd` tests cannot prove hosted account quotas, deployed namespace/binding configuration, Cloudflare network behavior, or real upstream reachability. Use only a dedicated test Worker, test KV namespace, and test-only secret/origin values. Never attach remote bindings to production resources.

The local runtime suite covers:

- Many concurrent `/reserve` calls on one lane produce monotonically spaced slots at the configured interval.
- Different lane IDs remain independent.
- A cooldown inserted after reservations causes pending slots to be shifted by `/validate`.
- SQLite timestamp state survives `evictDurableObject()` and reconstruction.
- A real upstream-style 429 response writes a cooldown through the coordinated-fetch path, and the next reservation observes that persisted cooldown.
- The actual DO request path accepts and rejects the same payloads as the existing wrapper expects.
- The existing Node tests continue to cover cancellation and fail-closed behavior when the coordinator binding is missing or errors.

For hosted verification, use bounded representative traffic to inspect request/SQLite usage against the Free allowances. Do not intentionally exhaust a shared account quota as a test. Cloudflare documents that Free-plan limit exhaustion causes the affected operation to fail; it does not automatically upgrade the account. Any real quota-exhaustion observation must be treated as an operational failure, not a target acceptance test.

Official Cloudflare testing guidance:
- [Testing Workers](https://developers.cloudflare.com/workers/testing/) — recommends Workers Vitest integration for unit tests and `createTestHarness()` for integration tests.
- [Testing Durable Objects](https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/) — documents SQLite-backed DO tests, direct access, and eviction helpers.
- [Workers Vitest configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/) — documents loading Wrangler configuration into the test runtime.
- [Local development](https://developers.cloudflare.com/workers/local-development/) — explains local `workerd` execution and local versus remote bindings.
## Source eligibility remains separate

A working limiter does not grant API permission. Before enabling a source, separately verify the current official terms, attribution, commercial status, data-license obligations, endpoint stability, response schema, and live Cloudflare connectivity.

- MusicBrainz: use `/ws/2`, a descriptive User-Agent, and only data whose applicable license is understood. The published 1 req/s limit is per source IP; non-commercial API access conditions must remain satisfied.
- MangaDex: metadata only; visibly credit MangaDex; do not add chapter reading or proxy chapter content; the project must not run ads or paid services while relying on its public API. Initial documented limit is 5 req/s per IP, plus endpoint-specific limits.
- Bangumi: use the maintained public `/v0/` API only. Do not rely on experimental keyword search as a production dependency or attempt to access NSFW-only data without authorization.\n- AniBT: use only the public anonymous Torznab read endpoint. The official docs state 60 requests/60 seconds/IP and no-store for Torznab. Use the shared 1,100 ms lane, do not cache responses, do not call personal RSS or group publishing endpoints, and keep the source disabled until hosted connectivity and content-policy review pass.

## Official references

- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- MangaDex API documentation and acceptable-use policy: https://api.mangadex.org/docs/
- MangaDex rate-limit guidance: https://api.mangadex.org/docs/ (Rate Limits)
- Bangumi public API documentation: https://bangumi.github.io/api/
- Bangumi public API repository and OpenAPI schema: https://github.com/bangumi/server/blob/master/openapi/v0.yaml
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/

## Local Durable Object runtime test suite

The opt-in local runtime suite is implemented with `@cloudflare/vitest-plugin` and loads the existing `apps/worker/wrangler.jsonc` directly:

```sh
npm run test:worker:runtime
```

It runs inside the local `workerd` runtime and covers concurrent reservation spacing for both configured lanes, per-lane isolation, cooldown revalidation, persistence of an upstream 429 cooldown through the coordinated-fetch path, and SQLite state persistence after Durable Object eviction. It is separate from the existing fast Node `tsx --test` suite so focused Worker tests remain quick.

The runtime suite uses the existing declarative `exports` configuration. Do not add legacy `migrations` alongside it: Wrangler treats the two Durable Object lifecycle declarations as mutually exclusive. The test command does not deploy a Worker, create a hosted namespace, access production KV, or call upstream Providers.

The full CI workflow runs both the fast Node suite and this local runtime suite as part of the same comprehensive verification run. Hosted non-production Cloudflare verification remains a separate operational gate and is not replaced by local `workerd` tests.


## LibriVox

LibriVox's first-party API update asks clients to separate requests by several seconds and warns that short-window throttling may return HTTP 429. The Worker has a dedicated compile-time `librivox` Durable Object lane with a 5,000 ms minimum interval and a registered `librivox-api` metadata-only Provider. The Provider is covered by a real first-party JSON fixture and Node tests; the lane is covered by Node and local `workerd` SQLite spacing and Retry-After persistence tests. Parsed Retry-After durations are anchored to the Durable Object clock. The source and adapter remain unconfigured and disabled; no production KV change or deployment is authorized. Non-production Hosted Cloudflare verification remains a separate pending gate.


## AudioSilo Meta

AudioSilo Meta's public API documents a 100 requests/second per-client token bucket with a burst of 400, plus `Retry-After` on 429. The Provider uses a dedicated shared `audiosilo` Durable Object lane at one request per second application-wide as a conservative initial cap. It does not cache search responses even though the API publishes a short 60-second cache lifetime. Upstream 429/503 responses are handled by the existing shared cooldown mechanism. The source remains disabled pending full CI and non-production Hosted Cloudflare verification.

The Provider uses only CC0 factual WorkResult fields. The rate-limit lane does not authorize access to, caching of, or reuse of the CC BY-SA community layer.
