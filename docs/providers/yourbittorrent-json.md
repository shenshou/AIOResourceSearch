# YourBittorrent JSON Provider

## Registration

- Adapter ID: \`yourbittorrent-json\`
- Version: \`1.0.0\`
- Category: \`torrent\`
- Capability: \`magnet\`
- Search modes: \`number\`, \`keyword\`
- Endpoint: \`https://yourbittorrent.com/api/search.json\`
- Authentication: none
- Adult category ID: \`7\`

Create adapter metadata with the exact ID/version/category/capability above. Configure a source with type \`provider\`, adapter ID \`yourbittorrent-json\`, category \`torrent\`, capability \`magnet\`, and both search modes. Keep it disabled until a live Cloudflare test confirms normal access and the operator has reviewed the content scope.

## Request behavior

The adapter sends:

\`\`\`text
GET /api/search.json?q=<encoded-query>&category=7&limit=50
\`\`\`

- Uses the official documented JSON API for websites/apps/scripts.
- No account or API key is required.
- Maps the result name, detail page, Magnet URI, optional torrent file URL, size, seeders, peers, and verified flag.
- Does not map \`added_iso\` to release date: it is the time the torrent was indexed, not the media release date.
- Validates detail and torrent URLs against the official \`yourbittorrent.com\` host and expected paths.
- Validates Magnet URIs for a BitTorrent infohash.
- Uses manual redirect handling and a 2 MiB streaming response limit.
- Uses Cloudflare's edge Cache API with a 15-minute TTL, matching the API documentation's stated search freshness interval.
- Does not retry 503 or other non-success responses.

## Fair-use and access restrictions

The API documentation explicitly says the free API is intended for a user's own website, app, or script, and says to cache responses and not re-request the same URL more often than the published interval. It also warns that datacenter traffic may be filtered and provides a whitelisting request process.

This project does not automate whitelisting, rotate proxies, spoof clients, or bypass blocks. If ordinary Worker requests are blocked, keep the Provider disabled and retain the external-site link.

## Tests and verification boundary

Fixture-based tests cover:
- API endpoint, query, Adult category 7, and limit;
- metadata, detail, Magnet and torrent-file mapping;
- cache hit and 15-minute cache response;
- rejection of untrusted detail/torrent URLs;
- malformed JSON and no automatic retry on server errors.

Tests use mocked Fetch and cache. They do not prove live Cloudflare connectivity or guarantee cache behavior across all edge locations.

## Official references

- JSON API and Torznab documentation: https://yourbittorrent2.com/api.html
- FAQ and content safety notes: https://yourbittorrent2.com/faq.html
