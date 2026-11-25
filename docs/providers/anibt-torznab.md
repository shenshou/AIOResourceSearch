# AniBT Torznab Provider

## Status

- Provider ID: `anibt-torznab`
- Version: `1.0.0`
- Mechanism: API (Torznab XML)
- Source category: `torrent`
- Content category: `anime`
- Search mode: keyword
- Capabilities: metadata, torrent
- Rate-limit lane: `anibt`
- Runtime state: registered in code, but no KV source/adapter config; disabled and not deployed

## Official contract

- Torznab endpoint: `https://anibt.net/torznab/api`
- Request: `GET` with `t=search`, `q={query}`, `cat=5070`, `limit=50`
- Authentication: none; no account or API key
- Keyword: maximum 160 UTF-8 bytes
- Result scope: anime releases; newest first
- Pagination: bounded offset, maximum item 300 (not currently used)
- Result fields documented by AniBT: original title, public `.torrent` download, category 5070/2000; seeders may be absent
- Rate limit: 60 requests / 60 seconds / IP
- Torznab caching: `no-store`
- Temporary unavailability: HTTP 503

Official references:
- https://wiki.anibt.net/en/docs/open-api/torznab
- https://wiki.anibt.net/en/docs/open-api/torznab-api
- https://wiki.anibt.net/en/docs/open-api/limits
- https://wiki.anibt.net/en/docs/open-api/caching

## Implementation behavior

- Uses the documented public Torznab endpoint only; no login, group API key, personal RSS token, or private subscription feed.
- Uses the shared Durable Object `anibt` lane at 1,100 ms between requests (about 54.5 requests/minute), leaving headroom under the documented 60/minute/IP limit.
- Does not read or write Cache API entries because the official caching guide marks Torznab as `no-store`.
- Does not retry 429/503. The shared fetch wrapper records upstream cooldown and honors `Retry-After` when supplied.
- Enforces the 160-byte UTF-8 query bound, 2 MiB streamed response limit, HTTPS, exact `anibt.net` host, manual redirects, and XML content type.
- Accepts only `https://anibt.net/api/torrent/rel_*.torrent` torrent URLs. A same-origin `/release/{id}` GUID is used as the detail URL when supplied; otherwise the official torrent URL remains the actionable result URL.
- Maps title, release ID, publication date, torrent URL, size, seeders, and peers. It does not infer a magnet URI.
- Does not fetch torrent bytes, images, or detail pages.

## Policy and enablement gate

The official documentation explicitly instructs users to integrate AniBT with Sonarr, Radarr, and Prowlarr using its public anonymous Torznab API. This is sufficient to treat the endpoint as an intended third-party integration interface, not an access-control bypass.

The docs do not separately state a broad metadata-republication license. Keep the Provider disabled until content-policy review and non-production Cloudflare connectivity checks are complete.

No KV configuration, source enablement, production changes, or deployment is included.
