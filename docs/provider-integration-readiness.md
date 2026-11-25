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

- Official endpoint: `POST https://api.igdb.com/v4/games`, using the APICalypse request body. A narrow first query can request `name`, `summary`, `url`, `first_release_date`, `genres.name`, and `platforms.name`, with a hard result limit of 20.
- The API is free for non-commercial projects. Commercial integrations require a partnership; the official FAQ says the API itself is free but a commercial partnership includes visible, static user-facing attribution. This project must remain non-commercial unless a partnership is obtained.
- Account setup is an operator-side prerequisite: a Twitch account, 2FA, a registered **Confidential** developer application, Client ID, and Client Secret. End users do not need Twitch accounts or OAuth consent.
- Authentication is the Twitch **Client Credentials** grant: POST to `https://id.twitch.tv/oauth2/token` with `client_id`, `client_secret`, and `grant_type=client_credentials`. The response supplies `access_token` and `expires_in`; it does **not** supply a refresh token. Twitch documents that app access tokens cannot be refreshed with a refresh token: obtain a new app token through the same client-credentials flow when the current token expires or an API request returns 401.
- IGDB's official FAQ states that an app access token is valid for up to 60 days and that a Client ID can have at most 25 active access tokens. This makes per-request or per-isolate token acquisition unsafe: repeated Worker isolate eviction or high concurrency could create many tokens and invalidate older ones.
- **Required token architecture before implementation:** use a dedicated, globally stable token-broker Durable Object for this IGDB application. It must serialize token acquisition (single-flight), reuse one app token across Worker instances, honor `expires_in`, and reacquire only when needed. Store the app token only in protected server-side state (prefer encrypted Durable Object storage with a separate Worker Secret encryption key); never store it in KV, browser storage, source configuration, API responses, or logs. The Twitch Client Secret remains in a source-scoped Worker Secret. Do not add token state to the existing rate-limit coordinator: token lifecycle and request pacing are separate responsibilities.
- **Required request pacing before implementation:** enforce the documented maximum of 4 requests/second and no more than 8 open requests at a time across the application, not per isolate. The existing spacing-only lanes do not by themselves prove the 8-request in-flight ceiling; the implementation must coordinate both constraints and honor 429/rate-limit responses.
- Proposed scope: game metadata only; no images in the first version. Exclude the documented erotic theme (theme ID 42) from the general games category using `where themes != (42);`. Build APICalypse from fixed server-owned syntax and safely escape the user search term; never concatenate raw user input as query syntax.
- **Decision: conditional candidate, not implemented or registered.** The API contract is technically suitable, but the project still needs the dedicated token-broker design, coordinated request/concurrency limits, and an operator-created Twitch application. Do not ask the operator to paste credentials into chat; use the established Worker Secret provisioning process only after the implementation and test plan are ready.
- Official references:
  - IGDB API account setup, authentication, request format, rate limits, erotic-theme exclusion, and FAQ: https://api-docs.igdb.com/
  - Twitch Client Credentials grant: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/
  - Twitch app-token behavior: https://dev.twitch.tv/docs/authentication/refresh-tokens/
  - Twitch application registration and secret handling: https://dev.twitch.tv/docs/authentication/register-app/
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



## 6. Additional anime metadata API candidates — 2026-11-25

### AniDB HTTP API — deferred

- AniDB has an official API, but the reviewed HTTP API contract does not establish a stable arbitrary keyword-search endpoint for this product. Its documented read operations are narrower (including anime detail and hot-anime data) and require a registered client identity.
- Current official endpoint examples use `http://api.anidb.net:9001/httpapi`; a supported HTTPS endpoint was not verified. The project must not relax its HTTPS-only upstream policy.
- Secondary implementation references report approximately one request every two seconds and mandatory caching of repeated requests. Treat this as a lead, not a verified current official quota; re-check the official documentation before reconsideration.
- The official API wiki and policy pages returned HTTP 403 to the research fetcher during this review. This does not prove that ordinary API clients are blocked and is not permission to bypass the response.
- **Decision: do not implement.** Reconsider only when official docs can be verified and provide a supported HTTPS keyword-search contract plus current request/cache rules. No HTML scraping, UDP automation, bulk data dump, or proxy integration.

References:
- https://wiki.anidb.net/API
- https://wiki.anidb.net/HTTP_API_Definition
- https://anidb.net/policy
- https://docs.shokoanime.com/shoko-server/understanding-anidb-bans

### Notify.moe — deferred pending search-contract and data-use clarification

- Public REST API: `https://notify.moe/api`. The documented Anime type includes title, summary, status, genres, dates, episode information, studios, producers, licensors, and related fields.
- The site's own guide says the API is an ongoing effort and subject to change. The public type documentation demonstrates ID-based Anime records, but this review did not verify a stable public keyword-search endpoint or a versioned search contract.
- Terms prohibit HTML scraping and explicitly direct clients to the public API. They also limit displayed images to personal, non-commercial use. This Provider would omit images, but the terms do not clearly establish third-party display/republication rights for text metadata in this integrated multi-source search product.
- **Decision: do not implement or add an external-search template yet.** Reconsider after a stable documented search contract and written or otherwise clear permission for third-party metadata display are established. Do not use undocumented internal routes or scrape HTML.

References:
- https://notify.moe/api
- https://notify.moe/api/anime
- https://notify.moe/thread/I3MMiOtzR
- https://notify.moe/terms


## 7. Movie / TV torrent API candidates — 2026-11-25

### EZTV — public beta API, but no documented keyword-search operation

- First-party API page: `https://eztvx.to/api/get-torrents`.
- The page states the API is in beta and does not require an API login or key. It documents JSON output, `limit` and `page` parameters, and lookup by `imdb_id` when the caller already knows the show's IMDb ID.
- It does not document a free-text title/search parameter. A broad recent-torrents feed is not equivalent to searching the user's query and should not be fetched and filtered locally.
- The page does not establish a numeric quota, cache policy, or broad metadata republication permission.
- **Decision: deferred.** No Provider until EZTV publishes a stable keyword-search contract or explicitly confirms that ID-based enrichment is an allowed use and documents operating limits. Do not scrape the search UI to fill the API gap.

Reference: https://eztvx.to/api/

### YTS — current API origin not verified

- YTS's status page lists official domains and marks its API operational, but does not publish a canonical API hostname or current endpoint contract.
- A current API documentation result is hosted on a third-party proxy/documentation domain and points to `movies-api.accel.li`; this is not sufficient proof of YTS ownership or permission. Older API docs refer to historical domains and cannot be assumed current.
- **Decision: pending; do not implement.** Require a current API specification and canonical API host published by YTS itself, plus terms that permit this product's use. Do not depend on third-party proxy APIs or infer an API host from old documentation.

References:
- https://yifystatus.com/
- https://yts.proxyninja.org/api (third-party lead only)
- https://github.com/BrokenEmpire/YTS/blob/master/API.md (historical docs)


## 8. The RarBg public JSON API — ready for a narrow Provider implementation

- **Adapter candidate:** `the-rarbg-json`; mechanism `api`; source category `torrent`; capabilities `metadata` + `magnet`; search modes `keyword` and `number`.
- **Canonical endpoint:** `GET https://therarbg.com/api/v1/search/`; use only the documented free-text search endpoint.
- **No credential required:** anonymous use is documented at 30 requests/minute and 10,000 requests/day per IP. Do not create an account or request the optional free key.
- **Rate coordination:** the project must add a dedicated shared Durable Object lane with at least 2,100 ms between upstream reservations (approximately 28.6/minute), leaving headroom under the 30/minute limit. Respect 429 `Retry-After`, minute/day rate-limit headers, and fail closed if the coordinator is unavailable.
- **Caching:** operator asks API clients to cache; upstream server-side cache is 2–60 minutes. Use a conservative 120-second edge cache for identical query/category/page requests; cache is an optimization and not a substitute for the shared global rate limiter.
- **Category mapping:** `jav` → `XXX`; `anime` → `Anime`; `film-tv` → `Movies,TV`; `game` → `Games`; `music` → `Music`. Do not claim support for manga/novel because the documented categories do not include them. Apps/Books/Other can be considered later under `general` only if product taxonomy and result relevance are deliberately defined.
- **Result mapping:** accept only valid 40-character hex infohashes and source-provided Magnet URIs; accept detail URLs only on the canonical HTTPS host and documented torrent-detail path; map title, indexed timestamp, seeders, leechers, size, source category, quality score and tags as text metadata. Do not synthesize Magnet URIs from hashes.
- **TMDB boundary:** do not call the API's title, extras, upcoming, collection, or streaming endpoints, and do not use poster/plot/rating/streaming fields. Those separate endpoints include TMDB-sourced data; TMDB's prohibition on use in connection with pornographic content applies to this overall product context. Keep this Provider strictly on the torrent search endpoint and omit all images.
- **Transport hardening:** HTTPS only, manual redirects, canonical-host validation, JSON content-type validation, streamed 2 MiB response cap, query length cap, maximum 50 upstream results, no automatic retry on 429/5xx.
- **Status:** documented API contract is sufficient to begin implementation. Provider remains unregistered/unconfigured until implementation, focused fixture tests, source catalog entries, and non-production Cloudflare connectivity/policy verification are complete. Do not deploy or enable it as part of this code change.
- References:
  - https://therarbg.com/developers/
  - https://therarbg.com/api/openapi.json
  - https://therarbg.com/about-us/
  - https://therarbg.com/dmca/


### The RarBg Provider implementation — code added, not configured or enabled

- Adapter ID: `the-rarbg-json`, version `1.0.0`; source category `torrent`; capabilities `metadata` + `magnet`; search modes `number` and `keyword`.
- Supported content categories: JAV (API category `XXX`), Anime, Film/TV (`Movies,TV`), Games, and Music. Manga, novels, and generic resources are deliberately unsupported.
- Uses only `GET /api/v1/search/`; never calls TMDB-backed title, extras, collection, upcoming, or streaming endpoints.
- Uses the shared `therarbg` Durable Object lane at 2,100 ms between requests (approximately 28.6/minute) and respects minute/day exhaustion signals, 429, and `Retry-After`.
- Uses a 120-second edge cache for identical query/category requests; anonymous quota only, no account or API key.
- Validates the 40-character infohash and requires the Magnet URI's BTIH to match it; detail links must be HTTPS on `therarbg.com` under `/post-detail/`. No Magnet is synthesized.
- No images, torrent-file downloads, detail-page scraping, TMDB-backed metadata, or account credentials.
- Focused fixture tests cover category selection, field normalization, hash/Magnet consistency, unsafe detail URLs, and unsupported categories. The Durable Object lane test checks the 2,100 ms reservation interval.
- **Not enabled:** the Provider is registered in Worker code but no KV source/adapter configuration has been created. No Cloudflare deployment or production changes have been made. Hosted connectivity and actual upstream behavior remain unverified. The five content-category source records must be configured separately after deployment and review.
