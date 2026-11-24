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
| Perverzija DB | Strong free metadata Provider candidate; implementation pending | Official v1 JSON API has no API key, documents scene search and a stable data model, refreshes every 3 hours, and publishes a 120 requests/minute/IP limit. Its terms allow free commercial and non-commercial use with visible attribution linking to the scene watch page or Perverzija DB; it is adults-only and prohibits bulk standalone resale and rate-limit circumvention. This is broader adult scene metadata, not a JAV-only catalogue. A Provider can map `urls.page` to the result URL and add a visible watch link, but the project needs a caching/rate-control decision before implementation. Do not expose its cover images until their display conditions are clear; the data model says images belong to their respective owners and are for identification/reference. |
| Torlock | Free Torznab Provider candidate; pending terms and live verification | Its API page documents a no-key Torznab endpoint, `search` with `q`, category filters, magnet links, and an Adult category (Newznab 6000). It explicitly says feeds are free for apps, recommends Torznab over scraping, and asks clients to cache and not re-request the same URL more than once per minute. The page also says datacenter traffic may be filtered and whitelisting may be required. No bypass is appropriate; verify terms and test ordinary Worker access before implementation. |
| Bitsearch | Free REST Provider candidate; pending terms and live verification | Official API documentation advertises 200 unauthenticated requests/day/IP, or 1,000/day with a free account key; it documents search, categories, infohash, magnet URI, and rate-limit headers, including an Adult Content category. Its content-removal page describes DMCA and prohibited-content reporting. The API documentation is clear, but a separate API data-use licence/terms permitting republication in this aggregator was not established. Do not implement until that is clarified. |
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

### Perverzija DB

- Search endpoint: `GET https://api.perverzija.com/v1/scenes?q=...&per_page=...`.
- Authentication: none.
- Documented limit: 120 requests/minute/IP; respect `429` and `Retry-After`.
- Freshness: source says its data refreshes every 3 hours and explicitly recommends caching.
- Candidate result mapping:
  - `id` → stable provider result ID.
  - `title` → normalized result title.
  - `release_date` → release date.
  - `urls.page` → primary result URL, satisfying the visible Perverzija DB attribution link.
  - `urls.watch` → separately labelled external watch link.
  - `urls.official` → optional official studio link.
  - studio, performers, tags and duration → concise description text.
- Do not map `cover` to `imageUrl` until image-display rights/conditions are confirmed.
- Before coding, add a cache/rate-control layer suitable for Cloudflare's shared Worker egress. A per-isolate in-memory cache alone is not sufficient to enforce a per-IP quota across isolates.

### Torlock

- Documented endpoint: `https://www.torlock.com/torznab/api?t=search&q=...`.
- Category filter supports Newznab category `6000` for Adult.
- Parse only documented Torznab RSS/XML fields; do not scrape HTML.
- Respect its stated minimum one-minute repeat interval for the same URL and cache responses.
- No challenge solving, proxy rotation, or datacenter-block bypass. If ordinary Worker requests are blocked, leave the source disabled.

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
- Bitsearch API documentation: https://bitsearch.eu/api
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
