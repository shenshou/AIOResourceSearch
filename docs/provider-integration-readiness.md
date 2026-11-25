# Provider Integration Readiness — API Candidates

This document converts source-policy review into implementation-ready contracts. It is deliberately stricter than “an endpoint exists”: a Provider is not approved until its endpoint is stable, its intended use is permitted, its quota behavior is coordinated, and its response can be mapped into the shared result model.

## Decision summary

| Candidate | Search contract | Authentication | Quota / policy | Current implementation decision |
|---|---|---|---|---|
| Bangumi API v0 | `POST /v0/search/subjects` supports keyword search but is explicitly marked experimental; stable `GET /v0/subjects/{id}` is detail lookup, not keyword search | Public subject reads can be anonymous; optional bearer token must not be added just to obtain restricted data | No verified numeric public quota; meaningful User-Agent and conservative behavior | **Deferred** — no production keyword-search Provider until a stable search contract exists |
| MangaDex API | Public `GET /manga` search/list endpoint; title, content-rating, language, tag and paging filters | Public metadata endpoints do not require user login | Initial global IP limit documented at 5 req/s; endpoint-specific limits and response headers apply. AUP requires credit and prohibits ads/paid services | **Conditional implementation candidate** — metadata only, shared coordinator required, product must remain ad-free/free |
| MangaUpdates API | Public `POST /series/search` endpoint exists; exact request/response schema must be pinned from current OpenAPI before coding | Most API functions public/no account; user-based functions require account | AUP requires credit, reasonable spacing, caching, and prohibits use assisting illegal action | **Deferred pending scope clarification** — because this product also aggregates torrent sources, obtain written confirmation that metadata-only MangaUpdates use in this integrated product is acceptable |
| MusicBrainz API | Official `GET /ws/2/release-group` search supports JSON, Lucene query, limit and offset | Read-only search requires no API key or user account | Free for non-commercial use; meaningful User-Agent; average max 1 request/second per source IP; core data CC0, supplementary data CC BY-NC-SA 3.0 | **Implemented in Worker; disabled pending hosted verification** — core release-group metadata only, shared one-second Durable Object lane, no tags/ratings/cover art |

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
- https://gitlab.com/mangadex-pub/mangadex-api-docs/-/raw/main/static/api.yaml
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


## DMHY public RSS — implemented, disabled pending hosted verification

- Official FAQ documents `https://share.dmhy.org/topics/rss/rss.xml?keyword={query}` as a public keyword RSS interface and describes AND/OR query syntax.
- The Provider is `dmhy-rss` v1.0.0, RSS mechanism, torrent source category, anime content category, metadata + magnet capabilities, keyword-only.
- The official FAQ describes the site as free and its focus as anime/tokusatsu/Japanese drama; its publishing rules prohibit real-person pornography. This is not classified as a JAV source.
- No numeric request quota was identified in the reviewed FAQ. Keep disabled until Cloudflare Hosted access, conservative request pacing, current terms/robots and content legality are reviewed.
- No KV configuration or source enablement is included.


## Authenticated Provider credential injection

The Worker has a source-scoped credential injection path:

- A source's `credentialBinding` is a dedicated Worker Secret binding name prefixed with `SOURCE_CREDENTIAL_`, not a credential value. The prefix prevents source configuration from referencing reserved bindings such as `ADMIN_API_TOKEN` or `SOURCES_KV`.
- At request time the Worker resolves only the binding named by that source and passes the value to that source's Provider through `ProviderContext.credential`.
- If a source declares a binding but the secret is missing or empty, the source is marked unavailable with `credential_unavailable`; the Provider is not called.
- The credential is not written to KV, included in public source responses, or returned in search/test results.
- Provider implementations remain responsible for sending credentials only to the reviewed canonical HTTPS host, refusing unsafe redirects, and never logging the credential.
- Local development uses an ignored `.dev.vars` file. Deployed credentials are provisioned separately as Worker Secrets; Wrangler's `secret put` creates a new Worker version and deploys it immediately, so secret provisioning is a release operation, not an admin CRUD action.
- On the Workers Free plan, environment variables and secrets share a per-Worker limit of 64 bindings and 5 KB per value. Keep one small secret per credential binding; reassess the storage design before approaching the binding limit.

This is a generic transport boundary, not a universal login automation engine. Provider-specific authentication (Bearer token, API key, Cookie, or OAuth) still requires a documented contract and a narrow implementation. Interactive login, CAPTCHA solving, anti-bot bypass, paywall bypass, and evasion of geo/IP/rate restrictions remain out of scope.


## AniBT public Torznab — implemented, disabled pending hosted verification

- Official API: `GET https://anibt.net/torznab/api`; anonymous, no account or API key.
- The official integration guide explicitly supports Sonarr, Radarr, and Prowlarr as third-party Torznab clients.
- Query: `t=search`, `q`, `cat=5070` (Anime), `limit=50`. Keyword is limited to 160 UTF-8 bytes. The API returns newest-first results and supports bounded offset through item 300.
- Official rate limit: 60 requests / 60 seconds / IP. The Provider uses the shared `anibt` Durable Object lane at 1,100 ms spacing to leave headroom.
- Official caching policy marks Torznab `no-store`; the Provider does not use Cache API reads/writes. It does not retry; 429/503 cooldowns are handled by the shared coordinator.
- Provider: `anibt-torznab` v1.0.0, API mechanism, torrent source category, anime content category, metadata + torrent capabilities, keyword-only.
- Maps only safe same-host release details (when supplied), the official torrent download URL, publication date, size, seeders, and peers. No magnet URI is inferred.
- Public Torznab integration is explicitly documented for third-party indexer clients, but broad republication terms are not separately stated. Keep disabled until project content-policy review and non-production Cloudflare connectivity verification pass.
- No private RSS token, group API key, account session, publishing endpoint, KV config, source enablement, or deployment is included.


## 5. Additional cross-category API candidates — 2026-11-25

The following candidates were reviewed against official API documentation and current use restrictions. They are not yet registered in the runtime catalog.

### IGDB — conditional game metadata candidate

- Official endpoint: `POST https://api.igdb.com/v4/games`, using the APICalypse request body (for example, `search "query"; fields name,summary,url,first_release_date,genres.name,platforms.name; limit 20;`).
- The API is free for non-commercial projects. Commercial usage requires a partnership; the API docs describe commercial partnership as free but require contacting IGDB and user-facing attribution. This project must remain non-commercial unless a partnership is obtained.
- Authentication requires a free Twitch account with 2FA, a registered confidential application, Client ID and Client Secret, and OAuth client-credentials token issuance. Access tokens have an expiry and must be refreshed.
- Official limits: 4 requests/second and up to 8 concurrent requests. Use a shared lane and respect 429 responses; do not parallelize around limits.
- Proposed scope: game metadata only; no images in the first version. Consider excluding IGDB's documented erotic theme (theme ID 42) from this general games metadata source to avoid mixing adult-game metadata into the game category.
- **Decision: conditional candidate, not implemented.** Before coding, define a safe source-scoped credential representation for Client ID + Client Secret, token caching/refresh and expiry handling, and the Worker secret rotation procedure. Do not store credentials or OAuth tokens in KV or browser storage. Do not ask the operator to paste credentials into chat; use the established Worker Secret provisioning process when implementation is approved.
- Official references: https://api-docs.igdb.com/ and https://www.twitch.tv/p/en/legal/developer-agreement/

### AniList — defer pending scope clarification

- Official public GraphQL endpoint: `POST https://graphql.anilist.co`; public search can be anonymous.
- The API documentation currently states a normal rate limit of 90 requests/minute, while also warning that a temporary degraded state may reduce it to 30 requests/minute. The implementation would need to honor response headers and 429 cooldowns.
- The terms prohibit use in competing, non-complementary services of the same nature, explicitly including anime/manga list or tracker services. This project is a multi-source resource-search aggregator, not a tracker, but its anime/manga discovery scope makes compatibility uncertain.
- **Decision: do not implement until AniList confirms in writing that metadata search in this product is permitted.** No assumption that “metadata only” automatically resolves the product-scope restriction.
- References: https://docs.anilist.co/guide/terms-of-use, https://docs.anilist.co/guide/graphql/, https://github.com/AniList/docs/blob/master/docs/guide/rate-limiting.md

### Excluded or unsuitable APIs

- **TMDB:** free non-commercial API with an API key and attribution, but its official FAQ says API data/images may not be used in connection with pornographic content. The overall product is an adult-resource search aggregator; do not integrate even metadata-only results without an explicit written exception. Reference: https://developer.themoviedb.org/docs/faq
- **Discogs:** some catalogue fields are CC0, but its API terms prohibit using API content to drive traffic to non-Discogs websites/services. That conflicts with this product's external-resource-linking purpose. Do not integrate without written permission. Reference: https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
- **Open Library:** its official API guidance says the API is not intended as a data backend for third-party services; its legacy search API is deprecated and the current Search API is described as experimental. Do not implement a Worker Provider unless Open Library confirms the intended use and a stable search contract. Reference: https://openlibrary.org/developers/api
- **Kitsu (CGWire):** the current Kitsu API is for animation/VFX production tracking and requires JWT authentication; it is not a consumer anime/manga catalogue. Not applicable. Reference: https://api-docs.kitsu.cloud/

