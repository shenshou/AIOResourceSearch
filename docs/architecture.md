# Architecture

## Product boundary

AIOResourceSearch is a general-purpose, multi-category resource search aggregator. A user submits one query and selects a content category (or all categories); the Worker schedules enabled sources, normalizes their metadata, deduplicates results, and returns source-attributed links.

It is a search and aggregation system, not a media-management product. It does not host or stream media.

## Content categories and source kinds

Content categories describe what the user wants to search:

- `jav`: JAV / adult video metadata
- `anime`: anime and animation
- `film-tv`: films and television
- `manga`: manga and comics
- `novel`: books and novels
- `game`: games
- `music`: music and albums
- `general`: other public resource indexes

The existing `SourceCategory` field is retained as a source-kind classification for backward compatibility:

- `jav`: JAV metadata site
- `torrent`: torrent index / tracker
- `forum`: forum
- `other-index`: other metadata or resource index

These two dimensions are deliberately independent. For example, a torrent index may provide JAV resources, anime resources, or general resources. New source records set `contentCategory`; legacy records without it are interpreted as `jav` so existing configurations continue to work.

## Acquisition mechanisms

Worker-backed adapters declare one mechanism:

1. **API** — documented REST/JSON, XML, Torznab, or another reviewed structured endpoint.
2. **RSS** — public RSS or Atom feeds.
3. **HTML** — a reviewed HTML adapter requests a public search page and extracts configured fields with Cloudflare's native `HTMLRewriter`.

External search is a separate source type, not a Worker acquisition mechanism. It only expands a verified HTTPS search URL template or returns a homepage URL for the user to open. It does not fetch the destination.

### Generic HTML adapter

The registered `generic-html` adapter uses declarative CSS selectors stored with the source configuration:

- result card selector (required)
- title selector (required)
- detail-link selector (required)
- image, description, and Magnet selectors (optional)
- same-origin HTTPS search URL template containing exactly one `{query}`

Safety constraints:

- The search template must use the same HTTPS origin as the configured base URL.
- Redirects are not followed.
- The response must be HTML/XHTML and is limited to 2 MiB while streaming.
- Detail URLs must resolve to HTTPS on the configured source host.
- Magnet links are accepted only when they contain a valid BitTorrent Info Hash.
- Selectors are configuration, not executable JavaScript. No page scripts are run.
- No login, paywall, CAPTCHA, anti-bot challenge, geo restriction, rate limit, or other access control is bypassed.

HTML selectors and URL templates are site-specific. A generic adapter does not make every website compatible; each source still needs a reviewed configuration and live connectivity test.

## Runtime topology

```text
Vue 3 frontend (Cloudflare Pages)
        |
        | HTTPS / JSON
        v
Cloudflare Worker API
        |
        +---- Workers KV: source configuration (sources:config:v1)
        |
        +---- Workers KV: adapter metadata (adapters:config:v1)
        |
        +---- compile-time Provider registry
                    |
                    +---- API adapters
                    +---- RSS adapters
                    +---- HTML adapters
                              |
                              +---- permitted public source endpoints
```

Pages and Worker are separate deployable targets in one monorepo. Source requests belong behind the Worker boundary; the browser does not directly run Provider adapters.

## Module responsibilities

- `apps/web`: search page, category selector, source/adapter administration, browser-only preferences, API clients.
- `apps/worker`: HTTP routing, admin authorization, configuration validation/persistence, acquisition adapters, orchestration, result normalization.
- `packages/shared`: framework-independent category, source, adapter, and API contracts.
- Adapter metadata: identity, version, mechanism, supported source kinds, supported content categories, capabilities, and administrative state. It contains no executable code.
- Provider adapters: reviewed TypeScript implementations that translate one source's permitted protocol into the shared result contract.

A source has one of two types:

- `provider`: `adapterId` must exist in adapter metadata, be enabled, and have an implementation in the Worker compile-time registry.
- `external-search`: has an HTTPS `searchUrlTemplate` containing exactly one `{query}`, or an HTTPS `baseUrl` homepage. The Worker returns the destination but never fetches or parses it.

A source may not use both external-search and Worker-side HTML configuration.

## Source and adapter configuration

Two independent versioned JSON documents use the same KV namespace:

- `sources:config:v1`: data-source definitions.
- `adapters:config:v1`: adapter administrative metadata.

Source records include source kind, user-facing `contentCategory`, adapter ID, capabilities, search modes, timeout, and optional protocol-specific configuration. HTML sources additionally store `providerSearchUrlTemplate` and declarative `htmlSelectors`, including an optional mapping of up to 20 category-specific metadata field names to CSS selectors.

KV is eventually consistent and does not provide compare-and-swap transactions. ETag/revision preconditions catch ordinary stale-editor updates but are not distributed locks. Avoid concurrent administrator edits.

Only configuration belongs in KV. Adapter executable code remains in the Worker bundle. Search results, images, media, favorites, and search history are not persisted there.

CRUD and enable/disable operations update KV and do not require deployment. New adapter implementations, protocols, parsers, or code changes require a Worker deployment. KV propagation and edge cache TTL may delay visibility of changes.

## Adapter registry and current implementations

Executable adapters are registered in `apps/worker/src/providers/registry.ts`. The registry is a compile-time allowlist and is never populated from KV. An adapter metadata record cannot make arbitrary code executable.

Current registered implementations:

| Adapter | Mechanism | Content category | Role |
|---|---|---|---|
| Perverzija DB | API / JSON | JAV | Metadata |
| Torlock Torznab | API / XML | JAV | Torrent search |
| YourBittorrent | API / JSON | JAV | Torrent search |
| Sukebei RSS | RSS | JAV | Magnet feed |
| generic-html | HTML | Configurable | Public HTML search pages |

The four site-specific providers have source-specific code and tests. `generic-html` is a reusable parser adapter; individual HTML sources still require selector configuration and review.

## Search flow

```text
Search page
  -> query + content category + search mode
  -> Worker search endpoint
  -> enabled source configurations matching content category
  -> API / RSS / HTML Provider adapters
  -> result validation and normalization
  -> URL deduplication
  -> response to frontend
  -> result cards and source links

External-search sources
  -> verified HTTPS search URL or homepage
  -> user opens the original site
```

The search category defaults to `all`. Legacy sources with no `contentCategory` are treated as `jav`. Each result is stamped with the configured source identity and effective content category. The normalized result contract keeps stable common fields (title, URL, release date, image, resource links) and an optional bounded `metadata` string map for category-specific fields such as author, ISBN, publisher, season, episode, platform, or artist.

The scheduler limits outbound concurrency, applies per-source timeouts, isolates failures, and caps results at 50 per source and 100 total. HTTPS result links are validated. Magnet links require a valid `xt=urn:btih`; ED2K values are checked against their expected URI format.

## Security and access policy

- All source/adapter mutations require the Worker secret `ADMIN_API_TOKEN`.
- The browser keeps the admin token in component memory only.
- CORS must be restricted to exact frontend origins through `ALLOWED_ORIGINS`.
- Credentials belong in Worker secrets. KV may contain a secret binding name, never its value.
- Public listings omit administrator notes and secret-binding metadata.
- Validate all management input before writing it to KV.
- HTML adapter URLs are same-origin with the configured base URL; redirects are refused and response bodies are bounded.
- Do not bypass authentication, paywalls, CAPTCHA, anti-bot protections, geo restrictions, rate limits, or other access controls.
- Public visibility does not itself establish permission for automated access, republication, or image display. Review applicable site terms and legal requirements before enabling each source.

## Explicit non-goals

- User registration or profiles
- Cloud favorites or search history
- Media hosting, streaming, or local media management
- D1 database
- Cross-device synchronization of personal user data
- Arbitrary JavaScript execution from KV
- Automatic scraping of every catalog entry without per-source review

## Tests

Worker unit tests live under `apps/worker/tests/providers`. They cover scheduler behavior, validation, deduplication, failure isolation, timeouts, concurrency, and adapter-specific parsing using fixtures/mocks. Tests do not prove live Cloudflare connectivity or source permission.

Run from the repository root:

```bash
npm run test:worker
```

CI runs Worker tests, frontend production build, and Worker type-check.
