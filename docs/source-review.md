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
