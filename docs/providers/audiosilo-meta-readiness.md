# AudioSilo Meta Provider — implementation and verification status

**Review date:** 2026-11-27  
**Disposition:** Worker Provider implemented and registered; source and adapter remain unconfigured/disabled; CI and non-production Cloudflare hosted verification pending.

## Decision and licence boundary

AudioSilo Meta exposes a public, read-only audiobook catalogue API. Its factual core (works, recordings, people, and series) is dedicated to CC0-1.0. The separately maintained community layer is CC BY-SA 4.0 and is composed into the live SQLite artifact served by the API.

The Provider uses only the documented `/api/v1/works/search` response's factual `WorkResult` fields:
- Work ID and title.
- Author and narrator names.
- Language.
- Series name and string position.
- Release date.

It deliberately ignores `cover_url`, `description`, `genres`, `characters`, `recaps`, `community_description`, chapter data, and every other field outside the approved CC0 metadata allowlist. It never calls work-detail, chapters, people, series, bulk snapshot, or community endpoints. The Provider does not copy AudioSilo code; the upstream code's AGPL licence is not used as an implementation dependency.

## First-party evidence

- API reference: https://meta.audiosilo.app/docs/api
- OpenAPI source: https://github.com/KodeStar/audiosilo-meta/blob/main/internal/serve/openapi.json
- Data licence: https://github.com/KodeStar/audiosilo-meta/blob/main/LICENSING.md
- Repository overview: https://github.com/KodeStar/audiosilo-meta

The OpenAPI contract documents `GET /api/v1/works/search?q=&limit=`, with `limit` capped at 50 and a WorkResult shape. The public deployment applies a per-client token-bucket limit and returns `429` with `Retry-After`; search responses carry a short `Cache-Control` lifetime. The Provider uses a smaller 20-result cap and a conservative shared one-second Durable Object lane. The shared coordinator persists 429/503 cooldowns.

The canonical human-readable work page route is `https://meta.audiosilo.app/works/{id}`. The API is public, read-only, requires no API key, and supports ordinary GET requests.

## Implemented contract

| Property | Implementation |
|---|---|
| Provider ID | `audiosilo-meta-api` |
| Version | `1.0.0` |
| Mechanism | `api` |
| Source category | `other-index` |
| Content category | `audiobook` |
| Capability | metadata only |
| Search mode | keyword |
| Endpoint | Fixed `https://meta.audiosilo.app/api/v1/works/search` |
| Query | `q={query}` |
| Interactive result cap | 20 |
| Shared rate limit | Durable Object lane `audiosilo`, 1,000 ms minimum spacing |
| Cache | None |
| Result link | Canonical `/works/{id}` page |

The response parser requires a `results` array, accepts only `kind: "work"` records with bounded slug IDs and non-empty titles, and validates optional dates. It bounds the response body at 1 MiB, rejects unexpected content types, redirects, HTTP errors, malformed JSON and invalid envelopes, and propagates cancellation. Upstream 429/503 responses pass through the shared coordinator's Retry-After cooldown path.

## Code and test coverage

- Provider: `apps/worker/src/providers/audiosilo-meta-api.ts`
- Registry: `apps/worker/src/providers/registry.ts`
- Provider tests: `apps/worker/tests/providers/audiosilo-meta-api.test.ts`
- Response fixture: `apps/worker/tests/fixtures/audiosilo-meta-works.json`
- Shared pacing lane: `apps/worker/src/rate-limit-coordinator.ts`
- Node lane test: `apps/worker/tests/rate-limit-coordinator.test.ts`
- Local workerd concurrency test: `apps/worker/runtime-tests/rate-limit-coordinator.test.ts`
- Source catalog entry: `apps/web/src/modules/sources/sourceCatalog.ts`

Tests cover the documented request contract, CC0 field allowlist, exclusion of cover/community fields, canonical result links, malformed and non-work records, invalid envelope/content type, redirects, oversized bodies, malformed JSON, Retry-After errors, query bounds, cancellation, and shared SQLite pacing.

## Deployment and activation status

- Worker implementation: registered in code.
- Source catalog: registered as a Provider candidate.
- Adapter KV record: not created.
- Source KV record: not created.
- Adapter enabled: no.
- Source enabled: no.
- Production KV mutation: none.
- Deployment: none.
- CI: pending; run the complete module CI after implementation and documentation are integrated.
- Non-production Cloudflare hosted verification: not started; no live API connectivity or hosted quota claim is made.

When eventually configured in a test environment, both adapter and source must initially remain disabled. The implementation does not authorize production enablement.
