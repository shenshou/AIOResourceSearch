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
