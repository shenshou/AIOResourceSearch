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
