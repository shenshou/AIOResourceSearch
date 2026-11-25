# DMHY RSS Provider

## Status

- Provider ID: `dmhy-rss`
- Version: `1.0.0`
- Mechanism: RSS 2.0
- Source category: `torrent`
- Content category: `anime`
- Capabilities: metadata, magnet
- Search mode: keyword only
- Initial state: code registered; no KV adapter/source configuration, disabled until operator review and hosted verification.

## Official interface

- Official FAQ: `https://www.dmhy.org/cms/page/name/faq.html`
- Documented feed: `https://share.dmhy.org/topics/rss/rss.xml`
- Keyword filter: `?keyword={query}`
- The FAQ documents keyword matching and the same AND/OR search syntax used by the site's search page. It also documents category, team, and user-specific feed routes; this Provider deliberately implements only the keyword feed.
- The FAQ says the service is free and describes its content focus as anime, tokusatsu, and Japanese drama. Its publishing rules prohibit real-person pornography. This Provider is therefore classified as anime, not JAV.

## Implementation

- GET only; HTTPS only; no API key, account, cookie, browser emulation, or HTML scraping.
- Accepts RSS/XML content types and validates the RSS/channel envelope.
- Reads title, GUID/link, enclosure magnet URI, and publication date.
- Converts only canonical `share.dmhy.org/topics/view/{id}_*.html` detail links to HTTPS.
- Accepts only valid BTIH magnet hashes (40-character hex or 32-character base32).
- Does not fetch detail pages, images, torrent files, or other linked resources.
- Manual redirects; final URL must remain HTTPS on `share.dmhy.org`.
- Response body is streamed with a 2 MiB cap; no retries.
- No numeric request quota was found in the reviewed official FAQ. Keep the source disabled until ordinary Cloudflare Workers access, acceptable request pacing, and current site rules are verified. Do not treat the public RSS feature as permission to bypass any access controls.

## Operational state

The Provider is registered in the Worker compile-time registry, but this change does not write KV configuration, enable the source, run a live upstream request from Cloudflare, or deploy anything. The management UI requires an operator to create an enabled adapter definition and a disabled source definition with category `torrent`, content category `anime`, adapter ID `dmhy-rss`, capabilities `metadata` and `magnet`, and keyword search mode. Enable only after hosted verification and a separate content/legal review.
