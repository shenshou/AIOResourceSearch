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

## Review policy

1. Prefer official APIs and documented public feeds.
2. A public HTML page is not an API and is not, by itself, permission to automate access.
3. Do not bypass login, paywalls, CAPTCHA, Cloudflare challenges, rate limits, geo-restrictions, or other access controls.
4. Do not use paid metadata services.
5. If terms or access permission are unclear, keep the source as an external-search link or leave it pending.
6. Re-check the upstream documentation and terms before implementing or enabling a Provider.
