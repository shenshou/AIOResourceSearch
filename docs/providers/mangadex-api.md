# MangaDex API Provider

## Status

The Worker implementation is registered in the compile-time Provider registry, but **the adapter and source remain unconfigured/disabled**. No KV record has been written, no Cloudflare binding has been deployed, and no live MangaDex request has been made from Cloudflare.

- Provider ID: `mangadex-api`
- Version: `1.0.0`
- Mechanism: API
- Source category: `other-index`
- Content category: `manga`
- Search mode: keyword only
- Rate-limit lane: `mangadex` (400 ms application-wide reservation interval)
- Capabilities: metadata only

## API contract

- Base endpoint: `https://api.mangadex.org/manga`
- Method: `GET`
- Search text: scalar `title` query parameter (not `title[]`)
- `limit=20`, `offset=0`
- Explicit repeated `contentRating[]` values: `safe`, `suggestive`, `erotica`, `pornographic`
- Descriptive `User-Agent`: `AIOResourceSearch/0.1.0` with the public repository URL
- `Accept: application/json`
- No API key or user account is used.

The request intentionally omits relationship expansion and pagination. The first version makes one narrow metadata search request and returns at most 20 valid records.

## Result mapping

| MangaDex field | Shared result |
|---|---|
| `data[].id` | Stable result ID |
| `attributes.title` | Localized title; prefer English, Japanese, romanized Japanese, then Chinese, then first available |
| `attributes.description` | Localized description, maximum 4,000 characters |
| `attributes.status` | `metadata.status` |
| `attributes.originalLanguage` | `metadata.originalLanguage` |
| `attributes.contentRating` | `metadata.contentRating` |
| `attributes.year` | `metadata.year`; never converted to a fabricated full date |
| `attributes.tags[].attributes.name` | Up to 20 tag names in `metadata.tags` |
| MangaDex ID | Canonical `https://mangadex.org/title/{id}` result URL |

Every result also includes a visible `MangaDex attribution` link to `https://mangadex.org`. The source label is MangaDex. Author/artist relationships, cover art, images, chapters, chapter feeds, reader content, accounts, and user endpoints are not requested.

## Runtime safeguards

- HTTPS fixed endpoint; manual redirect handling; no redirect following.
- Exact upstream host validation.
- JSON Content-Type validation.
- 2 MiB streamed response-size ceiling, plus Content-Length pre-check.
- UUID validation for MangaDex result IDs.
- Strict field/type/length checks; malformed records are dropped.
- Cache API lookup occurs before coordinated fetch; cache TTL is one hour.
- Cache hit does not consume a Durable Object reservation.
- The shared `mangadex` Durable Object lane is mandatory. Missing/unavailable coordinator fails closed.
- No retry loop on 429. `Retry-After`, MangaDex `X-RateLimit-Retry-After`, and exhausted-quota headers extend the shared cooldown.
- Search cancellation is passed to upstream fetch and coordinator wait.

## Required administrative records (disabled template only)

The following are examples for a future, separately approved configuration change. They have **not** been written to KV.

Adapter record:

```json
{
  "id": "mangadex-api",
  "name": "MangaDex API",
  "description": "Public MangaDex manga metadata search.",
  "mechanism": "api",
  "contentCategories": ["manga"],
  "version": "1.0.0",
  "enabled": false,
  "categories": ["other-index"],
  "capabilities": ["metadata"],
  "implemented": true
}
```

Source record:

```json
{
  "id": "mangadex",
  "name": "MangaDex",
  "category": "other-index",
  "contentCategory": "manga",
  "type": "provider",
  "adapterId": "mangadex-api",
  "enabled": false,
  "searchModes": ["keyword"],
  "capabilities": ["metadata"],
  "timeoutMs": 10000
}
```

Both records must remain disabled until a non-production Cloudflare environment verifies the SQLite Durable Object binding, real concurrency spacing, cooldown behavior, object restart persistence, and Free-plan quota behavior. Enabling the source also requires a fresh review of MangaDex's Acceptable Usage Policy and confirmation that the product remains ad-free and free of paid services.

## Policy and scope

MangaDex's official Acceptable Usage Policy requires credit and prohibits advertisements and paid services on the integrating website/app. This Provider therefore must not be used if the product later introduces ads or paid access unless MangaDex grants written permission.

This integration is metadata-only. It does not fetch or proxy chapter text, chapter images, cover art, or reader content, and it does not attempt to bypass content ratings or API restrictions.

## Tests

`apps/worker/tests/providers/mangadex-api.test.ts` covers the request contract, locale mapping, metadata normalization, attribution link, malformed records, cache-hit behavior, unexpected content types, invalid envelopes, and redirect rejection.

The shared coordinator tests cover fail-closed behavior, cancellation, reservation validation, cooldown propagation, and MangaDex exhausted-quota headers. These tests use test doubles; real Cloudflare Durable Object/SQLite concurrency and live upstream connectivity remain unverified.

## Official references

- API docs: https://api.mangadex.org/docs/
- OpenAPI document: https://api.mangadex.org/docs/static/api.yaml
- Acceptable Usage Policy: https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/main/index.md
- Rate limits: https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/main/rate-limits.md
