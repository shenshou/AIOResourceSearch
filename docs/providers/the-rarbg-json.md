# The RarBg JSON Provider

## Implementation

- Adapter ID: `the-rarbg-json`; version: `1.0.0`.
- Protocol: official anonymous JSON search API, `GET https://therarbg.com/api/v1/search/`.
- Source kind: `torrent`; capabilities: `metadata`, `magnet`.
- Supported content categories and upstream category values:

| Project category | The RarBg category |
|---|---|
| JAV | `XXX` |
| Anime | `Anime` |
| Film / TV | `Movies,TV` |
| Games | `Games` |
| Music | `Music` |

Manga, novels, and generic resources are not supported by this mapping.

## Source records

The frontend source catalog contains five independent, disabled records:

- `the-rarbg-jav`
- `the-rarbg-anime`
- `the-rarbg-film-tv`
- `the-rarbg-game`
- `the-rarbg-music`

All five point to the same `the-rarbg-json` adapter. The adapter is registered once in Worker code and once in adapter metadata. Each source record keeps its own content category and enabled state.

After deploying the Worker version containing this Provider:

1. In Adapter Management, register and enable the single The RarBg preset.
2. In Source Management, register the five catalog entries individually. The normal Worker endpoint validates adapter compatibility.
3. Keep every source disabled until Hosted Cloudflare connectivity, rate-limit behavior, content scope, and policy checks are complete.

The bulk source-import endpoint intentionally remains external-search-only. Provider records must use the validated single-source creation path.

## Request and quota controls

- No account, API key, cookie, or other credential is used.
- Shared Durable Object lane: at least 2,100 ms between upstream requests, below the documented anonymous 30 requests/minute ceiling.
- A 120-second edge cache is used for identical query/category requests; it is not a distributed lock or global limiter.
- Honor minute/day quota exhaustion, `Retry-After`, and daily reset headers through the shared coordinator. Do not tight-loop retry 429/5xx responses.
- Response size is capped at 2 MiB; request uses HTTPS and manual redirects; only JSON responses from the canonical host are accepted.
- Result count is bounded by the upstream request limit of 50.

## Data boundaries

- Accept only 40-character hexadecimal infohashes and source-provided Magnet URIs whose BTIH matches the hash. Never synthesize a Magnet URI.
- Accept only canonical HTTPS torrent-detail links on `therarbg.com` under `/post-detail/`.
- Use text metadata only. No images, torrent-file downloads, detail-page scraping, or media hosting.
- Preserve upstream `added` as `metadata.addedAt`; do not label it as the media release date.
- Use only the documented torrent search endpoint. Do not call title, extras, upcoming, collection, streaming, debrid, Verifile, or other endpoints. In particular, do not consume TMDB-backed metadata or imagery.

## Verification status

The Provider and focused fixture tests are in the feature branch. The five source catalog entries and one adapter preset are also in code. This does not mean the Provider is deployed, configured in KV, enabled, or live-verified. No production deployment or KV mutation has been performed. Full CI and Hosted Cloudflare verification remain pending.

## Official references

- https://therarbg.com/developers/
- https://therarbg.com/api/openapi.json
- https://therarbg.com/about-us/
- https://therarbg.com/dmca/
