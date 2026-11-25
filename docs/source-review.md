# Candidate Source Review Log

Last reviewed: 2026-11-25

This document records evidence-based triage, not a blanket approval to crawl a site. A candidate is not an executable Provider until its public interface, access conditions, data fields, and deployment behavior have been reviewed.

## Status definitions

- **Provider candidate** — a documented public interface exists and can be evaluated for a Worker adapter.
- **External-search only** — keep as a browser-opened search link unless the site publishes an API or grants permission for automated access.
- **Not eligible** — excluded because it is paid, requires bypassing access controls, or is outside this project's scope.
- **Pending** — insufficient current evidence; do not enable or implement automated fetching.

## Reviewed candidates

| Source | Current disposition | Evidence and implementation decision |
|---|---|---|
| Sukebei | Provider implemented; live Worker verification pending | Official RSS documentation describes RSS 2.0 feeds, `/feed/magnet`, `q`, and `limit`. Implemented as `sukebei-rss`; no HTML scraping or challenge bypass. Keep disabled until the operator reviews content/legal scope and the Cloudflare test request succeeds. |
| JAVDB | External-search only / pending permission | No official public API contract was identified in the reviewed material. Its Terms reserve rights and state that use of the site/service to promote or operate another service requires prior written consent. Do not copy community scrapers or Cloudflare bypass behavior. |
| JAVLibrary | External-search only / pending interface review | The site describes itself as a metadata library, but no stable public API contract was identified. Existing search URL may be offered as a user-opened link; do not infer that automated Worker scraping is authorized. |
| javinfo | Not eligible | Its API requires a key and usage is billed per request/result after a limited trial. The project requirement excludes paid metadata APIs. |
| JAV.guru | External-search only | A public usage example points to the WordPress-style `/?s={query}` search URL. The site's `/feed/` exists, but the attempted query-feed and REST search endpoints could not be verified from available documentation. No stable documented API or explicit automated-access permission was established; do not implement a Worker scraper. |
| DMM / FANZA | Conditional official-API candidate; not implemented | DMM's official help says Web Service API access requires a DMM member account, affiliate registration, and API registration; the API ID is issued after registration. This is not a paid metadata API, but it is an affiliate program with eligibility and display conditions. Do not add it until the operator confirms they want affiliate registration and the current API terms/attribution requirements are reviewed. |
| Nyaa (work-safe) | Out of scope for the adult-resource Provider set | Nyaa's own help distinguishes its work-safe index from Sukebei's non-work-safe index. Do not add it as an adult source merely because it shares the RSS protocol. |
| Perverzija DB | Provider implemented; live Worker verification pending | Implemented as `perverzija-db` v1.0.0 using the documented no-key v1 JSON API. The adapter maps the DB scene page as the primary attribution link and the watch page as an external link; it deliberately omits cover images and player/embed fields. The API terms allow free commercial/non-commercial use with visible attribution, require adults-only use, prohibit bulk standalone resale and rate-limit circumvention, and recommend caching. Keep disabled until live Cloudflare connectivity and audience/legal review are complete. |
| YourBittorrent | Provider implemented; live Worker verification pending | Its official API documentation explicitly offers a free JSON API for websites/apps/scripts with no key or account, documents Adult category ID 7, and returns title, detail URL, Magnet URI, torrent URL, size, seeds, peers, and verified status. The API asks clients to cache search results for 15 minutes and warns that datacenter traffic may be filtered. Implemented as `yourbittorrent-json` v1.0.0 with strict host validation and a 15-minute Cloudflare edge cache; no bypass or automatic whitelisting. Keep disabled until live Worker connectivity is confirmed. |
| Torlock | Provider implemented; live Worker verification pending | Implemented as `torlock-torznab` v1.0.0 using the documented no-key Torznab endpoint and Adult category 6000. The adapter validates Magnet hashes and Torlock detail URLs, rejects redirects, caps responses at 2 MiB, and uses a 60-second Cloudflare edge cache. Torlock permits feeds for apps, asks clients to cache, and warns datacenter traffic may be filtered. No bypass or automatic whitelisting; if ordinary Worker traffic is blocked, keep the Provider disabled and use the external site link. |
| Bitsearch | External-search only / pending API data-use terms | Official API documentation advertises 200 unauthenticated requests/day/IP, or 1,000/day with a free account key; it documents search, categories, infohash, magnet URI, and rate-limit headers, including an Adult Content category. Its content-removal page describes DMCA and prohibited-content reporting. A separate API data-use licence/terms permitting republication in this aggregator was not established. Keep as a browser-opened site link until clarified. |
| apiJAV WordPress API | Not a general-purpose catalogue source | The documented API is part of a server/client WordPress video-import plugin system. Its sample server exposes posts, player/embed URLs, and webhooks; the public documentation does not establish a general catalogue licence for this project. Player/iframe/import features are also outside this metadata-and-external-links search product. |
| PornAPI (apiJAV) | Conditional free-tier candidate; pending terms and scope | Documentation advertises a free plan (30 requests/minute, 20,000 API requests/month, one approved domain) and a key-protected JSON catalogue, but also offers paid tiers. The API returns metadata plus player/embed fields; this project would use metadata and external links only. No sufficiently clear data-use licence/attribution terms were confirmed in the reviewed material. Do not register or implement until those terms and free-tier domain requirements are reviewed. |

## Sukebei implementation notes

- Adapter: `sukebei-rss`, version `1.0.1`.
- Endpoint: `https://sukebei.nyaa.net/feed/magnet`.
- Query parameters: `q`, `limit=50`.
- Parses RSS title, GUID/permalink, magnet URI, and publication date.
- Uses a 2 MiB streaming response cap.
- Does not follow redirects.
- Rejects malformed RSS documents and non-success HTTP responses.
- Automated tests use fixtures and mocked Fetch; they do not prove that Cloudflare Workers can reach the live endpoint.
- Keep the KV source disabled until a Cloudflare test environment confirms connectivity and the operator has reviewed the source's content and applicable rules.

## New provider candidates — implementation gates

### Perverzija DB — implemented

- Adapter documentation: `docs/providers/perverzija-db.md`.
- The implementation uses the documented search endpoint, strict host validation, manual redirect handling, a 2 MiB streaming response limit, and fixture-based tests.
- The DB scene page is the primary result link to satisfy visible attribution; the watch page is a separate external link.
- Covers and player/embed data are not consumed.
- The provider is registered in the Worker compile-time allowlist. It is not configured in production KV and must remain disabled until live Cloudflare verification.
- The API advertises `Cache-Control: public, max-age=300, s-maxage=1800`; cached responses served by its CDN do not consume the API quota. Distinct queries still count, so monitor 429 responses and do not retry in a tight loop.

### YourBittorrent — implemented

- Adapter documentation: `docs/providers/yourbittorrent-json.md`.
- Registered Worker adapter: `yourbittorrent-json` v1.0.0.
- Uses the documented JSON search API and Adult category 7; maps detail, Magnet and optional torrent-file URLs, with a 15-minute edge cache.
- Does not mistake `added_iso` (indexing time) for media release date.
- Keep disabled until live Cloudflare connectivity succeeds; do not bypass datacenter filtering or automate whitelisting.

### Torlock — implemented

- Adapter documentation: `docs/providers/torlock-torznab.md`.
- Registered Worker adapter: `torlock-torznab` v1.0.0.
- Uses the official Torznab endpoint, Adult category 6000, strict result URL and Magnet validation, manual redirects, a 2 MiB response cap, and a 60-second Cloudflare edge cache.
- Cache is per edge location and is not a global atomic rate limiter.
- Keep disabled until a live Cloudflare request succeeds; do not request whitelisting or bypass datacenter filtering.

### Bitsearch

- Documented endpoint: `GET https://bitsearch.eu/api/v1/search?q=...`.
- Free unauthenticated quota: 200 requests/day/IP.
- Optional free account key: 1,000 requests/day/account.
- Adult category ID: `10`.
- Parse only documented JSON result fields and validate any magnet URI before returning it.
- Keep pending until an API data-use licence/terms and Cloudflare egress behavior are confirmed.

## References

- Sukebei RSS documentation: https://sukebei.nyaa.net/rss
- Sukebei rules and content-removal policy: https://sukebei.nyaa.net/rules
- JAVDB Terms of Use: https://javdb.com/terms
- JAVLibrary About: https://www.javlibrary.com/en/about.php
- JAVLibrary Help: https://www.javlibrary.com/en/help.php
- javinfo API overview and billing: https://docs.javinfo.dev/docs
- DMM Web Service registration requirement: https://support.dmm.com/affiliate/article/44077
- DMM API ID registration help: https://support.dmm.com/affiliate/article/47546
- Nyaa help / work-safe and RSS notes: https://nyaa.wiki/help
- JAV.guru public search-link usage example (third-party, not an official API contract): https://sleazyfork.org/en/scripts/502894-javlibrary-improvements/code
- Perverzija DB API introduction: https://api.perverzija.com/docs
- Perverzija DB API quickstart: https://api.perverzija.com/docs/getting-started
- Perverzija DB API data model: https://api.perverzija.com/docs/objects
- Perverzija DB API terms: https://api.perverzija.com/docs/terms
- Torlock Torznab and RSS API documentation: https://www.torlock2.com/apis.html
- Torlock FAQ and scraping guidance: https://www.torlock.com/faq.html
- Torlock Provider implementation: `docs/providers/torlock-torznab.md`
- Bitsearch API documentation: https://bitsearch.eu/api
- YourBittorrent JSON API documentation: https://yourbittorrent2.com/api.html
- YourBittorrent FAQ: https://yourbittorrent2.com/faq.html
- YourBittorrent Provider implementation: `docs/providers/yourbittorrent-json.md`
- Bitsearch content removal / DMCA process: https://bitsearch.eu/content-removal
- apiJAV WordPress API reference: https://apijav.com/api-reference.html
- PornAPI documentation and free-tier limits: https://apijav.com/pornapi.html

## Review policy

1. Prefer official APIs and documented public feeds.
2. A public HTML page is not an API and is not, by itself, permission to automate access.
3. Do not bypass login, paywalls, CAPTCHA, Cloudflare challenges, rate limits, geo-restrictions, or other access controls.
4. Do not use paid metadata services.
5. If terms or access permission are unclear, keep the source as an external-search link or leave it pending.
6. Re-check the upstream documentation and terms before implementing or enabling a Provider.
7. Respect attribution, cache directives, quotas, takedown procedures, and source-specific restrictions.


## Upstream project audits — 2026-11-25

### FetchJAV

The current upstream README advertises 30+ supported site adapters. Its explicit supported-site table currently names:

- JableTV, MissAV, SupJav, Hanime1, HanimeTV, TnaFlix, 91Porn, JavDB.
- Jable.org, ThisAV, PigAV, Porn5F, 85Tube, PornBest, HAnime XYZ, PornTW.
- PornJP, PornHK, PornHoHo, PornNVR, Video01, PornLuLu, MIEN321, AApp11, Seselah, and XJISHI.

The README also describes video downloading, streaming, local playback, subtitle generation, proxy support, Cloudflare clearance-cookie import, and anti-bot-oriented networking dependencies. Those capabilities are not part of AIOResourceSearch and must not be ported.

The current `metadata_fetcher.py` is a separate, narrower metadata-enrichment pipeline. It contains site-specific HTML parsers for Jable, MissAV, SupJAV, JAV.guru, and JAVDatabase; it can also retrieve actress-page photos and tags. For an incoming video URL, Jable/MissAV/SupJAV are parsed according to the originating site, while JAV.guru and JAVDatabase are queried by normalized video code and their missing fields are merged into the result.

Disposition:

- The five metadata sites are already represented in the candidate inventory (JableTV, MissAV, SupJAV, JAV.guru, JAVDatabase); they are not five documented public APIs.
- The three origin-site metadata parsers and the two cross-site enrichers are HTML scraping implementations, not reusable API contracts.
- Do not port FetchJAV's proxy, TLS-fingerprint, Cloudflare-cookie, cloudscraper, or challenge-handling behavior into Workers.
- Keep these sites as external-search candidates unless a stable public feed/API or explicit permission for automated access is established.
- Do not add actress photos, video streams, download URLs, subtitles, or player/embed data to the normalized search result contract.

### Lustpress

The current README documents eight site modules: PornHub, XNXX, RedTube, XVideos, XHamster, YouPorn, Eporner, and TXXX. The project exposes a unified REST/GraphQL shape for search, get, related, and random operations, but describes its source acquisition as primarily HTML scraping.

The README explicitly documents a PornHub JavaScript challenge solver that computes and reuses a challenge cookie. This is an access-control/anti-bot bypass technique and is excluded from AIOResourceSearch. No Lustpress public API or Playground service should be used as a dependency: upstream states that the public services were discontinued on 2026-03-11 and users must self-host.

Disposition:

- Retain only the architectural lessons: per-site modules, normalized response objects, isolated source failures, and a consistent endpoint contract.
- Do not deploy Lustpress as an upstream data service for this project.
- Do not port its challenge solver, cookie acquisition/reuse, or other anti-bot bypass logic.
- Its eight sites remain external-search candidates unless a source publishes an independently documented interface and the applicable terms permit our intended use.

## Cross-category official API candidates

These candidates are separate from the three adult-focused upstream projects. They are being reviewed to give the project's eight content categories genuine source coverage rather than merely adding category labels.

| Source | Categories | Interface / requirements | Current disposition |
|---|---|---|---|
| AniList | Anime, manga | Public GraphQL API; public catalogue queries do not require OAuth. Terms prohibit hoarding/mass collection and prohibit use in competing, non-complementary anime/manga list or tracker services. | Conditional only. Do not implement until the intended search-aggregator use is confirmed as permitted; use on-demand queries only, never bulk ingestion. |
| Bangumi | Anime, film/TV, games, books | Official v0 API and OpenAPI schema. The v0 API replaces the legacy unversioned API; some search endpoints in the current schema are marked experimental. User authentication/access-token behavior and the exact public search contract must be verified per endpoint. | Candidate; review exact endpoint/auth requirements before implementation. Prefer v0, not legacy API. |
| MangaDex | Manga | Official REST API. Its policies include source attribution and content-removal requirements; chapter/scanlation use has additional attribution obligations. | Conditional candidate; initially restrict to catalogue metadata and official MangaDex detail links, subject to full policy review. |
| MusicBrainz | Music | Official Web Service; free for non-commercial use, no API key, JSON supported. Each client must not exceed one request per second and must send a meaningful User-Agent. | Strong candidate, subject to non-commercial use and strict shared rate limiting. |
| Open Library | Novels/books | Official JSON APIs including search.json. Usage guidance says it is for human-facing book discovery, not a third-party data backend or high-traffic commercial infrastructure; identify the app and cache responses. | Conditional candidate for low-volume, user-triggered lookup only; not a bulk catalogue backend. |
| TMDB | Film/TV | Official API; developer key is free for non-commercial use with source attribution and TMDB logo requirements. Commercial projects require a separate licence. | Conditional candidate; requires operator-managed API key and explicit attribution UI. |
| IGDB | Games | Official API is free; requires a Twitch account, registered application, Client ID/Secret, OAuth client-credentials token, and a maximum of four requests per second. Commercial integration requires a partnership and user-facing attribution. | Strong technical candidate, but requires operator-created Twitch developer credentials and review of the Twitch Developer Service Agreement. Store secrets only in Worker Secrets. |
| RAWG | Games | API key required. Free plan is for personal/non-commercial use; terms prohibit redistribution or making its data available to other businesses. | Not eligible for this public multi-user aggregation service unless RAWG grants explicit permission. |
| Wikidata Query Service | General | Public SPARQL endpoint with processing-time, concurrency, error, and User-Agent limits. Official guidance says it is not suitable for fuzzy text search. | Supplementary structured-entity lookup only; not a primary keyword-search Provider. |

Implementation rules for this group:

- Do not bulk mirror, harvest, or persist entire catalogues. Use user-triggered queries and bounded response caching only where the source's terms permit it.
- Keep API keys and OAuth client secrets in Cloudflare Worker Secrets, never in the public source catalog or frontend.
- Add source-specific attribution in result cards when required; the generic source badge alone may not satisfy a provider's logo or placement requirements.
- Treat an API's free tier as conditional on its own terms, quotas, and use case; do not infer unrestricted redistribution rights.
- For each candidate, verify live Cloudflare connectivity separately from API documentation and policy eligibility.


## Atlas current seed-file comparison — 2026-11-25

The upstream `main` branch was checked directly. Its current README describes five search categories (JAV, anime, movies, comics, novels) and documents these principal source groups:

- JAV: DMM/FANZA metadata; JavBus/JavDB magnet/resource lookup; JavBus actress search.
- Anime: Bangumi, Mikan, DMHY; Nyaa is noted as disabled due to deployment-environment restrictions.
- Movies: TMDB, YTS, EZTV, TPB.
- Comics: MangaDex, MangaUpdates, and 13 additional search sources.
- Novels: Anna's Archive metadata and Qishu TXT links.

The current repository's README also describes substantial functionality outside AIOResourceSearch's scope (D1-backed local collection and persistence, accounts, community/source sharing, follows, notifications, playback, and library management). Do not port these features merely because they exist upstream.

A direct parse of `database/seeds/003_search_sources.sql` on Atlas `main` found 119 SQL seed records across the following legacy source groups:

| Atlas seed group | Records |
|---|---:|
| JAV database | 4 |
| JAV streaming | 21 |
| JAV torrent | 15 |
| JAV community | 16 |
| Anime metadata | 8 |
| Anime torrent | 6 |
| Anime streaming | 8 |
| Anime/manga cross-listing | 1 |
| Movie metadata | 8 |
| Movie torrent | 3 |
| Movie streaming | 8 |
| Manga metadata | 5 |
| Manga resources | 8 |
| Novel sources | 8 |
| **Total** | **119** |

This is a count of rows in the seed SQL, not 119 verified, live, permitted, or current providers. It is also not necessarily the same as the production source configuration: the SQL header explicitly says it is not run during normal deployment and production names/order/enabled state may differ.

Comparing exact seed IDs with AIOResourceSearch's current 91-entry `sourceCatalog.ts` gives 54 exact ID matches. The 65 remaining Atlas IDs are listed below as not yet represented by the same ID in the catalog. This is an ID comparison only: some entries may be semantically represented under a different AIOResourceSearch ID/name (for example `javguru` vs `jav-guru`), so these are not automatically 65 genuinely new websites.

- JAV: `jable`, `javguru`.
- Anime metadata: `bangumi`, `myanimelist`, `anilist`, `douban_anime`, `kitsu`, `livechart`, `anidb`, `notifyanime`.
- Anime resources: `nyaa_si`, `mikan_project`, `dmhy`, `animebytes`, `sukebei_nyaa`, `shana_project`, `bilibili`, `dilidili`, `crunchyroll`, `funimation`, `hidive`, `aniwatch`, `gogoanime`, `9anime`, `bilibili_comic`.
- Movie metadata/resources: `tmdb`, `douban_movie`, `imdb`, `trakt`, `letterboxd`, `rottentomatoes`, `metacritic`, `themoviedb_cn`, `pirate_bay`, `eztv`, `mejortorrent`, `netflix_info`, `youtube_movies`, `justwatch`, `reelgood`, `playpilot`, `putlocker`, `fmovies`, `solarmovie`.
- Manga metadata/resources: `mangadex`, `anilist_manga`, `kitsu_manga`, `mal_manga`, `mangaupdates`, `manganelo`, `mangakakalot`, `bilibili_manga`, `dmzj`, `manhuagui`, `mangafire`, `mangasee`, `comicwalker`.
- Novel sources: `zlibrary`, `annas_archive`, `zxcs`, `xqishuta`, `sobooks`, `lunarora`, `pdfs`, `dushupai`.

The next catalog reconciliation must compare normalized hostnames and aliases, not only IDs. It must also keep content categories separate from source kinds, and must not invent homepage/search URLs for seed entries whose canonical URL is absent or unverified.

### Atlas source review decisions

- **Metadata APIs** (for example Bangumi, TMDB, MangaDex) are reviewed independently from resource-index sites. API access does not imply permission to mirror, bulk harvest, or redistribute the full catalogue.
- **Anime RSS/index sources** (Mikan, DMHY, Nyaa, Shana Project) need individual endpoint, terms, rate-limit, and response-format checks. Nyaa and Sukebei are separate work-safe/non-work-safe services and must not be conflated.
- **Streaming/subscription services** (Netflix, Crunchyroll, HIDIVE, Funimation, YouTube Movies) are not automatically metadata or resource Providers. Without a documented public search API and permission, treat them as user-facing external discovery links only; do not scrape playback pages or protected media.
- **Movie/comic/novel resource indexes** (TPB, EZTV, MangaFire, Z-Library, Anna's Archive, etc.) require individual access, copyright, and terms review. Their presence in Atlas seed SQL is not evidence of lawful redistribution rights or Worker access permission.
- **Social/community sources** and user-generated content are not equivalent to structured catalogue APIs. Keep external-search-only unless an official API and intended-use permission are established.
- Atlas's MIT license covers the Atlas code under its license; it does not grant rights to third-party websites, metadata, images, torrents, or media linked by Atlas.

## Corrected upstream scope notes

- The current Atlas README reviewed here describes five principal categories, not a verified seven-category catalog. AIOResourceSearch retains its independently chosen eight-category model; game and music support must be sourced separately.
- FetchJAV's current public README advertises 30+ site adapters, but the displayed supported-sites table is not a complete machine-readable inventory of every implementation. The metadata enrichment file is a separate HTML-based pipeline, not an official API directory.
- Lustpress's discontinued hosted API/Playground is not an upstream dependency. Self-hosting its source code does not establish permission to access or republish the third-party sites it parses.


## Atlas seed reconciliation by URL host (2026-11-25)

A second comparison was performed against the 119 rows in Atlas `main:database/seeds/003_search_sources.sql`, this time extracting URL hosts from both the seed rows and AIOResourceSearch's `sourceCatalog.ts`, lowercasing them, and removing a leading `www.`. This is more useful than comparing source IDs, but it is still a conservative exact-host comparison rather than a full registrable-domain/alias resolver.

- Atlas seed rows parsed: **119**.
- Distinct URL hosts present in the Atlas seed rows: **115**.
- Distinct URL hosts present in the current AIOResourceSearch catalog: **61**.
- Exact normalized host overlap: **56**.
- Atlas hosts not present as exact URL hosts in the current catalog: **59**.
- One important known alias is already represented: Atlas uses `sukebei.nyaa.si`, while the current catalog entry `sukebei` points to the currently documented `sukebei.nyaa.net` endpoint. It is not a new source to add.
- Therefore, the raw host difference is **not** a count of new websites. A rough grouping by registrable-domain suffix reduces the 59 unmatched hosts to 55 domain groups; this heuristic is not a substitute for Public Suffix List-aware canonicalization.

The remaining host differences are useful candidates for manual review, grouped by Atlas seed category below. Repeated domains across categories (for example AniList, Kitsu, MyAnimeList, and Bilibili) should normally be represented by one source with multiple content-category associations, not duplicate source records.

| Atlas seed category | Unmatched host candidates |
|---|---|
| Anime metadata | `anidb.net`, `anilist.co`, `bangumi.tv`, `douban.com`, `kitsu.io`, `livechart.me`, `myanimelist.net`, `notify.moe` |
| Anime torrent | `animebytes.tv`, `mikanani.me`, `nyaa.si`, `shanaproject.com`, `share.dmhy.org` (DMHY), `sukebei.nyaa.si` (known Sukebei alias; already represented) |
| Anime streaming | `9anime.gs`, `aniwatch.to`, `bilibili.com`, `crunchyroll.com`, `dilidili.wang`, `funimation.com`, `gogoanime3.net`, `hidive.com`, `search.bilibili.com` |
| Anime/manga cross-listing | `manga.bilibili.com` |
| Movie metadata | `imdb.com`, `letterboxd.com`, `metacritic.com`, `movie.douban.com`, `rottentomatoes.com`, `themoviedb.org`, `trakt.tv` |
| Movie torrent | `eztv.re`, `mejortorrent.com`, `thepiratebay.org` |
| Movie streaming/discovery | `fmovies.to`, `justwatch.com`, `netflix.com`, `playpilot.com`, `putlockers.name`, `reelgood.com`, `solarmovie.pe`, `youtube.com` |
| Manga metadata | `anilist.co`, `kitsu.io`, `mangadex.org`, `mangaupdates.com`, `myanimelist.net` |
| Manga resources | `comic-walker.com`, `dmzj.com`, `manga.bilibili.com`, `mangafire.to`, `mangakakalot.com`, `manganelo.com`, `mangasee123.com`, `manhuagui.com` |
| Novel sources | `dushupai.com`, `lunarora.com`, `pdfs.top`, `qishuxia.com`, `sobooks.cc`, `zh.annas-archive.gl`, `zh.z-library.sk`, `zxcs.zip` |

### Reconciliation decisions

1. **Do not bulk-add these hosts to the runtime source catalog.** The Atlas SQL is a historical/default seed inventory, not evidence that a source is live, reachable from Workers, permitted for automated access, or suitable for public aggregation.
2. **Prioritize documented metadata APIs separately:** Bangumi, AniList, MangaDex, TMDB, MusicBrainz, and IGDB remain candidates for endpoint-by-endpoint terms, authentication, rate-limit, attribution, and intended-use checks. Their presence in the seed list does not waive those checks.
3. **Keep commercial streaming services as external discovery links only** unless a documented public API and intended-use permission are confirmed. Do not scrape subscription playback pages or protected media.
4. **Treat torrent/index and manga/novel resource sites as individual legal/terms reviews**, not as a single generic adapter batch. Do not bypass login, paywalls, challenges, CAPTCHA, geoblocking, or rate limits.
5. **Avoid duplicate source records for one service.** The future catalog model should support multiple content categories on one source, and alias metadata for hostname migrations/subdomains, rather than duplicating a provider for each Atlas category.
6. This inventory reconciliation changes documentation only. It does not add or enable sources, change adapter implementations, or modify Cloudflare KV.


## Cross-category official API eligibility review (2026-11-25)

This review separates API reachability from permission to use the data in this specific public, multi-category resource-search application. The project currently has no paid tier or advertising in scope. Any future monetization, advertisements, or materially different use must trigger a fresh terms review. This is a source-eligibility decision, not an implementation or live-connectivity test.

### Decision summary

| API | Scope | Current decision | Main constraints / unresolved points |
|---|---|---|---|
| Bangumi API v0 | Anime, games, books/manga-related subject metadata | **Conditional candidate** | Use only the maintained `/v0/` public API, never the legacy unversioned API or private website API. Non-browser clients should send a descriptive project User-Agent. NSFW subject visibility requires authorization; do not attempt to bypass this. No explicit general request-rate number was confirmed in the reviewed official docs, so start with conservative sequential requests and honor server responses. |
| AniList GraphQL | Anime and manga metadata | **Hold — obtain clarification first** | Public unauthenticated metadata queries are technically supported, but the terms prohibit hoarding/mass collection and use in competing, non-complementary services of the same nature. A multi-source search aggregator may or may not be considered complementary; do not integrate until AniList confirms this use is acceptable. The current docs report a temporary degraded limit of 30 requests/minute, while the normal documented limit is 90/minute. |
| MangaDex REST API | Manga metadata | **Conditional candidate — metadata only** | Public API requires visible MangaDex credit. Its acceptable-use policy prohibits ads and paid services; this project currently has neither in scope. If chapter reading were ever added, scanlation-group credit and takedown/removal requests would also apply; chapter reading is outside this project's scope. Official docs describe an initial limit of 5 requests/second/IP, with additional endpoint-specific limits and response headers. Keep requests conservative and honor 429/Retry-After. |
| TMDB API v3 | Film/TV metadata | **Do not integrate into this project at present** | TMDB's official FAQ states free API use is for non-commercial purposes and requires logo plus prominent attribution. The same FAQ's API legal notice prohibits using its API data/images in connection with pornographic or otherwise offensive content. Because AIOResourceSearch is a multi-category platform that includes adult-resource search, this creates a direct compatibility concern. Do not assume a separate movie category isolates TMDB data from the platform's adult context. Reconsider only with written permission/licensing that explicitly covers the product's full context. |
| MusicBrainz Web Service v2 | Music metadata | **Conditional candidate; defer implementation** | No API key is needed for public lookups, JSON is supported, and every client application must stay at or below 1 request/second with a meaningful identifying User-Agent. The Web Service is free for non-commercial use; commercial use requires a separate plan/license. Core database data is CC0, but supplementary data is CC BY-NC-SA 3.0 and must not be treated as uniformly CC0. Current architecture has no strict global rate limiter; Cache API is edge-local and KV is not a transactional global limiter. Defer production integration until a shared limiter/queue is designed. |
| IGDB API v4 | Game metadata | **Conditional candidate; credentials and shared throttle required** | Uses Twitch application credentials and OAuth client-credentials flow; secrets must remain in Worker Secrets. Official docs state 4 requests/second and up to 8 concurrent open requests. Tokens expire after 60 days. API is free for non-commercial use; commercial usage requires a partnership. The API does not support browser requests, so Worker proxying is the correct architecture. Defer implementation until shared rate limiting and token refresh handling are designed. |

### Evidence and implementation implications

#### Bangumi

- The official developer documentation distinguishes the maintained public `/v0/` API from the legacy API, which remains reachable for compatibility but is no longer maintained. The private API used by the new website is a separate interface with no compatibility guarantee; do not use it.
- The official API repository recommends a meaningful User-Agent for non-browser clients, including the developer/project identity and project homepage for open-source projects.
- Some public subject reads do not require authorization. The OpenAPI security description states NSFW content is visible only to authorized users; unauthenticated requests may return 404. Do not try to obtain or expose NSFW-only data through another route.
- Some search endpoints in the OpenAPI schema are explicitly marked experimental. Avoid making those endpoints a required dependency until their stability is confirmed.
- Suggested initial use, if implemented: public subject metadata lookup/search only, no user accounts, collections, or write endpoints.

#### AniList

- Public anime/manga metadata can be queried without OAuth.
- The terms prohibit backup/data-storage use, hoarding/mass collection, and competing non-complementary services of the same nature. The exact boundary for a general multi-source resource-search engine is not explicit in the reviewed terms. This is a policy question, not something to infer from the API being public.
- Current rate-limit docs show a temporary degraded state at 30 requests/minute, with 90 requests/minute described as the normal limit. Respect the actual response headers and Retry-After rather than hardcoding the normal ceiling.
- Decision: keep in the research list but do not add to the runtime catalog or implement before obtaining written clarification from AniList.

#### MangaDex

- The official acceptable-use policy requires crediting MangaDex and prohibits advertisements or paid services. It additionally requires scanlation-group credit and honoring group removal requests only if the consuming app offers chapter reading. AIOResourceSearch will not offer chapter reading.
- Limit use to title/author/artist/status/public metadata and MangaDex's own detail page. Do not proxy chapter images, chapter content, or other media.
- The documented initial per-IP limit is 5 requests/second; endpoint-specific limits can apply. Respect response rate-limit headers, avoid bursts, and back off on rate-limit responses.
- Before enabling, add a persistent visible attribution/credits entry and verify that the product remains non-advertising and non-paid.

#### TMDB

- The official FAQ requires use of an approved TMDB logo and a prominent notice: "This product uses the TMDB API but is not endorsed or certified by TMDB."
- The same FAQ's API legal notice says TMDB data/images cannot be used in connection with pornographic or otherwise offensive content. The project's adult-resource category means the safe decision is not to integrate TMDB under the current product design.
- A free developer key is not a blanket permission to use the data in every product context. Do not put an API key in frontend code; if the product scope changes and written permission is obtained, use a Worker Secret.

#### MusicBrainz

- Use the maintained `/ws/2` Web Service, not the deprecated `/ws/1` service.
- Public lookup/search can use JSON and does not require an API key. Each client application must remain at or below one request per second and provide a meaningful User-Agent containing the application name/version and a contact or project URL.
- The Web Service is free for non-commercial use; commercial usage requires contacting MetaBrainz for an appropriate plan.
- Do not describe the entire MusicBrainz database as CC0: core data is CC0, while supplementary data has CC BY-NC-SA 3.0 terms. API access terms and data licenses are separate concerns.
- Existing Cache API entries are edge-local and cannot guarantee one request/second globally. A strict shared throttle would need a dedicated coordination primitive or serialized queue; KV writes are not a safe substitute for atomic rate limiting.

#### IGDB

- Requests go through the Worker because the API does not support browser CORS. Store Twitch Client ID/Secret and token state only in server-side secrets/state, never in the public source catalog or frontend.
- Respect the 4 requests/second limit, the maximum of 8 open requests, HTTP 429 and rate-limit headers. OAuth access tokens are time-limited (documented as 60 days); implement refresh/re-acquisition safely.
- The official FAQ states the API is free for non-commercial and commercial projects, but commercial integrations require a partnership and user-facing attribution. This project should treat itself as non-commercial only while it remains genuinely non-commercial.
- The 4 req/s ceiling is per app/client and can be exceeded by concurrent visitors unless requests are coordinated centrally. Do not assume per-Worker-instance or per-edge throttling is sufficient.

### Current source classification outcome

- **Eligible for a controlled prototype after implementation details are settled:** Bangumi (public/non-NSFW metadata), MangaDex (metadata only; attribution and no-ads/no-paid policy), MusicBrainz (non-commercial; strict shared 1 req/s limiter).
- **Hold pending policy clarification:** AniList.
- **Do not integrate under current product scope:** TMDB.
- **Technically promising but defer until credentials and shared throttling are designed:** IGDB.
- None of these APIs has been added to `sourceCatalog.ts`, registered in KV, enabled, or deployed by this review.


## Individual source audit — first batch (2026-11-25)

This batch checks a small set of existing catalog entries with search URL templates. A URL template is only a navigation hint; it is not evidence of permission to automate requests, a stable HTML contract, or a working Provider. No source in this batch is enabled or added to the Worker runtime.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JavDB | Canonical terms page: https://javdb.com/terms | **Hold — written permission required before operating an integration** | No API/HTML requests; do not enable the catalog entry as a Provider or automated external-search integration pending permission |
| JavLibrary | A terms page was found through a third-party mirror, not verified on the canonical site; community scraper code is not authoritative | **Unverified — do not automate** | No Worker requests; do not copy age-verification cookies or scraper behavior. Revisit only after canonical terms and ordinary public access are verified |
| JavBus | Current third-party observations report an age-verification gate on the homepage; canonical terms and the catalog search route were not verified | **Access gate observed — no bypass** | No Worker requests or challenge/cookie handling. Keep disabled pending official policy and normal unauthenticated access review |
| Reddit r/JAV | Reddit User Agreement and Developer/Data API Terms: https://redditinc.com/policies/user-agreement and https://redditinc.com/policies/developer-terms | **External-search only** | A user-initiated link to Reddit's own search may remain a navigation option; no HTML scraping or API integration without authorized API access and a separate terms review |

### Source-specific findings

#### JavDB

The current canonical terms page includes a restriction against using the site or its services to promote or operate a service without the operator's prior written consent. It also reserves rights not expressly granted. An automated search aggregator integration would create a material terms risk; the public search URL alone does not grant permission.

Decision: do not fetch JavDB from Workers, parse its pages, or represent it as an implemented Provider. Do not enable the catalog entry pending written permission that covers this product and its intended use. This is a conservative engineering eligibility decision, not a legal opinion.

#### JavLibrary

Search surfaced a terms page describing itself as the terms for javlibrary.com, but the page was hosted on a third-party domain rather than a canonical JavLibrary domain. That is insufficient provenance to make a reliable policy determination. A community scraper example also uses an over-18 cookie; community code is neither authorization nor evidence of permitted access.

Decision: no Worker access and no copied cookie, browser session, or scraper logic. First obtain the canonical current terms and verify the ordinary public search/detail flow without supplying access-control cookies.

#### JavBus

Third-party site observations currently report that the homepage resolves to an age-verification page. This is a technical observation only; it does not establish the site's terms or authorize any alternate access path. The catalog's existing search template has not been verified as a normal public endpoint.

Decision: do not implement HTML/API access, reuse verification cookies, or attempt to evade the gate. Reconsider only if official terms and an ordinary unauthenticated public search flow are confirmed.

#### Reddit r/JAV

Reddit's User Agreement prohibits scraping without prior written consent, while the Developer Terms and Data API Terms require authorized access credentials and impose additional usage conditions. The Developer Terms also restrict monetized use unless separately permitted or approved. The project currently has no approved Reddit API credentials or written permission.

Decision: keep this source as a plain external-search destination only. Do not fetch Reddit HTML, use undocumented endpoints, or add a Reddit API Provider. If API use is later proposed, obtain authorized access and review the current Data API Terms, attribution, retention/deletion, rate limits, and non-commercial restrictions first.

### Not yet decided in this batch

JableTV and SupJAV remain candidates, but the search results available in this review did not establish a canonical, current terms page with sufficient provenance. A third-party-hosted terms page that names these services is not treated as conclusive evidence. Both remain disabled and must not be automated until their canonical policies and normal public access paths are verified.

### Batch outcome

- 4 sources received a source-specific decision: JavDB, JavLibrary, JavBus, and Reddit r/JAV.
- 2 further candidates (JableTV and SupJAV) remain explicitly unresolved.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- The next audit batch should prioritize the remaining catalog entries that already have search URL templates, then proceed to homepage-only candidates. Each review must record evidence provenance separately from technical reachability.


## Individual source audit — second batch (2026-11-25)

This batch reviewed AV01, JAV.guru, MissAV, and BestJavPorn. The review distinguishes permission to retrieve a site-maintained discovery document (such as a mirror list) from permission to crawl the site's search results or content.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| AV01 | Official AV01 URL-announcement repository and mirrors JSON: https://github.com/av01tv/url | **Mirror-list retrieval only; search crawling not approved** | The official JSON may be used solely to refresh the current mirror destination. Do not fetch/search the mirror site automatically. Existing search template is removed until a normal public search contract is verified |
| JAV.guru | Canonical Terms: https://jav.guru/terms/ | **External-search only, personal/non-commercial linking conditions** | User-initiated search links may be offered subject to the site's stated non-commercial linking conditions. No Worker scraping, metadata extraction, copying, or redistribution |
| MissAV | Current site at https://missav.ws; a similarly named terms page was found at missav.run, a different domain | **External-search only; canonical policy unresolved** | Do not treat missav.run terms as binding for missav.ws. No Worker requests or automated HTML parsing until canonical terms and an ordinary public search contract are verified |
| BestJavPorn | Current homepage and third-party technical/privacy scans; no authoritative canonical terms found | **Unverified; no automated access** | Remove the unverified search template. Keep disabled pending canonical terms and confirmation of ordinary public search behavior |

### Source-specific findings

#### AV01

The official av01tv/url repository states that it publishes updated mirror URLs and explicitly invites developers to use its mirrors JSON in automation. The permission described is limited to integrating the mirror links. It does not document a search API, a stable result-page contract, or permission to crawl search results/content. A recent third-party scan of av01.media also describes the page as heavily JavaScript-built, so a static HTML parser would not be a reliable integration assumption.

Decision: the mirrors JSON can be considered an official, narrow-purpose discovery input for updating the external destination. It is not a content/search Provider. The catalog's old /jp/search?q={query} template is removed until independently verified as a normal public search route. No challenge solving, cookie reuse, or alternate access path is permitted.

#### JAV.guru

The canonical Terms state that the site is for personal use and restricts commercial endeavors absent approval. They prohibit unauthorized framing/linking and content copying or redistribution without prior written consent. The Terms separately permit links to site materials for personal, non-commercial purposes.

Decision: retain only a user-initiated external search link, subject to the personal/non-commercial conditions in the site's Terms. Do not have the Worker fetch the site, parse metadata, copy titles/thumbnails, or redistribute site content. This is a conservative product boundary; it is not a legal opinion.

#### MissAV

The current catalog domain missav.ws is reachable and exposes a public search interface in the page content. However, a search result for a "MissAV" terms page was hosted at missav.run, which is a different registrable domain. It cannot be treated as the canonical policy for missav.ws. The currently observed page also includes account/login and dynamically loaded areas; this does not establish a stable server-side search contract.

Decision: preserve only a user-initiated external search destination for now. Do not automatically fetch missav.ws or reuse the missav.run terms as evidence of permission. Revisit only after canonical terms for the exact domain and an ordinary public search flow are verified.

#### BestJavPorn

The homepage is reachable through a redirect to www.bestjavporn.com. Third-party scans show substantial third-party advertising/tracking requests and point-in-time changes in Cloudflare challenge behavior. These scans are technical/privacy observations, not the site's authoritative terms and not permission to automate access. No canonical terms page or verified search URL contract was established in this batch.

Decision: keep disabled and remove the catalog's unverified /search?q= template. Do not infer permission from reachability, a clean malware scan, or the absence of a challenge during one scan.

### Batch outcome

- 4 sources received source-specific decisions.
- AV01's official mirror JSON is recognized as a narrowly permitted mirror-discovery input, not a search Provider.
- JAV.guru is restricted to user-initiated external links under its stated personal/non-commercial conditions.
- MissAV and BestJavPorn remain unapproved for automated access.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.


## Individual source audit — third batch (2026-11-25)

This batch reviewed JAV Ass Lover, JAV Desu, JAV Subtitle, and JAV Subtitled. Direct page retrieval was unsuccessful or inconclusive for all four. A failed fetch from a research tool is not proof that a site is offline or blocks ordinary users; it only means the site, its policy, and its search contract could not be verified from the available evidence.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JAV Ass Lover | Canonical homepage fetch returned HTTP 403 to the research fetcher; search results were limited to third-party technical/domain records | **Unverified** | Remove the unverified search template; no Worker access until canonical terms and ordinary public search are verified |
| JAV Desu | Homepage fetch returned HTTP 502 to the research fetcher; search results did not establish a current canonical policy or stable search route | **Unverified** | Remove the unverified search template; no Worker access until canonical terms and ordinary public search are verified |
| JAV Subtitle (javsubtitle.xyz) | Canonical homepage could not be retrieved; search results for JAV-Subtitles at jav-subtitles.com refer to a different domain | **Unverified; domain identity must not be conflated** | Remove the unverified search template; do not apply jav-subtitles.com terms to javsubtitle.xyz |
| JAV Subtitled (javsubtitled.com) | Canonical homepage could not be retrieved; third-party technical pages are not authoritative policy evidence | **Unverified** | Remove the unverified search template; no Worker access until canonical terms and ordinary public search are verified |

### Source-specific findings

#### JAV Ass Lover

The current catalog points to javass.love and contains a WordPress-style search template. The available research fetch returned HTTP 403, while third-party sources provide only domain/hosting and reputation metadata. None establishes the current canonical terms, a supported API, or a stable public search contract.

Decision: remove the unverified search template. Keep the source as an unverified homepage candidate only. Do not interpret the fetcher's 403 as permission to try alternate routes, proxies, cookies, or challenge bypasses.

#### JAV Desu

The catalog points to javdesu.tv, while some search results concern the separate domain jav-desu.com. Those domains must not be treated as interchangeable. The direct fetch of javdesu.tv returned HTTP 502 to the research fetcher, and the search results did not provide current canonical terms or an authoritative search interface description.

Decision: remove the unverified search template. Keep the source unverified; do not substitute jav-desu.com or infer a route from another domain.

#### JAV Subtitle

The catalog points to javsubtitle.xyz. Search results for JAV-Subtitles and its terms page refer to jav-subtitles.com, which is a different domain and appears to be a commercial subtitle service. Those terms do not govern javsubtitle.xyz. The canonical javsubtitle.xyz homepage could not be retrieved in this review.

Decision: remove the unverified search template. Do not conflate javsubtitle.xyz with jav-subtitles.com or transfer its terms, commercial model, or policy to this source.

#### JAV Subtitled

The catalog points to javsubtitled.com. The canonical homepage could not be retrieved in this review. Third-party domain, ownership, reputation, and technology records do not establish whether automated search or scraping is permitted. A third-party FAQ warning about the site is not the site's own policy.

Decision: remove the unverified search template. Keep the source unverified until its canonical policy and normal public search interface can be confirmed.

### Batch outcome

- 4 sources received a source-specific status.
- All 4 existing search templates are removed because they have not been verified as stable, ordinary public search routes.
- No site is declared offline solely because a research fetch failed.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- The next batch should continue through the remaining JAV search-template candidates, then review the torrent/forum candidates with homepage-only entries.


## Individual source audit — fourth batch (2026-11-25)

This batch reviewed JAV.sb, JAVCL, JavDoe, and JavGG. It distinguishes canonical policy evidence from technical observations made by the research fetcher. HTTP errors and timeouts from that fetcher do not establish that ordinary users are blocked or that a site is offline.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JAV.sb | Canonical homepage fetch returned HTTP 502 to the research fetcher; no canonical current terms or stable search contract was verified | **Unverified** | Remove the unverified search template; no Worker requests pending canonical policy and ordinary public search verification |
| JAVCL | Canonical homepage fetch returned HTTP 403 to the research fetcher; no canonical current terms or stable search contract was verified | **Unverified** | Remove the unverified search template; do not treat the research fetcher's 403 as proof of site-wide blocking |
| JavDoe | Canonical homepage fetch timed out; search results did not establish current canonical terms or a supported search contract | **Unverified** | Remove the unverified search template; no Worker requests pending verification |
| JavGG | Canonical Terms of Service: https://javgg.net/terms-of-service/ | **Automated extraction prohibited by the published Terms** | Remove the search template; do not fetch search results, mine data, extract metadata, or redistribute site material |

### Source-specific findings

#### JAV.sb

The catalog points to jav.sb and previously contained a /search/{query} template. The research fetcher returned HTTP 502 for the canonical homepage. The available search evidence did not establish a canonical current terms page or a supported public search contract. A fetch failure is not evidence that the site is offline or that ordinary users receive the same response.

Decision: remove the unverified search template and retain only the homepage as an unverified directory reference. Do not implement Worker fetching or HTML parsing until canonical terms and ordinary public access are verified.

#### JAVCL

The catalog points to javcl.com and previously contained a /search/{query} template. The research fetcher received HTTP 403 from the canonical homepage. The available results did not establish current canonical terms or a stable public search contract. A research fetcher's 403 is a point-in-time tool response, not proof of a site-wide block and not a reason to try alternate routes, proxies, cookies, or challenge bypasses.

Decision: remove the unverified search template. Retain the homepage as an unverified directory reference only; do not automate access pending verification.

#### JavDoe

The catalog points to javdoe.to and previously contained a /search?q={query} template. The research fetcher timed out when opening the canonical homepage. Third-party domain/reputation records do not establish the site's own automation policy or a supported search interface.

Decision: remove the unverified search template. Keep the source unverified; do not infer availability, permission, or a search contract from the timeout or third-party records.

#### JavGG

The canonical Terms of Service grant a limited license for viewing site material and expressly restrict data mining, data harvesting, and data extraction. The terms also restrict publishing, commercializing, or publicly showing website material. This is direct policy evidence for the exact catalog domain, not a third-party scan.

Decision: remove the search template and do not implement automated search, HTML parsing, metadata extraction, or redistribution. Keep only the homepage as a directory reference; do not treat the presence of a public search page as permission to automate it.

### Batch outcome

- 4 sources received source-specific decisions.
- All 4 unverified search templates were removed.
- JavGG's canonical Terms explicitly prohibit data extraction; the other 3 remain unverified rather than being labeled offline or blocked.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue auditing the remaining search-template candidates, then move to homepage-only forum and torrent candidates.


## Individual source audit — fifth batch (2026-11-25)

This batch reviewed JAVHDPorn.net, JAVLeak, JavMost, and JAVOut. The review records only what could be established from the exact catalog domains. Third-party reputation/WHOIS pages are not treated as permission to automate access or as substitutes for canonical terms.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JAVHDPorn.net | Canonical homepage and candidate terms route could not be retrieved; search results surfaced only third-party domain/reputation records | **Unverified** | Remove the unverified search template; no Worker requests pending canonical terms and a verified public search contract |
| JAVLeak | Canonical homepage is reachable and exposes a search form, but current canonical terms and the exact search route were not established | **Unverified** | Remove the unverified search template; do not infer the route or permission from the visible form |
| JavMost | The catalog's www5.javmost.com host redirects to javmost.ws; the current page exposes navigation and a legal/2257 page, not a verified automation policy | **Canonical host mismatch; policy unresolved** | Remove the old www5.javmost.com search template; do not automatically follow or scrape the new host pending canonical policy review |
| JAVOut | Canonical homepage and candidate terms route could not be retrieved; no authoritative policy or stable search contract was found | **Unverified** | Remove the unverified search template; no Worker requests pending verification |

### Source-specific findings

#### JAVHDPorn.net

The catalog points to javhdporn.net and previously contained a /search?q={query} template. Direct retrieval of the canonical homepage and the guessed terms route was unavailable to the research fetcher. Search results mainly returned third-party domain and reputation records, which do not establish the site's own terms, permission for automated access, or a supported search interface.

Decision: remove the unverified search template. Keep the source as an unverified homepage reference only; do not automate access based on third-party technical records.

#### JAVLeak

The canonical javleak.com homepage is reachable and exposes a visible search field and an advanced-search link. However, the available page did not establish current canonical terms or confirm that the catalog's old /search?q={query} path is the supported public search route. A visible search form is not itself an automation permission or a stable endpoint contract.

Decision: remove the unverified search template. Retain the homepage reference only until the current terms and exact ordinary public search route are verified. Do not reverse-engineer undocumented endpoints.

#### JavMost

The catalog's previous search template used www5.javmost.com. The current research result redirects that host to javmost.ws, and the current page identifies the latter as the site host. The linked legal page is an 18 U.S.C. 2257 compliance statement; it is not a terms-of-service or automated-access policy. Third-party WHOIS/reputation records do not fill that gap.

Decision: remove the old search template and retain the existing catalog homepage as a directory reference only. Do not silently rewrite the catalog to a new host or automate requests against javmost.ws until the canonical domain, current terms, and public search contract are independently verified.

#### JAVOut

The catalog points to javout.co and previously contained a /search/{query} template. Direct retrieval of the canonical homepage and the guessed terms route was unavailable to the research fetcher. The available search results did not establish canonical current terms or a stable search interface.

Decision: remove the unverified search template. Keep the source unverified; do not interpret research-fetch failure as proof that the site is offline or blocked for ordinary users.

### Batch outcome

- 4 sources received source-specific decisions.
- All 4 unverified search templates were removed.
- JavMost's catalog host was not silently changed to javmost.ws; its 2257 page was not misclassified as a ToS.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue with JAVSeen, JAVTsunami, and JavyNow, then review remaining external-search and homepage-only candidates.


## Individual source audit — sixth batch (2026-11-25)

This batch reviewed JAVSeen, JAVTsunami, and JavyNow. It distinguishes terms linked from a site's own page from terms whose stated operator/scope clearly covers the exact catalog domain. A linked policy with a different named service/domain is recorded as ambiguous rather than silently extended.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JAVSeen | Canonical homepage links to a Terms page, but the Terms identify Javhd.today and its operator/service rather than clearly stating that they govern javseen.tv; the linked Terms prohibit automated systems | **Policy scope ambiguous; automation not approved** | Remove the search template; do not automate retrieval pending operator clarification |
| JAVTsunami | Canonical homepage fetch timed out; third-party technical scan reports HTTP 403, but no canonical current terms or supported search contract was verified | **Unverified** | Remove the unverified search template; no Worker access pending verification |
| JavyNow | Canonical homepage and its linked Terms of Service at https://javynow.com/tos | **Automated content retrieval prohibited absent express authorization** | Remove the search template; no scraper, spider, robot, offline reader, or Worker fetching |

### Source-specific findings

#### JAVSeen

The canonical javseen.tv homepage links to a Terms of Service page at /static/terms/. However, the Terms state that they form an agreement with Sun Media Limited as operator of Javhd.today and describe use of the Javhd.today website and the operator's services. The homepage itself also lists javhd.today as a related destination. The same linked Terms prohibit automated systems/software/devices from using the service or obtaining content/information, and restrict copying, redistribution, and commercial exploitation.

Because the policy's stated website/service scope names javhd.today rather than clearly naming javseen.tv, this review does not assume that the terms definitively govern every javseen.tv activity. The prohibition is nevertheless a strong reason not to automate access while the operator/scope relationship remains unclear.

Decision: remove the search template. Keep only the homepage as a directory reference. Reconsider only after the operator confirms in writing that the linked Terms govern javseen.tv and clarifies whether any automated metadata retrieval is authorized.

#### JAVTsunami

The catalog points to javtsunami.com and previously contained a /search/{query} template. The research fetcher timed out on the canonical homepage. A third-party technical/reputation scan reports a point-in-time HTTP 403, but that is not a canonical policy statement and does not establish that ordinary users are blocked. No current canonical terms or stable public search contract was verified.

Decision: remove the unverified search template. Keep the source unverified; do not try alternate routes, proxies, cookies, or challenge bypasses.

#### JavyNow

The canonical javynow.com homepage links directly to its Terms of Service at /tos. The Terms state that the website is for personal, non-commercial use, prohibit copying or distributing site content without prior written authorization, and expressly prohibit computerized/automatic mechanisms—including web scrapers, offline readers, spiders, and robots—from accessing, extracting, or downloading website content unless expressly authorized.

Decision: do not implement a Worker Provider, HTML parser, metadata extractor, or other automated retrieval for JavyNow absent express authorization. The existing catalog search template was not independently verified as the site's supported public search route, so it is removed as well. Retain only the homepage reference.

### Batch outcome

- 3 sources received source-specific decisions.
- All 3 unverified search templates were removed.
- JAVSeen's linked terms are recorded with an explicit domain/scope caveat rather than misrepresented as definitively applicable.
- JavyNow's canonical Terms expressly prohibit automated content retrieval absent authorization.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- The remaining catalog search templates are now primarily the user-initiated external-search cases and existing implemented-provider fallback. The next review should validate those remaining entries, then continue through homepage-only torrent/forum candidates.


## Individual source audit — seventh batch (2026-11-25)

This batch revisited the two unresolved candidates, JableTV and SupJAV. It verifies the policy from the exact site's own page where possible and does not treat a terms document hosted on an unrelated domain as canonical policy.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JableTV | Canonical homepage and its linked Terms at https://jable.tv/terms/ | **Personal, non-commercial linking only; automated integration not approved** | Remove the unverified /videos/{query}/ search template; no Worker scraping, metadata extraction, or content copying |
| SupJAV | Canonical homepage fetch returned HTTP 403; the Terms result found on hmsea.com is hosted on a different domain and cannot be confirmed as SupJAV's canonical policy | **Unverified; no automated access** | Remove the unverified search template; no Worker requests pending canonical terms and ordinary public search verification |

### Source-specific findings

#### JableTV

The canonical jable.tv homepage links directly to /terms/. The current page identifies the agreement as governing Jable.TV and states that the site is for personal use, prohibits unauthorized framing/linking, and limits permitted linking to personal, non-commercial purposes. It also restricts copying, reproduction, distribution, and other exploitation of site content without prior written consent. The terms page is dated 2019-03-28, so it is the current page linked by the site but is not a recently revised policy.

The catalog's old https://jable.tv/videos/{query}/ template was not verified as a search route. The homepage exposes a search field, but the existence of a field does not establish that this guessed URL is the route it submits to. No official API or authorization for automated extraction was found.

Decision: remove the unverified search template. Retain only the homepage as a directory reference. Do not implement Worker fetching, HTML parsing, metadata extraction, or content copying. Any future user-initiated link must remain within the site's stated personal/non-commercial linking conditions and use a verified search destination.

#### SupJAV

The canonical supjav.com homepage returned HTTP 403 to the research fetcher. A search result surfaced a terms document hosted on hmsea.com that mentions both SUPJAV and jable.tv, but it is not hosted on supjav.com and its canonical provenance could not be established. It must not be treated as SupJAV's authoritative current policy. Third-party reputation reports and domain records do not establish permission to automate access.

Decision: remove the unverified search template. Keep SupJAV unverified and do not implement Worker requests, HTML parsing, or alternate-route/cookie/challenge workarounds. Revisit only after obtaining the canonical terms and confirming an ordinary public search interface for the exact domain.

### Batch outcome

- 2 sources received source-specific decisions.
- Both search templates were removed.
- JableTV is restricted to personal, non-commercial linking under its canonical linked Terms; the old catalog URL was not a verified search route.
- SupJAV remains unverified; a terms document hosted on a different domain was not misrepresented as canonical.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Remaining search templates should now be reviewed individually: JAV.guru (personal/non-commercial external link), r/JAV (external-search only), and YourBittorrent (implemented Provider fallback).


## Individual source audit — eighth batch (2026-11-25)

This batch reviewed four torrent-directory candidates: 141PPV, BTSOW, Empornium, and iJavTorrent. The decisions distinguish public UI visibility, mirror announcements, and third-party indexer metadata from canonical automation permission.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| 141PPV | A third-party RSSHub route reference points to https://141ppv.com/feeds/ and says the site's official feed does not support BT-download subscriptions; direct feed details and current terms were not verified | **Feed candidate; insufficient evidence for integration** | Keep homepage-only; do not implement RSS/API fetching until the exact feed format, content fields, and policy are verified |
| BTSOW | The catalog's btsow.com URL redirects to tellme.pw/btsow, which lists btsow.live and the old domain; no canonical operator-controlled mirror or current terms were verified | **Legacy domain / mirror provenance unresolved** | Keep only the existing directory reference; do not silently switch to third-party-listed mirrors or automate access |
| Empornium | Official status page lists empornium.sx online; the old .is domain is retired. Jackett identifies Empornium as a private tracker | **Current destination verified; private access only** | Update external destination to www.empornium.sx; no anonymous or authenticated Worker integration, account-cookie handling, or scraping |
| iJavTorrent | Public homepage exposes search/filter controls and torrent metadata; no canonical current Terms, documented API, or verified search URL was found | **Public UI visible; automation policy/interface unverified** | Keep user-initiated external search only; no Worker fetching or metadata extraction pending policy and interface verification |

### Source-specific findings

#### 141PPV

The catalog points to 141ppv.com. The research fetcher could not retrieve the site's /feeds/ page directly. RSSHub's third-party route documentation references https://141ppv.com/feeds/ as the official feed page and explicitly notes that the official feed does not support BT-download subscriptions. This is useful discovery evidence, but it does not establish the exact current feed format, which metadata fields are exposed, or permission for this product to republish feed data. A third-party reputation scan also reports one security-provider warning out of 26 displayed sources; that is not a definitive malware verdict, but it is a reason for caution before any server-side fetch.

Decision: retain the homepage reference only. Do not implement an RSS/API Provider until the official feed can be inspected directly and its terms/content scope reviewed. Do not treat an RSSHub route as an official 141PPV API.

#### BTSOW

The catalog's btsow.com URL now redirects the research browser to tellme.pw/btsow, a directory-style page that lists btsow.live and btsow.com as destinations. A separate btsow.icu search result also describes itself as BTSOW and lists bt1.btsow.me/bt2.btsow.me, but no canonical operator announcement tying these mirror domains to the catalog's original domain was verified. The redirect directory and search results are not sufficient to establish current operator control, policy, or a stable search contract.

Decision: do not rewrite the catalog to btsow.live, btsow.icu, or btsow.me based on third-party mirror listings. Keep the old entry as an unverified directory reference only; no Worker fetching or HTML parsing.

#### Empornium

The catalog previously pointed to empornium.is. The current status page hosted at about.empornium.sx lists empornium.sx as online and emparadise.rs as online, while the older .is domain is no longer the current site. Jackett's current indexer definition identifies Empornium as a private torrent tracker and lists https://www.empornium.sx/ as the active site URL, with .is as a legacy link. A January 2026 Jackett issue also records that the .is domain was retired and the .sx domain was active.

Decision: update the external destination to https://www.empornium.sx. Because it is a private tracker, do not build an anonymous Provider or handle user credentials, cookies, invite-only access, or authenticated search. This change only corrects the directory destination; it does not add a Provider.

#### iJavTorrent

The canonical homepage is reachable and exposes a search/filter UI for title, actress, or code, along with listing metadata and magnet links. The page footer states that the site does not host video files and that links are uploaded/shared by others; this disclaimer does not grant permission to scrape, copy, or republish the site's metadata. No canonical Terms of Service, documented API, or verifiable ordinary public search URL was found in the reviewed page. The site's articles page also says it collects articles from other websites and links back to sources, but that statement is not an authorization for third-party automation.

Decision: retain only a user-initiated external-search entry. Do not implement Worker fetching, HTML parsing, magnet extraction, or metadata redistribution until the operator publishes a clear policy and a stable public interface.

### Batch outcome

- 4 torrent candidates received source-specific decisions.
- Empornium's stale .is destination was corrected to its current .sx site, based on its status page and current indexer metadata.
- 141PPV's feed page is a possible future source, but its direct contents and policy remain unverified.
- BTSOW mirror domains were not substituted based on unofficial directory/search results.
- iJavTorrent remains external-search only; public page visibility is not treated as automation permission.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review forum candidates in small groups, prioritizing domains with a clearly identifiable canonical operator and public RSS/API documentation.


## Individual source audit — ninth batch (2026-11-25)

This batch reviewed four forum candidates: 141HongKong, 5278.cc, 52AV, and the 91Porny forum. It distinguishes research-fetch failures from site-wide access restrictions and does not infer automation permission from forum software or domain records.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| 141HongKong | Canonical homepage could not be retrieved; third-party domain metadata does not establish current terms or automation policy | **Unverified** | Keep homepage-only; no Worker crawling or post extraction |
| 5278.cc | Research fetch returned HTTP 403; Cloudflare Radar shows active domain certificates/DNS, but no canonical terms or search contract was found | **Unverified** | Keep homepage-only; no alternate-route probing, cookies, or challenge bypass |
| 52AV | Canonical homepage could not be retrieved; third-party technical records identify a Discuz-based forum but no current policy or search contract | **Unverified** | Keep homepage-only; no automated access pending canonical verification |
| 91论坛 (91porny.com/forum) | Public forum page exposes login/register, post listings, a footer Terms link, and numerous off-domain promotional redirects; linked Terms could not be reliably retrieved | **Public page visible; policy/API unresolved** | User-initiated external access only; no Worker scraping or post extraction |

### Source-specific findings

#### 141HongKong

The catalog points to 141hongkong.com. The research fetcher could not retrieve the canonical homepage. Search results primarily surfaced third-party domain/WHOIS records, which do not establish the operator's current terms, whether anonymous search is supported, or whether automated post retrieval is permitted.

Decision: retain the homepage-only entry as unverified. Do not infer that the site is offline or blocked for ordinary users from the research fetch failure, and do not implement Worker requests until canonical terms and a public search contract are verified.

#### 5278.cc

The research fetcher received HTTP 403 from https://5278.cc/. Cloudflare Radar shows current TLS certificates and DNS activity for the domain, but those infrastructure signals do not prove that the forum's public content is accessible to automated clients or establish any permission to collect it. No canonical current terms or public API/search documentation was identified.

Decision: retain homepage-only. Do not probe undocumented alternate paths, reuse browser cookies, proxy around the 403, or attempt challenge bypass. Reconsider only after the operator publishes a supported public interface and applicable terms.

#### 52AV

The catalog points to 52av.one. The research fetcher could not retrieve the canonical homepage. Third-party technical records describe a Discuz-based forum and show domain/DNS information, but they are not the site's own policy and do not establish a supported search URL or automation permission.

Decision: retain homepage-only and mark the source unverified. Do not infer the forum's search route from Discuz conventions or build an undocumented scraper.

#### 91论坛 (91porny.com/forum)

The canonical forum page is publicly visible and exposes login/register controls, a post listing, pagination, and a footer link labeled Terms. The same page contains numerous promotional links that redirect to unrelated external domains. The research browser did not reliably retrieve the actual Terms document from the footer link, and no documented public API or stable search endpoint was verified. Public visibility of forum posts is not permission to bulk collect or republish them.

Decision: keep user-initiated external access only. Do not implement Worker scraping, post extraction, user/profile collection, or automated following of promotional redirects. Revisit only after the canonical Terms and an authorized public interface are verified.

### Batch outcome

- 4 forum candidates received source-specific decisions.
- No candidate met the evidence threshold for a Worker Provider.
- HTTP 403 and fetch failures were recorded as research observations, not claims that ordinary users are blocked.
- No undocumented Discuz endpoints, session cookies, proxies, or challenge workarounds were attempted.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue with Cool18, EYNY, HJD2048, and JKForum, then assess the remaining forum directory entries.


## Individual source audit — tenth batch (2026-11-25)

This batch reviewed Cool18, EYNY, HJD2048, and JKForum. The review records research-fetch behavior separately from site availability and treats third-party scraper implementations as technical references, not permission.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Cool18 | Research fetch could not retrieve the canonical homepage; a community RSSHub route contains HTML scraping/search logic, but no official API/RSS contract or current automation policy was verified | **Technical route exists; permission unresolved** | Keep homepage-only; do not copy community scraping logic into Worker |
| EYNY | Canonical homepage returned a transient “system busy” message; no current canonical terms or supported public API/search contract was verified | **Unverified / transient response** | Keep homepage-only; no automated access pending verification |
| HJD2048 | Research fetch returned HTTP 403; third-party records report the forum as online, but do not establish automation permission | **Unverified** | Keep homepage-only; no alternate-route probing, cookies, or challenge bypass |
| JKForum | Research fetch returned HTTP 451; third-party reports indicate regional blocking in mainland China, which does not establish global availability or policy | **Access/policy unresolved** | Keep homepage-only; no Worker requests or attempts to circumvent access restrictions |

### Source-specific findings

#### Cool18

The catalog points to cool18.com. The research fetcher could not retrieve the canonical homepage. A community-maintained RSSHub route exists and its source code constructs search URLs and parses forum pages, including search.php and board-specific endpoints. That proves only that a third-party scraper has been written; it is not an official API, an operator-supported RSS feed, or permission for AIOResourceSearch to collect and republish forum posts. No canonical current automation policy was verified.

Decision: retain homepage-only. Do not copy RSSHub's scraping implementation or infer permission from its existence. Reconsider only if the operator documents a public API/RSS interface and applicable terms permit this use.

#### EYNY

The canonical www.eyny.com homepage returned a short transient “系統繁忙中，請稍等幾秒再試。” message to the research fetcher. This response does not establish that the forum is offline or that ordinary users receive the same result. Search results did not establish a canonical current terms page or a supported public search/API contract.

Decision: retain homepage-only and mark the source unverified. Do not probe undocumented endpoints or treat transient errors as automation permission.

#### HJD2048

The canonical hjd2048.com homepage returned HTTP 403 to the research fetcher. Third-party site records describe a forum and report successful checks from other times, but such records are not the operator's terms and do not establish a stable public search contract. A 403 from the research fetcher is not proof that ordinary visitors are globally blocked.

Decision: retain homepage-only. Do not use cookies, alternate routes, proxies, or challenge workarounds. Reconsider only after a documented public interface and applicable policy are verified.

#### JKForum

The catalog points to jkforum.net. The research fetcher received HTTP 451. GreatFire reports that URLs under jkforum.net are blocked in mainland China, but that regional measurement does not establish global unavailability or the site's automation policy. Search results did not establish canonical terms for the exact site or a supported public API/RSS contract.

Decision: retain homepage-only. Do not route around the 451 or regional access restrictions. No Worker scraping or post extraction is approved.

### Batch outcome

- 4 forum candidates received source-specific decisions.
- No candidate met the evidence threshold for a Worker Provider.
- Cool18's community RSSHub implementation was recorded as a technical reference only, not adopted as permission or code.
- HTTP 403, 451, and transient busy responses were not misrepresented as global site outages.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue with OurSogo, Sex8.cc, SexInSex, and SIS001, then finish the remaining forum candidates.


## Individual source audit — eleventh batch (2026-11-25)

This batch reviewed OurSogo, Sex8.cc, SexInSex, and SIS001. The review distinguishes forum features visible to ordinary visitors from a documented, authorized third-party data interface.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| OurSogo | Research fetch returned HTTP 403; no canonical current terms or supported public search/API contract was found | **Unverified** | Keep homepage-only; no alternate-route probing, cookies, or challenge bypass |
| Sex8.cc | Operator-linked Linktree lists sex8.cc among current destinations; canonical terms and documented public search/API contract were not verified | **External destination only** | Keep homepage-only; no Worker crawling or post extraction |
| SexInSex | Site entry page displays a 21+ warning, user-submitted-link disclaimer, and legal-rights notice; full access requires account activation | **Access-controlled; automation policy unresolved** | User-initiated external access only; no Worker scraping or account/session handling |
| SIS001 | Current FAQ pages on web.sis001.com and bbs.sis001.com document search and RSS features; catalog root returned HTTP 403 and no public feed URL/third-party collection permission was verified | **Forum features documented; public integration not authorized/verified** | Keep external access only; no Worker scraping or account/session handling |

### Source-specific findings

#### OurSogo

The canonical oursogo.com homepage returned HTTP 403 to the research fetcher. Search results did not establish a canonical current terms page, public API, RSS endpoint, or stable search contract for the exact domain. The 403 is a research observation, not proof that ordinary visitors are globally blocked.

Decision: retain homepage-only and mark unverified. Do not probe alternate paths, reuse cookies, proxy around the response, or attempt challenge bypass.

#### Sex8.cc

The canonical sex8.cc homepage could not be retrieved by the research fetcher. An operator-linked Linktree account for 杏吧论坛 lists sex8.cc alongside other current destinations (including sin8.cc and 8sex.online), which supports the association of the domain with the forum operator. However, that Linktree page does not establish the site's current terms, an authorized API/RSS feed, or a stable public search contract. Third-party privacy/technology scans describe page resources and trackers but are not automation policy evidence.

Decision: retain the exact catalog domain as a user-initiated external destination only. Do not implement Worker crawling or post extraction pending canonical terms and a supported public interface.

#### SexInSex

The canonical site's entry page displays a sexual-material warning, requires visitors to represent that they are at least 21 and that access is lawful in their community, and states that the site provides discussion and user-submitted links rather than hosting media files. It also states that full access requires account activation. These notices are access and content disclaimers, not permission for a third-party service to scrape or redistribute forum posts. A third-party registration page on a different domain was not treated as canonical terms for sexinsex.net.

Decision: keep user-initiated external access only. Do not implement Worker scraping, user/profile collection, account activation, cookie reuse, or authenticated requests. No explicit automation permission or documented public API/RSS contract was verified.

#### SIS001

The catalog points to sis001.com, whose root returned HTTP 403 to the research fetcher. Search results surfaced current FAQ pages on web.sis001.com and bbs.sis001.com. Those FAQs document built-in forum search and RSS subscription features, but they do not by themselves expose a verified public feed URL, establish anonymous access to all relevant boards, or grant permission for a third-party aggregator to collect and republish posts. The official FAQ also indicates registration/access restrictions, including closed registration notices.

Decision: keep the catalog entry as an external reference only. Do not infer a public RSS endpoint from the existence of an RSS feature, and do not use authenticated sessions or collect account-restricted content. Reconsider only after the operator documents a public feed/API and its terms permit this use.

### Batch outcome

- 4 forum candidates received source-specific decisions.
- No candidate met the evidence threshold for a Worker Provider.
- SIS001's built-in RSS feature was recorded as a lead for future verification, not treated as a public API or permission.
- SexInSex's 21+ warning and user-submitted-link disclaimer were not misrepresented as automation authorization.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review South-Plus, T66Y, 夯鸭论坛, and 色花堂98堂, then finish the remaining forum entries.


## Individual source audit — twelfth batch (2026-11-25)

This batch reviewed South-Plus, T66Y, 夯鸭论坛 (Hung-Ya), and 色花堂98堂 (SeHuaTang). It prioritizes first-party notices and avoids treating unofficial mirror announcements or an age-gate as permission for automated collection.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| South-Plus | Canonical homepage could not be retrieved; third-party reports indicate mainland-China regional blocking but no canonical automation policy was found | **Unverified / regionally inaccessible in some networks** | Keep homepage-only; no Worker access pending canonical terms and public interface |
| T66Y草榴社区 | First-party visitor notice explicitly says not to use scripts and warns abnormal access may cause IP blocking and account deletion | **Automated access expressly disallowed by site notice** | User-initiated external link only; no scripts, scraping, or Worker requests |
| 夯鸭论坛 (Hung-Ya) | Canonical homepage displays an 18+ age gate and general legal-content warning; no current terms or public API/search contract was found | **Age-gated; policy/interface unresolved** | Keep homepage-only; no scraping or age-gate bypass |
| 色花堂98堂 (SeHuaTang) | Operator-associated Telegram channel lists .net and .org as permanent domains; current .org homepage renders unrelated generic text and canonical terms/API were not verified | **Domain/content mismatch; unverified** | Keep existing .org reference only; no mirror switching or automated access |

### Source-specific findings

#### South-Plus

The catalog points to south-plus.net. The research fetcher could not retrieve the canonical homepage. GreatFire's regional measurement reports that south-plus.net URLs are blocked in mainland China, but this is a network-specific observation and does not establish global unavailability or the site's automation policy. No canonical current terms, official RSS/API documentation, or stable public search contract was identified.

Decision: retain homepage-only. Do not treat regional blocking as an invitation to use proxies or alternate domains; no Worker access is approved pending canonical terms and a supported public interface.

#### T66Y草榴社区

The site's own visitor notice at /notice.php?fid=-1 states that the forum is for adults 18+, warns against distributing content to minors, and explicitly instructs visitors not to use scripts. It further warns that abnormal access can cause the visitor's IP to be disabled and their account deleted. The notice also describes account-based forum functions and user-provided torrent links.

Decision: do not implement automated search, HTML parsing, post extraction, or Worker requests. Retain only a user-initiated external link. The first-party instruction not to use scripts is treated as a direct prohibition, not merely a technical warning.

#### 夯鸭论坛 (Hung-Ya)

The canonical hung-ya.com homepage currently presents an 18+ age gate and states that the site contains adult material, with a general reminder to comply with local law. This is an age/content notice, not a terms-of-service document or permission for automated access. No canonical current automation policy, public API/RSS feed, or stable search contract was verified.

Decision: retain homepage-only. Do not bypass the age gate or implement Worker crawling until the operator publishes an applicable policy and supported public interface.

#### 色花堂98堂 (SeHuaTang)

The catalog points to sehuatang.org. An operator-associated Telegram channel under the SeHuaTang name lists sehuatang.net and sehuatang.org as permanent domains and posts forum-rule updates. However, the current research fetch of sehuatang.org renders an unrelated generic quotation page rather than a forum. A third-party RSSHub issue from 2023 requests author-level RSS and is marked login-required; it is not evidence of an official public feed or automation permission. The channel's domain announcements do not provide a canonical API or grant data-reuse rights.

Decision: keep the existing .org entry as an unverified external reference. Do not silently switch to .net, a mirror, or a Telegram-derived address; do not scrape posts or author pages. Revisit only after the operator's current canonical domain, terms, and supported public interface are independently verified.

### Batch outcome

- 4 forum candidates received source-specific decisions.
- T66Y's first-party no-scripts instruction rules out automated collection.
- South-Plus regional blocking was not misrepresented as global outage or permission to circumvent.
- SeHuaTang's Telegram announcements were treated as domain-discovery evidence only; no mirror substitution was made.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- The initial forum candidate list is now fully reviewed; remaining directory entries should be checked for duplicates, stale domains, and whether any have a genuine first-party API/RSS before being considered for integration.


## Individual source audit — thirteenth batch (2026-11-25)

This batch reviewed four Lustpress-listed video-index candidates: Eporner, XNXX, XVideos, and XHamster. The review distinguishes canonical policy text from third-party policy indexes and does not infer that a public search page or unofficial scraper grants reuse rights.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Eporner | Canonical Terms URL could not be retrieved; a third-party policy review quotes restrictions on automated/manual extraction, scraping, harvesting, downloading, or reproduction for AI-model/system purposes without prior written consent | **Policy scope unresolved; automation not approved** | External-only pending canonical Terms review and written clarification |
| XNXX | Official legal Terms and robots.txt exist; third-party review reports two disallowed paths and no clear public data-sharing API | **No third-party aggregation permission verified** | External-only; respect robots.txt; do not use unofficial scraper wrappers |
| XVideos | Third-party Terms index records a clause prohibiting spidering, crawling, or automated access; canonical Terms page was not independently retrieved | **Automated access treated as prohibited pending contrary written authorization** | External-only; no Worker crawling |
| XHamster | Current xHamster-related Terms at my.xhsocial.com prohibit scraping, redistribution, and automatic/manual monitoring or reproduction; defined scope is centered on my.xhsocial.com and company-operated related domains | **Strong restriction; exact xhamster.com scope requires clarification** | External-only; no automated access pending written clarification |

### Source-specific findings

#### Eporner

The catalog entry originates from the Lustpress provider list. The canonical Terms URL at https://www.eporner.com/terms/ was blocked to the research fetcher, so the full current first-party text could not be reviewed directly. A third-party policy review quotes a clause restricting automated or manual extraction, scraping, harvesting, downloading, or reproduction of content/data for the purposes of developing, training, or operating AI models or systems without prior written consent. That quoted scope is not identical to ordinary metadata aggregation, so this review does not overstate it as a blanket prohibition on every kind of automated access. However, no public API or authorization for this project's intended reuse was established.

Decision: keep Eporner external-only. Do not implement a Worker Provider or HTML scraper unless the canonical Terms are reviewed and the operator confirms in writing that the intended metadata aggregation is permitted.

#### XNXX

The official legal Terms are published under info.xnxx.com/legal/tos, and the site publishes robots.txt. A third-party policy review reports two disallowed paths and notes that the Terms address delegated/agent activity, but it did not establish a public data-sharing API or an affirmative grant for third-party metadata aggregation. Unofficial Python/API wrappers and hosted scraper products are not official authorization and are not adopted as implementation references.

Decision: retain external-only. Do not implement scraping or use unofficial wrappers. Any future review must inspect the exact current Terms and robots.txt path-by-path, identify an official supported interface, and obtain any required permission.

#### XVideos

A third-party Terms index for XVideos records an approved clause stating that spidering, crawling, or accessing the site through automated means is not allowed. The canonical Terms page was not independently retrieved in this review, so the finding is recorded as a strong policy signal rather than a direct first-party quotation from a fetched page. No official public API or written permission for this aggregator was found.

Decision: treat automated access as prohibited unless the operator provides contrary written authorization. Keep the source as a user-initiated external destination only; do not implement Worker fetching or HTML parsing.

#### XHamster

The current Terms & Conditions at my.xhsocial.com/info/terms were last modified 2026-10-09. They prohibit redistribution or scraping of the Site/Materials and also prohibit using automatic devices or manual processes to monitor or reproduce the Site or Materials. The defined scope explicitly centers on my.xhsocial.com and related domains operated by the company, and the text references xHamster.com in its Community User provisions. However, the scope definition does not unambiguously establish that every xhamster.com domain/path is covered by this exact page, so this review records that caveat rather than extending the terms beyond their stated scope.

Decision: do not automate access to xhamster.com pending written clarification of the policy's scope and permission. Keep external-only; no scraper, metadata extraction, or redistribution.

### Batch outcome

- 4 Lustpress-listed sources received source-specific decisions.
- No source received approval for a Worker Provider.
- Third-party policy summaries were labeled as such and not misrepresented as canonical fetched Terms.
- No unofficial scraper/API wrapper was adopted.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review the remaining Lustpress-listed sources PornHub, RedTube, YouPorn, and TXXX, then move to the FetchJAV-listed other-index candidates.


## Individual source audit — fourteenth batch (2026-11-25)

This batch reviewed the remaining four Lustpress-listed sites: PornHub, RedTube, YouPorn, and TXXX. It uses exact-site policy evidence where available and does not transfer terms between related sites solely because they share a corporate operator.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| PornHub | Third-party Terms index records a clause prohibiting spidering, crawling, or automated access; canonical Terms page could not be retrieved | **Automated access treated as prohibited pending contrary written authorization** | User-initiated external access only; no Worker crawling |
| RedTube | First-party Terms last modified 2026-05-01 grant a revocable personal-use license requiring full-site display with ads and prohibit public reproduction/distribution/linking absent express permission | **Public aggregator linking/reuse not permitted by the reviewed license** | Remove product destination; no scraping, linking, or metadata redistribution absent written permission |
| YouPorn | Homepage links to Terms and Privacy Notice, but Terms route redirects to a regional access notice in the research session | **Exact-site policy unverified** | External-only; no Worker access pending current Terms review |
| TXXX | Canonical homepage fetch returned only a minimal shell/tracking resources; no current terms, API/RSS, or stable search contract was verified | **Unverified** | Homepage-only; no Worker scraping or metadata extraction |

### Source-specific findings

#### PornHub

The catalog entry originates from the Lustpress provider list. A third-party Terms index for PornHub records an approved clause stating that spidering, crawling, or accessing the site through automated means is not allowed. The canonical Terms URL at https://www.pornhub.com/information/terms could not be retrieved by the research browser, so this is recorded as a strong third-party policy signal rather than a direct first-party quotation. No official public metadata API or written authorization for this project was identified.

Decision: treat Worker crawling and HTML parsing as prohibited unless the operator provides contrary written authorization. Keep only a user-initiated external entry; do not adopt unofficial scrapers.

#### RedTube

The canonical RedTube Terms of Service at https://www.redtube.com/information/terms were directly retrieved and were last modified 2026-05-01. The Terms apply to registered and unregistered users. The license to access and use the website and its Works is revocable and conditional on personal use, and requires the website to be displayed whole and intact as presented by its host, including all advertising. The Terms also state that users may not otherwise reproduce, distribute, communicate to the public, make available, adapt, publicly perform, link to, or publicly display the website and Works absent express permission; they separately prohibit copying or reproducing content that does not belong to the user.

Decision: do not include a RedTube destination link in the public source catalog and do not scrape, extract, or redistribute metadata. Reconsider only if the operator grants written permission for the exact public linking and metadata-aggregation use.

#### YouPorn

The canonical YouPorn homepage exposes links to its Terms of Service and Privacy Notice. However, opening the Terms route in the research session redirected to a regional access notice explaining that access is disabled in Virginia pending age-verification requirements. The current Terms text could not be retrieved from that session. RedTube and PornHub are operated by the same corporate group, but their individual site policies cannot be assumed to be identical or automatically extended to YouPorn.

Decision: retain user-initiated external access only. Do not implement Worker fetching, HTML parsing, or metadata extraction until the exact YouPorn Terms and any public API/search contract are verified.

#### TXXX

The catalog points to txxx.com. The canonical homepage returned only a minimal shell and tracking resources to the research browser. No canonical current Terms, documented public API/RSS feed, or stable ordinary public search route was verified. A thin page response is not evidence that the site is offline or that an undocumented route may be probed.

Decision: retain homepage-only as an unverified directory reference. Do not reverse-engineer endpoints, scrape HTML, or extract metadata pending policy and interface verification.

### Batch outcome

- 4 Lustpress-listed sources received source-specific decisions.
- RedTube's product destination was removed because its first-party license restricts public linking and reuse absent express permission.
- PornHub automation remains disallowed pending contrary written authorization.
- YouPorn was not assigned RedTube/PornHub terms by corporate association alone.
- TXXX remains unverified; no undocumented endpoint probing was performed.
- The eight Lustpress-listed sources have now all received individual review entries (Eporner, XNXX, XVideos, XHamster, PornHub, RedTube, YouPorn, TXXX).
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue with FetchJAV-listed other-index candidates, starting with 91Porn, 85Tube, AApp11, and HAnime XYZ.


## Individual source audit — fifteenth batch (2026-11-25)

This batch reviewed four FetchJAV-listed other-index candidates: 91Porn, 85Tube, AApp11, and HAnime XYZ. The review keeps similarly named domains separate and does not treat third-party redirect records as definitive operator confirmation.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| 91Porn | Canonical homepage is an 18+ age gate and explicitly says mainland-China users should not visit; no canonical current automation policy/API/search route was verified | **Age-gated; policy/interface unresolved** | User-initiated external access only; no Worker fetching or age-gate bypass |
| 85Tube | Third-party domain records report 85tube.com redirecting to 85ro.com; 85PO's first-party Terms restrict use to personal purposes and prohibit unauthorized linking/copying/redistribution | **Possible legacy alias; operator relationship not fully verified** | No Worker scraping; keep exact 85Tube domain unresolved pending operator confirmation |
| AApp11 | FetchJAV names the source but no canonical domain, terms, or public interface was verified | **Name-only unverified candidate** | No domain guessing or automated access |
| HAnime XYZ | FetchJAV names the source but exact canonical domain and terms were not verified; hanime.moe is a separate domain | **Name-only unverified candidate** | No domain guessing or automated access |

### Source-specific findings

#### 91Porn

The canonical 91porn.com homepage currently presents an age-confirmation gate. Its text states that visitors must be at least 18 and explicitly says mainland-China users should not visit. The page also states the site's public-facing policy position against privacy violations, doxxing, coercion, and material involving persons under 18. No canonical current Terms of Service, documented public API/RSS, or stable search URL was verified. This site is distinct from the previously audited 91porny.com/forum; the two domains must not be conflated.

Decision: keep only user-initiated external access for eligible visitors. Do not implement Worker fetching, HTML parsing, metadata extraction, or age-gate bypass. Revisit only after the exact site's current Terms and a supported public interface are verified.

#### 85Tube

The FetchJAV list names 85Tube, while third-party domain records report that 85tube.com redirects to www.85ro.com/en. The latter's first-party Terms identify the service as 85PO and state that the agreement applies to 85ro.com. Those Terms restrict use to personal purposes, prohibit unauthorized framing/linking, and prohibit copying, reproducing, distributing, or otherwise exploiting content without prior written consent. They permit links to materials for personal, non-commercial purposes only. However, the precise relationship between the old 85tube.com domain and the current 85PO/85RO operator was not confirmed by a first-party announcement in this review.

Decision: do not implement Worker scraping or metadata redistribution. Do not silently rewrite the 85Tube entry to 85ro.com based only on third-party redirect observations. Keep the candidate's canonical domain unresolved until the operator confirms the alias and any allowed linking scope.

#### AApp11

FetchJAV's supported-site list names AApp11, but the catalog contains no verified canonical domain. Searches did not establish a first-party website, current Terms, public API/RSS, or stable public search contract for the exact name. Similar-looking domains are not sufficient evidence to select a destination.

Decision: keep as a name-only candidate. Do not guess a domain, copy FetchJAV-specific scraping code, or implement automated access.

#### HAnime XYZ

FetchJAV's supported-site list names HAnime XYZ, but the exact canonical domain and current Terms were not verified. Search results surfaced hanime.moe Terms of Use, but hanime.moe is a separate domain and must not be treated as HAnime XYZ's policy. Similar branding or a shared category is not proof of common ownership or terms.

Decision: keep as a name-only candidate. Do not substitute hanime.moe or any other similarly named domain, and do not implement automated access until the exact site is identified and its terms/interface are reviewed.

### Batch outcome

- 4 FetchJAV-listed candidates received source-specific decisions.
- 91Porn's 18+ and mainland-China access notice was recorded; no access-gate bypass is permitted.
- 85Tube's possible redirect to 85PO/85RO was recorded as third-party evidence, not as a confirmed first-party alias.
- AApp11 and HAnime XYZ remain name-only candidates rather than receiving guessed URLs.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: continue with Hanime1, HanimeTV, MIEN321, and PigAV.


## Individual source audit — sixteenth batch (2026-11-25)

This batch reviewed four FetchJAV-listed other-index candidates: Hanime1, HanimeTV, MIEN321, and PigAV. Similar names and historical domain snapshots are not treated as proof of a common operator or current integration permission.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Hanime1 | Exact site has a 2257 statement requiring visitors to be at least 18; canonical homepage returned HTTP 403; no current Terms or public API/search contract was verified | **Age-restricted; policy/interface unresolved** | External-only; no Worker scraping or challenge bypass |
| HanimeTV | First-party Terms updated 2026-06-25 expressly prohibit robots, spiders, scrapers, automated access, and data mining/extraction | **Automated access expressly prohibited** | External-only; no Worker API calls or scraping |
| MIEN321 | FetchJAV names the source but no exact canonical domain, Terms, or public interface was verified | **Name-only unverified candidate** | No domain guessing or automated access |
| PigAV | Current homepage renders a PeerTube-style JavaScript-required shell; no canonical instance policy/terms or verified API scope; older third-party WordPress records may be stale | **Platform/domain identity changed or unresolved** | External-only; no API harvesting or HTML scraping pending operator verification |

### Source-specific findings

#### Hanime1

The catalog entry is Hanime1, whose exact domain is hanime1.me. The site publishes a 2257 statement saying visitors must be at least 18 or the age of majority in their jurisdiction, whichever is higher. The research fetcher received HTTP 403 from the canonical homepage, and no current Terms of Service, public API, or authorized search contract was verified. Third-party mobile clients and scraper projects exist, but their own disclaimers explicitly say they are unaffiliated and do not establish Hanime1 authorization.

Decision: retain user-initiated external access only. Do not implement Worker scraping, use third-party unofficial wrappers as permission, or attempt challenge/cookie bypass. Revisit after the canonical Terms and a supported public interface are verified.

#### HanimeTV

The canonical hanime.tv homepage links to its first-party Terms of Use, last updated 2026-06-25. The Terms define the service to include its website, interfaces, content, and software. They limit use to personal/non-commercial viewing and state that, unless expressly authorized, users may not archive, reproduce, distribute, publish, license, or otherwise use content/information obtained through the service without express written permission. They expressly prohibit using any robot, spider, scraper, or other automated means to access the service, and prohibit data mining, data gathering, or extraction methods.

Decision: do not implement a Worker Provider, use the site's internal API from the Worker, scrape HTML, or extract metadata absent express written permission. Keep the source as an external destination only.

#### MIEN321

FetchJAV's supported-site list names MIEN321, but the current source catalog does not have a verified canonical domain. Searches did not establish a first-party website, current Terms, public API/RSS, or stable public search contract for the exact source name. Similar-looking domains are insufficient to select a destination.

Decision: keep as a name-only candidate. Do not guess a domain, copy FetchJAV-specific scraping code, or implement automated access.

#### PigAV

The current pigav.com homepage renders a JavaScript-required shell with wording and controls characteristic of a PeerTube-style instance. A third-party historical page describes pigav.com as a WordPress-based AV site, but that older snapshot may be stale and conflicts with the current response. The research fetcher could not retrieve an instance About page or Terms route, and no operator-published API policy or stable search contract was verified. PeerTube's existence as an open-source platform does not automatically authorize this instance's data to be harvested or redistributed.

Decision: keep user-initiated external access only. Do not query PeerTube API endpoints, crawl the HTML, or extract metadata until the instance operator and current rules are verified.

### Batch outcome

- 4 FetchJAV-listed candidates received source-specific decisions.
- HanimeTV's first-party Terms explicitly rule out automated access and data extraction absent express authorization.
- Hanime1 remains distinct from HanimeTV and from similarly named Hanime services.
- MIEN321 remains name-only rather than receiving a guessed domain.
- PigAV's current PeerTube-style response was recorded; stale third-party WordPress records were not treated as current truth.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review ThisAV, Porn5F, PornBest, and PornTW.


## Individual source audit — seventeenth batch (2026-11-25)

This batch reviewed four FetchJAV-listed other-index candidates: ThisAV, Porn5F, PornBest, and PornTW. It distinguishes an officially confiscated domain from stale or unverifiable directory names and does not substitute unrelated mirrors.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| ThisAV | Current thisav.com homepage displays an anti-piracy notice stating the domain was confiscated through legal proceedings; a U.S. federal judgment ordered transfer of thisav.com | **Retired / domain legally seized** | Remove destination; no external redirect, scraping, or mirror substitution |
| Porn5F | Canonical homepage could not be retrieved; third-party records are stale/inconsistent and one snapshot lists a July 2026 expiry | **Unverified / possibly stale domain** | Keep name-only; no mirror guessing or automated access |
| PornBest | pornbest.org homepage could not be retrieved; third-party WHOIS snapshots list 2026-11-23 expiry and redirects involving unrelated domains | **Current ownership/service unresolved** | Keep name-only; no redirect following or mirror substitution |
| PornTW | No exact canonical domain, current Terms, public API/RSS, or stable search contract was verified | **Name-only unverified candidate** | No domain guessing or automated access |

### Source-specific findings

#### ThisAV

The canonical thisav.com homepage currently displays a multilingual anti-piracy notice stating that the site previously published on the domain handled illegally uploaded videos and that the domain was confiscated through legal proceedings. A U.S. federal judgment in WILL CO., LTD. v. LEE ordered the transfer of thisav.com and several related domains to the plaintiff. This is materially different from a transient fetch failure or ordinary domain redirect: the current destination itself states that the domain was confiscated.

Decision: treat ThisAV as retired and legally seized. Do not retain a clickable destination, attempt to scrape it, follow replacement domains, or substitute unofficial mirrors. The catalog entry remains only as a historical source record.

#### Porn5F

The catalog contains the FetchJAV name Porn5F but no verified canonical URL. The research fetcher could not retrieve porn5f.com. Third-party domain snapshots are stale/inconsistent; one lists a July 3, 2026 expiry date, while other snapshots show later infrastructure observations without proving the current operator or renewal status. No first-party Terms, API/RSS documentation, or stable search contract was identified.

Decision: keep Porn5F as a name-only unverified candidate. Do not assume the domain is expired, do not guess a replacement domain, and do not copy FetchJAV's site-specific scraping code.

#### PornBest

The FetchJAV candidate name maps to pornbest.org in the existing directory references. The canonical homepage could not be retrieved. Third-party WHOIS snapshots list an expiry date of 2026-11-23, two days before this review, but do not confirm whether the domain renewed, changed owners, or was transferred. Other third-party records show redirects involving unrelated domains such as whichav.com and singlove.com; those are not proof of an operator-approved replacement. No canonical Terms or public search contract was verified.

Decision: keep PornBest as a name-only unverified candidate. Do not follow third-party redirect chains or substitute similarly named/redirected domains. Reconsider only after the operator's canonical current domain and policy are confirmed.

#### PornTW

FetchJAV's supported-site list names PornTW, but the exact canonical domain could not be established. The likely-looking porntw.com address was not retrievable, and searches did not surface a first-party Terms page, official API/RSS documentation, or a stable public search interface. Similar names and search snippets are insufficient evidence to identify the operator's site.

Decision: keep as a name-only unverified candidate. Do not guess a domain, infer a search path, or implement automated access.

### Batch outcome

- 4 FetchJAV-listed candidates received source-specific decisions.
- ThisAV was classified as retired/legally seized based on its current anti-piracy notice and the federal domain-transfer judgment.
- Porn5F and PornBest remain unverified rather than being labeled definitely offline or expired.
- PornTW remains name-only; no URL was guessed.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review PornHK, PornJP, PornHoHo, and PornLuLu.


## Individual source audit — eighteenth batch (2026-11-25)

This batch reviewed four FetchJAV-listed candidates: PornHK, PornJP, PornHoHo, and PornLuLu. The review focuses on current domain ownership/status and avoids assuming that a name in an old supported-site list still corresponds to an active site.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| PornHK | pornHK.com RDAP reports the domain registered but parked, with domain-marketplace nameservers; no active operator-controlled service or Terms were verified | **Parked / no current service verified** | Remove destination; keep historical name-only record |
| PornJP | No exact canonical domain, current Terms, API/RSS, or public search interface was verified | **Name-only unverified candidate** | No domain guessing or automated access |
| PornHoHo | pornhoho.com could not be retrieved; third-party status data reports offline and a WHOIS snapshot lists 2025-12-12 expiry | **Historical / apparently inactive** | Remove destination; keep historical name-only record |
| PornLuLu | Domain remains active, but the research fetcher receives a Cloudflare challenge; no current canonical Terms or public API/search contract was verified | **Active domain; access/policy unresolved** | External-only; no cookie reuse, proxying, or challenge bypass |

### Source-specific findings

#### PornHK

The FetchJAV candidate name maps to pornhk.com in third-party references. Current RDAP data reports that pornhk.com is registered but parked, with nameservers associated with a domain marketplace rather than an identifiable operator-controlled content service. The research fetcher cannot retrieve a site, and no current canonical Terms, public API/RSS, or supported search contract was found.

Decision: remove any clickable destination and retain only a historical name-only record. Do not substitute another PornHK-like domain or a parked-domain marketplace listing.

#### PornJP

FetchJAV's supported-site list names PornJP, but the exact canonical domain could not be established. Searches did not surface a first-party website, current Terms, official API/RSS, or a stable public search interface for the exact name. Similar domain strings are not sufficient evidence to identify the operator.

Decision: keep as a name-only unverified candidate. Do not guess a domain or implement automated access.

#### PornHoHo

The likely catalog domain pornhoho.com could not be retrieved. Third-party site-status data reports the site offline, and a WHOIS snapshot lists a 2025-12-12 expiry date. These are third-party observations, not proof of current ownership or permanent deletion, but no current operator-controlled service or canonical policy could be verified.

Decision: remove any clickable destination and keep only a historical name-only record. Do not follow unrelated redirects or guess replacement domains.

#### PornLuLu

The canonical pornlulu.com domain remains registered and has current DNS/certificate activity in third-party records. However, the research fetcher receives a Cloudflare “Just a moment” challenge response rather than the site's ordinary content. This does not prove that normal visitors cannot access the site. No canonical current Terms, public API/RSS, or supported search contract was verified. The challenge is an access-control signal, not an invitation to reuse browser cookies, proxy requests, or attempt a bypass.

Decision: retain user-initiated external access only. Do not implement Worker fetching, HTML parsing, or metadata extraction pending canonical policy and supported-interface verification. Do not circumvent the challenge.

### Batch outcome

- 4 FetchJAV-listed candidates received source-specific decisions.
- PornHK is currently parked; PornHoHo appears inactive; neither received a guessed replacement URL.
- PornJP remains name-only because its exact domain is unresolved.
- PornLuLu remains external-only because the research fetcher receives a challenge and no policy/API permission was verified.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review PornNVR, Seselah, XJISHI, and any remaining FetchJAV candidates.


## Individual source audit — nineteenth batch (2026-11-25)

This batch reviewed four remaining FetchJAV-listed names: PornNVR, Seselah, XJISHI, and Video01. The focus was canonical-domain identity; similar names, redirects, and stale WHOIS/technology snapshots are not treated as proof of a supported source.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| PornNVR | No exact canonical domain, current Terms, API/RSS, or stable public search contract was found | **Name-only unverified candidate** | No domain guessing or automated access |
| Seselah | Third-party records report seselah.com redirecting to papalah.com, but no first-party operator confirmation or exact-domain policy was verified | **Possible redirect; alias unconfirmed** | Keep name-only; do not switch to Papalah or scrape |
| XJISHI | FetchJAV names the source, but xjishi.com third-party records show a holding/placeholder-style response and stale data; no canonical operator site was verified | **Name-only; domain mismatch** | No domain guessing or automated access |
| Video01 | FetchJAV names the source but no exact canonical domain was verified; video01.com appears unrelated and video01.org records do not establish the intended operator | **Name-only; domain unresolved** | No domain substitution or automated access |

### Source-specific findings

#### PornNVR

FetchJAV's supported-site list names PornNVR, but no exact canonical domain could be established. Searches did not surface a first-party site, current Terms, official API/RSS documentation, or a stable public search interface for the exact name. The catalog therefore has no verified URL.

Decision: keep PornNVR as a name-only unverified candidate. Do not guess a domain or infer a search route.

#### Seselah

The catalog contains the name Seselah. Third-party domain information reports that seselah.com redirects to papalah.com, but no first-party announcement from the operator was found confirming that Papalah is the official successor or that the two domains share the same current Terms. Other third-party records describe Cloudflare challenges and historical technical details, which do not establish an automation policy or a supported public search contract.

Decision: keep Seselah as a name-only candidate. Do not silently rewrite it to Papalah or implement scraping until the operator confirms the canonical domain and applicable terms.

#### XJISHI

FetchJAV names XJISHI but does not establish a current canonical URL in the reviewed material. Third-party records for xjishi.com show a generic/holding-page style response and stale registration snapshots; they do not establish that xjishi.com is the source FetchJAV intended. A similarly named xjishi.site record is also stale and cannot be substituted.

Decision: keep as a name-only unverified candidate. Do not link to xjishi.com or xjishi.site, and do not guess another domain.

#### Video01

FetchJAV names Video01, but no exact canonical domain was verified. The search result for video01.com identifies a generic company/contact site rather than the intended adult-content source. Third-party records for video01.org mention a human-check page but do not establish operator identity or a canonical supported-site relationship.

Decision: keep as a name-only unverified candidate. Do not substitute video01.com or video01.org without first-party confirmation.

### Batch outcome

- 4 remaining FetchJAV names received source-specific decisions.
- No canonical domains were guessed for PornNVR, Seselah, XJISHI, or Video01.
- Seselah's third-party redirect to Papalah was recorded as an unconfirmed lead only.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review the remaining FetchJAV candidates Jable.org and TnaFlix, then perform a full reconciliation of the 26 named sites against the 28 FetchJAV-tagged catalog records.


## Individual source audit — twentieth batch (2026-11-25)

This batch reviewed the remaining two FetchJAV-listed candidates, Jable.org and TnaFlix. It keeps Jable.org separate from JableTV and uses TnaFlix's own current Terms rather than relying on scraper projects or third-party site profiles.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Jable.org | Canonical homepage and robots.txt could not be retrieved; third-party site report says robots.txt disallows the entire site, but this was not independently confirmed | **Unverified; crawler restriction signal** | Keep name-only; no Worker crawling |
| TnaFlix | First-party Terms require personal, non-commercial use and prohibit copying/distributing any part of the website or exploiting its content without prior written authorization | **External homepage only; automated aggregation not authorized** | Keep user-initiated homepage link; no Worker scraping or metadata extraction |

### Source-specific findings

#### Jable.org

The FetchJAV list names Jable.org, which is a separate exact domain from JableTV (jable.tv). The research fetcher could not retrieve either https://jable.org/ or https://jable.org/robots.txt. A third-party site-information service reports that the site's robots.txt disallows the entire site, but that report could not be independently confirmed from the first-party file. No canonical current Terms, official API/RSS, or stable public search route was verified.

Decision: keep Jable.org as a name-only unverified candidate. Do not treat it as JableTV, do not infer permission from FetchJAV's adapter, and do not crawl the site while the robots restriction remains unresolved.

#### TnaFlix

The canonical www.tnaflix.com homepage is reachable and exposes a public search field. Its first-party Terms of Service at /terms state that access is for personal, non-commercial purposes and that users may not copy or distribute any part of the website without prior written authorization. The Terms also reserve copyright and other intellectual-property rights in site content and prohibit use, copying, reproduction, distribution, broadcast, display, sale, licensing, or other exploitation of that content without prior written consent from the respective owners. No public metadata API or permission for third-party aggregation was found. The site has a separate legal/regulatory history and a 2022 data breach; neither creates permission to automate access or handle user credentials.

Decision: retain only the user-initiated homepage link. Do not implement Worker fetching, HTML parsing, metadata extraction, or reuse of account credentials/cookies absent written authorization. Do not adopt FetchJAV's scraping logic as proof of permission.

### Batch outcome

- 2 remaining FetchJAV candidates received source-specific decisions.
- Jable.org remains separate from JableTV and has an unresolved first-party robots/terms status.
- TnaFlix's first-party Terms do not authorize the intended public metadata aggregation.
- The 26 explicitly listed FetchJAV sites have now all been reviewed individually; this does not mean every FetchJAV-tagged catalog record is a distinct site or a working Provider.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next step: reconcile the full FetchJAV tag set against its 26 README-listed sites, identify duplicates/extra records, then continue the remaining Atlas/other-index candidates.


## FetchJAV catalog reconciliation (2026-11-25)

The current FetchJAV README says the application supports 30+ sites, but its explicit Supported Sites table lists 26 names. The AIOResourceSearch catalog has 28 entries carrying the FetchJAV project tag. A name-by-name comparison shows that all 26 README-listed sites are represented in the catalog, with no missing entries. The two additional FetchJAV-tagged records are metadata-enrichment sources, not additional site adapters:

| Catalog entry | FetchJAV role | Classification |
|---|---|---|
| JAV.guru | Native discovery and actress/catalog metadata feature mentioned in README; also used by the metadata pipeline | Metadata/discovery source, not one of the 26 Supported Sites table entries |
| JAVDatabase | Listed in `metadata_fetcher.py` cross-site metadata enrichment pipeline | Metadata enrichment source, not one of the 26 Supported Sites table entries |

### Explicit 26-site inventory

The 26 entries in the README's Supported Sites table are: JableTV, MissAV, SupJav, Hanime1, HanimeTV, TnaFlix, 91Porn, JavDB, Jable.org, ThisAV, PigAV, Porn5F, 85Tube, PornBest, HAnime XYZ, PornTW, PornJP, PornHK, PornHoHo, PornNVR, Video01, PornLuLu, MIEN321, AApp11, Seselah, and XJISHI.

Each of these 26 has now received an individual source review in this document or in the earlier source-review batches. This means only that the candidate identity and available policy/interface evidence were reviewed; it does not mean the sites are authorized, working, integrated, or production-enabled. Several are explicitly disallowed for automation, several remain name-only or stale-domain records, and others are external-only pending canonical policy verification.

### Reconciliation result

- README explicit website adapter list: 26.
- FetchJAV-tagged catalog entries: 28.
- Missing README-listed sites in catalog: 0.
- Extra FetchJAV-tagged metadata records: 2 (JAV.guru and JAVDatabase).
- The README's broader phrase “30+ sites” is a project-level claim; this audit does not infer 30+ individually listed or verified site adapters from it.
- No new Provider, search template, KV configuration, source enablement, or deployment was added by this reconciliation.

## Next source-review scope

With the explicitly listed FetchJAV sites reconciled, the next review pass returns to the remaining Atlas-tagged `other-index` and torrent/forum candidates. Prioritize entries with first-party APIs/RSS or stable public metadata interfaces; treat any site-specific FetchJAV/Atlas scraper code only as technical evidence, never as permission to reuse it.


## Individual source audit — twenty-first batch (2026-11-25)

This batch reviewed four Atlas-listed torrent candidates: JAVBEE, JavJunkies, LoveTorrent, and MagnetDL. The review distinguishes inaccessible/uncertain domains from known historical shutdowns and does not adopt unofficial mirrors.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| JAVBEE | Canonical homepage could not be retrieved; no current Terms or public API/RSS/search contract was verified | **Unverified** | Homepage-only; no Worker fetching or HTML parsing |
| JavJunkies | javjunkies.org shows a “No Access” page in third-party observations; security services flag possible phishing/malware signals, not definitive | **Access/security risk unresolved** | Remove clickable destination; no login, credential submission, or automated access |
| LoveTorrent | Canonical lovetorrent.net homepage could not be retrieved; no current operator-controlled service or policy was verified | **Unverified** | Name-only; no mirror guessing or automated access |
| MagnetDL | MagnetDL.com announced shutdown in May 2019 and briefly returned; current third-party monitoring reports .com offline; .io/.co domains are unverified mirrors | **Historical / current service unverified** | Remove destination; no mirror substitution or automated access |

### Source-specific findings

#### JAVBEE

The catalog points to javbee.org. The research fetcher could not retrieve the canonical homepage. Searches did not establish current first-party Terms, an operator-confirmed API/RSS feed, or a stable public search contract. Third-party technical or domain records do not establish permission to collect and republish torrent metadata.

Decision: retain the homepage reference only as unverified. Do not implement Worker requests or an HTML scraper until the operator publishes a supported interface and applicable policy.

#### JavJunkies

The catalog points to javjunkies.org. The research fetcher could not retrieve the homepage. Third-party observations identify the current page title as “JAVJunkies » No Access,” while security services have flagged possible phishing or malware signals. These reputation assessments are not definitive findings, but they are sufficient to avoid directing users to a login or credential-entry page until the operator's identity and site integrity are verified. The separate javjunkies.com domain appears parked and is not treated as an official mirror.

Decision: remove the clickable destination and retain only a historical name-only record. Do not submit credentials, reuse cookies, or automate requests. Do not replace .org with .com.

#### LoveTorrent

The catalog points to lovetorrent.net. The research fetcher could not retrieve the canonical homepage, and searches did not establish a current operator-controlled service, canonical Terms, public API/RSS, or stable search contract. Similar torrent site names and third-party proxy lists are not sufficient to identify a legitimate replacement domain.

Decision: keep LoveTorrent as a name-only unverified candidate. Do not guess mirrors or implement automated access.

#### MagnetDL

MagnetDL.com announced that it had closed in May 2019; TorrentFreak subsequently reported that the operator briefly reversed the shutdown and brought the site back. Current third-party status monitoring reports the .com domain offline, and the research fetcher cannot retrieve it. Search results surface magnetdl.io and magnetdl.co, but no first-party operator announcement verifies either as an official successor. A mirror's use of the MagnetDL name does not establish common ownership or policy.

Decision: remove the clickable .com destination and retain only a historical name-only record. Do not switch to .io, .co, or other mirror domains absent a first-party announcement.

### Batch outcome

- 4 Atlas-listed torrent candidates received source-specific decisions.
- JavJunkies was removed from clickable destinations due unresolved identity/security signals.
- MagnetDL's old .com destination was removed; no unofficial mirror was substituted.
- JAVBEE and LoveTorrent remain unverified; no scraping or API integration was added.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review MyJavBay, NextJAV, OneJAV, and Project JAV.


## Individual source audit — twenty-second batch (2026-11-25)

This batch reviewed four Atlas-listed torrent candidates: My JAV Bay, NextJAV, OneJAV, and Project JAV. The review distinguishes public UI/RSS discovery from a supported and authorized integration contract.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| My JAV Bay | Public VR catalog and search UI are visible; no canonical Terms, official API/RSS, or metadata-reuse permission was verified | **External homepage only** | No Worker scraping or metadata extraction |
| NextJAV | nextjav.com DNS records point to ParkLogic nameservers/parking infrastructure; no active operator-controlled site or policy was verified | **Parked / no current service verified** | Remove destination; keep historical name-only record |
| OneJAV | Third-party RSSHub documentation identifies /feeds/ as an official feed but says it does not support BT-download subscriptions; feed request returned HTTP 403; community BT route is a scraper | **Feed lead only; content and policy unverified** | External-only; no RSS/API integration or community scraper reuse |
| Project JAV | Public search/filter UI, metadata, and magnet links are visible; footer has DMCA/contact and a no-hosted-video disclaimer but no Terms/API/automation policy | **Public interface visible; automation permission unresolved** | External-only; no Worker scraping, metadata extraction, or magnet harvesting |

### Source-specific findings

#### My JAV Bay

The canonical myjavbay.com homepage is publicly visible and identifies the service as a VR JAV collection. It exposes search inputs and recent posts with identifiers, dates, cast metadata, and file-size information. However, the reviewed page does not expose a canonical Terms of Service or an official public API/RSS contract, and the site's robots.txt could not be retrieved. A third-party commercial scraping service advertises paid JSON extraction for myjavbay.com; that is neither an official My JAV Bay API nor authorization from the site operator, and it is not adopted as a dependency.

Decision: retain only the user-initiated homepage link. Do not implement Worker HTML parsing, metadata extraction, or use third-party paid scraping services pending operator policy and a supported interface.

#### NextJAV

The catalog points to nextjav.com. Current third-party DNS records show ParkLogic nameservers and a parking-oriented DNS configuration rather than an identifiable active operator-controlled site. The research fetcher could not retrieve the homepage, and no canonical current Terms, public API/RSS, or stable search contract was verified.

Decision: remove the clickable destination and keep only a historical name-only record. Do not follow unrelated parking redirects or guess a replacement domain.

#### OneJAV

The canonical onejav.com homepage returned HTTP 403 to the research fetcher. RSSHub's third-party route documentation points to https://onejav.com/feeds/ as the site's official feed page and explicitly states that the official feed does not support BT-download subscriptions. The same documentation offers a separate community-maintained `/onejav/:type/:key?` route that parses OneJAV pages and provides BT-related results. That route is a third-party scraper, not an official API, and its existence does not authorize AIOResourceSearch to collect or republish the site's metadata. The direct feed page could not be inspected and no canonical automation policy was verified.

Decision: keep user-initiated external access only. Do not implement the RSSHub scraping route or consume the unverified feed until the exact feed contents and current terms are reviewed.

#### Project JAV

The canonical projectjav.com homepage is currently reachable and exposes a search/filter UI for titles, codes, actresses, makers, and tags. Public listings include metadata and magnet links, and the footer shows a DMCA/contact link plus a disclaimer that the site does not host videos and that links are uploaded/shared by others. The footer does not expose a Terms of Service, privacy policy, public API documentation, or automation permission. A no-hosted-video disclaimer does not grant permission to scrape, extract, or redistribute the site's metadata or magnets. Third-party WHOIS snapshots disagree about expiry/renewal dates, but the current site response and latest update timestamp establish that the page is presently reachable; the stale domain-expiry snapshot is not treated as proof of shutdown.

Decision: retain user-initiated external access only. Do not implement Worker scraping, magnet extraction, or metadata redistribution until the operator publishes applicable terms and a supported interface or grants written permission.

### Batch outcome

- 4 Atlas-listed torrent candidates received source-specific decisions.
- My JAV Bay and Project JAV have visible public search UIs but no verified automation permission.
- OneJAV's public feed remains a lead only; community scraper code was not adopted.
- NextJAV's current DNS indicates parking; no replacement domain was guessed.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review TorrentKitty and XXXClub, then reconcile the remaining Atlas torrent entries against the original Atlas seed list and current catalog.


## Individual source audit — twenty-third batch (2026-11-25)

This batch reviewed the final two Atlas torrent-directory candidates: TorrentKitty and XXXClub.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| TorrentKitty | TorrentKitty-branded .net page lists .tv/.cam/.ink as permanent domains but describes a torrent-file-to-magnet conversion service; a separate .app Terms page was not confirmed to govern .tv | **External destination only; policy/search contract unresolved** | No Worker search scraping or magnet harvesting |
| XXXClub | Domain is registered; third-party indexer logs show a public /torrents/search route, but canonical homepage returns HTTP 403 and no first-party Terms/API/automation permission was verified | **Public indexer evidence; policy unresolved** | External-only; no scraping, undocumented endpoint use, or challenge bypass |

### Source-specific findings

#### TorrentKitty

The catalog points to https://www.torrentkitty.tv. A TorrentKitty-branded site at torrentkitty.net describes a torrent-file-to-magnet conversion service and lists torrentkitty.tv, torrentkitty.cam, and torrentkitty.ink as permanent domains. This supports the relationship between the brand and the .tv destination, but the .net page does not provide a documented public search API. A Terms/Copyright page found at tw.torrentkitty.app describes a search index that gathers information from public websites and has a DMCA metadata-removal process, but it is hosted on a different domain; this review did not establish that it is the canonical policy governing torrentkitty.tv. Third-party client code shows historical search routes, but client code is not operator authorization.

Decision: retain the existing .tv destination for user-initiated external access only. Do not implement Worker search scraping or magnet harvesting until the exact .tv policy and supported search contract are verified. Do not switch to .cam or .ink without first-party confirmation of current domain status.

#### XXXClub

The catalog points to xxxclub.to. Current WHOIS records show the domain registered through 2027. The research fetcher receives HTTP 403 from the canonical homepage. Third-party indexer issue logs from March 2026 show a public `/torrents/search` route returning HTTP 200 to that indexer's client, and an earlier Jackett request describes it as a public tracker. Those are technical observations from third-party clients, not first-party API documentation or permission to collect and republish metadata. A third-party reputation service flags the site as suspicious; this is not a definitive malware verdict but supports caution. No canonical Terms, public API policy, or automation permission was verified.

Decision: retain user-initiated external access only. Do not use the undocumented route, implement Worker scraping, or attempt cookie/proxy/challenge workarounds. Revisit only after first-party Terms and an authorized public interface are available.

### Batch outcome

- 2 final Atlas torrent candidates received source-specific decisions.
- TorrentKitty's cross-domain Terms were not misrepresented as definitely applying to torrentkitty.tv.
- XXXClub's third-party indexer route was recorded as technical evidence only, not authorization.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.


## Atlas source inventory — final reconciliation (2026-11-25)

This section closes the reconciliation item left after the twenty-third individual audit batch. It compares the current Atlas default seed file with the AIOResourceSearch catalog and the completed source-specific review batches. The seed file itself says it is not automatically executed on deployment and may differ from Atlas production configuration.

### Scope and count

The current Atlas `database/seeds/003_search_sources.sql` contains 119 rows:

| Atlas seed category | Rows | Included in the original AIOResourceSearch candidate import |
|---|---:|---|
| JAV database | 4 | Yes |
| JAV streaming | 21 | Yes |
| JAV torrent | 15 | Yes |
| JAV community | 16 | Yes |
| Anime database / torrent / streaming / manga | 23 | No — separate multi-category discovery scope |
| Movie database / torrent / streaming | 19 | No — separate multi-category discovery scope |
| Manga database / resources | 13 | No — separate multi-category discovery scope |
| Novel database | 8 | No — separate multi-category discovery scope |
| **Total** | **119** | **56 included seed rows** |

The original AIOResourceSearch Atlas import deliberately included the 56 JAV, torrent, and community seed rows. All 56 are represented in the current candidate catalog:

- 54 rows have an exact ID match.
- The remaining two are naming/ID migrations, not missing sources:
  - Atlas `jable` → catalog `jabletv` (JableTV; same canonical `jable.tv` source).
  - Atlas `javguru` → catalog `jav-guru` (JAV.guru; same canonical `jav.guru` source).
- Atlas README also identifies DMM/FANZA as a metadata source; it is represented by the additional `dmm-fanza` candidate.
- Therefore the current catalog has 57 Atlas-tagged candidates: 56 relevant seed entries plus the DMM/FANZA README candidate.

The 63 Atlas seed rows outside the original import scope have not been silently discarded as “audited” or “integrated.” They remain a separate discovery backlog for anime, film/TV, manga, and novel categories. They require their own policy, API, attribution, and rate-limit review before registration or implementation.

### Current catalog reconciliation

- Current candidate catalog: 91 unique records.
- Reference-project candidate records: 88 unique records across Atlas, FetchJAV, and Lustpress.
- AIOResourceSearch-origin candidates: 3 (Torlock, Bitsearch, YourBittorrent).
- Project tags overlap on five shared records; project-tag totals therefore exceed unique candidate count.
- Current `sourceCatalog.ts` contains three search URL templates: JAV.guru, r/JAV, and YourBittorrent. These are external-search/backup entry points; they are not three additional Worker Providers.
- The four implemented site-specific Providers remain Sukebei RSS, Perverzija DB, Torlock Torznab, and YourBittorrent JSON. The reusable `generic-html` adapter is a framework, not a fifth site-specific Provider.

### Review completion versus integration status

The 56 imported Atlas seed candidates have source-specific decisions recorded across the first through twelfth individual audit batches and the DMM/FANZA API eligibility review. “Reviewed” means the canonical identity, available interface evidence, and relevant policy constraints were assessed. It does not mean every source is approved for automation, reachable from Cloudflare Workers, enabled in KV, or implemented as a Provider.

The remaining 63 Atlas rows outside the original import scope are not part of the 57-candidate Atlas review count. They are the next Atlas-derived discovery scope if/when those additional content categories are pursued.

No Provider implementation, source enablement, production KV mutation, or Cloudflare deployment was performed by this reconciliation.


## Individual source audit — twenty-fourth batch (2026-11-25)

This batch begins the separate Atlas multi-category backlog and reviews the eight anime-database candidates. It distinguishes a documented API from permission to use it in this product.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Bangumi | Official developer documentation identifies the maintained public `/v0/` API and distinguishes it from the unmaintained legacy API | **Conditional API candidate** | Public subject metadata only; use `/v0/`, meaningful User-Agent, conservative request pacing; no private website API or auth-gated data |
| MyAnimeList (MAL) | MAL has a public API v2 ecosystem, but the current official API developer agreement and the exact permitted third-party aggregation scope were not independently verified in this pass | **Policy / agreement verification required** | No scraping or Provider implementation; do not treat community API clients as authorization |
| AniList | Official API terms prohibit hoarding/mass collection and use in competing, non-complementary services; this project's aggregator fit remains unresolved | **Deferred pending written clarification** | No Provider implementation |
| Douban Anime | Official 2025-05-27 User Agreement was reviewed; no current public third-party API permission for this product was verified | **External-only** | No Worker HTML scraping, cookie use, or unofficial API |
| Kitsu | Search results for “Kitsu API” resolve to CGWire's production-management API, not the anime database at kitsu.io; no matching official anime metadata API/policy was verified | **Unverified** | No API substitution; external-only |
| LiveChart.me | The canonical site could not be inspected by the research fetcher and no official public API or automation policy was verified | **Unverified** | No Worker requests or scraping |
| AniDB | Official policy directs automated clients to its supported API rather than website scraping; the official API documentation endpoint returned 403 to this research fetcher | **API-only candidate; implementation deferred** | No website scraping; verify current API client registration and rate rules before implementation |
| Notify.moe | Official site exposes a public REST API at `https://notify.moe/api`; its schema includes public anime entities but also user, activity, notification, and payment-related types | **Narrow API candidate; policy review required** | Do not call user/activity/payment endpoints; no Provider until permitted public metadata scope and request limits are confirmed |

### Source-specific findings

#### Bangumi

The official developer documentation distinguishes the maintained public API under `/v0/` from the legacy unversioned API, which is no longer maintained. The current decision from the earlier cross-category review remains unchanged: consider only public subject metadata, use a meaningful non-browser User-Agent, respect response limits and 429 responses, and do not use private website APIs or attempt to access NSFW data that requires authorization. Search endpoints marked experimental must not become critical dependencies.

References:
- https://github.com/bangumi/dev-docs
- https://bangumi.github.io/api/

#### MyAnimeList

The catalog's `myanimelist.net` entry is a metadata candidate, not permission to collect or republish MAL data. This pass did not retrieve the current first-party API developer agreement or confirm whether a third-party multi-source search aggregator may use the API under that agreement. Third-party API directories and unofficial client libraries are not substitutes for the current official agreement.

Decision: keep external-only for now. Revisit only after the current first-party API terms, client registration requirements, application-notification obligations, and permitted data display/redistribution scope are verified.

#### AniList

The official API terms prohibit use as a backup/data-storage service, hoarding or mass collection, and use within competing non-complementary services of the same nature. AIOResourceSearch is a multi-source search aggregator, so it is not safe to assume that public GraphQL access alone authorizes integration. The previously recorded decision to seek written clarification remains in force.

References:
- https://docs.anilist.co/guide/terms-of-use
- https://docs.anilist.co/guide/rate-limiting

#### Douban Anime

The current official Douban User Agreement was published on 2025-05-27. It describes platform services and reserves the right to impose usage limits and terminate access for improper or program-like behavior. This review did not establish an official public anime metadata API or an authorization for third-party automated aggregation.

Decision: keep user-initiated external access only. Do not use unofficial API wrappers, session cookies, or Worker HTML scraping.

Reference:
- https://www.douban.com/about/agreement

#### Kitsu

The Atlas seed points to `kitsu.io`. Search results for a current “Kitsu API” documentation site resolved to CGWire's Kitsu production-management system, whose API requires JWT authentication and is unrelated to the Kitsu anime database. This is a name collision, not evidence of an anime metadata API.

Decision: do not substitute the CGWire API or claim it serves kitsu.io. Keep the Atlas entry unverified and external-only until the correct operator-controlled API and policy are found.

#### LiveChart.me

The canonical site could not be retrieved by the research fetcher (robots restriction), and no first-party API specification or automation permission was established. A blocked research fetch is not evidence that ordinary users cannot access the site, nor is it permission to automate access.

Decision: keep external-only; no Worker fetching or scraping.

#### AniDB

AniDB's policy identifies its supported API as the channel for bots, scripts, and other automated methods, rather than scraping the website. The official API documentation and policy endpoints returned 403 to this research fetcher, so the complete current API contract and numeric request limits could not be independently checked here. Third-party client documentation commonly describes a two-second request interval, but that figure is not treated as an independently verified first-party rule in this audit.

Decision: API-only candidate. Before implementation, verify the current official HTTP API definition, client-name/version registration, rate limit, caching requirement, and permitted metadata fields. No website scraping or unofficial scraper reuse.

References:
- https://anidb.net/policy
- https://wiki.anidb.net/HTTP_API_Definition

#### Notify.moe

The official API page lists a REST endpoint at `https://notify.moe/api` and documents an `Anime` entity, but the same schema also exposes user accounts, activity, notifications, and payment-related types. The official support page says site data is accessible through a public API, but this alone does not establish unlimited collection or permission to ingest user-related data.

Decision: consider only public anime metadata if the operator's API policy, attribution expectations, and request limits are confirmed. Explicitly exclude user profiles, anime lists, activity feeds, notifications, payment, and other personal/account data. No Provider is implemented.

References:
- https://media.notify.moe/api
- https://media.notify.moe/support

### Batch outcome

- 8 Atlas anime-database candidates received individual decisions.
- Bangumi remains a conditional public API candidate under the previously documented constraints.
- AniList remains deferred pending written clarification.
- AniDB and Notify.moe are narrow API leads, not approved Providers.
- MAL, Douban, Kitsu, and LiveChart remain external-only or unverified.
- No new source, Provider, KV configuration, source enablement, or Cloudflare deployment was added.
- Next batch: review Atlas anime torrent candidates Nyaa.si, Mikan Project, DMHY, AnimeBytes, Sukebei Nyaa, and Shana Project.


## Individual source audit — twenty-fifth batch (2026-11-25)

This batch reviews the six Atlas anime-torrent candidates: Nyaa.si, Mikan Project, DMHY, AnimeBytes, Sukebei Nyaa, and Shana Project. A public RSS feed is distinguished from a user-specific/private feed, and from permission to build a third-party aggregation service.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Nyaa.si | RSS-style `?page=rss` and Torznab routes are described by Nyaa-compatible documentation, but the canonical nyaa.si help/rules pages could not be independently retrieved in this pass | **Technical lead; policy verification pending** | No new Provider until canonical policy and endpoint are verified; do not scrape HTML |
| Mikan Project | Public site is active; documented RSS examples are account-specific `MyBangumi?token=...` feeds | **User-specific RSS only** | Do not request or store user tokens; no shared Worker Provider |
| DMHY | Official FAQ explicitly documents public RSS and keyword/category/team/uploader filters | **Conditional public RSS candidate** | RSS-only candidate; confirm current terms, HTTPS behavior, response limits, and content policy before implementation |
| AnimeBytes | Official status page indicates a private tracker service; no public API or public RSS contract was verified | **Private-tracker / external-only** | No login, invite, cookie, or authenticated Worker access |
| Sukebei Nyaa | Already represented by the existing Sukebei RSS Provider; its rules warn that mirrored entries can include content removed upstream or violating rules/law | **Existing Provider only; not an Anime source** | Do not add a duplicate provider or classify adult Sukebei results as Anime; keep source disabled pending operator content/legal review |
| Shana Project | Official help documents a public RSS feed of the latest 50 releases, alongside user-specific public-follow and private secure feeds | **Conditional public RSS candidate** | Only the site-wide public feed may be considered; never use or store private per-user feed tokens |

### Source-specific findings

#### Nyaa.si

The Atlas seed points to `nyaa.si`. Nyaa-compatible help material describes a live RSS endpoint using `?page=rss` and legacy feed/Torznab routes, but the canonical `nyaa.si/help`, `/rules`, and feed endpoints could not be independently retrieved by the research fetcher in this pass. Documentation hosted on another Nyaa-related domain is not treated as conclusive proof of the exact current nyaa.si policy.

Decision: retain as an external candidate only. Before integration, verify the canonical Nyaa help/rules, RSS response, supported query/category filters, and content policy. Do not use undocumented HTML scraping or mirrors.

#### Mikan Project

The canonical site is active and exposes anime listings. The RSS subscription examples found in public documentation use a per-user `MyBangumi?token=...` URL; the token represents the user's personal subscription. This is not a general anonymous search API and should not be collected into a shared Worker configuration.

Decision: external-only. Do not ask users to submit private RSS tokens, store them in KV, or run a shared Provider against user-specific subscriptions.

References:
- https://mikanani.me/
- https://www.autobangumi.org/en/config/rss.html

#### DMHY

The official DMHY FAQ documents RSS subscriptions at `/topics/rss/rss.xml`, including keyword, team, category, and uploader filters. This is a first-party public feed contract and is materially stronger than an undocumented HTML search route. The FAQ also describes posting restrictions, including a prohibition on real-person adult content in its publishing rules.

The current FAQ uses an HTTP example URL; the HTTPS endpoint and response behavior must be confirmed before a Worker integration. The exact current service terms and any restrictions on third-party aggregation still need review.

Decision: conditional RSS candidate only. If later implemented, use the documented feed, enforce anime-category scope, avoid adult-content categories, honor removal/rules, and do not scrape HTML.

Reference:
- https://www.dmhy.org/cms/page/name/faq.html

#### AnimeBytes

The official status page reports the site and tracker service status, but this review did not verify an anonymous public API or RSS search contract. AnimeBytes is a private tracker; account/invite access must not be converted into a shared backend integration.

Decision: external-only. No account registration, invite acquisition, cookie handling, or authenticated Worker requests.

Reference:
- https://status.animebytes.tv/

#### Sukebei Nyaa

This is already represented by the existing `sukebei-rss` Provider and is not a new source integration. The current Sukebei rules explicitly warn that the site mirrors entries from upstream Nyaa/Sukebei sources shortly after publication, sometimes before moderation, and that mirrored entries may later be removed or violate origin rules or applicable law.

Although the Atlas seed groups this entry under anime torrent, the Sukebei service is an adult-oriented index. Its results must not be presented as Anime merely because of the Atlas seed category. Keep it in the adult/JAV content scope and retain the existing disabled-by-default/content-review guard.

References:
- https://sukebei.nyaa.net/rss
- https://sukebei.nyaa.net/rules

#### Shana Project

The official help documents a site-wide public RSS feed containing the latest 50 releases. It separately documents a public feed associated with a user's follows and a secure private feed that is intended only for that user and their torrent client; the private feed can mark downloads as consumed.

Decision: only the site-wide public RSS is a possible integration candidate, subject to current terms and response verification. Do not use the private secure feed or user-specific follow feeds in a shared Provider.

References:
- https://www.shanaproject.com/help/feeds/
- https://www.shanaproject.com/help/client/
- https://www.shanaproject.com/help/follows/

### Batch outcome

- 6 Atlas anime-torrent candidates received individual decisions.
- DMHY and Shana Project have documented public RSS interfaces worth further policy/technical validation.
- Mikan Project's tokenized personal RSS is not suitable for a shared search Provider.
- Nyaa.si remains pending canonical policy/endpoint verification.
- AnimeBytes remains external-only as a private tracker.
- Sukebei is an existing adult-content Provider, not an anime source; no duplicate was added.
- No Provider implementation, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review the remaining Atlas anime entries, starting with Bilibili, DiliDili, Crunchyroll, Funimation, HIDIVE, AniWatch, GogoAnime, and 9Anime.


## Individual source audit — twenty-sixth batch (2026-11-25)

This batch reviews the remaining eight Atlas anime-streaming candidates: Bilibili, DiliDili, Crunchyroll, Funimation, HIDIVE, AniWatch, GogoAnime, and 9Anime. It does not treat a website's public search UI as an authorized API, and it does not substitute similarly named domains.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Bilibili | Official Open Platform requires developer onboarding; its developer agreement prohibits automated acquisition of platform/Open Platform data without written consent | **Permission-gated; not approved** | No general-purpose scraping or metadata Provider; use only specifically authorized APIs and approved scope |
| DiliDili | Atlas domain `dilidili.wang` is not confirmed as canonical; a historical operator announcement said the old domain was retired and named `dilidili.name` as replacement at that time | **Domain identity unresolved** | Remove/avoid .wang destination; do not silently switch to .name without current first-party confirmation |
| Crunchyroll | Official Terms prohibit automated data gathering/extraction and prohibit indexing a significant portion of service content without express written authorization; no public developer API was verified | **Automation prohibited absent written permission** | No Worker scraping, catalog harvesting, or unofficial API |
| Funimation | Crunchyroll confirms Funimation's website and app ended on 2024-04-02 and most catalog content migrated to Crunchyroll | **Retired service** | Remove as a separate active source; do not keep the old endpoint or create a duplicate Provider |
| HIDIVE | Current official site/help center exists, but no public developer API or third-party metadata permission was verified | **External-only** | No scraping, account, or subscription access |
| AniWatch | Atlas domain `aniwatch.to` could not be tied to a verified current operator policy/API; similarly named `aniswatch.com` is a different domain | **Unverified** | No mirror substitution, Worker scraping, or API integration |
| GogoAnime | Atlas domain `gogoanime3.net` was not verified as the canonical operator domain; search results for `gogoanimes.org` are a different host | **Unverified** | No mirror substitution or scraping |
| 9Anime | Atlas domain `9anime.gs` was not verified as an official current service; third-party reports describe the 9anime→AniWave rebrand and AniWave shutdown in 2024 | **Historical / current identity unverified** | Remove active destination; retain historical name only; do not link to unofficial clones |

### Source-specific findings

#### Bilibili

The official Open Platform documentation describes an application/developer onboarding process and API permissions primarily for account authorization, creator/video management, and authorized user/creator data. The developer service agreement requires registration and review; it also prohibits automated programs, scripts, spiders, or crawlers from obtaining Open Platform data, user data, or related resources without Bilibili's written consent. The general Terms separately prohibit automated access except through an expressly authorized interface/API with prior written permission or as otherwise permitted by law.

Decision: the existence of Bilibili APIs does not authorize a general anime metadata search adapter. Do not scrape search pages or use undocumented web APIs. Revisit only with an approved application and written permission for the exact public metadata use case.

References:
- https://open.bilibili.com/doc
- https://open.bilibili.com/agreement/developer-service
- https://www.bilibili.com/blackboard/era/termsofservice.html

#### DiliDili

The Atlas seed points to `dilidili.wang`. A 2019 announcement attributed to DiliDili said the service had changed domains to `www.dilidili.name` and that the old domain had stopped being used. This is historical evidence only; it does not establish that .name remains the current canonical domain in 2026, nor that .wang is an authorized mirror.

Decision: do not treat .wang as verified. Do not silently replace it with .name based solely on a 2019 notice. Keep name-only until a current first-party operator announcement confirms the canonical domain and applicable access policy.

Reference:
- https://www.sohu.com/a/297856536_100193569

#### Crunchyroll

The official Terms prohibit automated robots, spiders, scrapers, and other automated data-gathering or extraction tools from accessing or collecting service content. They also prohibit creating or distributing an index of a significant portion of service content without express written authorization. The current public developer/API directory review did not identify an official public metadata API.

Decision: external link only. Do not scrape, use unofficial reverse-engineered endpoints, collect the catalog, or attempt to work around regional restrictions.

References:
- https://www.crunchyroll.com/en/terms/privacy
- https://www.crunchyroll.com/de/tos

#### Funimation

Crunchyroll's official support article confirms that the Funimation website and app ended on 2024-04-02 and that most of the catalog migrated to Crunchyroll. The legacy Atlas seed URL is therefore not a current independent service.

Decision: treat Funimation as retired. Do not keep it as a separately active source or assume every title is available on Crunchyroll. Any future discovery should use the Crunchyroll source and its own access restrictions.

Reference:
- https://help.crunchyroll.com/hc/en-us/articles/22843839604500-Funimation-End-of-Services

#### HIDIVE

The official HIDIVE website and support center are reachable through search results, but this review did not find a public developer API or an authorization for third-party metadata aggregation. The presence of search pages or support documentation does not establish a public data interface.

Decision: keep external-only. Do not automate catalog searches, use subscription credentials, or attempt to access internal/unauthorized endpoints.

References:
- https://www.hidive.com/
- https://support.hidive.com/

#### AniWatch

The Atlas seed points to `aniwatch.to`. Search results for `aniswatch.com` describe a separate editorial site and are not evidence about `aniwatch.to`. No current first-party Terms, API specification, or authorized automation interface for the exact Atlas domain was verified.

Decision: retain no automated integration and do not substitute a similarly named domain or mirror. Keep unverified pending first-party identity and policy evidence.

#### GogoAnime

The Atlas seed points to `gogoanime3.net`. Search results for `gogoanimes.org` describe a GogoAnime-branded streaming catalog, but the domains are not identical and no first-party announcement establishing their relationship was found. A public search UI does not authorize automated extraction.

Decision: keep the Atlas domain unverified. Do not use .org or any other mirror as a replacement, and do not scrape the site.

Reference:
- https://gogoanimes.org/about/

#### 9Anime

The Atlas seed points to `9anime.gs`. Current third-party reporting describes the original 9anime brand rebranding to AniWave in August 2023 and AniWave's shutdown on 2024-08-27. This does not prove that every domain using the 9anime name is fraudulent, but it does mean the current .gs endpoint cannot be presumed to be the original operator's official service.

Decision: remove the active destination and keep a historical name-only record. Do not link to or integrate an unverified clone or mirror.

Reference:
- https://www.itechguides.com/9anime-down-not-working-or-showing-invalid-request-heres-what-happened/

### Batch outcome

- 8 Atlas anime-streaming candidates received individual decisions.
- Bilibili is permission-gated despite having an official developer platform.
- Crunchyroll automation is prohibited absent express written authorization.
- Funimation is retired and should not be treated as an independent active source.
- DiliDili, AniWatch, GogoAnime, and 9Anime require canonical identity caution; no mirror was substituted.
- HIDIVE remains external-only.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review Atlas anime/manga crossover and movie metadata candidates, beginning with Bilibili Comic and the TMDB/Douban/IMDb/Trakt/Letterboxd/Rotten Tomatoes/Metacritic entries.


## Individual source audit — twenty-seventh batch (2026-11-25)

This batch reviews the eight Atlas movie/TV metadata entries: TMDB, Douban Movie, IMDb, Trakt, Letterboxd, Rotten Tomatoes, Metacritic, and the duplicate “TMDB Chinese Forum” entry.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| TMDB | Official API legal notice prohibits using its data/images in connection with pornographic or offensive content; AIOResourceSearch includes adult-resource search in the same product | **Do not integrate in current product context** | No API key, metadata, images, or Provider; reconsider only with explicit written permission covering the entire product |
| Douban Movie | Same current Douban User Agreement as Douban Anime; no official public third-party movie metadata API permission verified | **External-only** | No scraping, cookies, or unofficial API |
| IMDb | Official policy permits only limited non-commercial use of provided datasets, forbids site scraping, and prohibits repurposing data to create an online/offline movie database | **Not suitable for this aggregator** | No scraping or dataset ingestion |
| Trakt | Official API policy allows public discovery in general but explicitly prohibits using Trakt data in applications that promote copyright infringement or piracy | **Not suitable for current product context** | No API registration or Provider |
| Letterboxd | Official API exists but access is request-only; current access page says it is not granting access for data-analysis, visualization, recommendation, or private/personal projects | **Access not available / application required** | No API use until Letterboxd explicitly grants access for this exact product |
| Rotten Tomatoes | Official Terms prohibit data mining, automated collection, and systematic retrieval to build a collection/database without written consent | **Automation prohibited absent written consent** | No scraping or metadata aggregation |
| Metacritic | No official public developer API or third-party aggregation permission was verified | **External-only** | No scraping or unofficial API |
| TMDB Chinese Forum | The seed points to the same `themoviedb.org` host as TMDB and no separate operator/API identity was established | **Duplicate catalog entry** | Do not create a separate source or Provider |

### Source-specific findings

#### TMDB

The official TMDB API FAQ/legal notice states that API data and images may not be used in connection with libelous, defamatory, obscene, pornographic, abusive, or otherwise offensive content. AIOResourceSearch is one product that includes adult-resource discovery; separating calls into a Film/TV category does not establish that TMDB's restriction no longer applies to the product context.

Decision: do not integrate TMDB in the current product. Do not put a TMDB API key in Worker Secrets or consume its metadata/images unless TMDB provides explicit written permission or a license that covers the complete product context.

Reference:
- https://developer.themoviedb.org/docs/faq

#### Douban Movie

The official Douban User Agreement published on 2025-05-27 applies across Douban's service surfaces, including film. This review did not find an official public third-party movie metadata API or permission for this product to automate collection.

Decision: external-only. Do not scrape movie pages, reuse session cookies, or adopt unofficial API wrappers.

Reference:
- https://www.douban.com/about/agreement

#### IMDb

IMDb's official Help and Conditions pages state that limited non-commercial use is restricted to the datasets IMDb makes available. The data cannot be obtained by scraping the website, and the permitted dataset use cannot be repurposed to create an online/offline database of movie information. The datasets also require source acknowledgment and are subject to their accompanying terms.

Decision: not suitable for AIOResourceSearch's multi-source online catalog. Do not ingest the datasets or scrape IMDb pages. Individual users may independently use IMDb's consumer website.

References:
- https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX
- https://www.imdb.com/conditions/
- https://www.imdb.com/interfaces/

#### Trakt

Trakt's current official API Use Policy permits public discovery features in ordinary apps, including search results and title/person details, but explicitly prohibits using Trakt data in applications or websites that promote copyright infringement or piracy. Because AIOResourceSearch aggregates torrent and adult-resource sources in the same product, it cannot safely claim that the Trakt integration would be isolated from that product context.

Decision: do not register a Trakt API app or implement a Provider for the current product. Reconsider only if Trakt gives written approval for this exact integrated product context.

References:
- https://developer.trakt.tv/docs/api-use-policy
- https://developer.trakt.tv/docs/rate-limiting

#### Letterboxd

Letterboxd has an official API with OAuth2 and public-data client-credentials support, but its API access page states that access is by request only. The same page says it is not currently granting access for data-analysis, visualization, recommendation, LLM/GPT, private/personal projects, or recreations of paid-tier features. It recommends TMDB for general film/TV metadata.

Decision: no API access should be assumed. Do not use undocumented endpoints or scrape Letterboxd pages. Revisit only if Letterboxd grants access in writing for AIOResourceSearch's actual use case.

References:
- https://api-docs.letterboxd.com/
- https://letterboxd.com/api-beta/access/

#### Rotten Tomatoes

The official Terms of Use (last updated 2026-01-06) limit site use to personal, non-commercial purposes and prohibit data mining, automated collection, and systematic retrieval to create a collection, compilation, database, or directory without prior written consent.

Decision: no Worker scraping or metadata aggregation. Keep only a user-opened homepage link if the catalog later retains the entry.

Reference:
- https://www.rottentomatoes.com/policies/terms-of-use

#### Metacritic

This pass did not verify a current official public developer API, data license, or third-party aggregation permission. Search-engine snippets, third-party scraping libraries, or the fact that pages are publicly visible do not establish a supported interface or permission.

Decision: external-only. Do not scrape, use unofficial API wrappers, or republish ratings/reviews.

#### TMDB Chinese Forum

The Atlas seed labels this row “TMDB Chinese Forum” but points to `themoviedb.org`, the same canonical host as TMDB. No separate operator-controlled forum service or API was verified.

Decision: treat as a duplicate/alias of the TMDB entry, not an independent source. Do not add a second Provider or source configuration.

### Batch outcome

- 8 Atlas movie/TV metadata entries received individual decisions.
- TMDB and Trakt are unsuitable for the current integrated product context under their published policies.
- Letterboxd requires an application and currently excludes several adjacent project types from API access.
- IMDb's non-commercial datasets are not a license for a third-party online movie catalog.
- Douban, Rotten Tomatoes, and Metacritic remain external-only.
- The “TMDB Chinese Forum” seed is a duplicate of TMDB, not an independent provider.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review Atlas movie streaming and torrent candidates (Netflix, YouTube Movies, JustWatch, Reelgood, PlayPilot, Putlocker, FMovies, SolarMovie, The Pirate Bay, EZTV, and MejorTorrent).


## Individual source audit — twenty-eighth batch (2026-11-25)

This batch reviews the remaining Atlas movie/TV streaming and torrent candidates: Netflix, YouTube Movies, JustWatch, Reelgood, PlayPilot, Putlocker, FMovies, The Pirate Bay, EZTV, and MejorTorrent.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Netflix | No public metadata/search API for third-party catalog aggregation was verified; consumer streaming access is governed by service terms and licensed territory | **External-only** | No scraping, account access, or catalog extraction |
| YouTube Movies | YouTube Data API can search public videos, but developer policies restrict aggregation of API data and prohibit facilitating copyright infringement; YouTube Terms also restrict automated site access | **Not suitable for current product context** | No API or scraping integration |
| JustWatch | Official Content Partner API requires a concluded partner contract, partner token, and branded links/attribution | **Contract-gated; not approved** | No API until a suitable no-cost contract is confirmed and signed |
| Reelgood | Official business API supports real-time title lookups/search but requires issued API keys; commercial terms/pricing for this project were not verified | **Commercial terms unresolved** | No API key or S3 export; no implementation pending free-use confirmation and contract review |
| PlayPilot | No official public developer API or third-party data-use permission was verified | **External-only** | No scraping or unofficial API |
| Putlocker | The historic Putlocker operation was reported as no longer functioning in the U.S. Government's 2017 Notorious Markets report; the Atlas `.name` host was not verified as an official successor | **Historical / successor unverified** | Remove active destination; keep historical name only |
| FMovies | U.S. Government's 2025 Special 301 Report confirms Vietnamese authorities shut down FMovies and associated piracy sites in 2024 | **Retired operation** | Remove active destination; do not substitute current lookalike domains |
| The Pirate Bay | No current first-party API/RSS contract or automated metadata-use permission was verified in this pass | **External-only** | No Worker scraping or undocumented endpoint use |
| EZTV | No current first-party API/RSS contract or automated metadata-use permission was verified for the Atlas `eztv.re` domain | **External-only / policy unresolved** | No Worker scraping or undocumented endpoint use |
| MejorTorrent | Atlas `mejortorrent.com` is reported by current third-party research as an old domain that redirects/advertises changing numbered domains; no first-party canonical successor/policy was verified | **Unverified / unstable domain** | Remove old destination; do not follow third-party mirror lists or Cloudflare challenge flows |

### Source-specific findings

#### Netflix

The Atlas seed includes Netflix as a movie/TV streaming destination. This pass did not identify a public third-party title-search or catalog API intended for arbitrary aggregator use. A consumer streaming service and its subscription access do not imply permission to collect the service catalog or automate account access.

Decision: external link only. Do not scrape the catalog, use account cookies, or attempt to access internal APIs.

#### YouTube Movies

The official YouTube Data API supports public video search and can filter search results using `videoType=movie`. However, the YouTube API Developer Policies prohibit aggregating API Data except for narrowly defined same-content-owner cases, and prohibit using API services to facilitate or promote copyright infringement. The YouTube Terms also restrict automated access to the service except for public search engines following robots.txt, prior written permission, or applicable law.

Because AIOResourceSearch aggregates torrent sources in the same product, it cannot assume that a YouTube metadata integration would be isolated from the prohibited product use. The API's ability to search videos is not sufficient permission for this integration.

Decision: no YouTube Data API Provider and no website scraping.

References:
- https://developers.google.com/youtube/data/reference/rest/v3/search/list
- https://developers.google.com/youtube/terms/developer-policies
- https://www.youtube.com/t/terms

#### JustWatch

JustWatch documents a Content Partner API for VOD availability. The documentation states that a partner token is issued after a contract is concluded, and requires branded JustWatch links next to each integration/widget and on relevant pages. This is not an unrestricted public API. No free/no-cost contract for AIOResourceSearch has been established.

Decision: do not integrate or assume a free API. Revisit only if JustWatch confirms a suitable no-cost agreement and the UI can satisfy all required attribution and linking obligations.

References:
- https://apis.justwatch.com/docs/content_partner/
- https://apis.justwatch.com/docs/api/

#### Reelgood

Reelgood for Business documents a real-time consumer-facing API for title lookups/search and streaming availability, with API-key authentication issued per integration and data endpoints/rate-limit tiers. It separately offers S3 exports for historical/bulk data. The public documentation reviewed here does not establish that an appropriate API plan is free or that this product is eligible without a commercial agreement.

Decision: no integration while pricing/contract terms remain unknown. Do not use bulk S3 exports: the current project has no database or bulk-catalog persistence requirement.

References:
- https://data.reelgood.com/api-docs/api-documentation/
- https://data.reelgood.com/technology/

#### PlayPilot

This pass did not verify a first-party public developer API, data license, or third-party metadata aggregation program. A consumer-facing search page does not create an authorized API.

Decision: external-only. No scraping or unofficial endpoint.

#### Putlocker

The U.S. Trade Representative's 2017 Notorious Markets report stated that the previously listed Putlocker operation was no longer functioning, while warning that third-party phishing scams could still use the name. The Atlas seed points to `putlockers.name`, which was not verified as an official operator-controlled successor.

Decision: remove the active destination and retain a historical name-only record. Do not substitute a similarly named mirror.

Reference:
- https://ustr.gov/sites/default/files/files/Press/Reports/2017%20Notorious%20Markets%20List%201.11.18-%20JG%20SPV%20FINAL%20clean.pdf

#### FMovies

The U.S. Government's 2025 Special 301 Report states that Vietnamese authorities worked with U.S. authorities and stakeholders to shut down FMovies and associated piracy sites in 2024. Current domains using the FMovies name cannot be presumed to be the original operator's continuation.

Decision: remove the active Atlas destination. Do not substitute new FMovies-branded domains or mirrors.

Reference:
- https://ustr.gov/sites/default/files/files/Issue_Areas/Enforcement/2025%20Special%20301%20Report%20%28final%29.pdf

#### The Pirate Bay

The Atlas seed points to `thepiratebay.org`. This pass did not verify a current first-party public API/RSS specification, current automation policy, or permission for third-party metadata collection. Third-party indexer integrations and undocumented routes are not treated as operator authorization.

Decision: external-only. Do not implement Worker HTML parsing or undocumented API routes.

#### EZTV

The Atlas seed points to `eztv.re`. This pass did not verify a current first-party public API/RSS contract or applicable automation policy for this exact domain. Search results and third-party client support are not enough to establish permission.

Decision: external-only pending canonical operator documentation. Do not scrape or use undocumented endpoints.

#### MejorTorrent

The Atlas seed points to `mejortorrent.com`. Recent third-party domain research reports that the old domain is no longer the active endpoint and that the service changes numbered domains; it also reports Cloudflare verification on a current numbered host. This is not first-party evidence sufficient to establish a canonical successor, a stable public API, or permission for automated access.

Decision: remove the old .com destination. Do not follow third-party mirror lists, use rotating domains, or attempt Cloudflare challenge workarounds. Revisit only if the operator publishes a stable canonical domain and supported public interface with applicable terms.

### Batch outcome

- 10 Atlas movie/TV streaming and torrent candidates received individual decisions.
- JustWatch and Reelgood have business/partner APIs, but their access terms do not currently meet the project's verified no-cost/no-contract requirements.
- YouTube API access is not suitable for this product context under its data aggregation and anti-infringement policies.
- FMovies and Putlocker are historical/retired operations; no mirrors were substituted.
- Netflix, PlayPilot, The Pirate Bay, and EZTV remain external-only.
- MejorTorrent's rotating-domain model is not adopted.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review Atlas manga metadata/resources and novel sources, starting with MangaDex, AniList Manga, Kitsu Manga, MyAnimeList Manga, MangaUpdates, and the listed manga resource sites.


## Individual source audit — twenty-ninth batch (2026-11-25)

This batch reviews five Atlas manga metadata candidates: MangaDex, AniList Manga, Kitsu Manga, MyAnimeList Manga, and MangaUpdates. Bilibili Comic is covered by the Bilibili policy decision in the twenty-sixth batch because it is the same operator/platform.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| MangaDex | Official public API and Acceptable Usage Policy require MangaDex attribution and prohibit ads/paid services; chapter reading adds scanlation-group credit/removal obligations | **Conditional metadata-only API candidate** | Public title/author/artist/status metadata and MangaDex detail links only; no chapter text/images or reader; add attribution and shared rate limiter |
| AniList Manga | Same official AniList Terms as anime metadata: prohibits mass collection and competing non-complementary services | **Deferred pending written clarification** | No Provider |
| Kitsu Manga | Kitsu site pages are reachable, but the API documentation found under the “Kitsu API” name belongs to CGWire's production-management product, not kitsu.io | **Unverified** | No CGWire API substitution; external-only |
| MyAnimeList Manga | Same MAL API v2 and developer-agreement uncertainty as the anime entry | **Policy / agreement verification required** | No scraping or Provider implementation |
| MangaUpdates | Official API documentation provides public series search/read functions and an Acceptable Use Policy requiring attribution, reasonable request spacing, caching, and no assistance with illegal actions | **Conditional metadata API candidate** | Restrict to public series metadata and MangaUpdates detail links; no release downloads, chapter content, or user/forum endpoints |

### Source-specific findings

#### MangaDex

The official API documentation provides a public Manga API and an Acceptable Usage Policy. It requires MangaDex attribution and prohibits ads or paid services on the integrating website/app. Scanlation-group attribution and honoring group removal requests are required when the integration allows chapter reading. This project does not need to provide chapter reading.

Decision: a metadata-only integration is conditionally suitable while the project remains ad-free and free of paid services. Limit fields to title, authors/artists, publication status, tags/content rating, and the MangaDex detail URL. Do not request chapter text, chapter images, cover-image proxying, or reader data. Add visible MangaDex attribution and implement the previously documented shared global rate limiter before production use.

References:
- https://gitlab.com/mangadex-pub/mangadex-api-docs
- https://api.mangadex.org/

#### AniList Manga

AniList's official Terms expressly include manga list/tracker services in the prohibited competing non-complementary category and prohibit hoarding or mass collection. The existing AIOResourceSearch product is a multi-source resource search platform, so the manga classification does not remove the policy concern.

Decision: keep deferred pending written clarification for the exact integrated product.

Reference:
- https://docs.anilist.co/guide/terms-of-use

#### Kitsu Manga

The Atlas entry points to `kitsu.io`, and the current site exposes manga/anime database pages. However, the “Kitsu API” documentation located during this review is for CGWire's Kitsu production-management platform, whose API is unrelated to kitsu.io. No matching official Kitsu media metadata API contract and acceptable-use policy was verified.

Decision: external-only until the correct API and policy are established. Do not substitute CGWire's API or scrape the Kitsu website.

#### MyAnimeList Manga

The MAL manga entry has the same unresolved API agreement and permitted third-party aggregation scope as the MyAnimeList anime entry in the twenty-fourth batch. The presence of API v2 references in third-party directories or community client libraries is not a substitute for the current first-party developer agreement.

Decision: no scraping or Provider implementation until the first-party agreement, client registration requirements, data display conditions, and release-notification obligations are verified.

#### MangaUpdates

The official MangaUpdates API documentation lists a public API base at `https://api.mangaupdates.com/v1`, public series search/read endpoints, and an Acceptable Use Policy. The policy requires MangaUpdates credit, reasonable request spacing, and caching; it also prohibits use that deceives or defrauds users, assists or performs illegal actions, creates spam, or damages the database.

Decision: consider a narrowly scoped metadata Provider using public series search/read only, with attribution, caching, conservative pacing, and links to MangaUpdates detail pages. Do not use endpoints for user accounts, private messages, forum activity, or release/download distribution. Before implementation, confirm the endpoint authentication requirements and the exact API fields to be displayed.

Reference:
- https://mangaupdates.apidocumentation.com/

### Batch outcome

- 5 Atlas manga metadata candidates received individual decisions; Bilibili Comic remains covered by the Bilibili review.
- MangaDex and MangaUpdates are the strongest conditional API candidates for metadata-only use, with distinct attribution and usage requirements.
- AniList remains deferred; MAL and Kitsu remain unverified for this use case.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review Atlas manga resource sites MangaNelo, MangaKakalot, Bilibili Manga, DMZJ, Manhuagui, MangaFire, MangaSee, and ComicWalker.


## Individual source audit — thirtieth batch (2026-11-25)

This batch reviews the eight Atlas manga-resource entries: MangaNelo, MangaKakalot, Bilibili Manga, DMZJ, Manhuagui, MangaFire, MangaSee, and ComicWalker/Kadocomi.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| MangaNelo | No first-party API documentation, current automation policy, or metadata-reuse permission was verified | **External-only / unverified** | No Worker scraping or undocumented API |
| MangaKakalot | No first-party API documentation, current automation policy, or metadata-reuse permission was verified | **External-only / unverified** | No Worker scraping or undocumented API |
| Bilibili Manga | Same Bilibili Open Platform and Terms restrictions as the Bilibili anime entry; automated data acquisition requires authorized interface and written permission | **Permission-gated; not approved** | No scraping or unofficial app API |
| DMZJ | Public manga pages exist, but no first-party public API contract or permission for third-party metadata aggregation was verified | **External-only** | No use of undocumented app/mobile API or scraping |
| Manhuagui | Official About page describes user-uploaded material, copyright-holder removal requests, and says downloads are prohibited; no API permission was verified | **External-only; no downloads** | No chapter scraping, image fetching, or download links |
| MangaFire | A status page reports “API Operational,” but no first-party API specification or acceptable-use terms for third-party integrations were verified | **API existence/permission unresolved** | Do not infer API access from status monitoring; no Provider |
| MangaSee | No first-party API documentation, current automation policy, or metadata-reuse permission was verified | **External-only / unverified** | No Worker scraping or undocumented API |
| ComicWalker / Kadocomi | Official KADOKAWA Terms govern the content service; no public third-party metadata API or automation permission was verified | **External-only** | Link to official title pages only; no scraping, chapter retrieval, or account access |

### Source-specific findings

#### MangaNelo

The Atlas seed points to `manganelo.com`. This review did not find first-party API documentation, an official developer program, or a current policy granting third-party automated metadata extraction. Third-party scraper libraries and public search pages are not authorization.

Decision: retain as external-only if the destination is separately confirmed; no Worker fetching, HTML parsing, or unofficial endpoint use.

#### MangaKakalot

The Atlas seed points to `mangakakalot.com`. No first-party API specification or permission for third-party metadata aggregation was verified. Third-party status monitors only establish that a site responded, not that automated collection is allowed.

Decision: external-only; no scraping or unofficial API.

#### Bilibili Manga

Bilibili Manga is a Bilibili service surface, not an independent operator. The Bilibili Open Platform agreement and general Terms reviewed in the twenty-sixth batch remain applicable. Automated acquisition requires an expressly authorized API/interface and prior written permission; the public Open Platform catalog does not grant general-purpose manga catalog search access.

Decision: no scraping, no undocumented app/mobile API, and no Provider without written authorization for the exact metadata use.

References:
- https://open.bilibili.com/agreement/developer-service
- https://www.bilibili.com/blackboard/era/termsofservice.html

#### DMZJ

The Atlas seed points to `dmzj.com`. Public manga listings and author pages are visible, but this review did not establish a first-party open API contract or terms authorizing third-party metadata aggregation. Community-maintained mobile clients and reverse-engineered app endpoints are not official permission.

Decision: external-only. Do not reuse undocumented app/mobile APIs, session tokens, or HTML scraping.

#### Manhuagui

The official About page describes the site as a user-sharing manga platform, states that works are shared by users, directs rights holders to request removal, and says downloads are prohibited. The review did not identify a supported API or a license for third-party chapter/image distribution.

Decision: if retained, provide only a user-opened external page link. Do not scrape chapter lists, fetch images, proxy content, or generate download links.

References:
- https://www.manhuagui.com/contact.html
- https://www.manhuagui.com/

#### MangaFire

MangaFire's status page reports an “API Operational” component. A status component is not an API specification: this review did not verify the endpoint contract, authentication model, rate limits, acceptable-use policy, or permission for third-party metadata aggregation.

Decision: do not reverse-engineer the service API based on the status page. Keep external-only until first-party API documentation and usage terms are available.

Reference:
- https://mangafire.statuspage.io/

#### MangaSee

The Atlas seed points to `mangasee123.com`. This review did not verify a current first-party API, acceptable-use policy, or metadata-reuse permission. Third-party clients and scraper repositories are not operator authorization.

Decision: external-only; no scraping or undocumented API.

#### ComicWalker / Kadocomi

ComicWalker now operates under the Kadocomi service name. The official KADOKAWA Terms apply to the content distribution service and define content broadly to include text, information, images, audio, and video. The service requires an account for normal use except where otherwise permitted, and the review found no public third-party API or automated metadata permission. The app terms also prohibit bots or other technical means used to manipulate the app improperly.

Decision: keep user-initiated links to official title pages only. Do not scrape the catalog, retrieve chapters/images, use account credentials, or call private app endpoints.

References:
- https://comic-walker.com/terms
- https://comic-walker.com/terms/app

### Batch outcome

- 8 Atlas manga-resource candidates received individual decisions.
- Bilibili Manga remains permission-gated under the Bilibili platform agreement.
- MangaFire's status page is not treated as API documentation or authorization.
- Manhuagui's own page says downloads are prohibited; no chapter/image acquisition is allowed.
- ComicWalker/Kadocomi remains official-link-only.
- MangaNelo, MangaKakalot, DMZJ, and MangaSee remain external-only pending first-party API and policy evidence.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: review the eight Atlas novel sources: Z-Library, Anna's Archive, 知轩藏书, 奇书网, SoBooks, Lunarora, PDFs.top, and 读书派.


## Individual source audit — thirty-first batch (2026-11-25)

This batch reviews the eight Atlas novel/e-book candidates: Z-Library, Anna's Archive, 知轩藏书, 奇书网, SoBooks, Lunarora, PDFs.top, and 读书派.

### Decision summary

| Source | Evidence reviewed | Current decision | Worker action |
|---|---|---|---|
| Z-Library | Official social account identifies current official domains, but the Atlas URL's exact endpoint/API policy and a public search API were not verified; available EAPI client material is third-party and account-oriented | **No public search API verified** | No scraping, account-cookie use, challenge bypass, or unofficial API |
| Anna's Archive | Official FAQ says the only stable JSON API is member-only fast-download; custom search requires generating/downloading large ElasticSearch/MariaDB datasets | **Not suitable for this no-database search architecture** | No member download API, bulk dataset ingestion, or torrent metadata mirror |
| 知轩藏书 | Current `zxcs.zip` explicitly says it is a user-created replacement, not the original site's official new domain; it discourages crawling and offers full dataset by email | **Unofficial successor; no crawler** | No scraping; do not present as original official site |
| 奇书网 | No current first-party canonical domain, API specification, or acceptable-use policy was verified for the Atlas seed | **Unverified** | No domain substitution or automated access |
| SoBooks | No current first-party API, terms authorizing automated aggregation, or stable search contract was verified | **Unverified / external-only** | No scraping or unofficial API |
| Lunarora | No first-party canonical identity, API documentation, or terms for the Atlas seed was verified | **Unverified** | No scraping or domain guessing |
| PDFs.top | No first-party API specification or metadata-use permission was verified | **Unverified / external-only** | No automated access or file retrieval |
| 读书派 | Public catalog pages exist, but no first-party public API or permission for third-party metadata aggregation was verified | **External-only** | No scraping, book-file fetching, or unofficial API |

### Source-specific findings

#### Z-Library

The Atlas seed points to `zh.z-library.sk`. Z-Library's official social account has identified `z-library.sk`, `z-lib.sk`, and `z-library.gy` as official domains at the time of its January 2026 notice. However, this does not establish a public third-party metadata search API. The API evidence found for Z-Library is primarily third-party client documentation for authenticated EAPI operations, and some documented domains use anti-bot challenge infrastructure. This project will not use account cookies, browser challenges, or unofficial reverse-engineered endpoints.

Decision: no Worker Provider. Revisit only if Z-Library publishes a first-party public search API and explicit permitted third-party use terms for the exact integration.

References:
- https://mastodon.social/@Z_Lib_official/115982676684123606
- https://z-library.sk/

#### Anna's Archive

Anna's Archive's official FAQ says its stable JSON API is for members to obtain a fast download URL. For other uses, including custom search and iterating through files, it recommends generating or downloading its ElasticSearch and MariaDB databases. The FAQ also describes raw torrent lists and bulk distribution. That is not a lightweight public metadata-search API and would introduce bulk dataset replication outside the project's no-database architecture.

Decision: do not use the member download API, bulk datasets, raw torrent lists, or download endpoints. Keep external-only; no bulk mirror of its catalog.

Reference:
- https://annasarchive.io/faq

#### 知轩藏书

The current `zxcs.zip` About page explicitly states that it is not the official website or a new domain of the original 知轩藏书. It was created by former users from previously saved archives and merged user-preserved data. The operator discourages crawler use because it may overload the server and says users needing the full dataset should contact the site by email.

Decision: do not call it the original official site, do not crawl, and do not fetch its full dataset. If the directory retains the link, label it accurately as a user-created successor/archive.

References:
- https://zxcs.zip/
- https://zxcs.zip/about.html

#### 奇书网

The Atlas seed's `qishuxia.com` identity could not be corroborated through a current first-party operator page, API specification, or applicable terms. Similar Chinese book-site names and third-party directories are not sufficient to establish canonical ownership.

Decision: unverified; do not guess replacement domains, follow mirror lists, or automate requests.

#### SoBooks

The Atlas seed points to `sobooks.cc`. This pass did not retrieve a current first-party API specification, acceptable-use policy, or permission for third-party automated metadata aggregation.

Decision: external-only pending first-party documentation. No scraping, unofficial API, or file download.

#### Lunarora

The Atlas seed points to `lunarora.com`. This pass did not verify a first-party canonical service identity, API documentation, or data-use terms for the exact domain.

Decision: unverified; no scraping or domain substitution.

#### PDFs.top

The Atlas seed points to `pdfs.top`. No first-party API contract, metadata license, or permission for automated collection was established.

Decision: external-only; no Worker crawling or file retrieval.

#### 读书派

The official site exposes a public catalog of books and metadata such as title, author, category, and ratings. This review did not find a public developer API, a current automated-access policy, or permission to reuse its metadata in a third-party aggregator. A public page is not an API license.

Decision: external-only. Do not scrape the catalog or fetch ebook files.

Reference:
- https://www.dushupai.com/

### Batch outcome

- 8 Atlas novel/e-book candidates received individual decisions.
- No source in this batch was approved for a Worker Provider.
- Z-Library and Anna's Archive do not expose a suitable public metadata search API for this architecture.
- 知轩藏书 is explicitly not the original official site and discourages crawlers.
- 奇书网, SoBooks, Lunarora, and PDFs.top remain unverified.
- 读书派 remains external-only despite its public catalog.
- No Provider implementation, source catalog entry, KV configuration, source enablement, or Cloudflare deployment was changed.
- Next batch: reconcile the remaining 63 Atlas seed rows outside the original 57-candidate scope and decide which anime/movie/manga/novel candidates can be safely added to the multi-category source catalog without duplicating already-reviewed entries.


## Atlas 119-row seed — complete multi-category reconciliation (2026-11-25)

This section closes the 63-row multi-category review backlog identified after the original 57 Atlas-tagged catalog candidates. It also records the one missed SolarMovie row from the twenty-eighth batch.

### Final category accounting

The Atlas seed contains 119 rows. The original catalog import covered 56 JAV/torrent/community rows; the Atlas README contributed one additional DMM/FANZA metadata candidate, giving 57 Atlas-tagged catalog records. The remaining 63 seed rows are now all reviewed:

| Category | Seed rows | Review coverage |
|---|---:|---|
| Anime database | 8 | 8/8 |
| Anime torrent | 6 | 6/6 |
| Anime streaming | 8 | 8/8 |
| Anime/manga crossover | 1 | 1/1 (Bilibili Manga; same platform as Bilibili) |
| Movie/TV database | 8 | 8/8 |
| Movie/TV torrent | 3 | 3/3 |
| Movie/TV streaming | 8 | 8/8, including SolarMovie addendum |
| Manga database | 5 | 5/5 |
| Manga resources | 8 | 8/8 |
| Novel/e-book database | 8 | 8/8 |
| **Total** | **63** | **63/63** |

### Cross-category and duplicate identity resolution

The 63 rows are not 63 independent services. The following entries share one platform/operator identity and should be modeled as one multi-category source if ever approved:

- MyAnimeList + MyAnimeList Manga
- AniList + AniList Manga
- Douban Anime + Douban Movie
- Kitsu Anime + Kitsu Manga
- Bilibili Anime + Bilibili Comic + Bilibili Manga
- TMDB + “TMDB Chinese Forum” (the latter points to the same TMDB host and is not a separate forum/API)

Nyaa.si and Sukebei Nyaa share the Nyaa domain family but are distinct service surfaces and must not be merged. Sukebei is adult-oriented and remains in the JAV/adult scope, not Anime.

The Atlas 119-row seed therefore contains historical seed rows, duplicates, category aliases, and sources outside the initial catalog import. Counts must not be interpreted as unique services, approved integrations, or runnable Providers.

### Integration disposition after all 63 reviews

Conditional candidates worth a separate implementation-readiness review:

- Bangumi: public subject metadata only; use maintained `/v0/` API, meaningful User-Agent, conservative pacing, and no access to auth-gated data.
- MangaDex: public manga metadata only; visible attribution, no ads/paid services, no chapter content/images, and shared global rate limiting.
- MangaUpdates: public series metadata only; attribution, caching, reasonable request spacing, and no illegal-action or user/forum endpoints.
- DMHY: documented public RSS; verify current terms, HTTPS response, category filtering, and content rules before implementation.
- Shana Project: site-wide public RSS only; never use user-specific/private feeds.
- MusicBrainz: public metadata API remains conditional on the previously documented strict shared 1 request/second coordinator.
- AniDB and Notify.moe: technical API leads only; verify current official rate/policy details before implementation.

Not approved or external-only under current evidence:

- AniList: competing-service restriction unresolved; written clarification required.
- TMDB, Trakt, YouTube API: restrictions conflict with the integrated AIOResourceSearch product context.
- Bilibili: written authorization required for automated data acquisition.
- MAL, Kitsu, LiveChart, Douban, HIDIVE, Crunchyroll, Netflix, JustWatch, Reelgood, Letterboxd, IMDb, Rotten Tomatoes, Metacritic, and other streaming/resource sites: no current permission/API scope meeting the project's constraints was established.
- Private/account-bound feeds or trackers (Mikan personal RSS, AnimeBytes) are not shared Worker sources.
- Shadow-library/bulk-download services (Anna's Archive) are not integrated into this no-database search architecture.
- Unverified mirrors, retired services, and unstable rotating domains are not substituted.

### Final status

- Original Atlas catalog subset: 56 seed rows + 1 README metadata candidate = 57 Atlas-tagged catalog candidates.
- Additional Atlas multi-category rows: 63/63 reviewed, not imported into `sourceCatalog.ts`.
- Atlas SQL: 119/119 rows accounted for across the original subset and the multi-category review.
- Current source catalog remains 91 unique candidate records; no automatic expansion was made from the 63 reviewed rows.
- No new Provider implementation, KV configuration, source enablement, or Cloudflare deployment was performed.


## API integration readiness review — 2026-11-25

The current official contracts were rechecked and a separate implementation-readiness document was added at `docs/provider-integration-readiness.md`.

- **Bangumi:** `POST /v0/search/subjects` is explicitly marked experimental in the current official OpenAPI schema. Stable `GET /v0/subjects` is a browse/list endpoint requiring a subject type, not an arbitrary keyword-search replacement. Decision remains deferred; do not build a search Provider against the experimental endpoint.
- **MangaDex:** public `GET /manga` is the viable metadata search contract. Official AUP requires attribution and prohibits ads/paid services. The documented initial global limit is 5 requests/second per source IP, with endpoint-specific quotas and `X-RateLimit-*` headers. A shared 400 ms lane (2.5 requests/second application-wide) remains a conservative implementation target. Conditional implementation candidate; metadata and official detail links only, no chapter content/reader.
- **MangaUpdates:** official docs list public `POST /series/search` and say most endpoints need no account; AUP requires attribution, spacing, caching and prohibits use assisting illegal actions. Since this product also aggregates torrent indexes, metadata-only use still needs written scope clarification. Defer implementation until the operator confirms this integrated product use is acceptable.
- **Correction to rate-limit wording:** MusicBrainz's current official documentation describes the numeric 1 request/second limit as average per source IP (unless otherwise agreed), not as a literal per-client-app numeric quota. The proposed app-wide 1-second lane is a stricter project control that coordinates requests across Worker instances. The detailed rate-limit document has been corrected accordingly.
- No source catalog record, Provider code, KV config, Durable Object binding, source enablement, or deployment was added.


## MusicBrainz — implemented, disabled pending hosted verification

- Implemented as `musicbrainz-api` v1.0.0 using the official `/ws/2/release-group` JSON search endpoint.
- Read-only public search requires no API key, but the Web Service is free only for non-commercial use and requires a meaningful User-Agent.
- All application requests use the shared `musicbrainz` Durable Object lane with at least 1,000 ms spacing; cache hits occur before reservation.
- The Provider maps core release-group metadata only: MBID, title, artist credit, primary type, and first-release date. It does not map tags, ratings, annotations, user data, or cover art.
- The MusicBrainz database license distinguishes CC0 core data from CC BY-NC-SA 3.0 supplementary data. Keep this Provider limited to the documented core fields and re-review if monetization or supplementary fields are added.
- Code is registered in the Worker compile-time registry; no adapter/source record has been written to KV, and the Provider is not enabled. Hosted Cloudflare connectivity, quota behavior, and final product-policy review remain outstanding.


## Supplemental cross-category external sources — 2026-11-25

- **Nyaa** (`https://nyaa.si`): added as an anime-category, torrent-kind external entry only. The exact canonical domain's current automation terms, robots policy, and ordinary Cloudflare Worker access were not established in this review. No RSS request, HTML scraping, or metadata harvesting is approved; users open the original site themselves.
- **Shana Project** (`https://www.shanaproject.com`): its official Help page documents a public site RSS feed containing only the latest 50 releases, plus separate public and private personal feeds. The secure private feed is explicitly for its account holder and must not be used as a shared source. The site-wide feed is not a query-specific search endpoint, so using it as a keyword Provider would produce incomplete and misleading search results. Keep as homepage-only; do not request personal feeds.
- Both entries are tagged `contentCategory: anime` and `category: torrent`. The catalog-registration flow now preserves an entry's declared content category rather than forcing every imported source into `jav`.
- Source catalog count was 93 unique candidates after the Nyaa and Shana Project additions. DMHY is a third supplemental entry, bringing the catalog to 94. Nyaa and Shana remain homepage-only external entries; DMHY has a code Provider but no KV configuration, source activation, or deployment.


## DMHY — documented public keyword RSS, Provider implemented but disabled — 2026-11-25

- Official FAQ: `https://www.dmhy.org/cms/page/name/faq.html` documents the public RSS endpoint `https://share.dmhy.org/topics/rss/rss.xml`, keyword filtering via `?keyword=`, and the site's AND/OR query syntax. It also documents category/team/user feed variants; this implementation uses only the public keyword feed.
- The same FAQ describes the service as free, focuses publication on anime, tokusatsu, and Japanese drama, and prohibits real-person pornography. Classify the source as `contentCategory: anime`, not JAV.
- Implemented `dmhy-rss` v1.0.0 with GET-only RSS parsing, exact HTTPS host/path validation, bounded 2 MiB response streaming, BTIH magnet validation, canonical HTTPS detail URLs, and no detail-page/image/torrent fetching.
- No numeric request quota was found in the reviewed official FAQ. The public RSS feature is documented for subscriptions, but that alone is not a comprehensive third-party automation license. Keep the source disabled pending hosted Worker reachability, conservative pacing verification, current terms/robots review, and content/legal review.
- Code is registered in the Worker compile-time registry. No KV adapter/source record was written, no source was enabled, no live upstream request was performed by Cloudflare, and no deployment occurred.
