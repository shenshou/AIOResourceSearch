# Resource-link source status

Review baseline: `feature/adapter-management`, 2026-11-27.
Scope: distinguish metadata-only providers from sources that actually return magnet, torrent-file, or ED2K links. This is a capability inventory, not a statement that any source is enabled in production.

## Current implementation inventory

The source catalog currently contains **30 torrent-category entries**:

| Catalog state | Count | Meaning |
|---|---:|---|
| Provider source records | 10 | A Worker adapter is implemented and declared in the source catalog |
| External-only / unverified records | 20 | User-initiated navigation only; no Worker acquisition |
| Total | 30 | Retain all entries, including unverified candidates |

The 10 Provider records map to **6 unique adapter implementations**. The five The RarBg rows are five content-category configurations that share one adapter.

| Adapter | Source record(s) | Link output | Notes |
|---|---|---|---|
| `sukebei-rss` | Sukebei | Magnet | Public RSS magnet feed; JAV/adult torrent index |
| `torlock-torznab` | Torlock | Magnet | Torznab API |
| `yourbittorrent-json` | YourBittorrent | Magnet + .torrent URL | Official JSON API; Adult category is 7 |
| `dmhy-rss` | DMHY | Magnet | Public keyword RSS; anime category |
| `anibt-torznab` | AniBT | .torrent URL | Public Torznab API; anime category |
| `the-rarbg-json` | The RarBg · JAV / Anime / Film-TV / Games / Music | Magnet | One JSON adapter shared across five source records |

The source catalog notes still require hosted Cloudflare verification, policy review, or conservative pacing before activation for the listed Providers. This document does not enable any source or mutate production KV.

## Link contract already implemented

The project does not need a new result model to carry these link types:

- `packages/shared/src/index.ts` defines `ResourceLinkType = "magnet" | "torrent" | "ed2k"`, `ResourceLink`, source capabilities `magnet`, `torrent`, `ed2k`, and optional `magnetUri`, `torrentUrl`, `ed2kUri` fields in the normalized resource contract.
- `apps/worker/src/providers/search.ts` normalizes, validates, deduplicates and merges link records while retaining source attribution.
- `apps/worker/src/providers/generic-html.ts` and `html-parser.ts` support declarative selectors for magnet, torrent and ED2K links. The source's declared capability must match its configured selector.
- The ED2K validator accepts a file URI in the standard shape `ed2k://|file|NAME|SIZE|32-HEX-MD4|/`; it does not treat ED2K server or server-list URIs as downloadable file links.

**Important distinction:** ED2K transport support exists in the shared contract and HTML adapter, but there is currently **no ED2K source Provider** in the registry/catalog.

## ED2K source research

### Protocol reality
- ED2K file links identify a file by name, size and MD4 hash. aMule documentation distinguishes file links from server/server-list links and describes how compatible clients consume them.
- Searching for ED2K files is not equivalent to calling a conventional HTTP metadata API. eMule/aMule search uses an eD2K server or the decentralized Kademlia (Kad) network; Kad queries are distributed to peers.
- A Worker cannot simply turn an ED2K URI parser into a search source. A live Kad search engine requires network protocol handling, UDP connectivity, node/contact state and a long-running service.

### Candidate findings
| Candidate | What it provides | Current assessment |
|---|---|---|
| [hahajing](https://github.com/zhongziso/hahajing) | MIT-licensed Go web application that queries the eMule Kad network and displays ED2K links | Architecture reference only. The repository's last code push was 2018-03-25; its documented search path validates Movie/TV queries through Douban/Mtime before KAD lookup. It is a self-hosted KAD search engine, not a maintained public API or Cloudflare Worker adapter. Do not copy its network implementation into the Worker. |
| [tg-search public API](https://github.com/power721/tg-search/blob/main/docs/public-api.md) | API can return magnet and ED2K links from a locally indexed Telegram resource repository | Not a general ED2K index. The API requires an API key and queries that service's own indexed data; building the index requires a separate service and storage. Not a fit for the current no-database/no-paid-dependency architecture. Retain as a future integration reference only. |
| eMule / aMule / eMule Qt | Native ED2K/Kad search clients and link handlers | Client/protocol references, not remote search providers for this Worker. |

No first-party public ED2K search API, RSS feed, or permitted HTML index with a stable search contract was verified in this pass. No KAD node was contacted and no external ED2K service was queried.

## Current gap and next implementation boundary

1. Keep the existing six magnet/torrent adapters and their source records intact.
2. Do not create a fake ED2K Provider from the URI validator alone.
3. Continue reviewing the 20 external-only torrent candidates for a first-party public API/RSS/search contract and automation permission. Prioritize JAV/adult resource indexes, while retaining anime/general sources as separate content categories.
4. For ED2K, only consider a source when it offers a documented public HTTP API/RSS or an explicitly authorized stable search interface. A self-hosted Kad engine would require a separate architecture decision and is not part of the current Worker topology.
5. Preserve per-link source attribution and validate the complete URI before returning it. Never invent a magnet/ED2K link from metadata or a detail-page URL.

## References
- aMule ED2K link syntax: https://amule-org.github.io/docs/p2p-networks/ed2k/links
- aMule search modes (server, global and Kad): https://wiki.amule.org/wiki/Search
- aMule accepted ED2K and magnet links: https://amule-org.github.io/docs/manual/configuration/ed2k-magnet-links
- hahajing repository: https://github.com/zhongziso/hahajing
- tg-search public API contract: https://github.com/power721/tg-search/blob/main/docs/public-api.md
- Current project shared contract: `packages/shared/src/index.ts`
- Current Worker normalizer and HTML parser: `apps/worker/src/providers/search.ts`, `apps/worker/src/providers/generic-html.ts`, `apps/worker/src/providers/html-parser.ts`

## External torrent-source review batch 1 — 2026-11-27

The first five external-only torrent candidates were rechecked for first-party resource-link interfaces and permission evidence.

| Source | First-party/current observation | Decision |
|---|---|---|
| 141PPV | The exact official `/feeds/` page could not be retrieved in this session. RSSHub's route documentation explicitly says the official 141PPV feed does not support BT download subscriptions. | Keep homepage-only; no Worker RSS Provider and no magnet extraction from a third-party RSSHub route. |
| BTSOW | The catalog's `.com` destination is not verified as the current operator-controlled service. A separately surfaced `btsow.live` page renders a BTSOW magnet-search UI but provides no readable policy/API details; the domain's canonical relationship to the catalog operator is unverified. | Do not silently switch to `.live`; keep the existing record unverified and external-only. |
| Empornium | The official `.sx` homepage is reachable but presents a login path. Independent indexer documentation classifies Empornium as a private tracker. Its status page reports service health, not a public catalogue API. | Private/account-based source; no authenticated Worker access, cookies, invite flow or private-feed ingestion. |
| iJavTorrent | The first-party homepage is currently readable and visibly exposes a search/filter UI, more than 10,000 movie records, and multiple magnet links per listing with size and seeder/leecher counts. The homepage search form does not establish a stable supported query URL or API/RSS contract. No Terms/Privacy/API/RSS text was found in the page extraction; robots.txt and sitemap.xml could not be retrieved by the research browser. | Keep external-only. Do not scrape HTML, harvest magnets or infer permission from the public UI. Reassess only after first-party terms and a supported public interface are established. |
| JAVBEE | The exact catalog domain `javbee.org` could not be opened. No first-party API/RSS or automation permission was verified. | Keep unverified/homepage-only; no alternate domain or mirror substitution. |

### Additional candidate discovered: Magnetz
- Magnetz currently advertises free search/browsing after account confirmation, but magnet links and the JSON API are member-only. Its first-party Terms state that membership is paid (one-year and lifetime plans); members receive a personal API key with a combined limit of 1,000 requests/day for the JSON API and MCP server.
- This violates the project's no-paid-dependency rule and is not a verified JAV-specific source. Do not register, pay, request an API key or integrate it. Keep only as a research reference; it is not added as a production source.
- First-party references: https://magnetz.eu/about ; https://magnetz.eu/help/getting-started/start-here ; https://magnetz.eu/terms

### Batch result
- 5 existing catalog candidates rechecked; 0 promoted to Provider; 0 search templates added.
- iJavTorrent is technically rich in magnet listings but remains external-only because the required first-party automation permission and supported interface were not established.
- Magnetz is rejected for the current project because magnet/API access requires paid membership.
- No access control was bypassed, no private tracker account was used, and no source was enabled or deployed.

## External torrent-source review batch 2 — 2026-11-27

The next five external-only candidates were rechecked.

| Source | Current evidence | Decision |
|---|---|---|
| JavJunkies | The exact `javjunkies.org` homepage could not be retrieved. Existing third-party observations report a "No Access" response and possible phishing/malware reputation signals; these signals are not definitive, but there is no first-party API/RSS, terms or public search contract to rely on. | Keep as historical/unverified directory record; no clickable alternate domain, credentials, scraping or Worker requests. |
| LoveTorrent | The exact `lovetorrent.net` homepage could not be retrieved. No current operator-controlled service, first-party Terms, API/RSS or stable public search contract was verified. | Keep as name-only unverified candidate; do not guess mirrors or automate access. |
| MagnetDL | The exact `magnetdl.com` homepage could not be retrieved. TorrentFreak documented an official shutdown announcement in May 2019 followed by a quick return; later third-party monitoring currently reports the main domain down, but no current first-party closure/migration announcement was found. Similar `.io` and `.co` domains are not confirmed official mirrors. | Keep historical name-only record. No mirror substitution, scraping or Provider. Do not claim permanent closure as a verified current fact. |
| My JAV Bay | The first-party homepage is reachable and shows a current VR JAV metadata catalogue with title/code, cast, release date and size information. No magnet or torrent URI appears in the homepage extraction, and no official API/RSS or explicit third-party automation permission was verified. A third-party paid scraper explicitly says it does not use an official MyJAVBay API. | Metadata/navigation candidate only, not a resource-link Provider. Keep external-only; do not use paid scraper services or harvest page metadata/magnets. |
| NextJAV | The exact `nextjav.com` homepage could not be retrieved. Current third-party domain observations show registrar/parking indicators; no first-party operator-controlled service or official replacement domain was verified. | Keep historical name-only record; remove/avoid clickable destination and do not substitute mirrors. |

### Batch result
- 5 existing candidates rechecked; 0 promoted to Provider; 0 search templates added.
- My JAV Bay is confirmed as a metadata catalogue from the current homepage view, not a magnet/torrent source in the extracted page.
- MagnetDL's historical 2019 shutdown and return are documented, but current permanent closure is not confirmed by a current first-party announcement.
- No mirror, private account, access-control bypass or paid scraping service was used.

## External torrent-source review batch 3 — 2026-11-27

| Source | Current evidence | Decision |
|---|---|---|
| OneJAV | The official `/feeds/` endpoint returned HTTP 403 in this review. RSSHub's route documentation says OneJAV's official feed does not support BT downloads; its separate BT route is a third-party HTML extraction route, not an official feed/API contract. | Keep external-only. Do not use RSSHub as permission to scrape or bypass the 403. |
| ProjectJAV | The exact first-party homepage returned HTTP 403. Previous public observations show the site has a JAV catalogue and magnet listings, but no first-party API/RSS or applicable automation terms were verified. | Keep external-only; no cookies, proxy, challenge handling or alternate route probing. |
| TorrentKitty | The branded `.net` landing page describes a torrent-file-to-magnet conversion service and lists `torrentkitty.tv` as a permanent domain. No official search API/RSS or automation terms were found. Third-party bots parse a `/search/{query}` page, but that is not an operator-supported API or permission. | Keep external-only; do not implement third-party scraper routes or use a mirror to work around regional blocking. |
| XXXClub | The exact `xxxclub.to` homepage returned HTTP 403. Third-party Jackett/Prowlarr definitions and issue logs show that an indexer can query `/torrents/search`, but this is community reverse-engineering, not first-party authorization. | Keep external-only; do not reproduce the scraper or bypass the 403. |
| Bitsearch | The first-party API documentation explicitly invites programmatic access. Anonymous tier: 200 requests/day per source IP with no key; optional free account: 1,000/day. It documents `GET /api/v1/search`, category 10 = Adult Content, pagination (max 100), rate-limit headers, and a detail endpoint that returns `magnetUri`. The first-party removal page describes its index as metadata from the public BitTorrent network and offers takedown handling. However, no applicable Terms or explicit third-party metadata-display/republication grant was found; Privacy/About requests currently return server errors. Search results expose infohash, while the magnet URI is shown in the detail response, so full links can require additional calls. | **Priority technical candidate, not yet Provider.** Public API access is documented and free, but the shared 200/day anonymous quota and multi-call detail flow may be too small for a public aggregator. Keep external-only until data-use terms and a sustainable rate-limit plan are confirmed. Do not use the optional account tier unless the project owner chooses it. |

### Batch result
- 5 existing candidates rechecked; 0 promoted to Provider.
- Bitsearch is the strongest new technical candidate in this batch: it has a documented free API and an explicit adult category, but its terms/data-display rights and shared quota remain unresolved.
- OneJAV, ProjectJAV and XXXClub were not accessed through 403 workarounds; TorrentKitty's third-party scraping route was not adopted.
- No source was enabled, no API key was created, and no production request was made.

## External torrent-source review batch 4 — 2026-11-27

| Source | Current evidence | Decision |
|---|---|---|
| Nyaa | The catalog's exact `nyaa.si` homepage, robots.txt and `/terms` could not be retrieved by the research browser. A separate Nyaa-branded `nyaa.media` site is currently accessible and its first-party Help documents keyword/category search, magnet links and search-filtered RSS; its Terms prohibit scraping that harms availability and bypassing security controls. However, no first-party evidence was found proving `nyaa.media` is the same operator-controlled canonical endpoint as the catalog's `nyaa.si`. | Keep the existing `.si` entry unchanged and external-only. Do not silently substitute `.media`, poll its RSS, or use third-party mirrors until the operator relationship is confirmed. |
| Shana Project | The first-party Help documents a public RSS feed containing the latest 50 releases and separate public/private follow-list feeds. The secure feed is personal and changes downloaded-item state. The current public feed endpoint returns XML/RSS content unsupported by the research browser, but the first-party documentation establishes its existence. It is a latest-release feed, not a keyword-search API. | Keep external-only for now. Do not access private token feeds or use the 50-item feed as if it were a complete keyword index. Reassess only if a search use case and terms permit a bounded public RSS integration. |
| AnimeBytes | Current tracker documentation continues to classify AnimeBytes as a closed private tracker; the Jackett indexer record also marks it private. | No public Provider. Do not use credentials, invitations, passkeys, private feeds or tracker APIs. |
| Tokyo Toshokan | The first-party settings page exposes category controls including JAV and Hentai, plus RSS customization and a magnet-link display option. The exact homepage and `/rss.php` both returned HTTP 403 in this review. No first-party Terms/API or permission for external aggregation was verified. | Keep external-only. Do not bypass 403 or use a third-party indexer definition as permission. |
| Mikan Project | The first-party homepage is reachable and exposes a public site-search control and current anime catalogue. Official subscription guidance describes a personal `/RSS/MyBangumi?token=...` feed; it is tied to a user's account/token. No public keyword RSS/API or permission for shared third-party feed aggregation was verified. | Keep metadata/RSS candidate external-only. No login, personal token collection, shared private RSS, scraping or regional-route workaround. |

### Batch result
- 5 existing candidates rechecked; 0 promoted to Provider.
- Nyaa.media has a useful documented search/RSS/magnet interface, but it is not substituted for the catalog's nyaa.si without first-party canonical-domain confirmation.
- Shana Project has a public latest-50 RSS feed but no public keyword-search contract; its private follow feed is out of scope.
- Tokyo Toshokan's 403 was not bypassed; AnimeBytes remains private; Mikan's personal token feed is not a public search API.
- No source was enabled or deployed.

## External torrent-source review batch 4 — 2026-11-27

| Source | Current evidence | Decision |
|---|---|---|
| Nyaa | The catalog's exact `nyaa.si` homepage, robots.txt and `/terms` could not be retrieved by the research browser. A separate Nyaa-branded `nyaa.media` site is currently accessible and its first-party Help documents keyword/category search, magnet links and search-filtered RSS; its Terms prohibit scraping that harms availability and bypassing security controls. However, no first-party evidence was found proving `nyaa.media` is the same operator-controlled canonical endpoint as the catalog's `nyaa.si`. | Keep the existing `.si` entry unchanged and external-only. Do not silently substitute `.media`, poll its RSS, or use third-party mirrors until the operator relationship is confirmed. |
| Shana Project | The first-party Help documents a public RSS feed containing the latest 50 releases and separate public/private follow-list feeds. The secure feed is personal and changes downloaded-item state. The current public feed endpoint returns XML/RSS content unsupported by the research browser, but the first-party documentation establishes its existence. It is a latest-release feed, not a keyword-search API. | Keep external-only for now. Do not access private token feeds or use the 50-item feed as if it were a complete keyword index. Reassess only if a search use case and terms permit a bounded public RSS integration. |
| AnimeBytes | Current tracker documentation continues to classify AnimeBytes as a closed private tracker; the Jackett indexer record also marks it private. | No public Provider. Do not use credentials, invitations, passkeys, private feeds or tracker APIs. |
| Tokyo Toshokan | The first-party settings page exposes category controls including JAV and Hentai, plus RSS customization and a magnet-link display option. The exact homepage and `/rss.php` both returned HTTP 403 in this review. No first-party Terms/API or permission for external aggregation was verified. | Keep external-only. Do not bypass 403 or use a third-party indexer definition as permission. |
| Mikan Project | The first-party homepage is reachable and exposes a public site-search control and current anime catalogue. Official subscription guidance describes a personal `/RSS/MyBangumi?token=...` feed; it is tied to a user's account/token. No public keyword RSS/API or permission for shared third-party feed aggregation was verified. | Keep metadata/RSS candidate external-only. No login, personal token collection, shared private RSS, scraping or regional-route workaround. |

### Batch result
- 5 existing candidates rechecked; 0 promoted to Provider.
- Nyaa.media has a useful documented search/RSS/magnet interface, but it is not substituted for the catalog's nyaa.si without first-party canonical-domain confirmation.
- Shana Project has a public latest-50 RSS feed but no public keyword-search contract; its private follow feed is out of scope.
- Tokyo Toshokan's 403 was not bypassed; AnimeBytes remains private; Mikan's personal token feed is not a public search API.
- No source was enabled or deployed.



## Bitsearch — magnet-link and API quota feasibility (2026-11-27)

**Status: priority technical candidate; not implemented or enabled.**

The first-party API docs specify:
- `GET /api/v1/search`, `q` required, optional `category`, sort/order, page and `limit` up to 100.
- Category `10` is explicitly labelled Adult Content.
- Free anonymous quota: 200 requests/day per source IP; free account/API key: 1,000 requests/day per account.
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Search records contain `infohash`, title, size, category, seeders/leechers, verified flag and createdAt. The detail endpoint returns `magnetUri`.

### Important optimization: no detail call required for a basic magnet

A full BTIH infohash returned by the search endpoint can be transformed deterministically into a minimal magnet URI:

`magnet:?xt=urn:btih:<full-infohash>`

The project normalizer already accepts a valid BTIH hash in 40-hex or 32-base32 form. Therefore a future adapter can:
1. validate the full hash strictly;
2. build the minimal magnet URI from that exact hash;
3. optionally add a safely encoded display name only if useful;
4. avoid per-result detail calls unless additional fields are actually needed.

This changes the expected request pattern from `1 search + N detail calls` to `1 search call per uncached query/page`. Do not synthesize a magnet if the API returns a truncated, malformed or missing hash.

### Quota and runtime design gates

- Cache exact normalized search URL/query responses before contacting the upstream API; use a conservative TTL and never let a cache failure discard valid upstream results.
- Add a dedicated shared Durable Object lane and daily request counter. A spacing-only throttle is insufficient to enforce a 200/day or 1,000/day daily budget.
- Parse all documented rate-limit headers; on 429/403 or quota exhaustion, fail closed and honor reset information. Never rotate IPs, proxy, or otherwise evade the quota.
- The 200/day quota is per source IP. Actual Cloudflare Worker egress/quota behavior is unverified. The optional free-account tier is 1,000/day/account, not unlimited.
- Cap pages and results per search; do not crawl the full index.

### Remaining blockers

- The API docs explicitly invite programmatic access, but no separate grant for public third-party display, caching or republication of results was found.
- Terms, Privacy and About pages could not be retrieved in this research pass.
- The live JSON search endpoint could not be retrieved by the research browser, so live response shape and Worker reachability are not validated.
- No account or API key was created; no live API request or production change was made.

Decision: keep external-only / priority technical candidate. Reconsider implementation only after public result display/reuse terms and real Worker quota behavior are clarified.

References:
- First-party API docs: https://bitsearch.eu/api
- First-party content-removal page: https://bitsearch.eu/content-removal
- Current BTIH validation: `apps/worker/src/providers/search.ts`
- Current shared rate limiter: `apps/worker/src/rate-limit-coordinator.ts`

## ED2K follow-up research — 2026-11-27

The additional search did not uncover a public hosted ED2K text-search API suitable for a Cloudflare Worker. It did surface two distinct tools that must not be confused with an index provider:

| Candidate | Actual capability | Assessment |
|---|---|---|
| [ed2k-indexer](https://github.com/tronarite/ed2k-indexer) | MIT-licensed, self-hosted Python/Flask Torznab bridge. It scrapes configured sources, uses TMDB/OMDb to resolve movie/TV titles, and forwards selected ED2K links to a locally running eMule WebInterface. Requires Docker Compose, eMule on the host, credentials, local download/watch/media folders and a publicly reachable Torznab endpoint for Radarr/Sonarr. | Not a hosted ED2K index or API. It depends on a local eMule service and filesystem paths, and its scraper is source-specific. This conflicts with the project's Cloudflare-only/no-local-media-management architecture. Retain as a design reference for translating ED2K results into Torznab, but do not deploy or copy its scrapers. |
| [ed2k-stats](https://ed2k.shortypower.org/) | Accepts an existing ED2K link or hash and displays network statistics; its eMule Web Services integration is a hash lookup URL. | Hash lookup/enrichment only, not keyword discovery and not a source of new ED2K file links. It cannot fill the ED2K Provider gap. |

### Protocol confirmation
- The aMule first-party docs define file links as `ed2k://|file|NAME|SIZE|MD4-HASH|/`; file identity is the MD4 hash plus file size. Server and server-list links are different URI types and must not be accepted as downloadable file links.
- aMule supports searches against a connected server, all known servers, and the decentralized Kad network. Those are client/network operations, not a public REST API that a Cloudflare Worker can call by simply issuing an HTTP request.
- A hosted aMule controller API can expose search if an operator runs an aMule instance, but that would add a separate continuously running service, credentials and network exposure. It is not an upstream public catalogue and is outside the current deployment model.

### Decision
- ED2K remains supported as a normalized output-link type, but there is still no approved ED2K Provider.
- Do not create a Kad client inside the Worker, connect to public Kad peers, scrape arbitrary eMule web interfaces, or deploy a self-hosted indexer as an unapproved sidecar.
- Reopen if a first-party public HTTP API/RSS with documented query access and reuse terms appears, or if the project owner explicitly approves a separate hosted ED2K search service.

References:
- aMule ED2K file-link syntax: https://amule-org.github.io/docs/p2p-networks/ed2k/links
- aMule supported search modes: https://amule-org.github.io/docs
- ed2k-indexer repository and setup: https://github.com/tronarite/ed2k-indexer
- ed2k-stats hash lookup: https://ed2k.shortypower.org/

