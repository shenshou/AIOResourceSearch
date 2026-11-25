# Provider Integration Readiness — API Candidates

This document converts source-policy review into implementation-ready contracts. It is deliberately stricter than “an endpoint exists”: a Provider is not approved until its endpoint is stable, its intended use is permitted, its quota behavior is coordinated, and its response can be mapped into the shared result model.

## Decision summary

| Candidate | Search contract | Authentication | Quota / policy | Current implementation decision |
|---|---|---|---|---|
| Bangumi API v0 | `POST /v0/search/subjects` supports keyword search but is explicitly marked experimental; stable `GET /v0/subjects/{id}` is detail lookup, not keyword search | Public subject reads can be anonymous; optional bearer token must not be added just to obtain restricted data | No verified numeric public quota; meaningful User-Agent and conservative behavior | **Deferred** — no production keyword-search Provider until a stable search contract exists |
| MangaDex API | Public `GET /manga` search/list endpoint; title, content-rating, language, tag and paging filters | Public metadata endpoints do not require user login | Initial global IP limit documented at 5 req/s; endpoint-specific limits and response headers apply. AUP requires credit and prohibits ads/paid services | **Conditional implementation candidate** — metadata only, shared coordinator required, product must remain ad-free/free |
| MangaUpdates API | Public `POST /series/search` endpoint exists; exact request/response schema must be pinned from current OpenAPI before coding | Most API functions public/no account; user-based functions require account | AUP requires credit, reasonable spacing, caching, and prohibits use assisting illegal action | **Deferred pending scope clarification** — because this product also aggregates torrent sources, obtain written confirmation that metadata-only MangaUpdates use in this integrated product is acceptable |

## 1. Bangumi API v0

### Official contract

- API base: `https://api.bgm.tv/v0/`
- Stable detail lookup: `GET /subjects/{subject_id}`
- Keyword search: `POST /search/subjects`
- The current OpenAPI schema explicitly labels `POST /search/subjects` experimental and warns that both schema and runtime behavior may change at any time.
- Stable `GET /subjects` is a browse/list endpoint. It requires `type` and supports category, year/month, sorting and pagination; it is not a replacement for arbitrary keyword search.
- The old unversioned API (for example `/subject/{id}`) is no longer maintained and must not be used for new work.

### Search and mapping

No supported stable keyword-search endpoint is currently verified. Therefore do not implement a Provider that silently relies on the experimental endpoint.

If Bangumi later stabilizes keyword search, map only public subject metadata:

| Shared result field | Bangumi field / rule |
|---|---|
| `title` | `name_cn` when non-empty, otherwise `name` |
| `url` | Canonical `https://bgm.tv/subject/{id}` |
| `releaseDate` | `date`, only when it is a valid date |
| `description` | `summary`, bounded and text-only |
| `metadata` | Subject type, aliases, rating score/count, rank, tags |
| `image` | Omit in first version; image endpoint redirects and image-use/display policy needs separate verification |
| Resource links | None; do not infer download links from subject metadata |

### Restrictions and safeguards

- Do not use private website APIs, legacy unversioned APIs, account cookies, or user collections.
- Do not request or attempt to obtain NSFW-only data without authorization. The API schema documents that unauthorized requests cannot retrieve NSFW entries even when the parameter is supplied.
- Do not make experimental keyword search a production dependency.
- Use a meaningful project-identifying User-Agent and conservative request pacing; stop/back off on 429/5xx.
- No user account or OAuth flow is needed for the proposed public metadata-only use.

### Decision

**Deferred.** Bangumi has useful public metadata, but its current documented keyword search is experimental. A stable browse endpoint cannot provide equivalent arbitrary search. Keep it out of the Provider registry until the search contract is stabilized or Bangumi documents a suitable supported alternative.

Official references:
- https://bangumi.github.io/api/
- https://github.com/bangumi/server/blob/master/openapi/v0.yaml
- https://github.com/bangumi/dev-docs

## 2. MangaDex API

### Official contract

- API base: `https://api.mangadex.org`
- Search/list: `GET /manga`
- The endpoint supports title search, paging, content-rating filters, original/translated language filters, tags and included relationships.
- Public manga metadata lookup does not require a user account.
- Search result structure is an envelope with `data` records; each record contains an ID and attributes, with related author/artist/cover entities available through requested relationships.

### Proposed request profile

Initial implementation should keep the request narrow:

- `title`: the user's search query (single string parameter; do not send `title[]`)
- `limit`: bounded to 20 results for this aggregator (never request the maximum merely because the API allows it)
- `offset`: initially 0; only paginate if the caller explicitly requests more results and within the Worker result cap
- `contentRating[]`: repeat explicitly for the ratings the product intends to include; the API currently documents `safe`, `suggestive`, `erotica`, and `pornographic`
- `includes[]`: omit in the first version; do not expand author, artist, or cover relationships until their need and data mapping are separately reviewed
- No chapter, feed, upload, user, account, or reading endpoints

The current OpenAPI contract (version 5.13.1) defines `title` as a scalar string, `limit` as an integer from 0 to 100, `offset` as a non-negative integer, `contentRating[]` as an array of the four values above, and `includes[]` as a relationship-expansion array. The implementation deliberately requests only 20 results and does not paginate.

### Proposed field mapping

| Shared result field | MangaDex field / rule |
|---|---|
| `title` | `attributes.title` localized title; prefer English, then first available title |
| `url` | `https://mangadex.org/title/{id}` |
| `releaseDate` | Do not fabricate a release date; `year` is a year-only value and belongs in metadata unless the shared type explicitly supports year precision |
| `description` | `attributes.description` in selected locale, bounded |
| `metadata` | Status, original language, content rating, publication year, tags; author/artist omitted in v1 because relationships are not expanded |
| `image` | Omit initially; cover hotlinking and image-display policy must be verified separately |
| Resource links | None; never fetch or proxy chapter images or chapter content |

### Attribution and product conditions

MangaDex's official Acceptable Usage Policy requires visible credit and prohibits ads or paid services on the integrating website/app. Chapter reading would add scanlation-group credit and content-removal obligations; this project does not need chapter reading.

Before enabling:
- Keep the visible MangaDex attribution link rendered on each result card.
- Keep the product ad-free and free of paid services while relying on this API.
- Use metadata only; do not build a reader, proxy chapter images, fetch chapter text, or mirror chapter data.
- Respect content ratings and do not bypass any API restriction.
- Re-check the AUP before release; if the product later adds ads or paid tiers, disable this Provider unless MangaDex grants written permission.

### Quota coordination

The published initial global limit is 5 requests/second per source IP, with additional endpoint-specific limits and quota headers. Use the previously designed shared Durable Object lane at a conservative 400 ms minimum interval (2.5 requests/second application-wide), not a per-isolate throttle. Read `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Retry-After`; the last is documented as a Unix timestamp. On 429 or exhausted quota, extend the lane cooldown and do not retry in a tight loop.

### Decision

**Implemented in Worker code; not enabled.** The Provider uses the documented scalar `title` parameter, 20-result limit, explicit content-rating filters, metadata-only mapping, visible MangaDex attribution, and the shared 400 ms Durable Object lane. It is registered in the compile-time Worker registry, but no source/adapter configuration has been written to KV. Enablement still requires the non-production Cloudflare coordinator/runtime checks and confirmation that the deployed product remains ad-free/free.

Official references:
- https://api.mangadex.org/docs/
- https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/main/index.md
- https://gitlab.com/mangadex-pub/mangadex-api-docs/-/blob/main/rate-limits.md

## 3. MangaUpdates API

### Official contract

- API base: `https://api.mangaupdates.com/v1`
- The official OpenAPI documentation lists `POST /series/search` and `GET /series/{id}`.
- The documentation says most API functions are public and do not require an account; user-based functions require an account.
- The docs expose Bearer authentication for account-restricted operations. Do not assume a token is needed for public series search, and do not create or store a user account for this Provider.
- The API documentation is the source of truth for request/response shapes. The exact `POST /series/search` body and response schema must be pinned from the current OpenAPI YAML and verified with a minimal anonymous request before implementation. Do not guess fields based on third-party clients.

### Intended narrow scope

If policy clarification is obtained, restrict the Provider to:
- Public series search and public series detail only.
- Title, alternate titles, synopsis, author/artist, publication status/year, genres/categories, and MangaUpdates canonical detail URL, but only fields confirmed in the current OpenAPI schema.
- No account, member, private list, inbox, forum posting, review/comment mutation, release/download, image upload, or other user-specific endpoints.
- No download URL, chapter image, or file acquisition.

### Acceptable Use Policy

The official policy requires:
- Credit MangaUpdates when using API data.
- Reasonable spacing between requests.
- Caching.
- No use that deceives or defrauds users, assists or performs an illegal action, creates spam, or damages the database.

The last restriction needs special care: AIOResourceSearch is an integrated product that also includes torrent-index sources. Even if the MangaUpdates adapter itself returns metadata only, the product context could be interpreted broadly. We must not assume that separating the metadata Provider from torrent Providers resolves this policy issue.

### Quota and cache design

MangaUpdates does not publish a numeric requests-per-second ceiling in the reviewed API policy. Do not invent one as an official limit. For a first controlled implementation, use a conservative internal 1-second minimum interval per shared lane, cache successful public search/detail responses, and adjust only after written guidance or official headers. This is a project safety default, not a claimed MangaUpdates requirement.

### Decision

**Deferred pending written scope clarification.** Ask MangaUpdates whether metadata-only public series search in a free, ad-free, multi-source resource search product that separately lists torrent indexes is compatible with its “assist or perform an illegal action” restriction. Until clarified, do not register or enable this Provider.

Official reference:
- https://mangaupdates.apidocumentation.com/

## Shared implementation design

No new database is required for metadata or search results. If the project elects to implement MangaDex, the Durable Object described in [provider-rate-limiting.md](./provider-rate-limiting.md) is infrastructure-only and stores only per-lane timestamps/cooldowns.

Implementation sequence:
1. Implement and test the shared Durable Object coordinator, including concurrent reservation, persistence, cooldown, abort, and fail-closed tests.
2. Re-verify current MangaDex OpenAPI schema, AUP, query enums, response fields, and cover-image policy.
3. Implement MangaDex metadata-only Provider with fixtures and schema validation.
4. Add visible attribution and an explicit product-level no-ads/no-paid guard documented in release readiness.
5. Perform a live non-production Worker test; keep source disabled until policy and connectivity checks pass.
6. Revisit Bangumi only after a stable keyword-search contract exists.
7. Revisit MangaUpdates only after written scope clarification.

## Explicit non-changes

This readiness review does not add Provider code, source catalog records, KV configuration, Durable Object bindings, secrets, source enablement, or Cloudflare deployment.
