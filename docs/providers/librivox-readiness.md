# LibriVox Provider — implementation readiness

**Review date:** 2026-11-27  
**Disposition:** Provider candidate; implementation not started; source remains unconfigured and disabled.

## Decision summary

LibriVox is a strong candidate for a metadata-only audiobook search Provider. Its first-party API is released, supports JSON, title/author/genre filters, field selection, and bounded pagination. LibriVox explicitly welcomes third-party applications sharing and re-sharing its public-domain recordings. This is materially stronger evidence than a generic public endpoint.

The source is **not yet implementation-ready** for Provider registration because one integration detail remains unresolved:

1. The product now has a first-class `audiobook` content category, with a dedicated user-facing label and Worker validation. The live JSON response envelope and representative nested `authors` / `genres` structures have not yet been captured as a reviewed fixture. Do not infer these shapes from the endpoint documentation alone.

No Provider code, KV record, enablement, or deployment is included in this readiness review.

## Verified first-party contract

Canonical API: `https://librivox.org/api/feed/audiobooks`

- API status: released.
- Search fields: `title`, `author`, and `genre`; a leading `^` requests prefix matching. Title/author/genre matching is not documented as arbitrary substring search.
- Response formats include JSON. The default is XML, so clients must explicitly request `format=json`.
- `fields` can restrict top-level returned fields and include supported subgroups such as `authors` and `genres`.
- `limit` defaults to 50 and is capped at 500; `offset` supports pagination.
- `since` accepts a UNIX timestamp for incremental catalogue updates. LibriVox recommends using midnight UTC for the date being checked.
- The September 16, 2026 first-party API notice asks clients to separate requests by several seconds and warns that future short-window rate limiting may return HTTP 429.
- First-party documentation lists metadata fields including ID, title, description, language, copyright year, section count, RSS URL, catalogue URL, total runtime, authors, genres, and optional cover art / audio-related links.

References:
- https://librivox.org/api/info
- https://librivox.org/2026/09/16/librivox-api-update/
- https://librivox.org/pages/public-domain/

## Rights and scope

LibriVox states that its recordings are public domain in the United States and welcomes third-party sharing/re-sharing. It also cautions that the underlying source texts may not be public domain in every jurisdiction. This Provider should therefore index LibriVox catalogue metadata and link to the canonical LibriVox project page; it must not imply that every underlying literary work is public domain worldwide.

Proposed initial scope:
- Metadata only: project ID, title, description, language, authors, genres, runtime, and canonical project page.
- Include a visible LibriVox attribution/link-back.
- Do not fetch, proxy, cache, host, or repackage audio files.
- Do not request cover art initially; the platform's current Provider contract has no need for an image capability here.
- Do not import the full catalogue or run background polling as part of interactive search.

## Proposed implementation contract

- Provider ID: `librivox-api`.
- Mechanism: `api`.
- Source category: `other-index`.
+ Content category: `audiobook` (now added to shared types/labels; the existing frontend filter is data-driven from the shared category list, and Worker validation accepts the category).
- Capability: `metadata` only.
- Search mode: `keyword` only.
- Endpoint: fixed first-party HTTPS host `librivox.org`; no user-controlled host or redirect following.
- Query mapping: initially use title prefix search (`title=^<query>`) with a bounded result limit. This is prefix matching, not general full-text search; communicate that limitation in source notes/UI as appropriate. Author/genre search can be considered later as distinct filters rather than issuing several automatic requests per keystroke.
- Request fields: explicitly request only the approved metadata fields; do not request `sections`, `url_zip_file`, `coverart_*`, or audio assets.
- Result limit: 20 for interactive search; no pagination in the interactive path.
- Shared pacing: add a dedicated Durable Object lane at **5,000 ms minimum spacing**. The existing coordinator has a compile-time lane allowlist and currently supports 1,000–2,100 ms lanes; merely setting a delay in the Provider would not coordinate concurrent Worker instances. Add the new lane to the type, interval map, lane validator, tests, and runtime integration assertions. Preserve fail-closed behavior and Retry-After cooldown handling.
- Cache: an optional short edge cache may be used only after confirming response shape and cache behavior; cache is an optimization, not a substitute for the shared pacing lane.
- Error handling: fail on non-2xx, unexpected content type, invalid JSON/envelope, oversized body, unexpected redirect/host, and malformed records. Respect 429/503 and Retry-After; never turn an upstream error into an empty successful result.
- Tests: representative live-response fixtures (sanitized but structurally faithful), title prefix encoding, nested authors/genres parsing, invalid records, response-size bounds, redirect rejection, cancellation, cache hit/failure, and shared-lane fail-closed/cooldown tests.

## Readiness gates before implementation

1. ~~Add `audiobook` as a first-class content category.~~ Completed in the shared type/label contract; frontend filtering is driven by this shared list, and Worker validation is covered by a focused test.
2. Capture and review a real first-party JSON response and add it as a fixture.
3. Implement the 5-second shared lane in the existing Durable Object coordinator and its local workerd suite.
4. Implement the metadata-only Provider and focused tests; register it only in the same change.
5. Add the adapter/source definitions as disabled and unconfigured; no production KV mutation.
6. Run the complete CI suite once the module is complete.
7. Perform a separate non-production Cloudflare live connectivity check before any enablement decision.

## Current state

- Candidate catalog entry exists: `librivox` (`contentCategory: audiobook`; disabled/unconfigured).
- Provider implementation: no.
- Adapter registry entry: no.
- KV configuration: none verified.
- Enabled: no.
- Cloudflare hosted verification: not started.
