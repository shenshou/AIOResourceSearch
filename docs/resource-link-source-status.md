# Resource-link source status

Review baseline: `feature/adapter-management`, 2026-11-27.
Scope: distinguish metadata-only providers from sources that actually return magnet, torrent-file, or ED2K links. This is a capability inventory, not a statement that any source is enabled in production.

## Current implementation inventory

The source catalog currently contains **56 torrent-category entries**:

| Catalog state | Count | Meaning |
|---|---:|---|
| Provider source records | 10 | A Worker adapter is implemented and declared in the source catalog |
| External-only / unverified records | 46 | User-initiated navigation only; no Worker acquisition |
| Total | 56 | Retain all entries, including unverified candidates |

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
3. Continue reviewing the 42 external-only torrent candidates for a first-party public API/RSS/search contract and automation permission. Prioritize JAV/adult resource indexes, while retaining anime/general sources as separate content categories.
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



## Newly discovered torrent candidate — ØMagnet / 无极磁链 (2026-11-27)

- The first-party homepage at https://0cili.org identifies the service as a torrent/magnet sharing platform and magnet search engine, exposes a search field, reports approximately 2.8 million indexed magnet links, and lists its own backup domains. The catalog uses the first-party homepage domain only; no alias or mirror switching is configured.
- The current Servarr/Prowlarr supported-indexers catalogue classifies ØMagnet as a Chinese public tracker for Asian adult/JAV material. A Jackett feature request describes it as a public mixed-adult-content magnet-sharing site, mainly JAV and films. These are third-party descriptions of the service/category, not first-party API or automation permission.
- No first-party API documentation, RSS contract, stable supported query endpoint, Terms granting automated retrieval, or licence for public metadata/magnet aggregation was verified. Community indexer code is reverse-engineered integration evidence, not authorization. Historical FlareSolverr integration reports also show challenge-solving dependencies in some configurations; this project must not adopt those paths.
- **Decision:** add ØMagnet as a retained JAV/Torrent external-only candidate with the verified first-party homepage. Do not add a search template, Worker Provider, HTML scraper, challenge solver, or undocumented endpoint call. Reassess only if the operator publishes a supported public interface and applicable automation/reuse terms.
- Inventory after adding the directory record: **31 torrent-category entries = 10 Provider records + 21 external-only/unverified records**. The six existing adapter implementations are unchanged; no source was enabled or deployed.

References:
- First-party homepage: https://0cili.org/
- Servarr/Prowlarr supported indexers: https://github.com/Servarr/Wiki/blob/master/prowlarr/supported-indexers.md
- Jackett 0Magnet request and operator description: https://github.com/Jackett/Jackett/issues/10738
- FlareSolverr troubleshooting context: https://github.com/FlareSolverr/FlareSolverr/wiki/Troubleshooting


## External torrent-source review batch 5 — 2026-11-27

Five additional candidates surfaced from the current Prowlarr/Jackett public-indexer catalogues were reviewed. Their community indexer classifications establish candidate discovery only; they do not establish first-party permission to automate, reuse, cache, or publicly display data.

| Source | First-party/current evidence | Decision |
|---|---|---|
| Free JAV Torrent | The first-party homepage is reachable and exposes JAV categories, search UI and resource metadata. No magnet URI, .torrent URL, official API/RSS contract, or stable supported query contract was verified in the extracted page. Its Terms permit only personal, non-commercial, temporary viewing and prohibit copying, public display (commercial or non-commercial), transfer and mirroring. The homepage's Tracker link points to PornXLab, but an operator relationship is not established. | Retain as JAV/Torrent external-only directory entry. No Worker fetching, metadata extraction, magnet harvesting, or search template. |
| MyPornClub | Prowlarr/Jackett classify it as a public adult tracker; Jackett's historical request identifies https://myporn.club/. The first-party homepage returned HTTP 403 in this review. A community qBittorrent plugin demonstrates HTML parsing, not first-party authorization. No current first-party API/RSS, terms or automation/reuse permission was verified. | Retain original homepage as external-only. No scraping, community scraper reuse, or 403 bypass. |
| PornXLab | The first-party homepage is reachable and shows search/category controls and resource listings, but the homepage extraction did not verify magnet URIs, .torrent URLs, or an official API/RSS contract. First-party Terms grant only personal, non-commercial, temporary viewing and prohibit copying, public display (commercial or non-commercial), transfer and mirroring. | Retain as external-only. The stated licence conflicts with automated aggregation/public display; no Worker fetching or metadata/link extraction. |
| PornRips | The first-party homepage is reachable and shows a search field and recent release posts. Its Requests page says users should provide an external download link for items not downloadable from XXXClub; this does not establish PornRips as a magnet/torrent index or prove its posts contain magnet links. No first-party API/RSS or automation/reuse terms were verified. | Retain as external-only adult torrent candidate; do not treat it as a confirmed magnet provider, scrape posts, or harvest external download links. |
| U3C3 | Prowlarr classifies it as a public tracker focused on East Asian adult media. The first-party homepage could not be read. The community u3c3/bt-btt repository provides site/domain guidance, but is not first-party API/RSS documentation or an automation/reuse grant; its access-configuration advice is not adopted. | Retain the canonical u3c3.com destination as external-only. No hosts modification, mirror switching, scraping, or challenge/access-control workaround. |

### Batch result
- 5 new directory candidates added; 0 promoted to Provider; 0 search templates added.
- Current Torrent inventory: **36 entries = 10 Provider records + 26 external-only/unverified records**, backed by the same 6 existing Adapter implementations.
- None of these five is confirmed as an approved source of magnet or .torrent links. Free JAV Torrent and PornXLab have first-party terms that prohibit public display/copying under their stated limited-use licences.
- No login, account, proxy, challenge solver, region workaround, undocumented API call, source enablement, production KV write, or deployment was used.

References:
- Prowlarr supported-indexers list: https://github.com/Servarr/Wiki/blob/master/prowlarr/supported-indexers.md
- Jackett supported trackers: https://github.com/Jackett/Jackett
- Free JAV Torrent homepage and Terms: https://freejavtorrent.com/ ; https://freejavtorrent.com/page/tos.html
- PornXLab homepage and Terms: https://www.pornxlab.com/ ; https://www.pornxlab.com/page/tos.html
- MyPornClub first-party destination: https://myporn.club/
- PornRips homepage and Requests page: https://pornrips.to/ ; https://pornrips.to/requests/
- U3C3 community documentation: https://github.com/u3c3/bt-btt


## External torrent-source review batch 6 — 2026-11-27

Four additional adult/public tracker candidates were found in the current Prowlarr/Jackett indexer catalogue and cross-checked against available first-party or historical domain evidence. Because none of the exact first-party homepages could be verified in this pass, these are retained as name-only directory entries, not clickable destinations.

| Candidate | Evidence and uncertainty | Decision |
|---|---|---|
| OpenSharing | Prowlarr describes an OpenSharing public tracker for adult content. Third-party historical metadata mentions opensharing.org, but the current first-party request timed out and the domain/operator relationship is unconfirmed. Search also returns unrelated OpenSharing projects. | Name-only candidate; no baseUrl, mirror substitution, API/RSS, scraping or Worker requests. |
| PornoTorrent | Prowlarr describes a Brazilian public adult tracker. A third-party historical listing points to pornotorrent.com.br, but the available domain records are stale and show expiry-related historical data; no first-party current canonical domain or service status was verified. | Name-only candidate; do not restore the stale domain, guess a replacement, or automate access. |
| RinTor.NeT | Prowlarr lists a Russian public adult tracker. A historical third-party directory lists rintor.net, but the first-party homepage could not be retrieved; current operator control, service status, Terms, API/RSS and automation permission remain unknown. | Name-only candidate; no baseUrl, search template or Worker requests. |
| XXXTor | Prowlarr/Jackett list a public adult tracker; a historical third-party tracker directory lists xxxtor.net. The first-party homepage could not be retrieved and current canonical status, Terms, API/RSS and reuse permission remain unverified. | Name-only candidate; no baseUrl, mirror substitution or automation. |

### Batch result
- 4 additional name-only candidates retained; 0 Provider promotions; 0 clickable destinations or search templates added.
- Torrent inventory becomes **40 entries = 10 Provider records + 30 external-only/unverified records**. Unique adapters remain 6.
- This batch intentionally avoids treating third-party historical domain listings as canonical first-party URLs.
- No access-control workaround, source enablement, production KV write, deployment or CI run.

References:
- Prowlarr supported indexers: https://github.com/Servarr/Wiki/blob/master/prowlarr/supported-indexers.md
- Jackett supported trackers: https://github.com/Jackett/Jackett
- OpenSharing historical domain metadata: https://opensharing.org.atlaq.com/
- PornoTorrent historical domain record: https://pornotorrent.com.br/
- RinTor historical tracker listing: https://toptracker.ru/details.php?id=5675
- XXXTor historical tracker listing: https://toptracker.ru/details.php?id=5638


## External torrent-source review batch 7 — 2026-11-27

Three further adult/public candidates were identified in the current Jackett supported-indexer catalogue and checked against the current Jackett definitions and available first-party access evidence. Jackett explicitly describes itself as a proxy that translates tracker-specific HTTP requests and parses HTML/JSON; its definitions are community-maintained scraping logic, not first-party API contracts or permission grants.

| Candidate | Evidence and uncertainty | Decision |
|---|---|---|
| Sexy-Pics | Jackett classifies it as a public adult magnet-link site and its definition extracts magnet URLs from HTML search results. The definition also exposes a FlareSolverr configuration hint. The first-party homepage, robots.txt and likely Terms paths could not be retrieved in this review, so current operation, canonical URL, automation rules and public display/reuse rights remain unverified. | Name-only candidate. Do not reproduce the HTML scraper, use FlareSolverr/challenge solving, add a baseUrl or search template, or fetch the site. |
| sosulki | Jackett classifies it as a Russian public adult tracker and its definition maps adult categories and extracts magnet links. Its current definition lists a recently changed domain, and Jackett's 2026-11-22 release notes confirm a definition-domain update; neither is first-party evidence of canonical ownership or permission. | Name-only candidate. Do not adopt current or legacy domains from third-party indexer configuration, reuse its scraper, or automate access. |
| torrent-pirat | Jackett classifies it as a Russian public adult tracker with extensive adult categories. Its definition lists only an HTTP destination and explicitly notes that HTTPS is unsupported and the connection was refused. No first-party canonical HTTPS domain, Terms, API/RSS or automation/republication permission was verified. | Name-only candidate. Do not use plaintext HTTP, guess an HTTPS mirror, reuse the community scraper, or send Worker requests. |

### Batch result
- 3 additional name-only candidates retained; 0 Provider promotions; 0 clickable destinations or search templates added.
- Torrent inventory becomes **43 entries = 10 Provider records + 33 external-only/unverified records**. Unique adapters remain 6.
- The three candidates are not verified sources of magnet links for this project: the magnet selectors and extraction rules exist only in third-party Jackett definitions.
- No challenge solver, access-control workaround, account, source enablement, production KV write, deployment or CI run.

References:
- Jackett current supported trackers and project description: https://github.com/Jackett/Jackett
- Sexy-Pics third-party indexer definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/sexypics.yml
- sosulki third-party indexer definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/sosulki.yml
- torrent-pirat third-party indexer definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/torrent-pirat.yml
- Jackett v0.25.24 release note recording the sosulki definition-domain update: https://github.com/Jackett/Jackett/releases/tag/v0.25.24


## External torrent-source review batch 8 — 2026-11-27

Five adult trackers listed in current Prowlarr/Jackett catalogues were reviewed specifically for access class. These are not public anonymous sources: the current indexer classifications identify three as semi-private and two as private. Jackett definitions show account login or account-issued API-token requirements; this is technical discovery evidence only, not permission for AIOResourceSearch to access or republish their data.

| Candidate | Access evidence | Decision |
|---|---|---|
| PornoLab | Prowlarr/Jackett classify it as a Russian semi-private adult tracker; Jackett's definition contains an account login form. | Retain as name-only candidate. No account creation, login automation, cookies, private-feed access or scraping. |
| ProPorno | Classified as a Russian semi-private adult tracker; the Jackett definition includes username/password login. | Retain as name-only candidate. No credentials, account session or Worker integration. |
| PussyTorrents | Classified as a semi-private adult tracker; the Jackett definition includes username/password settings and a login route. | Retain as name-only candidate. No account access or private data ingestion. |
| ClearJAV | Classified as a private JAV tracker. The Jackett API definition says its Bearer API key is generated from the user's account settings; this is an account-bound API, not a public anonymous API. | Retain as name-only JAV candidate. No account creation, token collection/storage, authenticated API calls or result republication. |
| Fappaizuri | Classified as a private Hentai/JAV tracker; the Jackett definition includes account login and 2FA-related configuration, plus a FlareSolverr configuration hint. | Retain as name-only JAV candidate. No credentials, cookies, 2FA, challenge solving or scraper reuse. |

### Batch result
- 5 private/semi-private candidates retained; 0 Provider promotions; 0 clickable destinations or search templates added.
- Torrent inventory becomes **48 entries = 10 Provider records + 38 external-only/unverified records**. Unique adapters remain 6.
- These records are directory completeness entries only. They are not a request to integrate private tracker accounts or to bypass access controls.
- No account/API token was created or used; no source was enabled; no production KV write, deployment or CI run.

References:
- Prowlarr supported indexers: https://github.com/Servarr/Wiki/blob/master/prowlarr/supported-indexers.md
- Jackett supported trackers and access categories: https://github.com/Jackett/Jackett
- PornoLab definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/pornolab.yml
- ProPorno definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/proporno.yml
- PussyTorrents definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/pussytorrents.yml
- ClearJAV API definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/clearjav-api.yml
- Fappaizuri definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/fappaizuri.yml


## External torrent-source review batch 9 — 2026-11-27

Four more adult private trackers from the current Prowlarr/Jackett catalogues were retained after checking the corresponding Jackett definitions. Each requires an account-bound login, cookie or authenticated session; the community definitions are implementation references, not permission to access or redistribute private tracker data.

| Candidate | Access evidence | Decision |
|---|---|---|
| ExoticaZ | Classified as a private adult tracker. Jackett implements it through its AvistaZ private-tracker login framework and records a legacy domain alias. | Name-only candidate; no account, session, cookie, or legacy-domain substitution. |
| Femdomcult | Classified as a private fetish/adult tracker. Jackett's definition notes that its API call needs an account auth key and uses authenticated page parsing. | Name-only candidate; no account, auth-key collection, login, or scraping. |
| HappyFappy | Classified as a private adult tracker; Jackett provides a login definition and a separate 2FA-cookie variant. | Name-only candidate; no credentials, cookies, 2FA, or private-feed integration. |
| Pornorip | Classified as a private adult DVD tracker; Jackett's definition uses a supplied account cookie because normal login handling is insufficient for its search flow. | Name-only candidate; no cookie acquisition, account session, or private result ingestion. |

### Batch result
- 4 additional name-only private candidates retained; 0 Provider promotions; 0 clickable destinations or search templates added.
- Torrent inventory becomes **52 entries = 10 Provider records + 42 external-only/unverified records**. Unique adapters remain 6.
- These records are directory completeness entries only; no account-bound integration is planned under the current phase.
- No credentials/cookies/auth keys were collected; no login, private feed, source enablement, KV write, deployment or CI run.

References:
- Prowlarr supported indexers: https://github.com/Servarr/Wiki/blob/master/prowlarr/supported-indexers.md
- Jackett supported trackers: https://github.com/Jackett/Jackett
- ExoticaZ implementation: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Indexers/Definitions/ExoticaZ.cs
- Femdomcult definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/femdomcult.yml
- HappyFappy definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/happyfappy.yml
- Pornorip definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/pornorip.yml


## External torrent-source review batch 10 — 2026-11-27

Two additional adult trackers in the current Jackett catalogue were checked against their maintained definitions:

| Candidate | Access evidence | Decision |
|---|---|---|
| BootyTape | Jackett classifies it as semi-private; its definition lists an account username/password login and an account-configured search flow. | Retain as name-only candidate; no account, credentials, private search, or scraper reuse. |
| Gay-Torrents.net | Jackett classifies it as semi-private; its definition includes username/password login and login-state validation. It contains adult and non-adult categories. | Retain as name-only candidate; no account-bound integration or private result ingestion. |

### Batch result
- 2 additional name-only semi-private candidates retained; 0 Provider promotions, 0 clickable destinations, and 0 search templates added.
- Torrent inventory becomes **54 entries = 10 Provider records + 44 external-only/unverified records**. Unique adapters remain 6.
- No credentials were collected, no account or private feed was accessed, and no source was enabled. No production KV write, deployment or CI run.

References:
- Jackett supported trackers and access categories: https://github.com/Jackett/Jackett
- BootyTape definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/bootytape.yml
- Gay-Torrents.net definition: https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/gay-torrents.yml


## External torrent-source review batch 11 — 2026-11-27

Two public torrent meta-search services were reviewed as potential general-category additions:

| Candidate | First-party capability evidence | Decision |
|---|---|---|
| Knaben Database | First-party homepage exposes XXX categories (Video, ImageSet, Games, Hentai). API v1 documents keyword POST search, category filters, `hide_xxx`, pagination and response fields including `tracker`, `details`, `hash`, and `magnetUrl`. | Technical candidate only. API documentation does not establish third-party aggregation, caching or public-display permission. No live search request was made. Keep homepage-only; no API call, Provider or search template. |
| Magnetz | First-party API documentation describes keyword search, pagination, magnet URI and info-hash fields. | The documentation explicitly says listings do not grant rights to copy or share content; adult-category coverage is unverified. Keep homepage-only; no API call, Provider or search template. |

### Batch result
- 2 additional general Torrent candidates retained; 0 Provider promotions, 0 search templates and 0 adapter changes.
- Torrent inventory becomes **56 entries = 10 Provider records + 46 external-only/unverified records**. Unique adapters remain 6.
- No live API search was performed, no source was enabled, and no production KV write, deployment or CI run occurred.

References:
- Knaben homepage/categories: https://knaben.org/
- Knaben API v1: https://knaben.org/api/v1/
- Magnetz API documentation: https://magnetz.eu/apis
