# Shared Upstream Rate-Limiting Design

## Purpose

Some public metadata APIs impose limits on the application or source IP, not on one Worker invocation. The current search scheduler's maximum of ten concurrent Providers is a fan-out bound; it is not an upstream rate limiter.

The current Cloudflare Cache API is edge-local. Workers KV is eventually consistent and does not provide compare-and-swap transactions. Neither can enforce a strict cross-request, cross-isolate quota. Do not use either as a distributed lock or global rate limiter.

This document defines the implementation gate for APIs whose terms require coordinated outbound pacing. It does not add a runtime binding, change a Provider, or deploy infrastructure.

## Current API requirements

| API | Requirement | Design target |
|---|---|---|
| MusicBrainz `/ws/2` | At most 1 request/second per client application; meaningful identifying User-Agent | One shared lane per application, minimum 1,000 ms between upstream requests |
| MangaDex REST | Initial documented limit 5 requests/second/IP, with endpoint-specific limits and response headers | One shared application-wide lane at 400 ms (2.5 requests/second), leaving headroom below the published ceiling; honor response headers and back off on 429 |
| Bangumi API v0 | Search endpoint currently marked experimental in the official OpenAPI schema | Do not implement keyword search against the experimental endpoint as a required Provider. Prefer a stable endpoint or keep it external-search until the API contract is suitable |

The MusicBrainz limit is application-scoped and must not be enforced independently per Worker instance. The MangaDex target is deliberately more conservative than its documented initial ceiling. Actual response headers and newer official policy always take precedence over these starting intervals.

## Proposed implementation

### One Durable Object coordinator

Use a single SQLite-backed Durable Object class with a deterministic object ID per upstream service/rate-limit lane:

- `musicbrainz`
- `mangadex`

Each object serializes slot reservations for its lane. The coordinator stores only infrastructure scheduling state:

- lane key
- next allowed timestamp
- cooldown-until timestamp

It must not store search queries, result payloads, user identifiers, metadata, or media. No D1 database is introduced, and no user-facing data is persisted.

The Worker reserves a slot immediately before an actual upstream fetch. A cache hit must happen before reservation so cached requests do not consume upstream quota. The Worker then waits until the returned slot time and makes the request.

Use a single atomic SQLite upsert/statement to reserve the next slot; do not implement a read-then-write sequence across awaits. The Durable Object should expose only a narrow internal reservation/cooldown interface, not a generic proxy accepting arbitrary URLs.

### Provider integration boundary

Keep the scheduler and Providers decoupled:

- Add an optional rate-limit policy to the compiled Provider definition (lane key and minimum interval).
- Inject a Worker-owned rate-limit callback into Provider execution context.
- Wrap the Provider's outbound `fetch` in the scheduler so every network request made by a rate-limited Provider reserves a slot automatically.
- Keep Cache API lookup before outbound fetch, preserving the existing cache-key and TTL behavior.
- Keep the existing ten-worker scheduler concurrency bound. The shared lane serializes only Providers that declare a coordinated policy; unrelated sources remain concurrent.

This is preferable to embedding Durable Object calls separately in every adapter. It keeps policy in the Provider registry and coordination mechanics in the Worker composition layer.

### Backoff and failure behavior

- Respect `Retry-After` and API-specific rate-limit headers.
- On a rate-limit response, extend the lane cooldown before another request can be reserved. For APIs that return 503 for throttling, use a conservative fallback delay when no usable header is present.
- Do not retry the failed request in a tight loop.
- If the coordinator is unavailable, fail closed for Providers that require it: return the normal per-source failure status and do not send an uncoordinated upstream request.
- If the incoming search request is cancelled while waiting for a slot, stop waiting and do not issue the upstream request. The reserved slot may remain unused; that is safer than releasing it and allowing a burst.

## Cost and operational implications

Durable Objects are available on Cloudflare Workers Free and Paid plans. The published Free allocation includes 100,000 Durable Object requests/day and 13,000 GB-s/day; exceeding a Free allocation causes further operations of that type to fail. Paid-plan usage beyond included allocations can incur charges.

For this project, one reservation per uncached upstream HTTP request is the expected baseline. The coordinator should remain stateless apart from a tiny per-lane timestamp record, and its request volume should be measured before enabling these sources. Configure account spending limits/alerts where available. Do not assume that using Durable Objects is unconditionally free at every traffic level.

The coordinator is infrastructure state, not a general database backend. If the user elects not to introduce this small Durable Object, keep MusicBrainz and MangaDex Provider execution deferred; do not substitute KV writes or edge-local in-memory throttles and claim global compliance.

## Tests required before enabling

1. Concurrent reservations for one lane receive non-overlapping scheduled slots.
2. Different lanes do not block one another.
3. The stored next-slot timestamp survives object eviction/restart.
4. Cooldown extends the next eligible slot and respects server-provided retry timing.
5. Aborted requests do not proceed to upstream fetch.
6. Coordinator failures fail closed.
7. Cache hits do not reserve a slot.
8. Existing unrelated Providers retain their current concurrency behavior.
9. Unit tests use the current `tsx --test` runner; no new test framework is needed.

## Source eligibility remains separate

A working limiter does not grant API permission. Before enabling a source, separately verify the current official terms, attribution, commercial status, data-license obligations, endpoint stability, response schema, and live Cloudflare connectivity.

- MusicBrainz: use `/ws/2`, a descriptive User-Agent, and only data whose applicable license is understood. Non-commercial API access conditions must remain satisfied.
- MangaDex: metadata only; visibly credit MangaDex; do not add chapter reading or proxy chapter content; the project must not run ads or paid services while relying on its public API.
- Bangumi: use the maintained public `/v0/` API only. Do not rely on experimental keyword search as a production dependency or attempt to access NSFW-only data without authorization.

## Official references

- MusicBrainz API: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- MangaDex API documentation and acceptable-use policy: https://api.mangadex.org/docs/
- MangaDex rate-limit guidance: https://api.mangadex.org/docs/ (Rate Limits)
- Bangumi public API documentation: https://bangumi.github.io/api/
- Bangumi public API repository and OpenAPI schema: https://github.com/bangumi/server/blob/master/openapi/v0.yaml
- Cloudflare Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
