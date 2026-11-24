# Sukebei RSS Provider

## Implementation

- Adapter ID: `sukebei-rss`
- Version: `1.0.0`
- Source ID: `sukebei`
- Category: `torrent`
- Search modes: `number`, `keyword`
- Capability: `magnet`
- Endpoint: `https://sukebei.nyaa.net/feed/magnet`
- Query parameters: `q`, `limit=50`

The adapter uses the site's documented public RSS magnet feed. It does not use HTML scraping, browser emulation, cookies, CAPTCHA handling, or challenge-solving code.

## Admin configuration

After deploying a Worker build containing this adapter:

1. Open Adapter Management and add:
   - ID: `sukebei-rss`
   - Name: `Sukebei RSS`
   - Version: `1.0.0`
   - Categories: `torrent`
   - Capabilities: `magnet`
   - Enabled: on
2. In Source Management, configure the existing `sukebei` entry:
   - Type: `provider`
   - Adapter: `sukebei-rss`
   - Category: `torrent`
   - Search modes: `number`, `keyword`
   - Capabilities: `magnet`
   - Base URL: `https://sukebei.nyaa.net`
   - Timeout: start with 10 seconds
   - Enabled: keep off until the live Worker test has been completed.

The adapter is registered in Worker code, but source and adapter configuration remain explicit KV-backed admin settings. A code deployment alone does not enable this source.

## Verification boundary

Automated tests use a fixed RSS fixture and mocked Fetch. They verify query encoding, magnet extraction, permalink normalization from the legacy `.si` host to the current `.net` host, and rejection of non-feed / non-success responses.

Those tests do **not** prove that Cloudflare Workers can reach the live endpoint. That must be checked in the isolated Cloudflare test environment before enabling the source.

## Upstream reference

The site's own RSS documentation describes the RSS 2.0 feed, the `/feed/magnet` variant, its `q` and `limit` parameters, and the fact that magnet links are returned in each item's `link` field:

- https://sukebei.nyaa.net/rss

The site's rules state that it mirrors torrent metadata from the upstream Nyaa / Sukebei sites and may contain entries later removed upstream, including entries that violate site rules or applicable law:

- https://sukebei.nyaa.net/rules

This provider only indexes and returns the metadata supplied by that public feed. It does not host torrent payloads or determine the legality or authorization status of any indexed item. Keep the source disabled until the operator has reviewed the source's content and the applicable rules for the deployment jurisdiction.
