# Shared Upstream Rate-Limiting Design

## Purpose

Some public metadata APIs impose limits on the application or source IP, not on one Worker invocation. The current search scheduler's maximum of ten concurrent Providers is a fan-out bound; it is not an upstream rate limiter.

The current Cloudflare Cache API is edge-local. Workers KV is eventually consistent and does not provide compare-and-swap transactions. Neither can enforce a strict cross-request, cross-isolate quota. Do not use either as a distributed lock or global rate limiter.

This document defines the implementation gate for APIs whose terms require coordinated outbound pacing. The Worker-side coordinator infrastructure and the MangaDex metadata Provider are implemented and registered on the feature branch. No MangaDex source/adapter configuration is enabled in KV, and no Cloudflare deployment or production binding has been applied.

## Current API requirements

| API | Requirement | Design target |
|---|---|---|
| MusicBrainz `/ws/2` | Official documentation currently states an average maximum of 1 request/second per source IP (unless otherwise agreed), and requires a meaningful identifying User-Agent | One shared application lane at a minimum 1,000 ms between requests; this is deliberately stricter and helps coordinate all Worker traffic, but the published numeric limit is IP-based |
| MangaDex REST | Initial documented limit 5 requests/second/IP, with endpoint-specific limits and response headers | One shared application-wide lane at 400 ms (2.5 requests/second), leaving headroom below the published ceiling; honor response headers and back off on 429 |
| Bangumi API v0 | Search endpoint currently marked experimental in the official OpenAPI schema | Do not implement keyword search against the experimental endpoint as a required Provider. Prefer a stable endpoint or keep it external-search until the API contract is suitable |

MusicBrainz documents its numeric 1 request/second ceiling against source IP, while also applying User-Agent-specific throttling. The project-wide lane is a conservative application-level control and must not be enforced independently per Worker instance. MangaDex documents an initial 5 requests/second per IP plus endpoint-specific limits; the project target is deliberately more conservative. Actual quota headers and newer official policy always take precedence over these starting intervals.

## Implemented coordinator infrastructure

The feature branch now contains:

- `apps/worker/src/rate-limit-coordinator.ts`: a SQLite-backed `RateLimitCoordinator` Durable Object, a narrow internal `/reserve`, `/validate`, and `/cooldown` interface, and a Worker-side coordinated-fetch wrapper.
- `apps/worker/wrangler.jsonc`: a `RATE_LIMIT_COORDINATOR` binding and declarative SQLite class export. `apps/worker/src/index.ts` re-exports the class from the Worker entry point, as Wrangler requires. This is repository configuration only; it does not create a Cloudflare namespace until deployment.
- `apps/worker/src/env.ts`: the typed binding contract.
- `apps/worker/src/providers/types.ts`: optional compile-time `rateLimitLane` metadata on a Provider.
- `apps/worker/src/providers/search.ts` and `src/index.ts`: inject the coordinator-backed fetch only for Providers that declare a lane.

Reservation is allocated using one SQLite UPSERT with `RETURNING`; it does not perform a read-then-write sequence. The DO stores only one row of timestamps per lane. A request first reserves a slot, waits locally in the Worker, then revalidates the slot. Revalidation can move a queued request behind a newly extended cooldown, avoiding the common case where a 429 arrives after later requests have already reserved slots. No scheduler can retroactively stop a request that has already passed validation and started its upstream fetch.

The fetch wrapper supports standard `Retry-After` (seconds or HTTP date) and MangaDex's `X-RateLimit-Retry-After` Unix timestamp. It also honors `X-RateLimit-Remaining: 0` on otherwise successful responses when a retry timestamp is supplied. It applies a conservative one-second fallback for 429/503 without a usable header. A coordinator error or missing binding fails closed: the rate-limited Provider's upstream fetch is not called. Provider cache lookups remain outside the wrapper, so a cache hit does not reserve a slot. Aborting while waiting prevents the upstream fetch; an already reserved slot may be wasted rather than unsafely released.

The MangaDex Provider declares the `mangadex` lane, but no configured/enabled source currently invokes it. The infrastructure remains dormant in production until the Worker and Durable Object are deployed and an approved MangaDex source is explicitly enabled.

## Cost and operational implications

The implementation is designed for Cloudflare Workers Free and does not require a Paid plan. Current published Free allowances include 100,000 Durable Object requests/day, 13,000 GB-s/day, 5 million SQLite rows read/day, 100,000 rows written/day, and 5 GB total SQLite storage per account (with a 1 GB per-object limit). On the Free plan, exceeding a Free limit causes further operations of that type to fail; it does not convert the account to Paid or create overage billing. Cloudflare states Workers Free users are not charged for SQLite storage. These limits can still make the coordinator unavailable under excessive traffic, in which case dependent Providers fail closed.

Normal operation uses two DO requests per uncached upstream request (reserve and validate), plus an additional cooldown request after 429/503. The SQLite state is bounded to one tiny row per configured lane. No paid plan, paid add-on, spending-limit change, deployment, or production namespace creation is part of this code change. Do not upgrade the Cloudflare plan to keep this feature running; if Free quotas are exceeded, leave the dependent Provider unavailable until the next daily reset or reduce traffic.

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

## Source eligibility remains separate

A working limiter does not grant API permission. Before enabling a source, separately verify the current official terms, attribution, commercial status, data-license obligations, endpoint stability, response schema, and live Cloudflare connectivity.

- MusicBrainz: use `/ws/2`, a descriptive User-Agent, and only data whose applicable license is understood. The published 1 req/s limit is per source IP; non-commercial API access conditions must remain satisfied.
- MangaDex: metadata only; visibly credit MangaDex; do not add chapter reading or proxy chapter content; the project must not run ads or paid services while relying on its public API. Initial documented limit is 5 req/s per IP, plus endpoint-specific limits.
- Bangumi: use the maintained public `/v0/` API only. Do not rely on experimental keyword search as a production dependency or attempt to access NSFW-only data without authorization.

## Official references

- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- MangaDex API documentation and acceptable-use policy: https://api.mangadex.org/docs/
- MangaDex rate-limit guidance: https://api.mangadex.org/docs/ (Rate Limits)
- Bangumi public API documentation: https://bangumi.github.io/api/
- Bangumi public API repository and OpenAPI schema: https://github.com/bangumi/server/blob/master/openapi/v0.yaml
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
