# Candidate Source Review Log

本审核日志必须遵循[数据源目录管理规范](./source-catalog-policy.md)：保留来源资产与证据链，区分第一方证据/第三方报告，并分别记录自动化许可、实现、配置、启用和线上验证状态。

Last reviewed: 2026-11-26

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
| IGDB API v4 | Game metadata | **Conditional candidate; credentials and shared throttle required** | Uses Twitch application credentials and OAuth client-credentials flow; secrets must remain in Worker Secrets. Official docs state 4 requests/second and up to 8 concurrent open requests. App access tokens are valid for up to 60 days and the IGDB FAQ caps each Client ID at 25 active tokens; client-credentials app tokens have no refresh token and must be re-acquired on expiry/401, so a shared token broker is required. API is free for non-commercial use; commercial usage requires a partnership. The API does not support browser requests, so Worker proxying is the correct architecture. Defer implementation until shared rate limiting and token refresh handling are designed. |

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
| Eporner | First-party Terms updated 2026-10-09 and official API v2.1.0 docs: public API is expressly exempt from the general automated-access restriction; keyless search and daily removal feed are documented | **API use permitted within documented limits; project compliance prerequisites remain** | Provider implemented; hourly removal-feed sync and hosted Cloudflare verification pending; no player, images, downloads, or ML use |
| XNXX | Official legal Terms and robots.txt exist; third-party review reports two disallowed paths and no clear public data-sharing API | **No third-party aggregation permission verified** | External-only; respect robots.txt; do not use unofficial scraper wrappers |
| XVideos | Third-party Terms index records a clause prohibiting spidering, crawling, or automated access; canonical Terms page was not independently retrieved | **Automated access treated as prohibited pending contrary written authorization** | External-only; no Worker crawling |
| XHamster | Current xHamster-related Terms at my.xhsocial.com prohibit scraping, redistribution, and automatic/manual monitoring or reproduction; defined scope is centered on my.xhsocial.com and company-operated related domains | **Strong restriction; exact xhamster.com scope requires clarification** | External-only; no automated access pending written clarification |

### Source-specific findings

#### Eporner

The canonical Terms are now directly reviewable at https://www.eporner.com/terms/ (last updated 2026-10-09), and the first-party API documentation is published at https://www.eporner.com/api/v2/ (version 2.1.0). Section 6.2(8) generally restricts automated access and extraction, but Section 6.2 expressly states that this restriction does not apply to the documented public API when its documentation, usage limits, and the Terms are followed; no separate written permission is required for that API use. The official API exposes keyless HTTPS keyword search, pagination, a removed-video feed, and a status endpoint.

The API-specific terms welcome use on a website or app and require: reading the removed-video feed at least once daily and removing listed videos; compliance with applicable age-verification and child-protection rules; no use of the API/feed for machine-learning or AI training/testing; no downloading, copying, or re-hosting video files; and fair request behavior. The API documentation says to respect Cache-Control, make sequential rather than parallel page requests, and wait for Retry-After after HTTP 503. This project should consume only text metadata (title, keywords, duration, views/rating/date) and the canonical video URL. Do not consume thumbnails, embeds, player markup, or media files. The project must not treat the API as a way around Eporner's regional or age controls.

Decision: Eporner is eligible for a metadata-only Provider through the official public API, not HTML scraping. Implement the Provider with a daily removal-feed sync and fail-closed suppression of removed IDs. Public enablement remains subject to source-policy review and the project's jurisdiction-specific launch assessment; this is not a blanket requirement to hide all adult discovery while that assessment is pending. No API call, source activation, or deployment is part of this review.

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

The canonical www.tnaflix.com homepage is reachable and exposes a public search field. Its first-party Terms of Service at /terms state that access is for personal, non-commercial purposes and that users may not copy or distribute any part of the website without prior written authorization. The Terms also reserve copyright and other intellectual-property rights in site content and prohibit use, copying, reproduction, distribution, broadcast, display, sale, licensing, or other exploitation of that content without prior written consent from the respective owners. No public metadata API or permission for third-party aggregation was found. The French audiovisual regulator's Decision No. 2025-558 (published 2025-08-05; https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052045307) records that minors could access TNAFlix pornography under the arrangements observed in June/July 2025 and issued a formal notice to the operator. This historical finding is an age-protection risk signal, not proof of the site's present-day technical state. TNAFlix also had a 2022 data breach; neither the regulatory matter nor the breach creates permission to automate access or handle user credentials.

Decision: retain only the user-initiated homepage link. Do not implement Worker fetching, HTML parsing, metadata extraction, or reuse of account credentials/cookies absent written authorization. Do not adopt FetchJAV's scraping logic as proof of permission.

### Batch outcome

- 2 remaining FetchJAV candidates received source-specific decisions.
- Jable.org remains separate from JableTV and has an unresolved first-party robots/terms status.
- TnaFlix's first-party Terms do not authorize the intended public metadata aggregation; the 2025 French regulator notice is recorded as an additional age-protection risk.
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

The Atlas seed points to `nyaa.si`. Third-party Nyaa-compatible documentation describes queryable RSS using `?page=rss` and parameters such as `q`, `c`, and `f`, but this does not establish the current canonical site's contract or grant permission for a third-party aggregator. The canonical `nyaa.si/help`, `/rules`, and feed endpoints could not be independently retrieved in this pass. An archived Servarr supported-indexer reference also warns that Nyaa discourages automation and may ban automated clients' IP addresses; treat this as an operational warning, not as a substitute for current first-party policy.

Decision: retain as an external candidate only. Do not implement a Worker Provider until the canonical site's current rules and public RSS/search contract can be verified, including whether automated third-party search is permitted. Do not respond to blocking with proxy rotation, identity changes, browser impersonation, challenge solving, or other access-control evasion. The user-opened original-site link remains available.

References:
- https://nyaa.si/help
- https://nyaa.si/rules
- https://nyaa.si/?page=rss
- https://wiki.servarr.com/sonarr/supported#nyaa

2026-11-26 revalidation:
- Direct retrieval of the canonical `nyaa.si/help`, `nyaa.si/rules`, and a sample `?page=rss` URL again failed in the current research environment. This remains a fetcher limitation; it is not proof of universal unavailability or permission to work around the failure.
- Search results surfaced Nyaa-branded help/terms pages on other domains (including `nyaa.wiki`, `nyaa.help`, `nyaa.media`, and `nyaa.guru`). Their content must not be attributed to `nyaa.si` unless the Nyaa operator independently confirms domain ownership/canonical status. Do not replace the catalog destination with these domains.
- Third-party clients and RSS implementations continue to provide technical evidence that the Nyaa-style `?page=rss` interface is used, but this is not first-party confirmation of current endpoint guarantees, automation policy, or third-party aggregation permission.
- Decision unchanged: retain `https://nyaa.si` as a user-initiated external destination only. No RSS Provider, HTML scraper, search template, alternate domain, proxy, or challenge workaround.

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


## Mikan Project follow-up — 2026-11-25

- The official homepage is active and currently exposes an ordinary keyword search page at `https://mikanani.me/Home/Search?searchstr={query}`. A live search for `Rewrite` returned anime titles and result rows with title, size, update time, and magnet-related controls.
- The homepage also exposes account login/registration. Its announcement says advanced subscription options are available to registered users; this does not establish that the ordinary keyword search requires login.
- Third-party clients document `/RSS/Search?searchstr={query}`, and recent Auto_Bangumi issue logs show successful responses from both `mikanani.me` and `mikanime.tv`. This is useful compatibility evidence, not an official API contract or permission for a third-party aggregator.
- The `MyBangumi?token=...` feed remains a private, account-bound subscription endpoint. Do not request, collect, or store a user's personal token as a shared Worker credential.
- No current official automation policy, robots directive, RSS response schema, or explicit permission for third-party result aggregation was established in this review. The RSS XML endpoint was not inspectable through the research fetcher because it returned an unsupported XML content type; this is not evidence that the endpoint is unavailable.
- **Decision:** add Mikan Project to the anime/torrent source catalog as a user-initiated external search link using the verified `Home/Search` template. Do not implement RSS or HTML Worker fetching until official interface/policy evidence is sufficient. Site login is not a reason to exclude a source in general, but this particular personal subscription token is not a shared keyword-search API.
- The source catalog increases from 94 to 95 unique candidates. This is one external-search catalog entry, not a new executable Provider.

References:
- Official homepage: https://mikanani.me/
- Verified keyword search: https://mikanani.me/Home/Search?searchstr=Rewrite
- Third-party client RSS configuration (interface lead only): https://github.com/yaqinking/DMHY/blob/master/DMHY/support-site.json
- Auto_Bangumi issue showing RSS endpoint use: https://github.com/EstrellaXD/Auto_Bangumi/issues/893


## Authenticated-source eligibility and current implementation gap

- A source is not excluded merely because it requires a free account. Candidate review may include public search/API endpoints that require ordinary account authentication, provided the source's own terms permit the intended automated use and no access control is bypassed.
- Record the exact authentication model separately: official API key, OAuth, account session/Cookie, or a user-specific/private feed. These are not interchangeable.
- A personal subscription/export/feed token is not automatically a general-purpose search credential. Do not place one user's private feed into a shared source configuration or treat it as a public keyword-search API.
- **Current runtime capability:** Worker now resolves source-scoped `SOURCE_CREDENTIAL_*` bindings and passes the value only to the matching Provider through `ProviderContext.credential`. Missing or empty bindings fail closed before any upstream request. Provider-specific auth behavior still requires its own documented, host-restricted implementation.
- Never put passwords, session cookies, API keys, or OAuth client secrets in source catalog entries, ordinary KV source records, public API responses, browser storage, or logs. The eventual implementation must use Worker-side secrets, scope credentials to the intended source/host, and define rotation/expiry and failure behavior.
- Do not automate interactive login flows, defeat CAPTCHA/anti-bot checks, reuse stolen/shared sessions, bypass paywalls, or evade account/region/rate restrictions.


## Access-control bypass deferral rule — 2026-11-25

- A source that requires bypassing CAPTCHA, anti-bot challenges, Cloudflare challenge pages, paywalls, login gates not legitimately available to the operator, geo/IP restrictions, or published rate limits is **not an active development target**.
- Such sources and techniques belong in [deferred-source-backlog.md](./deferred-source-backlog.md), not the runnable Provider catalog. Record the specific blocker and a concrete reconsideration condition (official API, permitted account access, explicit authorization, or the source removing the restriction).
- This is not a blanket ban on login. Ordinary free-account authentication is eligible where the source's rules permit automated use and the account holder legitimately controls the credential.
- Do not reuse private personal feeds as shared search APIs. Do not automate interactive login or CAPTCHA solving.
- The current Worker now supports source-scoped credential injection through a named Worker Secret binding. A configured but missing secret fails closed before the Provider makes an upstream request. Provider-specific auth headers/cookies still require a reviewed implementation and must be restricted to the source's canonical host.


## AniBT — public Torznab API, Provider implemented but disabled — 2026-11-25

- Official Torznab docs: `https://wiki.anibt.net/en/docs/open-api/torznab` and protocol reference `https://wiki.anibt.net/en/docs/open-api/torznab-api`.
- The operator explicitly documents `GET https://anibt.net/torznab/api`, says no account or API key is needed, and gives instructions to add AniBT as a Torznab indexer in Sonarr, Radarr, and Prowlarr. This is a supported public read interface, not a challenge-bypass route.
- Search uses `t=search`, `q`, anime category `5070`, and `limit=50`. The documented keyword limit is 160 UTF-8 bytes; results are newest-first and the offset is bounded to item 300.
- Official quota: 60 Torznab requests / 60 seconds / IP. The project uses a shared Durable Object lane at 1,100 ms between upstream requests (about 54.5 requests/minute) to leave headroom and coordinate across Worker instances.
- Official caching documentation marks Torznab as `no-store`; the Provider deliberately bypasses Cache API reads and writes. It does not retry 429/503 responses; the shared coordinator records cooldowns from 429/503 and honors `Retry-After` when supplied.
- The documented Torznab result contains title and a public `.torrent` download. The Provider accepts only HTTPS `anibt.net/api/torrent/rel_*.torrent` URLs, maps the release ID, safe same-origin `/release/{id}` GUID when supplied, publication date, size, seeders, and peers. It does not infer or fabricate magnet links.
- The official API docs explicitly authorize anonymous query use by third-party indexer clients, but do not state a broad metadata-republication license. Keep the Provider disabled pending a final project content/policy review and non-production Cloudflare verification.
- No personal subscription RSS token, group API key, login session, publish/delete endpoint, or other authenticated API is used.
- The `robots.txt` URL could not be independently retrieved in this review; the implementation is restricted to the documented public Torznab endpoint. Do not probe alternate paths if it later becomes unavailable.
- No KV source/adapter configuration, enablement, production changes, or deployment is included.

## AnimeTosho — retired feed/API; do not integrate — 2026-11-25

- The operator's own shutdown notice states that updates would stop on 2026-05-09 and that the website/feed/API might remain temporarily available only to serve old data. This means the endpoint is not a live source for new releases.
- The operator's news archive records the shutdown plan; a later status report in October 2026 says the feed/API and download functions have been switched off. The later report is secondary evidence, while the operator's shutdown notice is the primary source.
- Decision: do not add AnimeTosho as a Provider or count it among active candidates. Do not use its legacy JSON/RSS/Torznab URLs as a fallback or try alternate hosts to revive the retired service.
- References:
  - Operator shutdown notice: https://animetosho.org/about/shutdown
  - Operator news archive: https://animetosho.org/about/news
  - Secondary shutdown confirmation: https://otakudown.com/anime-tosho-shuts-down-downloads-feeds/

## Tokyo Toshokan — public RSS capability historically documented; current integration not verified — revalidated 2026-11-26

- The canonical site's indexed listing still identifies Tokyo Toshokan as a Japanese-media BitTorrent index and retains the historical announcement that its RSS feed/customizer was introduced in 2017, with search features supported in RSS at that time.
- A current indexed listing page was discoverable, but direct retrieval of the canonical homepage again returned HTTP 403 in this review. This is a fetcher-specific observation only; it does not prove universal blocking or establish that bypass is necessary.
- No current first-party RSS endpoint specification, current terms granting third-party automated aggregation, or ordinary Worker reachability was verified. The 2017 announcement is historical capability evidence, not current authorization or a stable current interface contract.
- **Decision:** retain the existing user-initiated external destination only. Do not add a Provider or search template, guess feed URLs, probe undocumented endpoints, rotate IPs, impersonate browsers, or attempt to bypass a challenge. Reconsider only after a currently documented public feed and applicable automation/data-use conditions can be verified.
- References:
  - Canonical homepage and historical RSS announcement: https://www.tokyotosho.info/
  - Indexed listing page: https://www.tokyotosho.info/?cat=10&date=2026-07-21

## Project JAV — public catalogue UI verified; search contract and automation permission unresolved — 2026-11-26

- The first-party homepage is currently publicly reachable and identifies the service as a JAV torrent index. Its rendered page exposes a keyword/title/actress/code search control, filters, pagination, catalogue metadata, and magnet links. The homepage also displays a current update timestamp.
- The rendered interface confirms that a user-facing search UI exists, but the retrieved page does not expose a verifiable query URL or documented public search API/RSS contract. Do not infer the search route from client-side behavior or copy third-party scraper endpoints.
- The reviewed footer provides DMCA/contact/ideas links and states that the site does not host videos itself. No first-party Terms of Use, privacy policy, public API/RSS documentation, or explicit permission for third-party automated metadata aggregation was verified in this pass.
- **Decision:** retain Project JAV as a user-initiated external destination only. Do not add a search template until its actual user-facing query URL is verified; do not implement Worker HTML scraping, undocumented endpoint calls, metadata harvesting, or magnet harvesting. Reconsider if the operator publishes a supported search contract and applicable automation/data-use terms or grants explicit permission.
- References:
  - First-party homepage and rendered search/catalogue UI: https://projectjav.com/
  - First-party homepage footer (DMCA/contact/ideas and no-hosted-video statement): https://projectjav.com/


## Additional cross-category API candidates — 2026-11-25

This section records official API candidates reviewed while expanding beyond the current JAV/torrent source set. These candidates are not part of the 97-entry upstream-derived catalog and are not automatically registered.

| Candidate | Category | Evidence-based decision |
|---|---|---|
| IGDB | Game | **Conditional Provider candidate.** Official API is free for non-commercial use and supports server-side game search. It requires a Twitch account with 2FA, a registered confidential application, Client ID and Client Secret, and OAuth client-credentials access tokens. Tokens expire and must be refreshed; the project must design a safe token lifecycle and source-scoped secret handling before implementation. Official quota is 4 requests/second and at most 8 concurrent requests. Keep unregistered until credential lifecycle and current Twitch Developer Service Agreement conditions are reviewed. |
| AniList | Anime / manga metadata | **Deferred pending scope clarification.** Public GraphQL API is free and anonymous, but its terms prohibit use in competing, non-complementary services of the same nature, including anime/manga list or tracker services. AIOResourceSearch is a multi-source resource-search product rather than a tracker, but its anime/manga discovery functionality makes the boundary insufficiently clear. Do not assume compatibility; seek written clarification before Provider implementation. |
| TMDB | Film / TV metadata | **Not eligible for this product's current scope.** The API is free for non-commercial use with an API key and attribution, but its official FAQ prohibits using its data/images in connection with pornographic content. Because the overall product is an adult-resource search aggregator, metadata-only use does not reliably remove that product-context restriction. Do not integrate. |
| Discogs | Music metadata | **Not eligible for current external-resource search use.** Some catalog fields are CC0, but its API terms prohibit using API content to drive traffic to non-Discogs websites or services. This product's purpose includes linking users to external resource destinations, so the intended use conflicts with that restriction. Do not integrate without written permission. |
| Open Library | Books / novels | **Deferred; unsuitable as a backend under current guidance.** The official API provides search, but its current usage guidance says the APIs are not intended as a data backend for third-party services and prioritizes human-centered, time-sensitive lookup. The legacy search endpoint is deprecated and the current Search API is described as experimental. Keep out of Provider implementation unless Open Library confirms this product's use is acceptable and a stable search contract is available. |
| Kitsu (CGWire) | Not a consumer anime catalog | **Not applicable.** The current official Kitsu API documentation describes an animation/VFX production-management system and requires JWT authentication. It is not a public anime/manga metadata catalogue; do not confuse it with similarly named consumer anime databases. |

### Official references

- IGDB API account, authentication, and rate limits: https://api-docs.igdb.com/
- IGDB FAQ and non-commercial / commercial partnership terms: https://api-docs.igdb.com/
- AniList API terms: https://docs.anilist.co/guide/terms-of-use
- AniList GraphQL request guide: https://docs.anilist.co/guide/graphql/
- AniList rate limits: https://github.com/AniList/docs/blob/master/docs/guide/rate-limiting.md
- TMDB API FAQ and prohibited-content notice: https://developer.themoviedb.org/docs/faq
- TMDB search and authentication: https://developer.themoviedb.org/docs/search-and-query-for-details
- Discogs API Terms of Use: https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
- Open Library API usage guidelines: https://openlibrary.org/developers/api
- Open Library Search API status: https://openlibrary.org/dev/docs/api/search
- Kitsu API documentation: https://api-docs.kitsu.cloud/



## Additional anime metadata API review — 2026-11-25

### AniDB HTTP API — deferred; not a keyword-search Provider

- AniDB's published policy distinguishes supported API access from HTML scraping and database copying. The policy text surfaced during this review states that automated clients must use supported API channels; it does not grant permission to scrape the website or mirror the database.
- The documented HTTP API requires a registered client name/version and exposes a narrow read-only set of operations (for example, anime detail and hot-anime data). The current material reviewed does not establish a stable, supported arbitrary keyword-search contract suitable for this product's search box.
- The published endpoint examples use `http://api.anidb.net:9001/httpapi`; an HTTPS API endpoint was not verified. This project does not weaken its HTTPS-only upstream policy to accommodate an unverified transport.
- Secondary implementation references consistently report strict pacing (approximately one request every two seconds) and a requirement to cache identical requests. This would need to be confirmed against current official documentation before any implementation.
- The official API wiki and policy pages returned HTTP 403 to the research fetcher in this review. That is an evidence limitation, not proof that the service blocks all clients or that a bypass is required. Do not probe alternate hosts or attempt to work around the response.
- **Decision: deferred.** Reconsider only if AniDB's official docs become verifiable and provide a supported HTTPS keyword-search interface, current quota/cache rules, and terms compatible with metadata display. Do not implement HTML scraping, UDP client automation, bulk title-dump ingestion, or a proxy dependency.
- References:
  - Official API overview: https://wiki.anidb.net/API
  - Official HTTP API definition: https://wiki.anidb.net/HTTP_API_Definition
  - Official policy: https://anidb.net/policy
  - Secondary rate-limit implementation reference: https://docs.shokoanime.com/shoko-server/understanding-anidb-bans

### Notify.moe — public API exists; deferred pending stable search contract and data-use clarification

- The site's API page explicitly publishes a REST API at `https://notify.moe/api` and documents an `Anime` object with title, summary, status, genres, start/end dates, episode information, studios, producers, licensors, and related fields.
- Its help guide says the API is an ongoing effort and is subject to change. The currently published type page documents individual Anime records (for example, `/anime/{id}`), but this review did not establish a stable public keyword-search endpoint or a versioned search contract.
- The Terms of Service prohibit HTML scraping and explicitly direct clients to use the public API. The same terms state that images displayed on the site are for personal, non-commercial use. This project would omit images, but the terms do not clearly settle redistribution/display of API-sourced text metadata in a third-party multi-source aggregator.
- **Decision: deferred, not external-search registered and not implemented.** Reconsider if the operator documents a stable keyword-search endpoint and clarifies that third-party metadata display/linking in this product is permitted. Do not scrape HTML or depend on undocumented internal search routes.
- References:
  - Public API index: https://notify.moe/api
  - Anime type contract: https://notify.moe/api/anime
  - Beginner guide (API described as ongoing and subject to change): https://notify.moe/thread/I3MMiOtzR
  - Terms of Service: https://notify.moe/terms


## Movie / TV torrent API follow-up — 2026-11-25

### EZTV public API — deferred; current API does not provide keyword search

- The current EZTV API page on the site's own domain states that its API is in beta, requires no API login or key, and returns JSON from `https://eztvx.to/api/get-torrents`.
- The documented parameters are `limit` and `page`; a separate `imdb_id` parameter retrieves torrents for a show when its IMDb ID is already known. The page does not document a free-text title/query parameter.
- This is therefore not a drop-in Provider for the product's free-text search flow. It could only be useful in a future metadata-enrichment chain after a trusted upstream supplies an IMDb ID; that dependency and the API's beta status would need separate review.
- No numeric quota, cache policy, or broad third-party republication permission was established from the API page.
- **Decision: defer Provider implementation.** Do not crawl the search UI to compensate for the missing API query parameter. Reconsider only if EZTV documents stable keyword search or a clearly permitted ID-enrichment use, plus quota/cache guidance.
- Official reference: https://eztvx.to/api/

### YTS — API endpoint identity and current contract not verified

- YTS's status page lists its current official domains and reports its API as operational, but the status page does not identify a canonical API base URL or publish the current API contract.
- A current search result for YTS API documentation was hosted on a third-party proxy/documentation domain and directed clients to `movies-api.accel.li`. That is not sufficient evidence that this endpoint is operated or authorized by YTS; older YTS API documentation hosted on GitHub refers to retired domains such as `yts.am`.
- The API's historical ability to return movie torrents or construct Magnet URIs does not establish current endpoint ownership, data-use permission, or a stable contract.
- **Decision: pending / do not implement.** Do not connect the Worker to third-party proxy API hosts or guess an API origin from mirrors. Reconsider only when YTS publishes a current API specification and canonical API host on an official domain, with terms that permit this use.
- References:
  - YTS status page: https://yifystatus.com/
  - Third-party API documentation lead (not treated as authoritative): https://yts.proxyninja.org/api
  - Historical API documentation (retired host examples): https://github.com/BrokenEmpire/YTS/blob/master/API.md


## The RarBg public JSON API — conditional Provider candidate — 2026-11-25

- First-party developer guide: `https://therarbg.com/developers/`; first-party OpenAPI 3.1 specification: `https://therarbg.com/api/openapi.json`.
- The operator explicitly describes the API as free, read-only, and available to scripts, apps, media servers, and AI agents without signup or an API key. The documented search endpoint is `GET https://therarbg.com/api/v1/search/` with free-text `q`, category filters, pagination, and a maximum of 50 results per page.
- Supported categories include `XXX`, `Anime`, `Movies`, `TV`, `Games`, and `Music`; the same API also indexes Apps, Books, and Other. This makes it a potentially useful cross-category torrent source, not just an adult source.
- Search results include title, infohash, magnet URI, category, size, seeders, leechers, indexed timestamp, optional IMDb ID, tags, and a canonical torrent detail URL. The first implementation should consume only this search endpoint and display text metadata plus the source-provided magnet/detail link.
- Anonymous quota: 30 requests/minute and 10,000/day per IP (IPv6 counted per /64). A free account API key raises the limit, but this project does not need or intend to request one. Responses include minute/day rate-limit headers and 429 with `Retry-After`. The operator asks clients to cache; server-side responses are cached for 2–60 minutes.
- The API documents versioned `/api/v1/` compatibility and says breaking changes receive a new version path and at least 90 days' notice.
- **Important scope boundary:** the separate title/extras/upcoming/streaming endpoints include TMDB-sourced metadata and images. Because TMDB's terms prohibit use of its data/images in connection with pornographic content, this project must not call those endpoints or display those fields. Restrict the Provider to `/api/v1/search/` torrent-result records only; do not fetch posters, plot, ratings, streaming availability, or other TMDB-backed metadata.
- The API guide expressly invites application/script use, but this review did not locate a separate broad data-republication license. Keep output limited to the metadata fields necessary for search results and link back to the canonical source page; re-check the current API guide before expanding scope.
- **Decision: suitable for a narrowly scoped Provider implementation, subject to shared rate limiting and hosted validation.** Use no API key, no account, no HTML scraping, no images, and no TMDB-backed endpoints. The global request lane must stay below 30/minute across Worker instances (target at least 2.1 seconds between upstream requests), honor `Retry-After` and daily quota headers, and cache responses for at least the operator's requested interval.
- References:
  - First-party API guide: https://therarbg.com/developers/
  - First-party OpenAPI 3.1 contract: https://therarbg.com/api/openapi.json
  - First-party About page: https://therarbg.com/about-us/
  - First-party DMCA / removal process: https://therarbg.com/dmca/


## Bitsearch (bitsearch.eu) — official anonymous API verified; integration deferred — 2026-11-25

- The first-party API documentation is published at `https://bitsearch.eu/api` and explicitly advertises a free anonymous REST API. The documented search route is `GET /api/v1/search`, requires a free-text `q`, supports category/subcategory, sort/order, pagination and a maximum of 100 results per page. It also documents category and torrent-detail endpoints.
- Anonymous quota is **200 requests/day per source IP**, without signup or API key. A free account/API key is documented at 1,000 requests/day per account, but this review does not assume account creation or credentials. Responses expose `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`; the API docs recommend checking them, caching responses, and backing off on 429.
- The taxonomy includes Other, Movies, TV, Anime, Software, Games, Music, Audiobook, Ebook/Course, and XXX. The search result example includes title, infohash, size, category, seeders, leechers, verified flag, and createdAt; the separate torrent detail example includes a Magnet URI. A future implementation should use the search response first and only request detail records if genuinely needed, validate the full 40-character infohash and source-provided Magnet URI, and avoid exposing file paths or tracker lists.
- The API documentation's existence and anonymous-access instructions establish that the operator invites programmatic API use. They do **not**, by themselves, establish a broad data-republication license or explicitly permit a third-party multi-source aggregator to republish indexed metadata. The linked About and Privacy pages returned HTTP 500 to the research fetcher; no accessible first-party Terms / API data-use license was verified in this review.
- The 200/day anonymous quota is also a material operational constraint: Cloudflare Worker egress is shared, so the upstream will see the service's egress IP rather than each end user's IP. A shared service-wide budget of 200/day may be exhausted quickly; a tighter per-minute limiter alone does not solve the daily ceiling. The free authenticated tier is 1,000/day but requires an account/API key and still does not resolve the missing metadata-display permission.
- **Decision: keep external-search only; do not implement or configure a Worker Provider yet.** Reconsider after (1) the site publishes accessible terms or written clarification permitting third-party metadata display/linking, and (2) a sustainable quota model is confirmed. Do not evade quota, rotate IPs, or use undocumented endpoints. No login, scraping, or API call was used to bypass an access control.
- First-party reference: https://bitsearch.eu/api
- First-party policy pages linked from API docs but currently unavailable to this review: https://bitsearch.eu/about and https://bitsearch.eu/privacy-policy


### Bitsearch revalidation — 2026-11-26

- Re-opened the first-party API documentation on 2026-11-26. It is currently readable and confirms the documented anonymous tier: **200 requests/day per source IP**, no API key or account. A free-account API key raises the documented limit to 1,000 requests/day per account; this is a free account tier, not a paid API.
- The current API page explicitly documents `GET /api/v1/search` with required free-text `q`, category/subcategory filters, relevance/date/seeders/size/leechers sorting, pagination, and a maximum of 100 results per page. It documents `GET /api/v1/categories` and `GET /api/v1/torrent/:id`; the result example includes title, infohash, size, category, seeders/leechers, verified status, and creation time, while the detail example includes magnet URI, files, and trackers.
- The published taxonomy explicitly includes Movies, TV, Anime, Software, Games, Music, Audiobook, Ebook/Course, and XXX. This makes the API technically relevant to multiple product categories, not only adult search.
- The documentation exposes rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) and recommends checking them, caching, and backing off on 429. The shared Cloudflare egress IP still means the anonymous 200/day ceiling is service-wide in practice; a per-minute limiter alone cannot guarantee the daily quota.
- The first-party content-removal page describes a DMCA notice workflow and lists prohibited categories including CSAM/child safety, malware/phishing, encrypted/password-protected, spam, and non-working/fake content. This is a takedown mechanism, not a third-party metadata republication licence or permission to redistribute indexed material.
- The homepage/API documentation link to a Privacy page, but the first-party Privacy and About pages again returned HTTP 500 to this research fetcher. A `/terms` URL was not verified as a first-party published terms page. The first-party API documentation's invitation to use the API establishes programmatic access as a documented feature, but still does not expressly settle whether this product may display/re-publish Bitsearch metadata in a multi-source search service.
- A direct open attempt against the documented JSON endpoints was not retrievable by this research fetcher. This is a limitation of the current research tool path only; it is **not** evidence that the API is offline, blocked, or requires an access-control workaround. No alternate host, mirror, undocumented endpoint, or bypass was attempted.
- **Decision unchanged:** retain Bitsearch as external-search only. Do not implement or configure a Worker Provider until the operator clarifies metadata display/republication rights and a sustainable shared quota strategy is available. Do not create an account/API key merely to raise the quota before the data-use permission question is resolved. No API traffic was generated by this review.
- First-party references:
  - API documentation: https://bitsearch.eu/api
  - Content removal policy: https://bitsearch.eu/content-removal
  - Privacy page linked by the API documentation: https://bitsearch.eu/privacy-policy
  - About page linked by the API documentation: https://bitsearch.eu/about


## BTSOW — current canonical domain and automation contract unverified — 2026-11-25

- The existing catalog entry points to `https://btsow.com`, but current search results surfaced a redirect/directory path and multiple similarly branded hosts (`btsow.live`, `btsow.icu`, `btsow.vip`). No first-party announcement, canonical-domain list, operator-controlled API/RSS documentation, or terms linking these domains was verified.
- Search results from community-maintained scraper/rule repositories contain historical BTSOW HTML paths and selectors, but these are technical implementation traces, not current first-party documentation or permission to automate access. They must not be copied into a Worker Provider.
- The search engine's public UI description does not establish a stable API, RSS contract, request quota, or permission to republish indexed metadata. A current live result from `btsow.live` describes both torrent and magnet search, but the review did not establish that this host is controlled by the same operator as `btsow.com`.
- **Decision: unverified / external-only reference.** Keep the catalog note as an unverified directory reference; do not redirect to `btsow.live`, `btsow.icu`, or other mirror candidates; do not scrape HTML, copy third-party XPath selectors, or probe undocumented endpoints. Reconsider only after the operator publishes a canonical domain and a documented API/RSS/automation policy.
- References:
  - Existing catalog destination: https://btsow.com/
  - Current branded host surfaced by search (ownership unverified): https://btsow.live/
  - Another similarly branded host (ownership unverified): https://btsow.icu/
  - Third-party legacy selector example (implementation evidence only): https://github.com/xiandanin/magnetW/blob/master/rule.json


## Atlas torrent candidates — iJavTorrent, JAVBEE, My JAV Bay, OneJAV and 141PPV — reviewed 2026-11-26

### iJavTorrent (ijavtorrent.com)
- The public homepage is accessible to an ordinary browser and visibly exposes a search/filter interface, listing metadata, and source-provided Magnet links. This confirms a human-facing catalog, not a supported machine interface.
- The homepage contains no verifiable API/RSS documentation or automation/republication policy. A direct attempt to retrieve `/robots.txt` was not available to the research fetcher; this is recorded as unknown, not as permission or prohibition.
- **Decision: keep external-only.** Do not turn the visible page structure, form controls, or Magnet links into a generic HTML Provider without a first-party automation policy and stable documented search contract. Do not probe undocumented endpoints or bypass any challenge.

### JAVBEE (javbee.org)
- The canonical homepage could not be retrieved by the research fetcher. No operator-published API/RSS contract, current terms, or stable public search URL was verified.
- **Decision: unverified homepage reference only.** No Worker fetch, HTML parsing, or alternate-domain substitution. Reconsider after the operator provides an accessible canonical site and documented automation interface/policy.

### My JAV Bay (myjavbay.com)
- The first-party homepage is accessible and exposes a searchable VR catalog with recent post metadata, including title/code, size, cast names, category, and dates.
- No official API/RSS documentation or first-party permission for third-party metadata aggregation was found on the reviewed homepage. A search result advertised a third-party datawebot scraper API for this site; that service charges credits and explicitly states it does not use a My JAV Bay official API. It is neither a first-party integration nor compatible with the project's no-paid-services constraint, so it is not used.
- **Decision: homepage-only.** Do not implement HTML scraping or use the paid third-party scraper. Reconsider only if My JAV Bay publishes an official API/feed and the applicable rules permit the intended metadata display.

### OneJAV (onejav.com)
- RSSHub's route documentation states that the site's official `/feeds/` subscription does not support BT-download subscriptions, while RSSHub separately provides its own BT-oriented route. The latter is a third-party scraper route, not a first-party API or evidence of automation permission.
- Direct retrieval of `https://onejav.com/feeds/` returned HTTP 403 to the research fetcher. This is an access result, not a reason to deploy a challenge solver or use RSSHub as a proxy.
- **Decision: external-only.** Do not use RSSHub's route, scrape the site, or bypass the 403. Reconsider if the operator publishes a supported BT-capable feed/API and automation terms.

### 141PPV (141ppv.com)
- The official homepage and `/feeds/` page could not be verified directly in this review. RSSHub documentation distinguishes the site's own feed from its third-party BT route and states that the official feed does not support BT-download subscriptions.
- The RSSHub BT route is a third-party implementation; it does not establish a first-party BT search API, feed contract, or permission to republish metadata.
- **Decision: external-only.** Do not use RSSHub as a proxy, scrape HTML, or probe undocumented endpoints. Reconsider after the operator publishes a BT-capable public feed/API and rules covering automated metadata display.

### References
- iJavTorrent first-party homepage: https://ijavtorrent.com/
- JAVBEE candidate homepage (not retrievable in this review): https://javbee.org/
- My JAV Bay first-party homepage: https://myjavbay.com/
- My JAV Bay third-party paid scraper description (not used): https://www.datawebot.com/scraper/w_myjavbay_com
- OneJAV first-party feed page (403 in this review): https://onejav.com/feeds/
- RSSHub route documentation (third-party implementation evidence only): https://rsshub-doc.pages.dev/multimedia
- 141PPV first-party homepage/feed (not verified in this review): https://141ppv.com/ and https://141ppv.com/feeds/



## JAVDatabase candidate follow-up — 2026-11-26

- The first-party site identifies itself as a database for Japanese adult-video movie releases and performers, for tracking releases and collections. Its DMCA page says it does not provide access to or links to full pirated movies and describes the service as a database that promotes lawful purchases.
- The first-party site update dated 2026-03-12 describes its movie data as manually edited and sourced directly from Japanese sites. This is a description of its editorial workflow, not an API contract or permission for third-party automated extraction.
- A third-party open-source Stash scraper documents an HTML search URL and XPath selectors for JAVDatabase. This is implementation evidence only; it is not a first-party interface or authorization. FetchJAV's metadata enrichment implementation is likewise an HTML parser, not an official API.
- The third-party javinfo service documents JAVDatabase as one of its own providers and requires an API key; it is not a free first-party JAVDatabase API and is excluded under the project's no-paid-services rule.
- **Decision: homepage-only external entry.** The catalog now uses the verified first-party homepage `https://www.javdatabase.com`. Do not add a search template based on third-party scraper selectors, do not reuse FetchJAV/Stash scraping code, and do not implement Worker metadata extraction. Reconsider only if JAVDatabase publishes a supported public API/feed and applicable automation/data-use terms.
- References:
  - First-party site update: https://www.javdatabase.com/2026/03/12/site-update-data-improvements-improved-homepage-better-image-galleries-international-blocking/
  - First-party DMCA / site description: https://www.javdatabase.com/dmca-takedown-request/
  - Third-party Stash scraper (implementation evidence only): https://github.com/stashapp/CommunityScrapers/blob/master/scrapers/JavDatabase.yml
  - Third-party javinfo provider (paid API; not used): https://docs.javinfo.dev/docs


## 85Tube / 85RO candidate follow-up — 2026-11-26

- The first-party `85ro.com/terms/` page redirects to the English Terms page and explicitly defines the 85PO website as including content available through `85ro.com`. The terms restrict use to personal purposes, prohibit unauthorized framing/linking and non-personal exploitation, and permit links to site materials only for personal, non-commercial purposes.
- Third-party domain scans report that `85tube.com` redirects to `85ro.com`, but this review did not obtain a first-party redirect response or an operator statement establishing that `85tube.com` is an official canonical alias. The first-party 85ro.com terms must not be treated as proof of the old 85Tube domain relationship.
- The terms do not establish an API/feed contract or permission for automated metadata aggregation. They also do not authorize bypassing access restrictions.
- **Decision: keep the 85Tube catalog record name-only.** Do not substitute `85ro.com` for `85tube.com`, scrape the site, or build a Worker Provider. Reconsider only after a first-party source confirms the canonical relationship and publishes an applicable public integration interface/policy.
- References:
  - First-party 85ro.com Terms: https://www.85ro.com/terms/
  - First-party 85po.com Terms (separate domain scope): https://www.85po.com/vi/terms/
  - Third-party redirect observation only: https://scanner.pcrisk.com/scan-results/85tube.com
  - Third-party redirect observation only: https://gridinsoft.com/online-virus-scanner/url/85tube-com


## Additional name-only candidate recheck — 2026-11-26

### Jable.org
- The exact `jable.org` domain did not resolve to a verifiable first-party JableTV property in this review. A third-party domain monitor reports HTTP 401 and a redirect to a generated `ww547.jable.org` hostname; that is not evidence of an official mirror or a supported public service.
- FetchJAV lists Jable.org as an inherited/mirror adapter, but third-party scraper configuration is not first-party domain ownership or permission.
- **Decision: retain name-only.** Do not substitute `jable.tv`, follow generated redirect hosts, or bypass the 401. Reconsider only with first-party confirmation of the canonical domain and permitted public interface.
- References:
  - Third-party domain observation: https://siteinfo.verkosta.info/jable.org
  - FetchJAV supported-sites list (implementation evidence only): https://github.com/FetchJAV/FetchJAV_Public

### Porn5F
- The latest indexed domain record located for `porn5f.com` reports a 2026-07-03 expiry date. This is third-party WHOIS data, not confirmation of the current registrant or service status.
- No first-party operator announcement, current canonical replacement, Terms, public API, or RSS contract was verified. Do not infer a mirror from similarly named domains.
- **Decision: retain historical name-only record.** No external destination, Worker scraping, or mirror substitution.
- Reference: https://hypestat.com/info/porn5f.com

### PornBest
- Third-party records for `pornbest.org` are inconsistent: a recent WHOIS lookup still lists the 2026-11-23 expiry date, while other third-party scans report active DNS/HTTP responses and one reports HTTP 403. These observations do not establish renewal, current operator control, or permission to automate access.
- No first-party Terms/API/RSS contract or canonical replacement was verified. The separate `pornbest.com` and `pornbest.co` domains are not assumed to be official mirrors.
- **Decision: retain name-only.** Do not use third-party status reports to bypass a 403 or substitute another domain. Reconsider after first-party confirmation of the canonical service and a permitted public interface.
- References:
  - WHOIS snapshot: https://www.whois.com/whois/pornbest.org
  - Third-party HTTP/status observation: https://gridinsoft.com/online-virus-scanner/url/pornbest-org

### Seselah
- Third-party domain intelligence reports that `seselah.com` redirects to `papalah.com`, but no first-party operator announcement or Terms were found confirming that Papalah is the official successor/canonical destination for the FetchJAV-named Seselah source.
- A redirect observation alone is insufficient to merge identities or replace the catalog URL. No public API/RSS contract or automation permission was verified for the intended source.
- **Decision: retain name-only.** Do not silently substitute Papalah or scrape either domain. Reconsider only after first-party confirmation of the relationship and permitted automation terms.
- References:
  - Third-party domain observation: https://www.ipaddress.com/website/seselah.com/
  - Third-party Papalah profile: https://tools.malwaretips.com/url-scan/papalah.com


## PornHK and PornHoHo domain-status recheck — 2026-11-26

### PornHK
- The RDAP lookup for `pornhk.com` reports the domain as registered through 2028-01-17, with registrar Porkbun and DAN marketplace nameservers. The record was fetched on 2026-11-04.
- The domain being registered does not mean the historical PornHK service is active or operated by the previous source owner. The marketplace nameservers are consistent with a parked/for-sale domain.
- No first-party service homepage, current Terms, public API/RSS/search contract, or official replacement domain was verified.
- **Decision: retain name-only and do not link to pornhk.com.** Do not infer an operator from the registration record or substitute a domain suggested by third parties.
- Reference: https://who.is/rdap/pornhk.com

### PornHoHo
- A third-party site-status report contains a WHOIS snapshot for `pornhoho.com` listing an expiry date of 2025-12-12, but the same report also lists Cloudflare DNS records and nameservers updated in 2026. The data is internally stale/inconsistent and cannot establish whether the domain is currently renewed, parked, or serving the historical site.
- No first-party operator statement, current Terms, public API/RSS/search contract, or canonical replacement was verified.
- **Decision: retain name-only.** Do not describe the domain as definitively expired or offline based solely on the stale snapshot; do not link or guess mirrors.
- Reference: https://sitetrends.org/site/pornhoho.com


## FetchJAV name-only candidate group recheck — 2026-11-26

The current FetchJAV public README lists the following additional site names in its supported-site matrix but does not provide canonical domains, first-party Terms, or official API/RSS contracts for these individual entries:

- AApp11
- HAnime XYZ
- MIEN321
- PornJP
- PornNVR
- PornTW
- Video01
- XJISHI

The matrix is evidence that these names appear in FetchJAV's adapter inventory; it is not first-party evidence of the target sites' identity, canonical domain, or permission for this aggregator to access them. The README describes a local desktop application and site adapters, not a public integration service. Its networking dependency list includes TLS-fingerprint and Cloudflare-bypass components; those techniques are explicitly excluded from this project.

**Decision:** retain all eight as name-only candidates. Do not infer domains from names, reuse FetchJAV adapter code, follow unofficial mirrors, or implement Worker HTML scraping. Reconsider each independently only after the source operator confirms its canonical domain and publishes a supported public interface plus applicable automation/data-use terms.

References:
- FetchJAV supported-sites matrix: https://github.com/FetchJAV/FetchJAV_Public
- FetchJAV networking/dependency description: https://github.com/FetchJAV/FetchJAV_Public

## Follow-up source revalidation — 2026-11-26

This pass rechecked the previously deferred JavJunkies, LoveTorrent, NextJAV, MagnetDL, and RedTube entries. It did not establish any new first-party automation contract or permission, so no source was promoted to a Worker Provider or given a replacement URL.

### JavJunkies
- The current third-party page record still identifies `www.javjunkies.org` as “JAVJunkies » No Access”. A separate security-reputation service continues to flag possible phishing behavior. These are third-party observations, not a definitive finding about the operator or site content.
- Domain-registration records show the .org domain remains registered; registration and a valid TLS certificate do not establish that the current page is controlled by the historical operator.
- The similarly named `javjunkies.com` appears to use ParkLogic parking nameservers and is not treated as an official mirror.
- **Decision: retain name-only.** Do not link to the current No Access page, submit credentials, or automate access. Reconsider only after operator identity, canonical domain, and a permitted public interface are confirmed.
- References:
  - https://www.ipaddress.com/website/www.javjunkies.org/
  - https://gridinsoft.com/online-virus-scanner/url/javjunkies-org
  - https://www.whois.com/whois/javjunkies.com

### LoveTorrent
- A direct attempt to retrieve `https://lovetorrent.net/` remained unavailable in this review.
- Search did not establish a current operator-controlled site, first-party Terms, official API/RSS feed, or stable public search contract.
- **Decision: retain name-only.** Do not infer a replacement from similarly named domains or third-party mirror lists; no Worker request or HTML parsing.
- Reference:
  - https://lovetorrent.net/

### NextJAV
- A direct attempt to retrieve `https://nextjav.com/` remained unavailable.
- Third-party DNS observations continue to show ParkLogic nameservers and parking-oriented records. This does not establish an official successor or an active NextJAV service.
- No first-party Terms, public API/RSS, or stable search contract was verified.
- **Decision: retain historical name-only record.** Do not guess or substitute a mirror and do not automate access.
- References:
  - https://viewdns.info/dnsrecord/?domain=nextjav.com
  - https://nextjav.com/

### MagnetDL
- The existing review remains accurate: the 2019 shutdown announcement was followed by a reported brief return, so the old announcement alone is not proof of permanent closure.
- Current third-party status evidence still does not verify an operator-controlled .com service or establish `magnetdl.io` / `magnetdl.co` as official successors.
- **Decision: retain historical name-only record.** Do not substitute a mirror or build a Provider without first-party canonical-domain and interface evidence.
- References:
  - https://torrentfreak.com/torrent-site-magnetdl-shuts-down-190520/
  - https://torrentfreak.com/magnetdl-makes-comeback-days-after-it-shut-itself-down-190529/\n  - Current third-party status snapshot (checked 2026-11-19): https://sitetrends.org/site/magnetdl.com/
  - Existing source-review evidence remains the basis for the historical shutdown/return distinction.

### RedTube
- The direct first-party Terms URL redirected to a regional access notice during this review, so the Terms body could not be independently re-read in this session.
- The earlier first-party Terms review recorded in this document remains the operative evidence: the license is limited to personal use and restricts public linking/reproduction/distribution absent express permission.
- **Decision: no change.** Keep RedTube out of the public source catalog; no Worker scraping, metadata extraction, or public aggregator link absent written permission for this exact use.
- References:
  - https://www.redtube.com/information/terms
  - https://www.redtube.com/

**Batch outcome:** zero sources promoted, zero mirror substitutions, zero new Provider implementations, and zero access-control workarounds. The deferred-source backlog remains unchanged; these entries continue to require first-party confirmation and an expressly permitted public interface before reconsideration.

## Forum-source revalidation batch — 2026-11-26

This batch revisited 141HongKong, 52AV, Cool18, EYNY, and HJD2048. The review distinguishes a live domain or third-party scraper route from an operator-published and permitted integration interface.

### 141HongKong
- A direct retrieval of the catalog's exact domain, `https://141hongkong.com/`, was unavailable in this review.
- Search did not locate first-party current Terms, an official API/RSS feed, or an operator-documented public search contract. Third-party domain records alone cannot establish any of those.
- **Decision: retain homepage-only external reference.** No Worker requests or post metadata extraction pending canonical policy and public-search verification.
- Reference: https://141hongkong.com/

### 52AV
- A direct retrieval of `https://52av.one/` was unavailable in this review. Third-party domain records show that the domain is registered and has DNS/TLS infrastructure, but those facts do not establish the current service operator, its terms, or permission for automated collection.
- Search did not locate first-party current Terms, an official API/RSS feed, or a documented public search contract.
- **Decision: retain homepage-only external reference.** Do not probe alternate routes, reuse cookies, or bypass any challenge; no Worker scraping.
- References:
  - https://52av.one/
  - https://radar.cloudflare.com/domains/domain/52av.one

### Cool18
- The current RSSHub project contains a `cool18` route that constructs search URLs and parses the site's HTML, including article details. This is evidence of a third-party scraper implementation, not an operator-published RSS feed, API, or authorization for this project to collect and republish metadata.
- A 2026-09-26 RSSHub issue discussion says the broader 6park site had shut down while the Cool18 board remained reachable. A third-party regional measurement reports Cool18 blocked in mainland China as of 2026-11-24; that regional restriction is not a reason to proxy around it.
- No first-party automation/data-use terms or official public API/RSS contract were verified.
- **Decision: retain homepage-only external access.** Do not import RSSHub parsing code or call its hosted route as a substitute for first-party permission; no Worker scraping or regional-block evasion.
- References:
  - https://github.com/DIYgod/RSSHub/blob/master/lib/routes/cool18/index.ts
  - https://github.com/DIYgod/RSSHub/issues/3496
  - https://zh.greatfire.org/domain/cool18.com

### EYNY
- The first-party homepage returned a transient “system busy, please wait” message in this review. A third-party status snapshot reported HTTP 200 on 2026-11-25, and Cloudflare Radar showed recent domain/certificate activity; neither establishes a stable public search interface or automation permission.
- No first-party current Terms, official API/RSS feed, or documented public search contract was verified.
- **Decision: retain homepage-only external access.** Do not infer permission from domain reachability or third-party status; no Worker crawling or post extraction.
- References:
  - https://eyny.com/
  - https://sitetrends.org/site/eyny.com/
  - https://radar.cloudflare.com/domains/domain/eyny.com

### HJD2048
- The exact catalog domain returned HTTP 403 in this review. Third-party domain records show that the domain remains registered and resolves, but DNS activity does not override the observed access restriction or establish an authorized public interface.
- Historical RSSHub issue reports describe earlier access failures; neither third-party scraper code nor an old route is an authorization basis.
- No first-party current Terms or supported public API/RSS/search contract was verified.
- **Decision: retain homepage-only external reference.** Do not probe alternate paths, replay cookies, proxy around the 403, or automate access.
- References:
  - https://hjd2048.com/
  - https://www.ipaddress.com/website/hjd2048.com/
  - https://github.com/DIYgod/RSSHub/issues/13014

**Batch outcome:** no source was promoted to an automated Provider; no catalog destination was replaced; no third-party scraper implementation was adopted. Reconsider only after first-party confirmation of canonical ownership, a supported public interface, and terms that permit the intended metadata use.

## Follow-up candidate revalidation — 2026-11-26

This batch rechecked SexInSex, SIS001, 91论坛, JAVLeak, and JavMost. A visible search form, forum search feature, or RSS feature is not by itself an authorization to operate a third-party aggregator. No candidate in this batch met the project's requirements for a Worker Provider.

### SexInSex
- The first-party landing page currently displays a 21+ age/legal warning, states that full access requires account activation by email, and includes a user-submitted-link/legal-rights disclaimer. A first-party page also states that visitor access was restricted because automated crawlers and malicious attacks had overloaded the server.
- No public API/RSS contract or first-party permission for third-party metadata collection was verified. The observed activation/access requirements do not authorize Worker account/session handling.
- **Decision: retain user-initiated external access only.** No Worker scraping, account/session automation, or access-control workaround.
- References:
  - https://sexinsex.net/
  - https://whatsapp.btnihao.com/bbs/redirect.php?goto=lastpost&tid=9541239

### SIS001
- The first-party FAQ on `web.sis001.com` documents both the forum's built-in search feature and an RSS subscription feature. This establishes that the forum has user-facing search/RSS functionality, but the FAQ does not expose a verified public feed URL/query contract or establish permission for this project's automated collection and metadata display.
- The current FAQ fetch is HTTP 403 in this research session. A separate third-party RSSHub request from 2020 is merely a feature request, not an official feed implementation or authorization.
- The catalog root was previously observed returning HTTP 403; no public, operator-authorized Provider interface was verified.
- **Decision: retain external access only.** Do not reverse-engineer feed URLs, use RSSHub scraping routes, or automate account/session access. Reconsider only if the operator documents a public feed/API and permits this use.
- References:
  - https://web.sis001.com/bbs1/faq.php
  - https://github.com/DIYgod/RSSHub/issues/4377

### 91论坛
- The exact catalog destination `https://91porny.com/forum` returned HTTP 403 in this review. Third-party regional measurements report blocking in mainland China, but regional blocking is not permission to proxy around it.
- No first-party current Terms, public API/RSS contract, or authorized public search interface was verified. Earlier page observations of post listings and promotional redirects do not establish permission for automated extraction.
- **Decision: retain user-initiated external access only.** No Worker fetching, alternate-route probing, or regional-block evasion.
- References:
  - https://91porny.com/forum/
  - https://zh.greatfire.org/domain/91porny.com

### JAVLeak
- The current homepage is publicly retrievable and visibly exposes a search input, advanced-search link, and paginated metadata listings. The homepage did not expose a Terms or Privacy link/text in the retrieved page, and no official API/RSS contract or explicit automation/data-use permission was verified.
- The presence of a search form does not establish a stable supported search URL or permission to collect and republish metadata. Domain-registration records only establish registration, not operator identity or access rights.
- **Decision: retain homepage-only external access.** Keep the search template removed; no Worker scraping or undocumented endpoint use until first-party terms and a supported interface are published.
- References:
  - https://javleak.com/
  - https://www.whois.com/whois/javleak.com

### JavMost
- The catalog's historical `javmost.com` destination was previously observed redirecting to `javmost.ws`; the currently retrievable site resolves to `www.javmost.ws`. This supports recording the observed redirect destination, but does not independently establish long-term canonical ownership or an authorized integration relationship.
- The current homepage exposes navigation, advanced-search controls, and paginated metadata. The linked Legal page is a 18 U.S.C. §2257 compliance statement and says displayed content is user-submitted or pulled from third-party sources; it is not a Terms of Service or automated-access policy. No official API/RSS contract or permission for third-party metadata aggregation was verified.
- **Decision: retain external access only; do not promote the search template.** Do not treat the 2257 statement as automation permission or scrape the site's search/results pages. Reconsider only after current operator terms and a supported, permitted public interface are available.
- References:
  - https://www.javmost.ws/
  - https://www.javmost.ws/legal/
  - https://radar.cloudflare.com/domains/domain/javmost.com

**Batch outcome:** zero Provider promotions, zero search-template restorations, and zero access-control workarounds. Existing external destinations remain unchanged pending first-party permission and a supported public interface.

## Additional index/forum-source revalidation — 2026-11-26

This batch rechecked 5278.cc, OurSogo, Sex8.cc, 91Porn, and Hanime1. Domain activity, third-party status scans, or a third-party RSS route are not substitutes for a first-party supported interface and automation permission.

### 5278.cc
- A direct retrieval of the exact catalog homepage returned HTTP 403 in this review.
- Cloudflare Radar shows recent TLS certificate issuance and DNS/domain activity, but that establishes only technical domain activity, not permission for automated access or a public search contract.
- No first-party current Terms, public API/RSS, or operator-documented search interface was verified.
- **Decision: retain homepage-only external reference.** No Worker requests, alternate-route probing, cookie reuse, or challenge bypass.
- References:
  - https://5278.cc/
  - https://radar.cloudflare.com/domains/domain/5278.cc

### OurSogo
- A direct retrieval of `https://oursogo.com/` returned HTTP 403 in this review.
- No first-party current Terms, official API/RSS documentation, or supported public search interface was verified. Domain reachability or third-party directory references do not establish automation permission.
- **Decision: retain homepage-only external reference.** Do not probe alternate paths, reuse cookies, or bypass the 403.
- Reference: https://oursogo.com/

### Sex8.cc
- The exact catalog domain was not retrievable in this review. The existing catalog evidence records an operator-associated Linktree listing Sex8.cc as a destination; this association does not provide current Terms, an API/RSS contract, or permission for third-party metadata extraction.
- Cloudflare Radar's certificate observations establish that the domain has had active TLS certificates, not that a public automated interface is available or permitted.
- **Decision: retain homepage-only external reference.** No Worker crawling or post extraction pending first-party policy and interface verification.
- References:
  - https://sex8.cc/
  - https://radar.cloudflare.com/domains/domain/sex8.cc

### 91Porn
- The first-party homepage currently presents an 18+ age confirmation and explicitly tells visitors in mainland China not to access the site. This is a site-specific access notice; it is not an invitation to evade geographic restrictions.
- The RSSHub route documentation marks 91Porn as having strict anti-crawling. A third-party scraper route is not operator authorization and is not imported.
- No first-party public API/RSS contract or permission for third-party metadata aggregation was verified.
- **Decision: retain user-initiated external access only.** No Worker fetching, RSSHub route use, age-gate automation, or regional restriction evasion. This source remains distinct from 91论坛 (`91porny.com/forum`).
- References:
  - https://91porn.com/
  - https://john-marques.github.io/rsshub-docs/routes/multimedia

### Hanime1
- The exact site publishes a first-party 18 U.S.C. §2257 statement requiring visitors to be at least 18 (or the higher age of majority where applicable). This is an age/compliance statement, not an API contract or automated-access policy.
- The canonical homepage returned HTTP 403 in this review. Third-party regional measurements report mainland-China blocking, which does not authorize proxying or other circumvention.
- No first-party public API/RSS contract or permission for third-party metadata aggregation was verified.
- **Decision: retain user-initiated external access only.** No Worker scraping, challenge bypass, or geographic restriction evasion.
- References:
  - https://hanime1.me/
  - https://hanime1.me/2257
  - https://en.greatfire.org/domain/hanime1.me

**Batch outcome:** zero Provider promotions, zero new search templates, and zero access-control workarounds. Existing catalog destinations remain unchanged.


## Individual source audit — fourteenth batch (2026-11-26)

This revalidation covers 夯鸭论坛 (Hung-Ya), 色花堂98堂 (SeHuaTang), JAVGG, JavyNow, and Eporner. First-party policy and documented interfaces take precedence over search forms, third-party scripts, or domain-directory claims.

### Decision summary

| Source | First-party evidence | Current decision | Worker action |
|---|---|---|---|
| 夯鸭论坛 (Hung-Ya) | Canonical homepage https://hung-ya.com/ displays an 18+ entry gate and legal-content warning; no current Terms, public API/RSS, or supported automated search contract was located | **Age-gated; automation policy unresolved** | Homepage-only external link; no Worker fetch or age-gate bypass |
| 色花堂98堂 (SeHuaTang) | Existing operator-associated Telegram channel announces .net/.org domains and search availability changes, but is not a first-party Terms/API/RSS policy; current .org content/domain identity remains unverified | **Canonical domain and automation permission unresolved** | Keep existing unverified external reference; no mirror substitution, scraping, or account automation |
| JAVGG | First-party Terms at https://javgg.net/terms-of-service/ prohibit data mining, harvesting, and extraction; no exception or official API/RSS contract was found | **Automated metadata extraction prohibited by published Terms** | Homepage-only; no Worker Provider or HTML scraper |
| JavyNow | First-party Terms at https://javynow.com/tos prohibit scrapers, offline readers, spiders, robots, and automated extraction absent express authorization; third-party reproduction/distribution is also restricted | **Automated retrieval not authorized** | Homepage-only; remove/keep removed any search template; no Worker fetch |
| Eporner | First-party Terms updated 2026-10-09 expressly exempt the documented public API; API v2.1.0 provides no-key search and a removed-video feed | **Documented API use permitted subject to API Terms** | Eligible for metadata-only Provider after daily removal-feed sync and jurisdiction-specific launch review |

### Source-specific findings

#### 夯鸭论坛 (Hung-Ya)

The current canonical homepage identifies itself as 洪爺影城 / Hung-Ya and presents an 18+ entry gate. The gate and accompanying legal notice establish an age boundary, not permission for automated access. No current first-party Terms, public API/RSS contract, or supported search interface was verified.

Decision: retain the existing homepage-only reference. Do not automate entry-gate interaction, crawl the forum, or infer permission from the visible homepage.

#### 色花堂98堂 (SeHuaTang)

The operator-associated Telegram channel has published notices about the site's search availability and lists .net/.org domain references. Those notices are useful discovery evidence, but they do not provide a current first-party automation policy or public API/RSS contract. The exact existing .org catalog destination has not been verified as a functioning canonical site in this review.

Decision: retain the existing unverified external reference only. Do not switch to a presumed mirror, reverse-engineer forum search, reuse user cookies, or automate account access.

#### JAVGG

The first-party Terms at https://javgg.net/terms-of-service/ grant a limited viewing license and expressly restrict data mining, data harvesting, and data extraction. A public search UI does not override those restrictions, and no first-party API/RSS or express permission for this aggregator was found.

Decision: homepage-only external reference. Do not implement a Worker Provider, generic HTML adapter configuration, or metadata extraction.

#### JavyNow

The canonical homepage at https://javynow.com/ exposes a search input, but the first-party Terms at https://javynow.com/tos expressly prohibit computerized/automatic mechanisms including web scrapers, offline readers, spiders, and robots to access, extract, or download content unless expressly authorized. The Terms also restrict third-party reproduction, distribution, and exploitation of content without prior written consent.

Decision: retain the homepage reference only. The search box is not an API contract or automation authorization; do not restore a search template or implement automated retrieval.

#### Eporner

The previous 2026-11-25 review left Eporner external-only because the canonical Terms could not then be retrieved. That conclusion is superseded by this direct first-party review. The Terms' Section 6.2 exception explicitly permits use of the documented public API without separate written permission when its documentation, limits, and the Terms are followed. The API v2.1.0 documentation specifies a no-key HTTPS search endpoint, cache behavior, sequential paging, a removed-video feed, and status checks.

Decision: approve the documented API as an eligible acquisition path, limited to metadata and canonical source links. The Worker Provider is now implemented with keyword search, an active-status check for every returned ID, and a cursor-based 15-minute removal-feed sync. The source and adapter remain disabled pending a successful scheduled sync and non-production Cloudflare verification. Public enablement also requires the project jurisdiction-specific launch assessment; this is not a blanket adult-content hiding rule. Do not consume image thumbnails, player/embed data, or media files; do not bypass regional/age controls; do not use the API/feed for AI or machine-learning training/testing.

### Batch outcome

- One source (Eporner) promoted from external-only to **implemented, official-API Provider**; its scheduled removal-feed sync and hosted Cloudflare verification remain outstanding.
- Four sources remain external-only or homepage-only.
- No search templates were added for JAVGG or JavyNow.
- No mirror switching, age-gate automation, account/session reuse, challenge bypass, or HTML scraping was introduced.
- No Provider code, KV configuration, source enablement, Cloudflare deployment, or production setting was changed.


## Individual source audit — sixteenth batch (2026-11-26)

This batch revalidated XNXX, XVideos, and YouPorn. The review distinguishes first-party policy text from third-party policy archives and records the European Commission's preliminary DSA findings without presenting them as final adjudications.

### Decision summary

| Source | First-party / policy evidence | Current decision | Worker action |
|---|---|---|---|
| XNXX | Current Terms effective 2026-11-11; section 7(B) prohibits automated mechanisms including scrapers, offline readers, spiders, and robots absent express written authorization; personal/non-commercial use restrictions also apply | **Automated extraction prohibited absent written authorization** | External homepage only; no Worker fetch or HTML parsing |
| XVideos | Canonical Terms could not be independently retrieved; ToS;DR's archived terms record an approved prohibition on spidering, crawling, and automated access; no official API/RSS or written permission verified | **Treat automation as prohibited; first-party confirmation remains outstanding** | External homepage only; no Worker fetch or scraping |
| YouPorn | Official Terms PDF last modified 2025-06-30; personal-use-only license; robots/spiders/automatic access require prior written consent; third-party linking/reproduction of Website and Works is restricted absent express permission | **No third-party aggregation permission; remove clickable destination pending written permission** | Name-only; no Worker fetch, HTML scraping, or deep links |

### Source-specific findings

#### XNXX

The current Terms are published at https://info.xnxx.com/legal/TOS. The captured 2026-11-11 version explicitly prohibits use of computerized or automatic mechanisms, including web scrapers, offline readers, spiders, or robots, to access, extract, or download any content from the Website unless NKL Associates expressly authorizes it in writing (section 7(B)). The Terms also state that Website content is provided for personal and non-commercial use and restrict third-party exploitation of Website content absent prior written consent. No public API/RSS contract or written permission for this aggregator was found.

The European Commission's 2026-03-26 announcement stated that it had preliminarily found XNXX and XVideos, among other services, in breach of the DSA for failing to protect minors from exposure to pornography. These were preliminary findings; the Commission explicitly stated that the providers could examine the investigation files and respond. This is a material child-safety risk signal, not a final adjudication: https://digital-strategy.ec.europa.eu/en/news/commission-preliminarily-finds-pornhub-stripchat-xnxx-and-xvideos-breach-digital-services-act

Decision: retain only the existing homepage reference for user-initiated access. Do not use generic HTML parsing, unofficial scraper packages, or undocumented endpoints.

#### XVideos

The exact current Terms page could not be independently retrieved during this review. ToS;DR's archived Terms entry records a prohibition on using computerized/automatic mechanisms, including web scrapers, offline readers, spiders, or robots, to access, extract, or download Website content unless expressly authorized in writing. This is third-party policy evidence, not a substitute for direct first-party retrieval; however, absent contrary first-party documentation or written permission, the project must not automate access. No official public API/RSS or metadata aggregation authorization was found.

The European Commission's 2026-03-26 preliminary DSA findings also include XVideos. The finding remains preliminary and is recorded as an age-protection risk signal, not a final ruling.

Decision: retain the existing homepage reference only. Do not implement Worker fetching, HTML scraping, or unofficial wrappers. Reconsider only if the operator publishes a supported public interface and expressly permits the intended metadata use.

#### YouPorn

The official Terms PDF at https://fi1.ypncdn.com/static/cb/bundles/youpornwebfront/docs/ToS-YP-June30.pdf is marked last modified 2025-06-30. It applies to registered and unregistered visitors. Section "Ability to Accept Terms of Service" requires users to be adults and allows the operator to require age-verification information. The license in sections 65–78 is personal-use-only and restricts reproducing, distributing, publicly communicating, linking to, or publicly displaying the Website and Works absent an express exception. Section "Prohibited Uses" expressly bars robots, spiders, and other automatic devices/processes/means used to access the Website for any purpose, including monitoring or copying material, without prior written consent (section 198). No official public API/RSS or third-party metadata aggregation permission was found.

Decision: remove the clickable catalog destination and retain a name-only record pending written permission. Do not implement a Worker Provider, generic HTML adapter configuration, or deep links.

### Batch outcome

- No Provider or search template was added.
- XNXX and XVideos remain external-homepage-only candidates; YouPorn becomes name-only because its Terms expressly restrict linking absent permission.
- No unofficial scraper, HTML extraction, account/session reuse, or access-control workaround was introduced.
- No source activation, KV configuration, Cloudflare deployment, or production setting was changed.


## Provider implementation update — 2026-11-26

The Eporner public API integration has now been implemented in the feature branch.

- Registered `eporner-api` in the compile-time Provider registry as a keyword-only, metadata-only JAV Provider.
- Search requests use the documented API with `thumbs=none`; returned video IDs are checked through the official status endpoint and only `active` records are returned.
- Search metadata is restricted to title, canonical URL, keywords, view count, rating, duration, and the original timezone-unspecified added-time string.
- Embed/player markup, image URLs, downloads, and media fields are neither returned to the UI nor retained in the edge cache. The cache stores an allowlisted metadata projection only.
- Added a shared one-second `eporner` Durable Object lane plus a 60-second exclusive lease, so search, status, and scheduled feed requests cannot overlap across Worker instances. Scheduled sync requests have a 30-second abort bound, shorter than the lease.
- Added a 15-minute Cron Trigger. Each invocation consumes one page of up to 250 removal-feed records, validates it, and advances the opaque cursor only after successful validation.
- The existing `SOURCES_KV` namespace stores only the small sync cursor/timestamp record. No removed-ID list, search result, media, or user data is stored. The Provider fails closed while a continuation cursor is pending or the last completed sync is older than 36 hours.
- Added focused Provider, removal-sync, metadata-cache, and rate-lane tests. They have been added to the Worker test command but have not yet been executed in CI for the current branch head.

The source catalog now marks Eporner as a built-in Provider candidate. Its source and adapter remain unconfigured and disabled: no production KV writes, source activation, Cloudflare deployment, or PR merge has occurred. Before enablement, the 15-minute Cron Trigger and first successful removal-feed sync must be verified in a non-production Cloudflare environment, along with ordinary API connectivity and the project's jurisdiction-specific launch assessment.


## Mikan Project revalidation — 2026-11-26

- The first-party homepage remains publicly accessible and indexable. A current concrete keyword-search page (`https://mikanani.me/Home/Search?searchstr=Rewrite`) was directly inspected and returned public title, subtitle-group, release, size, and magnet-related UI data. This verifies the existing user-facing search template, not permission for Worker-side collection or republication.
- The first-party homepage announcement explicitly describes `mikanime.tv` as a new domain “仅限国内使用” (domestic use only). Treat this as an operator-stated geographic scope. The project must not use that domain as a fallback, redirect users to it, proxy it, or otherwise use it to work around regional availability restrictions; retain the original `mikanani.me` destination only.
- The public `Home/MyBangumi` page presents a personal subscription area and a login prompt. Third-party AutoBangumi documentation describes `/RSS/MyBangumi?token=...` as a user-specific subscription feed. That token represents an individual's subscription list and must not be collected, stored, or used as a shared project feed.
- A per-series `/RSS/Bangumi?bangumiId=...&subgroupid=...` route appears in third-party tutorials and community examples, but I did not find first-party API/RSS documentation confirming its public contract or permission for third-party aggregation.
- Third-party AniBT documentation describes an API token used by a subtitle group to publish/synchronize its own releases to Mikan. This is a publisher-side authenticated workflow, not an anonymous read/search API or permission for this project to query Mikan's catalog.
- The current first-party pages do not expose a clear automation/data-aggregation policy in the reviewed material; the site's `robots.txt` and Terms URLs could not be independently retrieved in this pass. No permission is inferred from the fact that public pages are indexable.

**Decision:** keep Mikan Project as a user-initiated external search destination only. Do not add Worker HTML scraping, shared RSS polling, or a search Provider until the operator publishes a supported public interface and applicable automation/data-use terms or grants explicit permission. Never use a personal MyBangumi token or publisher-side API credential as a shared source. No login automation, proxying, undocumented endpoint probing, or regional restriction evasion.

Updated references:
- https://mikanani.me/ (first-party homepage and domestic-only alternative-domain announcement)
- https://mikanani.me/Home/Search?searchstr=Rewrite (current first-party public search page)
- https://mikanani.me/robots.txt (not retrievable in this review; no policy conclusion drawn)
- https://www.autobangumi.org/en/config/rss.html (third-party personal RSS explanation)
- https://wiki.anibt.net/docs/site-sync/mikan (third-party publisher-side token documentation)

## JAV source revalidation — seventeenth batch (2026-11-26)

This batch rechecked AV01, BestJavPorn, JAV.sb, JAVCL, and JavDoe. It separates operator-published material from third-party technical observations. A reachable homepage, domain registration, or third-party scanner result is not an automated-access contract.

### Decision summary

| Source | New evidence | Current decision | Worker action |
|---|---|---|---|
| AV01 | Operator-controlled `av01tv/url` repository publishes `mirrors.json` for automated mirror-link discovery; its README says the mirrors address regional network interference/censorship | **Official mirror-list integration is permitted for mirror discovery only; no content-search or metadata permission established** | Keep original user-initiated `av01.tv` destination; do not auto-select a regional mirror, proxy, or fetch content |
| BestJavPorn | Third-party scan dated 2026-11-20 observed a challenge-style URL pattern; no first-party Terms/API or metadata-aggregation permission verified | **Automation policy unresolved; challenge evidence is third-party only** | Homepage-only; no Worker fetch, HTML extraction, or challenge handling |
| JAV.sb | Third-party observations report HTTP 403 with Cloudflare challenge indicators; no first-party Terms/API/RSS or metadata permission verified | **Challenge-gated in observed requests; first-party policy unresolved** | Homepage-only; no Worker fetch or challenge bypass in the current phase |
| JAVCL | Existing research fetch returned HTTP 403; no first-party Terms, API/RSS, or stable supported search contract verified | **Policy and interface unresolved** | Homepage-only; no Worker fetch or HTML extraction |
| JavDoe | `.to` domain registration is active, but no first-party canonical-service confirmation, Terms, or supported API/RSS contract was found; third-party reports of regional blocking do not establish source policy | **Canonical service and automation permission unresolved** | Retain existing candidate record; no Worker fetch, mirror substitution, or regional routing |

### Source-specific findings

#### AV01

The operator-controlled repository at https://github.com/av01tv/url identifies itself as the AV01 new-URL announcement page. Its README states that the original `https://www.av01.tv` may be inaccessible in some regions due to network interference/censorship, and that the operator publishes a machine-readable `mirrors.json` for tools that need to integrate mirror links. The current JSON contains one entry, `https://www.av01.media`, with an update date of 2026-04-18.

This is first-party evidence that automated mirror-list discovery is permitted. It is **not** a search API, metadata feed, or permission to crawl the destination. Because the mirror list is explicitly intended to address regional interference/censorship, this project will not automatically switch users to a mirror, proxy around a regional restriction, or make Worker requests to AV01 content. Keep the original user-initiated external destination and preserve the mirror-list repository as provenance/research evidence only.

References:
- https://github.com/av01tv/url
- https://github.com/av01tv/url/blob/master/mirrors.json

#### BestJavPorn

A third-party PCrisk scan dated 2026-11-20 describes a challenge-style URL pattern in the site's observed links. This is a point-in-time third-party technical observation, not first-party documentation of the site's automation policy. No canonical first-party Terms, official API/RSS, or explicit permission for third-party metadata aggregation was verified in this review.

Decision: retain the homepage-only candidate. Do not infer permission from homepage reachability or the absence of malware detections. No Worker fetching, HTML extraction, or challenge handling in the current phase.

References:
- https://bestjavporn.com/
- https://scanner.pcrisk.com/scan-results/bestjavporn.com

#### JAV.sb

Third-party technical observations report HTTP 403 responses with Cloudflare challenge indicators, including a response captured on 2026-03-01. Another third-party scan in October 2026 also recorded HTTP 403. These reports do not establish the site's first-party Terms, a supported public search contract, or permission for metadata aggregation. No first-party API/RSS documentation or written authorization was found.

Decision: retain the homepage-only candidate. Treat challenge-gated requests as a current-phase blocker; do not solve, replay, proxy around, or otherwise defeat the challenge. Keep the source in the future research inventory under Principle 11.

References:
- https://jav.sb/
- https://jav.sb.clearwebstats.com/
- https://zh.gridinsoft.com/online-virus-scanner/url/jav-sb

#### JAVCL

The existing research fetch returned HTTP 403. That response alone does not prove a site-wide prohibition or identify whether the response was generated by the origin, CDN, or an access-control layer. No current first-party Terms, official API/RSS, or stable supported search contract was verified.

Decision: retain the homepage-only candidate. Do not probe undocumented endpoints, attempt alternate request identities, or configure the generic HTML adapter without a verified supported interface and applicable permission.

Reference:
- https://javcl.com/

#### JavDoe

The `javdoe.to` registration record is active through 2028-03-18, but domain registration is not evidence that the current site is operator-controlled, that the catalog domain is the canonical service, or that automated access is permitted. Third-party monitoring reports regional blocking in mainland China; that is not a first-party access policy and does not authorize this project to route around regional restrictions. Similarly named `.us` and `.fun` domains were not confirmed by the operator as canonical successors and must not be substituted.

Decision: retain the existing candidate record and its provenance. No Worker fetching, search-template restoration, alternate-domain substitution, or regional routing.

References:
- https://javdoe.to/
- https://www.whois.com/whois/javdoe.to
- https://en.greatfire.org/domain/javdoe.to

### Batch outcome

- Zero Provider promotions and zero new search templates.
- No source was deleted or silently dropped; all five remain in the source inventory.
- AV01's official mirror-list repository is now recorded as a first-party discovery reference, but it is not treated as a content source or automatic regional fallback.
- BestJavPorn and JAV.sb challenge observations remain clearly labeled as third-party evidence.
- No Worker fetch, HTML scraping, account/session reuse, proxying, regional restriction evasion, or access-control workaround was introduced.
- No KV configuration, source enablement, Cloudflare deployment, or production setting was changed.

## JAV source revalidation — eighteenth batch (2026-11-26)

This batch rechecked JAV Desu, JAV Subtitle, JAV Subtitled, JAVHDPorn.net, and JAVOut. The review keeps exact catalog domains separate from similarly named domains and distinguishes current first-party evidence from historical or third-party technical observations.

### Decision summary

| Source | Evidence found | Current decision | Worker action |
|---|---|---|---|
| JAV Desu | Catalog domain `javdesu.tv` could not be fetched in this review (502 from the research fetch). Search results for `jav-desu.com` refer to a different domain and do not establish the identity or policy of `javdesu.tv`. No first-party Terms, API/RSS contract, or metadata-aggregation permission verified. | **Canonical site and automation policy unresolved** | Retain the exact catalog homepage candidate; no Worker fetch, HTML extraction, or substitute-domain use |
| JAV Subtitle | Catalog domain `javsubtitle.xyz` could not be fetched. Search results surfaced `jav-subtitles.com`, a different domain selling digital subtitle files; its terms are not applicable to `javsubtitle.xyz`. No first-party policy or supported public search/feed contract for the catalog domain verified. | **Canonical site and automation policy unresolved; similarly named commercial site is not evidence** | Retain the exact catalog homepage candidate; no Worker fetch, HTML extraction, or domain substitution |
| JAV Subtitled | The exact domain could not be opened in this review. WHOIS shows a registration record for `javsubtitled.com` through 2027-08-08, but registration and DNS metadata do not establish current site operation, operator identity, automation permission, or a search contract. | **Site operation and automation policy unresolved** | Retain the exact catalog homepage candidate; no Worker fetch or HTML extraction |
| JAVHDPorn.net | A third-party browser privacy scan dated 2026-10-15 reports a live homepage, a linked privacy policy, and a redirect to `www.javhdporn.net`; Cloudflare Radar shows recent certificate records. These are technical observations, not first-party authorization. No current first-party Terms, public API/RSS contract, or permission for third-party metadata aggregation was verified. | **Site appears technically active; automation policy and supported interface unresolved** | Retain the exact catalog homepage candidate; no Worker fetch, HTML extraction, or generic-HTML configuration |
| JAVOut | The exact catalog domain `javout.co` could not be opened. A third-party historical report for `javout.net` reproduces 2020 HTTP headers referencing WordPress REST endpoints on `javout.co`; this is stale, indirect evidence and does not establish a current supported API, operator authorization, or data-use permission. | **Current canonical operation, interface, and automation policy unresolved** | Retain the exact catalog homepage candidate; do not restore a search template or probe undocumented endpoints |

### Source-specific findings

#### JAV Desu

The catalog entry is `https://javdesu.tv`. The current research fetch returned 502. Search results for `jav-desu.com` identify a separate domain with a parked-domain/WHOIS record; there is no verified first-party statement connecting it to `javdesu.tv`. No canonical Terms, official API/RSS documentation, stable public search contract, or written metadata-aggregation permission was established.

Decision: keep the exact `javdesu.tv` candidate and its provenance. Do not substitute `jav-desu.com`, restore a search template, or attempt Worker retrieval.

References:
- https://javdesu.tv/
- https://www.whois.com/whois/jav-desu.com

#### JAV Subtitle

The catalog entry is `https://javsubtitle.xyz`, which could not be opened in this review. Search results surfaced `https://www.jav-subtitles.com/`, a similarly named but different service selling downloadable subtitle files. Its Terms describe personal-use licensing and restrictions on redistribution of purchased files; those terms cannot be attributed to `javsubtitle.xyz` and do not establish an automation policy for the catalog domain.

Decision: preserve `javsubtitle.xyz` as the candidate; do not replace it with `jav-subtitles.com`, add a search template, or configure automated extraction.

References:
- https://javsubtitle.xyz/
- https://www.jav-subtitles.com/terms-and-conditions/
- https://www.jav-subtitles.com/faq/

#### JAV Subtitled

The exact catalog domain `https://javsubtitled.com` could not be opened in this review. A WHOIS record shows a domain registration through 2027-08-08 and Cloudflare nameservers. This establishes only registration/DNS facts; it does not prove the current site is operated by the expected service or that automated access is allowed. No first-party Terms, API/RSS contract, or metadata-aggregation permission was verified.

Decision: retain the exact candidate and do not infer permission from domain registration or DNS configuration. No Worker fetch, HTML extraction, or search-template restoration.

References:
- https://javsubtitled.com/
- https://www.whois.com/whois/javsubtitled.com

#### JAVHDPorn.net

The exact catalog domain is `https://javhdporn.net`. A third-party privacy scan dated 2026-10-15 reports that the homepage redirected to `https://www.javhdporn.net/` and that a privacy policy was linked. Cloudflare Radar records recent certificates for the domain. Neither a privacy policy nor TLS/DNS activity is an automated-access license. The reviewed search material did not establish current first-party Terms, an official public API/RSS, a stable supported search contract, or permission for third-party metadata aggregation.

Decision: retain the homepage candidate, but keep it out of Worker automation. Do not treat the existence of a privacy policy, active certificate, or homepage response as permission to scrape; do not configure generic HTML parsing without a source-supported contract and policy review.

References:
- https://javhdporn.net/
- https://www.javhdporn.net/privacy-policy/
- https://whogetsmydata.com/website/javhdporn.net
- https://radar.cloudflare.com/domains/domain/javhdporn.net

#### JAVOut

The catalog entry is `https://javout.co`, which could not be opened in this review. A third-party historical page for `javout.net` reproduces HTTP headers from 2020 that referenced `https://javout.co/wp-json/` and a WordPress page endpoint. The report is old, indirect, and associated with a different host; it does not establish that those endpoints remain available, are intended as a search API, or may be used for third-party aggregation. No current first-party Terms or API/RSS/data-use permission was verified.

Decision: retain the exact `javout.co` candidate. Do not restore a search template or call undocumented WordPress endpoints based on historical third-party headers.

References:
- https://javout.co/
- https://javout.net.clearwebstats.com/

### Batch outcome

- Zero Provider promotions and zero search templates restored.
- All five exact catalog candidates remain in the source inventory; none was deleted or replaced by a similarly named domain.
- The `jav-subtitles.com` Terms were explicitly kept separate from the unrelated `javsubtitle.xyz` catalog candidate.
- Third-party technical records for JAVHDPorn and historical JAVOut headers were recorded as technical observations only, not permission.
- No Worker fetch, HTML scraping, undocumented endpoint probing, account/session reuse, proxying, regional restriction evasion, or access-control workaround was introduced.
- No KV configuration, source enablement, Cloudflare deployment, or production setting was changed.

## JAV source revalidation — nineteenth batch (2026-11-26)

This batch rechecked JavBus, JAVSeen, JAVTsunami, MissAV, and SupJAV. It distinguishes a source's own terms from third-party availability observations and records the explicit jurisdictional restriction published by MissAV.

### Decision summary

| Source | Evidence found | Current decision | Worker action |
|---|---|---|---|
| JavBus | The site returned an age-verification page in the third-party browser scan dated 2026-10-15. That scan reports the site's own `robots.txt` asks automated tools not to load its privacy-policy URL. The canonical policy itself was therefore not reviewed; no API/RSS or aggregation permission verified. | **Age gate and policy review unresolved; no access-gate handling** | Keep original homepage as user-initiated external destination; no Worker fetch, no age-gate automation, and no attempt to load the robots-excluded policy |
| JAVSeen | Its homepage links to a Terms page whose text identifies Sun Media Limited as operator of Javhd.today, not clearly Javseen.tv. The linked terms (last revised 2015-03-19) restrict use to personal purposes and prohibit automated systems from using the service or obtaining information; the scope mismatch remains unresolved. Homepage also tells users in blocked countries to use a backup domain. | **Treat automated access as disallowed pending scope clarification; backup domain is not an approved regional fallback** | Keep the original JAVSeen homepage only; no Worker fetch, no terms-based assumption of permission, and no automatic switch to Javseenz.TV |
| JAVTsunami | A third-party browser privacy scan dated 2026-10-22 observed a live homepage and linked privacy policy, but did not establish first-party Terms, an API/RSS contract, or metadata-aggregation permission. The current research fetch timed out. | **Technically observed as live; automation policy and supported interface unresolved** | Retain original homepage link; no Worker fetch or HTML extraction |
| MissAV | The exact `missav.ws` site exposes a public search form and a Terms page. The Terms explicitly say United States visitors are not allowed to browse, view videos, or click advertisements, and instruct US visitors to leave. No permission for third-party metadata aggregation was found. | **Explicit US jurisdiction restriction; do not expose to US users unless a lawful, reliable jurisdiction gate and launch review are in place** | No Worker fetch or search template. Retain the candidate in inventory, but do not configure it as a generally visible external-search source while the product has no jurisdiction-aware visibility control |
| SupJAV | The exact homepage returned 403 to the research fetch. A third-party GreatFire record reports the domain blocked in mainland China as of 2026-10-03; this does not establish an operator policy or authorize routing around the block. No first-party Terms/API/RSS permission verified. | **Availability and policy unresolved; regional block is not permission to route around it** | Retain original homepage candidate; no Worker fetch, mirror substitution, proxying, or regional routing |

### Source-specific findings

#### JavBus

The exact catalog domain is `https://www.javbus.com`. A third-party browser scan dated 2026-10-15 received an age-verification page at `/doc/driver-verify`. The same scan reports that the site's robots policy asks automated tools not to load `/doc/privacy`; it therefore did not read the privacy policy. This is a path-specific robots observation, not evidence that every site path is disallowed, but it prevents treating the unreviewed policy as evidence of permission. No official public API/RSS contract or third-party metadata-aggregation permission was established.

Decision: retain the original homepage as a user-initiated destination. Do not automate age verification, load the robots-excluded policy, or configure Worker retrieval without a supported public interface and a source-specific permission review.

References:
- https://www.javbus.com/
- https://www.javbus.com/robots.txt
- https://whogetsmydata.com/website/javbus.com

#### JAVSeen

The exact homepage `https://javseen.tv` is reachable in the research fetch and links to `/static/terms/`. The homepage says some countries have blocked the site and directs users to a backup domain, `javseenz.tv`. The linked Terms page, however, describes an agreement between the user and Sun Media Limited as operator of Javhd.today, says the terms govern Javhd.today and other services provided by that operator, and was last revised on 2015-03-19. It requires personal use, prohibits automated systems/software/devices from using the service or obtaining information, and prohibits defeating or interfering with security features. The Terms page is linked from JAVSeen, but it does not clearly identify JAVSeen.tv in its defined service scope.

Decision: do not implement automated retrieval. Treat the linked prohibition as a blocker unless the operator clarifies its applicability to JAVSeen.tv. Keep the original user-initiated JAVSeen destination; do not automatically follow the backup-domain recommendation because it is explicitly framed as a response to country-level blocking.

References:
- https://javseen.tv/
- https://javseen.tv/static/terms/

#### JAVTsunami

The exact homepage `https://javtsunami.com` timed out in the current research fetch. A third-party browser privacy scan dated 2026-10-22 reports that it observed the homepage and several linked pages, including a privacy policy. A privacy policy is not an automated-access permission, and the scan does not establish a stable supported search API/RSS contract or first-party permission for third-party metadata aggregation.

Decision: retain the original homepage candidate. Do not infer permission from the third-party scan or configure generic HTML parsing without current first-party terms, a supported search contract, and a source-specific review.

References:
- https://javtsunami.com/
- https://javtsunami.com/privacy-policy
- https://whogetsmydata.com/website/javtsunami.com

#### MissAV

The exact catalog domain `https://missav.ws` is reachable and exposes a public search interface. Its own Terms page at `/en/terms` states that United States visitors are not allowed to browse the site or click/view videos and advertisements, describes IP-address blocking and warning dialogs, and instructs US visitors to leave immediately. The Terms also describe the service as a user-uploaded video-sharing site and provide a copyright complaint process. The presence of a public search form does not grant this project permission to aggregate metadata, and no such permission was found.

The similarly named `missavweb.com` privacy-policy result is a different domain and is not used as policy evidence for `missav.ws`.

Decision: do not implement Worker retrieval or restore a search template. Because the product currently has no jurisdiction-aware source visibility control and the Terms expressly exclude US visitors, do not configure MissAV as a generally visible external-search source for a US launch. Keep its catalog record for future jurisdiction-specific review; no global deletion or blanket adult-category filtering.

References:
- https://missav.ws/
- https://missav.ws/en/terms
- https://www.whois.com/whois/missav.ws
- https://missavweb.com/privacy-policy/ (different domain; not applicable to missav.ws)

#### SupJAV

The exact catalog domain `https://supjav.com` returned 403 to the current research fetch. A third-party GreatFire record reports that the domain was blocked in mainland China, with its latest listed test dated 2026-10-03. This is a third-party regional availability observation, not a first-party access policy or permission to use a proxy, alternate domain, or other route around the block. A WHOIS record shows registration and DNS data only. No first-party Terms, official API/RSS contract, or metadata-aggregation permission was verified.

Decision: retain the exact candidate and original homepage. Do not substitute a similarly named domain, route around regional blocking, or configure Worker retrieval.

References:
- https://supjav.com/
- https://www.whois.com/whois/supjav.com
- https://en.greatfire.org/domain/supjav.com

### Batch outcome

- Zero Provider promotions and zero search templates added or restored.
- All five candidates remain in the inventory; none was deleted or replaced with a backup/similarly named domain.
- MissAV's explicit US visitor restriction is recorded as a jurisdiction-specific visibility gate, not a reason to hide adult sources globally.
- JAVSeen's linked automated-access prohibition is recorded with its unresolved domain-scope mismatch; its backup-domain prompt is not treated as authorization to route around country blocking.
- Third-party privacy scans, WHOIS records, and regional availability observations are not treated as first-party automation permission.
- No Worker fetch, HTML scraping, age-gate automation, undocumented endpoint probing, account/session reuse, proxying, regional restriction evasion, or access-control workaround was introduced.
- No KV configuration, source enablement, Cloudflare deployment, or production setting was changed.

## JAV source revalidation — twentieth batch (2026-11-26)

This batch reviewed DMM/FANZA, JavDB, JAVLeak, JavLibrary, and JavMost. The review distinguishes official API availability from the right to use the API for this project's particular product, and distinguishes a public search UI from permission to aggregate its results.

### Decision summary

| Source | Evidence found | Current decision | Worker action |
|---|---|---|---|
| DMM / FANZA | Official FANZA help says DMM Web Services requires a DMM member account, DMM Affiliate registration, and API-use registration; the API ID is issued after registration. The official API endpoint redirected the current research fetch to a regional unavailability page. Full current API terms and whether this non-affiliate metadata-search product fits the permitted use were not verified. | **Official affiliate API exists, but project eligibility and use restrictions are unresolved** | Do not implement or configure credentials until the complete current API terms and project use case are reviewed; no assumption that registration alone authorizes general metadata aggregation |
| JavDB | First-party Terms prohibit collecting/harvesting information about users and prohibit using the site to promote or operate a service without prior written consent. They do not, in the reviewed text, clearly grant or separately define permission for this project's metadata aggregation. | **Prior written consent is a project integration gate** | No Worker fetch or metadata extraction absent written consent that covers this service |
| JAVLeak | Exact homepage is live and exposes a search input, an Advanced Search link, and paginated metadata. No Terms, Privacy policy, official API/RSS contract, stable supported search URL, or explicit third-party aggregation permission was found in the retrieved homepage. | **Public search UI observed; data-use permission and supported interface unresolved** | Homepage-only; no Worker scraping, undocumented endpoint probing, or generic HTML adapter configuration |
| JavLibrary | Exact `www.javlibrary.com` homepage returned 403 to the current research fetch. No current first-party Terms, official API/RSS contract, or metadata-aggregation permission was verified. A fetcher-side 403 does not establish the site's global availability or access policy. | **Current site policy and supported interface unresolved** | Keep existing candidate; no Worker fetch, cookie/session reuse, or alternate-route probing |
| JavMost | The previously recorded `javmost.com` redirect to `javmost.ws` remains unverified as a canonical operator-controlled migration. Current research could not retrieve `javmost.ws`. The previously reviewed Legal page was a 18 U.S.C. §2257 compliance statement, not Terms or an automation policy. | **Canonical domain, current terms, and supported interface unresolved** | Keep original catalog record and provenance; no domain substitution, search-template restoration, or Worker fetch |

### Source-specific findings

#### DMM / FANZA

The official FANZA help article says product data for affiliate use is available through DMM Web Services and explicitly lists three prerequisites: DMM membership, DMM Affiliate registration, and API-use registration. A separate official help article says API registration issues an API ID. These establish an official affiliate API and its registration prerequisites; they do not by themselves establish that a general-purpose third-party metadata search aggregator is an allowed use.

The official API landing page redirected this research fetch to DMM's regional-unavailability notice. Therefore the current full Web Service Terms, permitted display/use cases, credit requirements, retention rules, and any restrictions on combining DMM data with other sources could not be independently checked in this review. A third-party article discussing the September 2026 terms is not treated as a substitute for the official terms.

Decision: keep DMM/FANZA as a candidate, but do not implement it yet. Before implementation, obtain and review the current official API terms and confirm whether this project must become an affiliate site, display DMM-specific credits/links, or segregate DMM-derived results from other providers. Do not treat "API registration available" as blanket authorization. No paid third-party API is being proposed; the unresolved point is the official affiliate program's eligibility and usage conditions.

References:
- https://support.fanza.jp/affiliate/article/44538
- https://support.fanza.jp/affiliate/article/48053
- https://affiliate.dmm.com/api/ (research fetch redirected to a regional unavailability notice)
- https://adafi-tips.com/posts/00078/ (third-party discussion only; not used as authoritative permission)

#### JavDB

The first-party Terms at `https://javdb.com/terms` prohibit collecting or harvesting information about other users and prohibit using the site or its facilities to promote or operate a service without the operator's prior written consent. The Terms also prohibit commercial use of the service/content. These clauses are directly relevant to a public multi-source search service, even though they are not a blanket statement that every form of automated access is prohibited.

Decision: do not add a JavDB Provider, HTML adapter, or search template. Written permission must explicitly cover operating this metadata-search service and the intended collection/display of JavDB metadata. The research fetch of the Terms page returned 403 after search indexing, but the first-party indexed Terms text was available and is recorded as the source of the clauses above.

References:
- https://javdb.com/terms
- https://javdb.com/privacy

#### JAVLeak

The exact homepage `https://javleak.com/` is retrievable. It displays a search input, an Advanced Search link, studio navigation, and paginated title/metadata listings. The retrieved page did not contain Terms or Privacy links/text, and no official API/RSS documentation or stable, source-documented search URL was established. The visible search form is evidence of a user-facing feature, not permission for automated third-party aggregation.

Decision: retain the original homepage candidate and existing provenance. Do not infer a query URL from the form or use undocumented WordPress/search endpoints. No Worker fetching, HTML extraction, or generic HTML adapter configuration.

References:
- https://javleak.com/

#### JavLibrary

The exact catalog URL `https://www.javlibrary.com/` returned 403 to the current research fetch. No current first-party Terms, official API/RSS documentation, supported public search contract, or permission for third-party metadata aggregation was established. The fetch result is a property of this research access path and is not proof of a universal block or a site policy.

Decision: retain the candidate and existing provenance; do not try alternate paths, cookies, browser sessions, or challenge handling to obtain access. No Worker fetching or metadata extraction.

References:
- https://www.javlibrary.com/

#### JavMost

The catalog record currently points to `https://javmost.com`; previous review observed a redirect toward `javmost.ws` / `www.javmost.ws`, but the redirect was not verified as a canonical operator-controlled migration. The current research fetch could not retrieve `https://javmost.ws/`. The previously reviewed Legal page was a U.S. 18 U.S.C. §2257 compliance statement; that statement is not Terms of Service, an API contract, or an automation permission.

Decision: keep the original `javmost.com` candidate and its provenance. Do not silently rewrite it to `.ws`, restore a search template, or automate retrieval.

References:
- https://javmost.com/
- https://javmost.ws/
- https://www.javmost.ws/

### Batch outcome

- Zero Provider promotions and zero search templates added or restored.
- All five candidates remain in the source inventory.
- DMM/FANZA is recorded as an official affiliate API candidate with registration and use-condition gates, not as an immediately usable generic public API.
- JavDB's prior-written-consent requirement is recorded precisely; no broader blanket scraping prohibition is inferred.
- JAVLeak's visible search UI is not treated as permission to aggregate its results.
- JavLibrary/JavMost fetch failures are not misrepresented as site-wide blocks or permission evidence.
- No Worker fetch, HTML scraping, undocumented endpoint probing, account/session reuse, proxying, regional restriction evasion, or access-control workaround was introduced.
- No KV configuration, source enablement, Cloudflare deployment, or production setting was changed.

## Non-JAV index source revalidation — twenty-first batch (2026-11-26)

This batch revisited five name-only or domain-ambiguous candidates from the FetchJAV inventory: 85Tube, AApp11, HAnime XYZ, MIEN321, and PornJP. FetchJAV's public repository lists these names among additional supported sites, but a third-party adapter list is provenance for candidate discovery, not first-party domain identity or permission to reuse its extraction behavior.

### Decision summary

| Candidate | Evidence found | Current decision | Project action |
|---|---|---|---|
| 85Tube | A third-party article dated 2026-11-17 claims 85Tube is an older brand/name associated with 85PO and that 85tube.com redirects to 85ro.com. Another third-party scan reports 85PO Terms identify only "85PO" as operator. No operator-controlled first-party statement connecting 85Tube to 85PO/85RO or authorizing aggregation was verified. | **Possible brand/domain relationship, not first-party verified** | Preserve 85Tube and its prior provenance; do not replace its name-only record with 85PO/85RO or automate retrieval |
| AApp11 | FetchJAV lists AApp11 as an additional site but supplies no canonical domain in the reviewed site table. Search results for aapp11.com and aapp11.xyz are third-party domain/safety records; no first-party link ties either to the FetchJAV candidate. | **Canonical domain unresolved** | Keep name-only; do not infer or add aapp11.com / aapp11.xyz |
| HAnime XYZ | FetchJAV lists HAnime XYZ as an additional site, but no canonical domain or first-party operator source was found. Similar names such as hanime.moe are not evidence of identity. | **Canonical domain unresolved** | Keep name-only; do not substitute another HAnime service |
| MIEN321 | FetchJAV lists MIEN321 as an additional site. Third-party domain relationship pages mention mien321.cc and mien321.xyz, but do not establish either as the current canonical site or connect it to the same operator. No first-party Terms/API/RSS/search contract found. | **Possible historical domain leads only** | Keep name-only; do not add .cc/.xyz domains or use third-party adapters |
| PornJP | FetchJAV lists PornJP as an additional site, but the search did not identify a verifiable first-party canonical domain, operator, Terms, public API/RSS, or supported search interface. | **Canonical domain unresolved** | Keep name-only; do not guess a domain or substitute similarly named sites |

### Source-specific findings

#### 85Tube

FetchJAV's public repository lists 85Tube among additional sites. A third-party Japanese article published 2026-11-17 describes 85PO as a newer name associated with 85XO/85TUBE and claims that `85tube.com` redirects to `85ro.com`; a third-party scan also describes 85PO terms that identify only "85PO" as operator. These reports are leads, not an operator-controlled canonical-domain announcement. They do not establish that the operator authorizes third-party indexing or metadata aggregation.

Decision: retain the existing 85Tube candidate and the previously recorded uncertainty around `85ro.com`. Do not rename it to 85PO, add sibling domains, switch users to a new domain, or configure Worker retrieval based on third-party reports.

References:
- https://github.com/FetchJAV/FetchJAV_Public
- https://min-ero.jp/85tube-review/
- https://tools.malwaretips.com/url-scan/85po.net

#### AApp11

FetchJAV's public repository lists AApp11 as an additional site but does not identify a canonical URL in the reviewed list. Search results for `aapp11.com` and `aapp11.xyz` are third-party domain/safety records, not first-party evidence that either is the source used by FetchJAV. No verified operator-controlled page, current Terms, public API/RSS, or stable search route was found.

Decision: retain AApp11 as a name-only candidate. Do not add a guessed domain or copy FetchJAV's site adapter.

References:
- https://github.com/FetchJAV/FetchJAV_Public
- https://www.siteconfiavel.com.br/site/aapp11-com
- https://webrate.org/site/aapp11.xyz/

#### HAnime XYZ

FetchJAV's public repository lists HAnime XYZ among additional sites but provides no canonical URL in the reviewed site table. Search did not identify a first-party operator page that establishes a domain or policy. Similar names, including hanime.moe, remain separate services unless a first-party statement proves otherwise.

Decision: retain the name-only candidate; do not guess a domain or reuse HanimeTV/Hanime1 routes.

References:
- https://github.com/FetchJAV/FetchJAV_Public

#### MIEN321

FetchJAV lists MIEN321 as an additional site. Third-party relationship data references `mien321.cc`, and other domain-index results mention `mien321.xyz`; neither source identifies the operator or proves which domain, if any, is canonical today. No first-party Terms, public API/RSS, supported search interface, or permission for third-party metadata aggregation was verified.

Decision: preserve the name-only entry. Do not add `.cc` or `.xyz` to the public catalog, and do not reuse a third-party downloader's adapter.

References:
- https://github.com/FetchJAV/FetchJAV_Public
- https://builtwith.com/relationships/mien321.cc
- https://www.findit.co.in/domains/178406/c29d8e4c941e590e34d529623298f19f/

#### PornJP

FetchJAV lists PornJP among additional sites, but the current search did not identify a first-party canonical URL or operator-controlled policy. Search results were either unrelated or insufficient to connect a domain to the exact FetchJAV candidate. No official API/RSS contract or stable public search interface was established.

Decision: retain the name-only candidate and its FetchJAV provenance. Do not guess a domain or substitute similarly named websites.

References:
- https://github.com/FetchJAV/FetchJAV_Public

### Batch outcome

- Zero Provider promotions and zero search templates added or restored.
- All five candidates remain in the 102-entry source inventory.
- No name-only entry was silently converted into a live URL based on third-party domain indexes.
- FetchJAV's list remains useful as source-discovery provenance, but its downloader adapters are not treated as authorization or copied into this metadata-only project.
- No Worker fetch, HTML scraping, undocumented endpoint probing, account/session reuse, proxying, regional restriction evasion, or access-control workaround was introduced.
- No KV configuration, source enablement, Cloudflare deployment, or production setting was changed.


## JAV source revalidation — twenty-second batch (2026-11-26)

This batch rechecked five remaining JAV candidates or previously reviewed entries where first-party terms, current site behavior, or regional constraints materially affect the project's external-link and metadata-search decisions.

### Decision summary

| Candidate | New evidence | Decision |
|---|---|---|
| JAV.guru | First-party Terms are available. They limit use to personal purposes, prohibit unauthorized framing/linking and commercial use absent approval, prohibit copying/redistribution of site content without prior written consent, and expressly permit links to site materials for personal, non-commercial purposes. | Retain the existing user-initiated external search entry only. Do not implement Worker fetching, metadata extraction, or content reuse. The Terms do not grant general-purpose aggregation rights. |
| JAVDatabase | First-party March 2026 site update says movie data is sourced from Japanese sites and manually edited; it also states traffic from the UK, Australia, and France is blocked because the operator does not intend to implement the age-verification requirements there. No first-party public API/feed or third-party aggregation permission was verified. | Retain homepage-only external access. Do not use third-party Stash/FetchJAV scrapers or paid javinfo API. Do not route around regional restrictions. |
| JableTV | First-party Terms (last revised 2019-03-28) permit links to site materials for personal, non-commercial purposes, while restricting unauthorized linking/framing and copying/redistribution. The Terms do not document a public metadata API/feed or authorize third-party metadata aggregation. | Keep the current external destination only; no Worker fetching or metadata extraction. Do not restore an unverified search template. |
| Jable.org | Current third-party domain monitoring reports HTTP 401, a generated `ww547.jable.org` redirect host, and robots disallowing the site. These are third-party observations, not first-party canonical identity, mirror authorization, or a supported interface. | Keep name-only. Do not substitute JableTV, follow generated redirect hosts, or attempt to bypass the 401. |
| JAV Ass Lover | Current research fetch still could not retrieve the canonical homepage (HTTP 403); no first-party current Terms, API/RSS, or supported search contract was verified. A third-party scan/WHOIS record is not operator permission. | Retain the original homepage candidate; no Worker fetching, HTML extraction, or search template until first-party terms and a supported interface are established. |

### Source-specific evidence

#### JAV.guru

The first-party Terms describe the service as personal-use and prohibit commercial use absent specific approval. They prohibit unauthorized framing/linking and copying, reproduction, distribution, or other exploitation of site content without prior written consent. A separate clause permits links to materials for personal, non-commercial purposes. This supports a narrow user-initiated external-link use, not a Worker metadata collector or redistribution of site content.

References:
- https://jav.guru/terms/

#### JAVDatabase

The first-party site update dated 2026-03-12 says its movie data is sourced from Japanese sites and manually edited. It also explicitly says traffic from the UK, Australia, and France has been blocked because the operator considered the relevant age-verification requirements unsustainable. The project must preserve that restriction and must not use alternate routes, proxies, or other means to reach blocked users. The first-party page does not publish an API/feed contract or grant third-party metadata aggregation permission.

A third-party Stash scraper documents a search URL and XPath selectors, but this is implementation evidence only. It does not establish permission or a stable first-party API. A third-party paid API is excluded under the no-paid-services rule.

References:
- https://www.javdatabase.com/2026/03/12/site-update-data-improvements-improved-homepage-better-image-galleries-international-blocking/
- https://github.com/stashapp/CommunityScrapers/blob/master/scrapers/JavDatabase.yml
- https://javinfo.dev/zh/blog/javdatabase-provider (third-party paid service; not eligible)

#### JableTV

The first-party Terms page is dated 2019-03-28. It allows linking to site materials for personal, non-commercial purposes, but also prohibits unauthorized linking/framing and content copying/redistribution. No first-party API/RSS contract or permission for third-party metadata aggregation was established in this review. The existence of a user-facing search field does not, by itself, authorize Worker collection or establish a durable search-template contract.

References:
- https://jable.tv/terms/

#### Jable.org

A third-party monitor currently reports HTTP 401, a redirect to a generated `ww547.jable.org` hostname, and a robots rule disallowing the entire site. These observations do not establish an operator-controlled canonical domain or permitted public interface. FetchJAV's inherited adapter is not first-party authorization.

References:
- https://siteinfo.verkosta.info/jable.org
- https://github.com/FetchJAV/FetchJAV_Public

#### JAV Ass Lover

The current research fetch could not retrieve `https://javass.love/` or its attempted Terms path. No current first-party Terms, API/RSS documentation, or stable supported search route was found. Third-party domain and hosting records only indicate historical or technical metadata; they do not establish an active permitted automation interface.

References:
- https://javass.love/
- https://javass.love/terms/

### Batch outcome

- Zero Provider promotions and zero new search templates.
- JAV.guru remains a user-initiated external-search candidate under its narrow personal/non-commercial linking terms; no automated collection or content reuse.
- JAVDatabase remains homepage-only; its stated UK/Australia/France blocking is preserved as an explicit restriction, not a problem to route around.
- JableTV remains an external destination only; no metadata automation.
- Jable.org remains name-only and separate from JableTV.
- JAV Ass Lover remains a candidate with unresolved first-party terms and interface evidence.
- All five candidates remain in the durable source inventory.
- No access-control bypass, account/session reuse, proxying, undocumented endpoint probing, Worker fetch, KV change, source enablement, or Cloudflare deployment was introduced.


## JAV source revalidation — twenty-third batch (2026-11-26)

This batch reviewed five additional JAV catalog entries: JAV.sb, JAVCL, JavDoe, BestJavPorn, and AV01. The review distinguishes first-party operator evidence from third-party observations, userscript routes, domain-registration records, and upstream mirror-list tooling.

### Decision summary

| Candidate | Evidence found | Decision |
|---|---|---|
| JAV.sb | Third-party monitoring describes the site as an adult-video index and reports HTTP 403 in one scanner. No first-party Terms, privacy policy, API/RSS contract, or third-party metadata-collection permission was verified. | Retain the existing candidate as an external homepage reference only; no Worker fetch, alternate route, or challenge handling. |
| JAVCL | A community userscript documents a /search/{query}/ route, and a third-party subtitle tool currently lists javcl.com. Neither is an operator-controlled search/API contract or permission for metadata aggregation. No first-party current Terms or automation permission was verified. | Keep homepage-only; do not restore a search template or copy third-party extraction behavior. |
| JavDoe | WHOIS confirms the javdoe.to registration record is active through 2028, but domain registration does not establish the operator's current service, terms, or automated-access permission. Third-party regional-block measurements are not operator policy. | Preserve the existing candidate and canonical-domain uncertainty; no alternate-domain substitution, Worker fetching, or regional routing. |
| BestJavPorn | A third-party privacy scan of the homepage and linked category/performer pages found no privacy policy. It does not establish terms, API/RSS, or permission for third-party metadata aggregation. A third-party challenge-style scan is not first-party policy evidence. | Keep homepage-only; no Worker fetching, HTML extraction, or challenge handling. |
| AV01 | The operator-associated av01tv/url repository says its JSON mirror list may be consumed by automated tools, but the stated purpose is mirror discovery because the original site may be inaccessible in some regions. It does not authorize content search or metadata extraction. | Retain only the original user-initiated destination. Do not automatically switch to mirrors, proxy users, or fetch site content. |

### Source-specific findings

#### JAV.sb

Third-party reports identify jav.sb as a JAV streaming/index site. One scan reported HTTP 403; another reports a valid certificate and active domain. These are technical observations and do not establish an operator identity, current Terms, a supported public search contract, or permission for this project to collect metadata. A successful or failed third-party scan is not authorization.

Decision: preserve the existing candidate and provenance. No Worker requests, alternate-route probing, cookies, browser-session reuse, HTML extraction, or challenge handling.

References:
- https://jav.sb/
- https://tools.malwaretips.com/url-scan/jav.sb
- https://gridinsoft.com/online-virus-scanner/url/jav-sb

#### JAVCL

A third-party userscript lists https://javcl.com/search/{code}/ as a search route. A separate subtitle-tool directory lists javcl.com as a supported site. Neither is controlled by the operator, and neither establishes that the route is stable, permitted for third-party aggregation, or suitable for Worker automation. No first-party current Terms/API/RSS or explicit metadata-use permission was verified.

Decision: keep the source homepage-only. Do not add the community userscript route as a catalog search template and do not reuse its extraction logic.

References:
- https://javcl.com/
- https://sleazyfork.org/en/scripts/443200-onejavoneweb-revise/code
- https://miraisub.com/en/supported-sites/

#### JavDoe

A WHOIS record shows javdoe.to registered since 2022 and currently set to expire in 2028. This is domain-registration evidence only; it does not prove a currently operated canonical service, operator identity, current Terms, or permission for automated metadata access. A third-party regional measurement reports mainland-China blocking, but that is not a first-party access policy and cannot justify alternate routing.

Decision: retain the existing javdoe.to candidate. Do not substitute similarly named .us or .fun domains, use proxies, or implement automated retrieval.

References:
- https://www.whois.com/whois/javdoe.to
- https://en.greatfire.org/domain/javdoe.to

#### BestJavPorn

A third-party privacy scan dated 2026-11-06 reviewed the homepage and several linked pages and reported that it found no privacy policy. The scan is not a legal review and does not establish whether other terms exist; it also does not grant or deny permission for metadata aggregation. No first-party API/RSS contract or express automation permission was verified. Third-party challenge-style observations are not permission to solve or bypass a challenge.

Decision: retain the homepage candidate only. No Worker fetch, HTML extraction, challenge handling, or undocumented endpoint probing pending first-party terms and a supported public interface.

References:
- https://www.bestjavporn.com/
- https://whogetsmydata.com/scan/157908

#### AV01

The operator-associated public repository av01tv/url states that the original site may be inaccessible in some regions and publishes a synchronized mirrors.json for developers or users wishing to integrate mirror links into automated tools. This is a narrow permission to consume the mirror-link list, not permission to automatically route end users around regional restrictions, proxy requests, search or extract site content, or aggregate metadata. The project's current source-catalog policy separately prohibits routing users to mirrors as a way around regional restrictions.

Decision: retain only the original https://www.av01.tv user-initiated external destination. Do not fetch AV01 content or automatically switch to any listed mirror. If a future phase considers mirror-list metadata for display, it must be separately reviewed for jurisdiction, user choice, and product-policy compatibility; it is not approved by this review.

References:
- https://github.com/av01tv/url
- https://github.com/av01tv/url/blob/main/mirrors.json

### Batch outcome

- Zero Provider promotions and zero search templates added or restored.
- All five sources remain in the durable candidate inventory.
- Third-party scripts, domain records, monitoring scans, and subtitle-tool support lists remain technical/discovery evidence only.
- AV01's narrow mirror-list integration permission is not expanded into permission to fetch content or route users around regional restrictions.
- No access-control bypass, account/session reuse, proxying, undocumented endpoint probing, Worker fetch, KV change, source enablement, Cloudflare deployment, or production setting was introduced.



## JAV source revalidation — twenty-fourth batch (2026-11-26)

This focused follow-up revalidates the existing `r/JAV` external-search entry against Reddit's current first-party platform policies. It distinguishes a user-initiated navigation link from project-operated collection of Reddit content.

### Decision summary

| Candidate | Current first-party evidence | Decision |
|---|---|---|
| r/JAV | Reddit's Data API Terms were last revised 2026-07-20. The current Responsible Builder Policy requires explicit approval before accessing Reddit data through its API; Reddit's anti-scraping guidance prohibits scraping without an authorized agreement. API use also requires accurate identification/OAuth access information, compliance with API limits, and adherence to content-use, removal, privacy, and attribution obligations. | Keep the existing user-initiated external search link only. No Reddit HTML fetching, undocumented endpoint use, RSS/API polling, post/comment metadata collection, or Provider implementation. |

### Source-specific findings

#### r/JAV

Reddit's first-party Data API Terms (last revised 2026-07-20) state that API access requires identification information and that clients must use the access information specified in the Developer Documentation, including OAuth credentials, without masking the user agent or OAuth identity. Reddit may impose API limits at its discretion. The terms permit copying and displaying user content through the Data API only as necessary to operate the approved app, subject to user-content rights and other applicable restrictions; they do not grant general rights to reuse the content for unrelated purposes. They also require an app privacy policy and impose removal/deletion obligations.

The current first-party Responsible Builder Policy says explicit approval is required before accessing Reddit data through its API. Reddit's current anti-abuse guidance separately prohibits scraping without an authorized agreement and bypassing technical guardrails. Reddit's developer access guidance states that commercial use, including monetized products/services and publishing Reddit content on monetized sites/apps, requires Reddit's permission and a contract. These requirements are materially more specific than the older general note and make clear that a public subreddit/search page is not permission for automated collection.

The project does not have an approved Reddit API integration or written authorization for this metadata-search product. The existing catalog template points users to Reddit's own search page; it does not cause the Worker to fetch Reddit or collect its results. The current availability/status of the `r/JAV` community itself could not be independently confirmed in this review: a third-party 2025 discussion about a temporary ban is stale and is not evidence of the current state.

Decision: preserve `https://reddit.com/r/jav/search?q={query}` as a user-initiated external-navigation option, subject to ordinary destination availability. Do not add a Reddit Provider, fetch HTML, poll RSS, call undocumented endpoints, reuse browser sessions, or collect Reddit posts/comments. Any future API proposal must first obtain explicit Reddit approval for the exact product use case and review current API terms, OAuth/identity requirements, app privacy disclosures, content display and removal duties, attribution, retention/deletion, rate limits, and any commercial-use contract or fees.

References:
- https://redditinc.com/policies/data-api-terms (first-party Data API Terms; last revised 2026-07-20)
- https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy (first-party policy; explicit approval requirement)
- https://support.reddithelp.com/hc/en-us/articles/360043512931-Don-t-break-the-site (first-party anti-scraping and platform-integrity guidance)
- https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data (first-party developer access and commercial-use guidance)
- https://www.reddit.com/dev/api/ (first-party API documentation for subreddit search and rules endpoints)
- https://www.reddit.com/r/BannedSubs/comments/1ii88m0/ (third-party 2025 discussion only; not used to establish current community status)

### Batch outcome

- Zero Provider promotions and zero search-template changes.
- The existing r/JAV external-search template is retained as user-initiated navigation only.
- Reddit's current API approval, OAuth identity, content-use, removal, privacy, rate-limit, attribution, and commercial-use gates are recorded.
- The current subreddit availability was not inferred from stale third-party reports.
- No Reddit HTML/API/RSS request, scraping, account/session reuse, access-control workaround, KV mutation, source enablement, Cloudflare deployment, or production setting was introduced.


## Anime-source revalidation — 2026-11-26

### DMHY — existing Provider retained; no duplicate implementation

- The first-party FAQ lists the public RSS endpoint as `http://share.dmhy.org/topics/rss/rss.xml` and documents keyword-filtered RSS via `?keyword=`; it also documents team, category, and uploader-specific feed variants. The FAQ prints HTTP URLs; the existing Provider's HTTPS request behavior is an implementation choice, not a separately documented endpoint guarantee.
- The same FAQ describes the service as free and says publications should focus on anime, tokusatsu, and Japanese drama; it prohibits real-person adult pornography. Keep DMHY classified as anime, not JAV.
- The existing `dmhy-rss` v1.0.0 implementation and its bounded RSS parsing, BTIH validation, and canonical detail-link handling remain the appropriate implementation. Do not create a second adapter or expand it to undocumented endpoints.
- The FAQ documents RSS subscription behavior, but this alone is not a comprehensive third-party aggregation licence. No numeric quota was established by the FAQ.
- **Decision:** retain the existing Provider as implemented but disabled. Before any enablement, complete current Terms/robots review, conservative pacing validation, source/content review, and live non-production Cloudflare Worker connectivity verification. No source activation, KV write, or deployment is authorized by this review.

### Shana Project — public feed is latest-only, not keyword search

- First-party RSS help states that the main public feed contains only the most recent 50 releases.
- The user's public feed contains the most recent 20 items added to that user's follows; the secure private feed contains up to 50 not-yet-downloaded follow items and marks an item downloaded when fetched.
- First-party follows help says follows are available only to registered users. The private feed is explicitly intended for the account holder's torrent client.
- These feeds are not a public keyword-search API or a general catalogue feed. Do not reuse private or account-bound feeds, request user tokens, or treat the latest-50 feed as complete search.
- **Decision:** retain the existing homepage-only external entry. No Provider, RSS polling, search template, account integration, or private-feed access.

### AnimeBytes — private tracker; external destination only

- The official AnimeBytes status site is live and exposes a linked JSON status endpoint. That endpoint reports service status only; it is not evidence of a public catalogue/search API.
- A current specialist tracker reference describes AnimeBytes as a closed private anime tracker with recruitment-based admission. This is third-party context, not a substitute for AnimeBytes' own terms or admission policy.
- A third-party autobrr indexer list identifies AnimeBytes as a private tracker using IRC announcements; that is technical integration context, not authorization for AIOResourceSearch to consume its member-only data.
- No first-party public search API, public RSS contract, or permission for third-party metadata aggregation was verified. Do not use account credentials, passkeys, private RSS, IRC member feeds, or invite-only endpoints in the shared Worker.
- **Decision:** retain AnimeBytes as a catalog candidate with its canonical homepage for user-initiated navigation only. No Provider, search template, credential handling, feed ingestion, or access-control workaround. Reconsider only if first-party public documentation or explicit written authorization establishes an appropriate public integration path.

### First-party and supporting references

- DMHY official FAQ: https://share.dmhy.org/cms/page/name/faq.html
- Shana Project official RSS help: https://www.shanaproject.com/help/feeds/
- Shana Project official follows help: https://www.shanaproject.com/help/follows/
- AnimeBytes official status page: https://status.animebytes.tv/
- AnimeBytes linked status JSON (service status only): https://status.animebytes.tv/api/status
- The Wiki private-tracker overview (third-party): https://thewiki.moe/sourcing/private-trackers/
- autobrr supported indexers (third-party): https://autobrr.com/configuration/indexers


## AniList metadata API review — 2026-11-26

- AniList publishes a free, public GraphQL API for anime and manga metadata. Public metadata queries do not require OAuth; GraphQL requests use POST to `https://graphql.anilist.co`.
- The first-party API Terms are decisive for this product: they prohibit using the API within competing, non-complementary services of the same nature, explicitly including anime/manga list or tracker services, and prohibit hoarding or mass collection. AIOResourceSearch is a multi-source anime/resource search service, so its intended use may fall within the competing-service restriction. Do not infer that the general free-use statement overrides this specific restriction.
- The API documentation currently warns that the service is degraded and temporarily limited to 30 requests/minute (the normal documented limit is 90/minute), with burst limiting and a one-minute timeout after rate-limit violations. The docs also describe possible manual IP blocking for excessive requests.
- **Decision:** do not implement or enable an AniList Provider, bulk metadata sync, or API-backed search until AniList gives explicit written confirmation that this specific aggregator use is permitted. No API account, OAuth, credential, or request was created/performed for this review. Retain the source as a user-initiated external destination only; no scraping or rate-limit workaround.

### References

- AniList official API introduction: https://docs.anilist.co/guide/introduction
- AniList official GraphQL request guide: https://docs.anilist.co/guide/graphql/
- AniList official Terms of Use: https://docs.anilist.co/guide/terms-of-use
- AniList official rate-limiting guidance: https://docs.anilist.co/guide/rate-limiting
- AniList official API stability considerations: https://docs.anilist.co/guide/considerations


## Anime metadata-source batch review — 2026-11-26

### Bangumi — public subject-search API exists; integration gate remains open

- The first-party `bangumi/api` repository documents a legacy keyword subject-search endpoint `GET /search/subject/:keywords`, URL-encoded keywords, type and response-size controls, pagination, and a maximum of 25 results per page.
- The first-party repository also publishes an OpenAPI v0 schema and marks parts of the newer API as experimental, subject to change. The legacy search document and the newer OpenAPI surface should not be conflated; implementation must select and test one supported contract.
- Bangumi explicitly asks non-browser API clients to use a descriptive User-Agent containing a developer identity and application name; distributed apps should include a version, and open-source projects should include the project homepage. Generic/default User-Agents may be disabled.
- No numeric request quota or explicit third-party metadata-republication licence was verified in the reviewed first-party materials. The API's existence and developer guidance are not a blanket grant for bulk collection or republication.
- **Decision:** retain Bangumi as a candidate with canonical homepage only. No Provider or external search template until current endpoint stability, rate policy, content-use terms, and the exact permissible metadata fields are confirmed. If reconsidered, use a transparent project-specific User-Agent and conservative caching; do not bulk mirror the database.

### MyAnimeList — official API access exists, but current first-party contract not verified

- Third-party API references describe MAL API v2 anime/manga keyword search and metadata endpoints requiring an issued Client ID; user-list and account-specific functions use OAuth. These references are not first-party authorization or a reliable current statement of quota.
- Do not copy or reuse a Client ID extracted from MAL's official mobile app or third-party source code. Do not automate account login or reuse user credentials.
- Current official developer reference and terms could not be independently retrieved in this review. No official current numeric rate limit or third-party metadata display/republication permission was verified.
- **Decision:** retain canonical MAL homepage only. No API Provider, copied client ID, OAuth flow, user-list collection, scraping, or undocumented endpoint use until current first-party documentation and explicit permitted-use scope are established.

### AniDB — API documentation exists, but current contract and permission remain unverified

- AniDB publishes HTTP and UDP API specifications on its own wiki. The official wiki returned HTTP 403 to the research fetcher; this is a fetcher-specific result and does not prove global unavailability.
- Third-party technical references describe a registered-client requirement for UDP API use and warn against using UDP as a bulk database-download mechanism. Those references are not a substitute for current first-party protocol rules, rate policy, or permission.
- No current first-party public search contract, numeric request quota, or explicit third-party metadata aggregation/republication permission was verified.
- **Decision:** retain AniDB canonical homepage only. No Provider, bulk sync, registered client, undocumented API call, scraping, or attempt to work around access restrictions. Reconsider after direct first-party API-policy review.

### Kitsu — public anime GET/search API exists; terms and data-use scope need confirmation

- The first-party Kitsu API documentation describes the JSON:API endpoint `https://kitsu.io/api/edge`, public-facing GET endpoints that generally do not require authentication, text filtering with `filter[text]`, and pagination (10 by default, generally up to 20).
- The same documentation states that R18 resources are hidden from unauthenticated requests and from accounts with mature content disabled. It also describes Algolia-backed search keys that are dynamic and user-specific when obtained under an authenticated session; keys must not be shared because they can expose user-specific/private content.
- The GitHub repository contains the API documentation; its repository/documentation licence is not evidence that Kitsu's catalogue data is licensed for republication. Kitsu's Terms of Service could not be reliably reviewed in this pass, and no explicit third-party metadata aggregation permission or numeric API quota was verified.
- **Decision:** retain Kitsu canonical homepage only. No Provider, shared Algolia keys, OAuth/user credentials, R18 access workaround, bulk collection, or metadata republication until current first-party terms and API-use permission are confirmed. Public GET technical availability alone is insufficient.

### LiveChart — no supported automated interface verified

- The canonical LiveChart domain and likely terms/documentation routes were not retrievable by the research fetcher (robots/access limitation). No first-party public API, RSS contract, documented search endpoint for third-party integration, numeric quota, or metadata-use permission was verified.
- A research-fetcher restriction is not proof that the service is globally inaccessible, nor permission to route around it.
- **Decision:** retain canonical LiveChart homepage only. No Worker scraping, undocumented endpoint probing, proxy, alternate-domain substitution, or access-control workaround.

### Douban — first-party written permission required

- Douban's first-party Legal Notice dated 2025-05-27 defines Douban content to include book/film/music item metadata, ratings, reviews and related counts, and prohibits use of that content without prior written permission. The restriction expressly covers commercial display, derivative apps/websites, data collection, crawlers, and similar extraction.
- The first-party notice directs parties seeking to use Douban content to contact `bd-team@douban.com` for authorization. Historical Douban API client documentation and third-party mirrors do not override the current first-party notice.
- **Decision:** keep Douban as user-initiated external navigation only. No API Provider, third-party API substitute, HTML scraping, internal app API, login/signature automation, or metadata/score/review reuse without written permission.

### Notify.moe — public API preferred over scraping, but aggregation scope remains unclear

- Notify.moe's first-party API page documents a REST API at `https://notify.moe/api` and exposes anime-related types including Anime, AnimeRelations, Episode, Character and Company.
- Its first-party Terms of Service (last modified 2017-11-17) explicitly prohibit HTML scraping and direct users to the public API to minimize bandwidth. This is a clear preference for API over scraping, but it does not expressly grant third-party bulk aggregation or republication rights.
- The official API documentation page is available, but no numeric quota or explicit third-party metadata reuse licence was found. The project's public GitHub repository was archived in 2024, which is third-party operational context and raises maintenance/continuity concerns; it does not itself mean the live API is discontinued.
- **Decision:** retain Notify.moe canonical homepage only. Do not scrape HTML. No Provider or bulk API harvesting until the operator confirms permitted third-party aggregation, current service support, and sustainable request limits.

### References

- Bangumi API repository: https://github.com/bangumi/api
- Bangumi legacy subject search: https://github.com/bangumi/api/blob/master/docs-raw/Search-API.md
- Bangumi User-Agent guidance: https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md
- Bangumi OpenAPI v0 schema: https://github.com/bangumi/api/blob/master/open-api/v0.yaml
- MyAnimeList API reference portal (not retrievable in this review): https://myanimelist.net/apiconfig/references/api/v2
- AniDB HTTP API specification: https://wiki.anidb.net/HTTP_API_Definition
- AniDB UDP API specification: https://wiki.anidb.net/UDP_API_Definition
- Kitsu API documentation: https://hummingbird-me.github.io/api-docs/
- Kitsu API documentation repository: https://github.com/hummingbird-me/api-docs
- LiveChart canonical site: https://www.livechart.me/
- Douban first-party Legal Notice: https://www.douban.com/about/legal?page=2025-05-27
- Douban first-party User Agreement: https://www.douban.com/about/agreement
- Notify.moe first-party API docs: https://notify.moe/api
- Notify.moe first-party Terms: https://notify.moe/terms
- Notify.moe public repository (archived): https://github.com/animenotifier/notify.moe


## Film / TV metadata-source review batch — 2026-11-26

### TVmaze — public show-search API; CC BY-SA obligations need product-level handling

- TVmaze's first-party API documentation describes a free public REST API at `https://api.tvmaze.com`, including fuzzy show-name search, JSON responses, CORS support, and 60-minute response caching.
- The public API is licensed CC BY-SA. TVmaze states that data may be used for any purpose when the source is credited and the ShareAlike provision is followed. Its API page documents a baseline of at least 20 calls per 10 seconds per IP, HTTP 429 handling/backoff, connection hygiene, and recommends a uniquely descriptive User-Agent.
- The project's current result model and UI need to preserve source-level field provenance and attribution; it is not enough to add a generic source link if TVmaze-derived fields are mixed with non-ShareAlike data. The precise compatibility of the project's data presentation/distribution and applicable ShareAlike version should be reviewed before implementation.
- **Decision:** retain TVmaze as a film/TV candidate with canonical homepage only. No Provider, HTML scraping, or source enablement until field-level provenance, attribution placement, ShareAlike compatibility, and shared Worker egress pacing are designed and reviewed.

### TMDB — API exists, but its content restriction conflicts with a core product pillar

- TMDB's first-party developer FAQ confirms a movie/TV/actor API requiring an API key. The developer API is free only for non-commercial projects with prescribed attribution; commercial projects require a separate commercial agreement.
- More importantly, the same first-party FAQ's API legal notice prohibits using TMDB API data or images in connection with pornographic, obscene, abusive, or otherwise offensive content. JAV/adult search is a core product pillar of AIOResourceSearch, so segregating the TMDB source to the film/TV category would not safely resolve the product-level restriction.
- **Decision:** retain TMDB as a canonical external-navigation candidate only. Do not use its API, images, metadata, third-party wrappers, or scraping anywhere in this product unless TMDB provides explicit written authorization that clearly covers the entire intended product context. This is not a statement that ordinary user-initiated navigation to TMDB is prohibited.

### IMDb — published datasets are not licensed for this product's database use

- IMDb publishes daily refreshed downloadable TSV datasets, but its first-party help page limits the stated permission to personal, non-commercial use and requires compliance with its conditions.
- The same first-party page expressly says the data must not be altered, republished, resold, or repurposed to create an online/offline database of movie information (except for individual personal use). IMDb's Conditions of Use also prohibit data mining, robots, and screen scraping absent express written consent.
- **Decision:** retain IMDb as a canonical homepage-only candidate. No dataset ingestion, search Provider, scraping, or reuse of IMDb metadata in this public multi-source product absent a separate written licence that covers the intended database/search use.

### Wikidata — CC0 structured data with documented search and access guidance

- Wikidata's first-party licensing and data-access pages state that structured data is released under CC0 and may be reused without attribution; Wikidata nevertheless asks projects to identify it as a data source and provide a way to report data issues.
- The first-party access guide distinguishes its mechanisms: Elasticsearch / `wbsearchentities` is appropriate for text/entity-name search; the Linked Data Interface is for already-known entity IDs; the Action API is intended for small groups of known entities (up to 50); and WDQS is intended for narrowly scoped relationship queries, not fuzzy text search or broad result sets.
- Access guidance requires a meaningful User-Agent, avoiding parallel request bursts, observing robot policy, using short timeouts, and stopping after HTTP 429 while respecting Retry-After. The separate WDQS service also publishes its own external-client rate and concurrency limits; those limits should not be confused with Action API limits.
- **Decision:** retain a film/TV-scoped Wikidata candidate as homepage-only pending a narrow search design and result-quality tests. No bulk dump, broad SPARQL scan, or Provider is introduced in this review. If revisited, use the search API for text lookup rather than regex-heavy WDQS queries, add explicit source provenance, and implement conservative serial requests and backoff.

### First-party references

- TVmaze API documentation and licence/rate guidance: https://www.tvmaze.com/api
- TVmaze API plans and free-tier limits: https://www.tvmaze.com/api/plans
- TVmaze Terms of Service: https://www.tvmaze.com/site/tos
- TMDB first-party API FAQ and legal notice: https://developer.themoviedb.org/docs/faq
- TMDB API getting started: https://developer.themoviedb.org/docs/getting-started
- IMDb non-commercial datasets: https://www.imdb.com/interfaces/
- IMDb first-party dataset use restrictions: https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX
- IMDb Conditions of Use: https://www.imdb.com/conditions/
- Wikidata licensing: https://www.wikidata.org/wiki/Wikidata:Licensing
- Wikidata first-party data-access guide: https://www.wikidata.org/wiki/Wikidata:Data_access
- Wikidata API etiquette: https://www.mediawiki.org/wiki/API:Etiquette
- Wikidata Query Service rate limits: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/API


## Film / TV discovery and metadata-source review — 2026-11-26

### Trakt — public discovery API is explicitly limited by anti-piracy use policy

- Trakt's first-party API Use Policy permits public title search, title/person details, images, ratings, vote counts, and discovery lists in free or paid apps. Standard API access is free and has documented unauthenticated GET limits (500 requests per five minutes per client ID + public IP); 429 responses require Retry-After or exponential backoff.
- The same first-party policy expressly prohibits using Trakt data in apps or websites that promote copyright infringement or piracy, and separately prohibits bulk harvesting, catalog mirroring, or supplying Trakt data to other services. AIOResourceSearch includes torrent-indexer and magnet-resource search; that product context creates a material policy conflict even though the API's ordinary discovery features otherwise look suitable.
- **Decision:** retain Trakt as a canonical homepage-only candidate. No API app registration, Provider, OAuth, search integration, or data collection unless Trakt explicitly confirms in writing that this specific torrent/magnet resource-search product is within its permitted use. Do not try replacement keys/apps or other workarounds if access is restricted.

### TheTVDB — API exists, but the API legal notice conflicts with the product's adult-content scope

- TheTVDB's first-party developer page describes a film/TV metadata API, project-specific API key registration, attribution requirements, and a free attributed tier for projects below the stated revenue threshold; higher revenue tiers are paid and are outside the no-paid-services rule.
- The API Terms license access for the product/project described during API-key approval. Its first-party API legal notice prohibits use of API data/images in connection with pornographic, abusive, or otherwise offensive content. Since JAV/adult search is a core AIOResourceSearch product pillar, limiting a TheTVDB source record to the film/TV category does not remove the product-level conflict.
- **Decision:** retain TheTVDB as a canonical external-navigation candidate only. No API key, Provider, image or metadata reuse, or scraping anywhere in this product unless the operator grants explicit written authorization covering the whole product context.

### Letterboxd — API access is request-only and not currently assured for this project

- Letterboxd's first-party API access page says access is by request and is not guaranteed. It also states that it is not currently granting API access for data-analysis, visualization, recommendation, private/personal projects, or uses that recreate current/planned paid subscription features.
- The API reference is publicly readable, but that does not itself grant an API credential or approval. Member RSS feeds are personal feeds for user activity, not a shared public film catalogue/search feed.
- **Decision:** retain canonical homepage only. No API integration, account/session automation, member-feed aggregation, or HTML scraping absent explicit access approval and scope confirmation.

### OMDb — API is technically accessible, but the indexing terms need written clarification

- OMDb's first-party API key page advertises a free tier with 1,000 requests/day and states that its content is licensed under CC BY-NC 4.0. Its API page also records that adult content is suppressed from search results (changelog dated 2026-11-11).
- The first-party Terms of Use separately prohibit creating, recreating, distributing, or advertising an index of Contributions without written authorization and prohibit commercial use of Contributions. The public API page's CC BY-NC statement does not, by itself, resolve how these indexing restrictions apply to an external multi-source search product or which API fields are covered.
- **Decision:** retain OMDb as a canonical homepage-only candidate. No API key request, Provider, indexing, scraping, or metadata reuse until the operator clarifies in writing that this exact public search/index use is permitted and identifies the applicable licence scope.

### First-party references

- Trakt API Use Policy: https://developer.trakt.tv/docs/api-use-policy
- Trakt rate limits: https://developer.trakt.tv/docs/rate-limiting
- Trakt create-an-app / production access: https://developer.trakt.tv/docs/create-an-app
- TheTVDB API and data licensing: https://thetvdb.com/api-information
- TheTVDB Terms of Service: https://thetvdb.com/tos
- TheTVDB API signup and tier selection: https://www.thetvdb.com/api-information/signup
- Letterboxd API access: https://letterboxd.com/api-beta/access/
- Letterboxd API reference: https://api-docs.letterboxd.com/
- Letterboxd Terms of Use (updated October 2026): https://letterboxd.com/legal/terms-of-use/
- OMDb API key and free tier: https://www.omdbapi.com/apikey.aspx
- OMDb API legal / Terms of Use: https://www.omdbapi.com/legal.htm
- OMDb API home and change log: https://www.omdbapi.com/


## Game and music metadata-source review — 2026-11-26

### RAWG — a game API exists, but its content and redistribution terms conflict with this product

- RAWG's API documentation describes a searchable video-game metadata API with a free personal/hobby tier and request limits. Its API-specific Terms of Service, last updated 2021-03-01, separately prohibit further distribution of the Services and prohibit using API data or images in connection with pornographic, obscene, abusive, or otherwise offensive content.
- The API documentation also says data must not be redistributed or made available to other businesses, and requires an active RAWG backlink on pages using its data. The API documentation's tier description and the older API-specific Terms should not be treated as a blanket grant for a multi-source search aggregator.
- AIOResourceSearch has JAV/adult search as a core product pillar. Restricting RAWG records to the game category would not resolve the product-level content restriction.
- **Decision:** retain RAWG as a canonical homepage-only game candidate. No API key request, Provider, image/metadata reuse, scraping, or third-party API wrapper unless RAWG provides current written authorization covering the entire product context and intended distribution.

### Giant Bomb — its first-party API is currently unavailable

- Giant Bomb's first-party API page explains that after its move away from Fandom, the API mechanisms are not currently available and are expected to change. It explicitly lists game, character, company, release, and other APIs as unavailable; its replacement wiki is described as rough alpha browsing.
- **Decision:** retain Giant Bomb as a canonical homepage-only game candidate. Do not call historical API endpoints, probe undocumented replacements, use third-party mirrors, or treat the community wiki rebuild as an API contract. Reassess only after the operator publishes a supported interface and current terms.

### Discogs — CC0 catalogue fields exist, but the intended search-aggregator use needs clarification

- Discogs' first-party API Terms (last updated 2025-05-27) identify release titles, notes, dates, formats, track listings, identifiers, credits, artist names, and label/producer names as CC0 data. User data, marketplace data, and user-contributed images are separately classified as Restricted Data.
- Restricted Data cannot be transferred to third parties or used commercially. API content must not be displayed more than six hours behind the current Discogs site, and caching is limited to what is necessary. The Terms require a prominent non-affiliation notice and a “Data provided by Discogs” notice with a direct link next to each use of Discogs data.
- The Terms also prohibit certain commercial uses, including using the API or Content with the intent to drive traffic to other non-Discogs websites or services. Since AIOResourceSearch is a multi-source search product that presents external resource destinations, the applicability of that clause to this product requires written clarification even if the implementation were restricted to CC0 catalogue fields.
- **Decision:** retain Discogs as a canonical homepage-only music candidate. No API integration, API credential, Provider, image, user, collection, wantlist, or marketplace-data use until Discogs clarifies in writing that this exact multi-source search and external-link use is permitted. Do not use additional API keys to work around any rate limit.

### ListenBrainz — API purpose does not match a public music-catalogue search source

- First-party documentation describes endpoints for submitting listens, reading a user's recent listens/listening history, and retrieving the currently playing track. Submission and some account-linked operations require a user token; the API publishes dynamic rate-limit response headers.
- These endpoints are oriented around user listening activity and statistics, not a general public artist/release catalogue search contract. User-specific history is outside this project's source-search scope.
- **Decision:** do not add ListenBrainz as a shared catalogue source. Do not request, collect, or store user tokens or aggregate individual users' listening histories. Reconsider only if a distinct public metadata-search interface is documented and its intended use is reviewed.

### Existing MusicBrainz implementation — keep its separate constraints

- MusicBrainz remains a distinct existing metadata Provider, not a substitute for Discogs. Its first-party API documentation states non-commercial use is free, no API key is required for public lookups, a meaningful User-Agent is mandatory, and each client application must not exceed one request per second. Core database data is CC0, while supplementary datasets can have different licences.
- The previously documented implementation and licence checks remain separate from this batch. Do not infer that MusicBrainz's terms apply to Discogs or ListenBrainz, or that one provider's availability authorizes another provider.

### First-party references

- RAWG API documentation: https://rawg.io/apidocs
- RAWG API-specific Terms of Service: https://rawg.io/tos_api
- Giant Bomb API availability notice: https://giantbomb.com/api
- Discogs API Terms of Use: https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use
- ListenBrainz API documentation: https://listenbrainz-server.readthedocs.io/en/latest/dev/api.html
- MusicBrainz API documentation: https://musicbrainz.org/doc/MusicBrainz_API
- MusicBrainz rate limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

### Batch outcome

- Three canonical homepage-only candidates are added to the runtime candidate inventory: RAWG (game), Giant Bomb (game), and Discogs (music).
- ListenBrainz is documented as out of scope for shared catalogue search because its documented API is user-listening-history oriented.
- No Provider implementation, external-search template, KV configuration, source enablement, credential, or Cloudflare deployment was added.


## Implemented Provider-to-catalog reconciliation — 2026-11-26

A cross-check of the compile-time Worker registry, Provider source files, focused tests, provider-specific documentation, and frontend sourceCatalog.ts found two implemented Providers that had not yet been represented by matching source-catalog records:

- **MangaDex** — Worker Provider `mangadex-api` v1.0.0, registered in `apps/worker/src/providers/registry.ts`, with focused tests and `docs/providers/mangadex-api.md`. The Provider is limited to public manga title metadata, explicit content-rating filters, visible attribution, one-hour cache, and the shared 400 ms `mangadex` Durable Object lane. It does not fetch chapters, cover art, images, accounts, or user endpoints.
- **MusicBrainz** — Worker Provider `musicbrainz-api` v1.0.0, registered in the same compile-time registry, with focused tests and `docs/providers/musicbrainz-api.md`. It is limited to non-commercial release-group metadata, omitting tags, ratings, annotations, cover art, and user data; uses a descriptive User-Agent, one-hour cache, and shared 1,000 ms `musicbrainz` Durable Object lane.

Both sources have now been added to `apps/web/src/modules/sources/sourceCatalog.ts` with their matching adapterId, category, content category, capabilities, search mode, canonical homepage, and operational/policy notes.

**This is a catalog registration reconciliation only.** No KV adapter/source records have been written; both remain unconfigured and disabled. No Cloudflare binding, live upstream request, deployment, or production change has occurred. Before any future enablement, complete the dedicated non-production Cloudflare Hosted verification and re-check MangaDex's ad-free/free-service condition and MusicBrainz's non-commercial-use condition.


## Provider implementation versus external-navigation catalog reconciliation — 2026-11-26

A cross-check of the compile-time Worker registry, Provider source files, focused tests, provider-specific documentation, and frontend source catalog identified two distinct catalog situations:

- **MangaDex** (mangadex-api) and **MusicBrainz** (musicbrainz-api) were implemented and registered in Worker code but had no source-catalog records. Both now have dedicated Provider-type candidate records with their exact adapter IDs, metadata-only capabilities, category/content-category, and policy/operational gates.
- **Perverzija DB** (perverzija-db) was implemented and documented but had no source-catalog record. A dedicated Provider-type candidate record has now been added.
- **Sukebei**, **DMHY**, **AniBT**, **Torlock**, and **YourBittorrent** initially existed as external-navigation candidates alongside compiled Worker Providers. The later 2026-11-26 dual-mode update converted these records to Provider type while preserving their user-initiated homepage/search destinations in independent navigation fields.

The earlier single-type source-model limitation is superseded by the dual-mode implementation documented in [architecture.md](./architecture.md) and [source-catalog-policy.md](./source-catalog-policy.md). Provider acquisition and browser-opened navigation are independent capabilities; the Worker never fetches the external navigation destination.

**Result at the time of this reconciliation:** three missing source records were added (MangaDex, MusicBrainz, Perverzija DB). Existing external-navigation records were then unchanged. No KV adapter/source records were written; the three new Provider candidates remained unconfigured and disabled. No Cloudflare binding, live upstream request, deployment, or production change occurred. The catalog contained 125 unique candidates at that point; later catalog reconciliations are recorded below.


## Novel / e-book catalog reconciliation and cross-category book-source review — 2026-11-26

This update closes the previously documented gap between the 2026-11-25 review of the eight Atlas novel/e-book candidates and the durable source catalog. All eight candidates are now represented in `apps/web/src/modules/sources/sourceCatalog.ts`; uncertain identities remain name-only, and no candidate is represented as an automated Provider.

### Atlas novel/e-book candidates

| Candidate | Catalog disposition | Current acquisition decision |
|---|---|---|
| Z-Library | External homepage reference: `https://z-library.sk` | Official social account identified this domain among official domains in January 2026, but no first-party public third-party metadata API or applicable automation terms were verified. No account cookies, challenge handling, unofficial EAPI, or Worker scraping. |
| Anna's Archive | External homepage reference: `https://annasarchive.io` | First-party FAQ describes its stable JSON API as member-only fast-download; custom search requires large ElasticSearch/MariaDB datasets. No member API, bulk datasets, raw torrent lists, or download endpoint. |
| 知轩藏书 | Explicitly labelled user-created archive: `https://zxcs.zip` | First-party About page says it is not the original official site or a new official domain and discourages crawlers. No crawling or bulk dataset retrieval. |
| 奇书网 | Name-only | The Atlas seed's `qishuxia.com` identity could not be corroborated by a current first-party operator page, API, or applicable terms. No guessed domains or mirrors. |
| SoBooks | External homepage reference: `https://sobooks.cc` | No current first-party API, automated aggregation permission, or stable search contract verified. No scraping, unofficial API, or file download. |
| Lunarora | Name-only | No first-party canonical identity, API documentation, or data-use terms for the seed identity verified. No domain substitution. |
| PDFs.top | External homepage reference: `https://pdfs.top` | No first-party API contract, metadata licence, or automated collection permission verified. No crawling or file retrieval. |
| 读书派 | External homepage reference: `https://www.dushupai.com` | Public book catalog is visible, but no first-party developer API, automation policy, or third-party metadata reuse permission verified. No scraping, metadata collection, or ebook-file fetching. |

### Additional first-party book and general-archive candidates

#### Open Library

- Official Search API supports real-time book, work, edition, and author lookup; the public search route is suitable as a user-opened external search destination.
- Usage guidance says to make useful time-sensitive requests on behalf of human users, cache responses, and identify the application with a descriptive User-Agent and contact email. Published pacing is 1 request/second for unidentified clients and 3 requests/second for identified clients.
- The same first-party guidance explicitly says the APIs are not intended to be a data backend for third-party services or high-traffic commercial infrastructure, and forbids bulk metadata downloads through the API.
- Decision: external search only. Do not add a Worker Provider or bulk metadata collection unless Open Library confirms this aggregator use or the product architecture is changed to fit the stated intended use.
- References: https://openlibrary.org/developers/api ; https://openlibrary.org/dev/docs/api/search ; https://openlibrary.org/help/faq/using

#### Google Books

- The official Books API supports programmatic book search and volume metadata lookup.
- Google states that much of the underlying Books data is licensed from third parties and is not Google's to redistribute freely. Its Books API terms prohibit charging users for the application without a separate agreement or written permission and require a content-removal process for allegedly infringing material.
- Decision: retain the website as an external destination only. No API integration, metadata/image reuse, or API key use until the product's fee model, data rights, removal handling, and intended display are reviewed.
- References: https://developers.google.com/books/docs/overview ; https://developers.google.com/books/terms

#### Project Gutenberg

- First-party documentation offers daily machine-readable XML/RDF catalog metadata, weekly CSV/MARC exports, RSS, and an OPDS discovery feed. The catalog metadata is stated to be public domain.
- OPDS clients must provide a descriptive User-Agent and contact address, request no more than a browser-like volume (one page per search and fetch another page only as the user continues), and use stable ebook landing-page URLs rather than deep links to file paths. A JSON OPDS2 feed is currently testing-only by contact request; the existing XML OPDS feeds are expected to be sunset in 2027.
- Decision: homepage-only for now. A bounded OPDS Provider is a plausible future task, but first verify query semantics, feed lifecycle, contact/identification requirements, and jurisdiction-specific copyright status. No bulk download, mirror, or ebook-file retrieval is introduced.
- References: https://www.gutenberg.org/ebooks/offline_catalogs.html ; https://www.gutenberg.org/policy/terms_of_use.html ; https://www.gutenberg.org/policy/robot_access.html

#### Internet Archive

- First-party Help Center documents general metadata search and Advanced Search output formats including JSON, XML, CSV, and RSS. The official search documentation also describes a cursor-based search API and Lucene-like query syntax.
- The Archive contains user-contributed items across texts/books, audio, video, software, and other media. Rights and licences are item/uploader-specific; the existence of an item or its presence in search results is not a blanket licence to reuse or redistribute its metadata or files.
- Decision: homepage-only pending a narrow text/book scope, per-item rights handling, content filtering, and API pacing review. No bulk harvesting or file retrieval.
- References: https://archive.org/help/aboutsearch.htm ; https://archivesupport.zendesk.com/hc/en-us/articles/360018359991-Search-A-Basic-Guide ; https://archive.org/services/docs/api/

### Catalog reconciliation result

- Added 8 Atlas novel/e-book candidates and 4 project-discovered book/general-archive candidates.
- Catalog now contains **137 unique candidates**: JAV 28, torrent 30, forum 16, other-index 63. Provenance tags are Atlas 75, FetchJAV 28, Lustpress 8, and AIOResourceSearch-owned 32; provenance tags overlap and must not be summed as unique records.
- No Provider implementation, search template beyond the user-opened Open Library search link, KV configuration, source enablement, credentials, or Cloudflare deployment was added. All new entries remain candidates and are disabled when registered.
- The eight Atlas candidates are now preserved in the catalog even where their identity remains name-only or automated access is deferred. This closes the previous catalog omission without changing any access-control boundary.


## Dual-mode source and novel-candidate inventory follow-up — 2026-11-26

The earlier Provider-to-catalog reconciliation text above is historical and has been superseded in two respects:

- The source model now supports a Provider record and a separate user-opened external search/homepage destination simultaneously through `externalSearchUrlTemplate` and `externalSearchBaseUrl`. This is implemented in shared types, Worker validation/response generation, the source-management UI, and unit tests. The Worker never requests the external destination.
- The eight Atlas novel/e-book candidates reviewed in the thirty-first batch have now been added to the durable source catalog, together with four additional book/general-archive candidates. The current inventory is 137 unique candidates: JAV 28, torrent 30, forum 16, other-index 63; provenance tags are Atlas 75, FetchJAV 28, Lustpress 8, and AIOResourceSearch-owned 32 (overlapping tags).

No new Provider implementation, KV configuration, source enablement, credential, Cloudflare deployment, or file retrieval was added by this follow-up. The only new search template is Open Library's user-opened external search link; it is not a Worker API call.
