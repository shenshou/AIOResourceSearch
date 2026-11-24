# Torlock Torznab Provider

## Registration

- Adapter ID: \`torlock-torznab\`
- Version: \`1.0.0\`
- Category: \`torrent\`
- Capability: \`magnet\`
- Search modes: \`number\`, \`keyword\`
- Endpoint: \`https://www.torlock.com/torznab/api\`
- Authentication: none
- Adult category: Newznab \`6000\`

Create adapter metadata with the exact ID/version/category/capability above. Configure a source with type \`provider\`, adapter ID \`torlock-torznab\`, category \`torrent\`, capability \`magnet\`, and both search modes. Keep the source disabled until a Cloudflare test deployment confirms normal connectivity and the operator has reviewed the content scope.

## Request behavior

The adapter sends:

\`\`\`text
GET /torznab/api?t=search&q=<encoded-query>&cat=6000&limit=50
\`\`\`

- Uses the documented Torznab endpoint; no HTML scraping.
- No API key or account is required by the published documentation.
- Parses RSS/Torznab item title, detail URL, Magnet URL, publication date, seeders, peers, and size where supplied.
- Accepts detail URLs only on Torlock's documented official domains and \`/torrent/\` path.
- Validates Magnet URIs for a BitTorrent infohash.
- Uses manual redirect handling and a 2 MiB streaming response cap.
- Does not retry 429 or other non-success responses.
- Uses Cloudflare's edge Cache API with a 60-second TTL for the exact request URL, matching Torlock's stated request interval. Cache entries are per edge location, not a globally atomic quota; this is a best-effort reduction in repeated requests, not a global rate limiter.

## Fair-use and access restrictions

Torlock says its feeds are free for apps/clients, asks clients to cache, and says not to request the same URL more than once per minute. It recommends Torznab rather than scraping HTML. It also says datacenter traffic may be filtered and offers an explicit whitelisting request process.

This project does not automate whitelisting, rotate proxies, spoof clients, or bypass blocks. If ordinary Worker requests are blocked, keep the Provider disabled and retain the external homepage/search link instead.

## Tests and verification boundary

Fixture-based tests cover:
- Adult category and query construction;
- Torznab item parsing and Magnet validation;
- edge-cache hit and 60-second cache response;
- malformed RSS and untrusted detail URL rejection;
- no retry on HTTP 429.

Tests use mocked Fetch and an in-memory cache stub. They do not establish live Cloudflare connectivity or guarantee cache behavior across all edge locations.

## Official references

- Torznab API and fair-use notes: https://www.torlock2.com/apis.html
- Torlock FAQ, API use and scraping guidance: https://www.torlock.com/faq.html
- Official domains: \`www.torlock.com\` and \`torlock2.com\`
