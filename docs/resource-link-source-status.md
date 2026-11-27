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

