# JAV Metadata Aggregation

This document defines the current Worker-side aggregation contract for JAV metadata. It is an implementation policy, not a claim that every candidate source is approved for automated retrieval or data reuse.

## Work identity

- Canonical detail URL is the primary identity key.
- For resources categorized as JAV, a conservative catalogue-number key is a secondary identity hint: NFKC normalization, uppercase, removal of non-ASCII alphanumeric separators, 4–40 characters, and at least one letter plus one digit.
- Catalogue-number matching is not applied to non-JAV categories.
- Titles, performer names, fuzzy similarity, and substring matches are not identity keys.
- Canonical URL identity also removes URL fragments, normalizes host casing/trailing slashes, strips only common analytics parameters (utm_* and fbclid/gclid/dclid/msclkid/mc_cid/mc_eid), and sorts remaining query parameters. It preserves source-specific parameters such as id, code, q, and page. The displayed result URL is never rewritten; these rules affect only identity matching.
- A catalogue-number match may combine distinct source URLs into one result; all contributing source attributions and unique external links are retained. If a canonical-URL match conflicts with a catalogue key already assigned to another result, the canonical-URL match wins for that record but the existing catalogue-key mapping is not reassigned.

## Field conflict policy

- Source results are processed in configured source order. The first valid, non-empty value is authoritative when sources disagree.
- Later sources may fill fields that are absent from the surviving result; they do not overwrite a selected title, canonical URL, catalogue number, release date, cover, description, or existing metadata key.
- Metadata is merged by key: an existing non-empty value wins, while previously absent keys can be supplied by later sources.
- Blank optional catalogue numbers, release dates, descriptions, and metadata values are discarded during normalization, so they cannot block a later source from filling the field.
- Resource links are combined by URL, deduplicated, and capped by the existing normalizer/aggregator limits. The first source's label wins when the same URL has conflicting labels.
- Source attribution is accumulated once per source ID. Per-source result counts continue to represent that Provider's pre-deduplication result count.

## Deliberate limitations

- There is no configurable per-field source-priority system yet. Adding one would require a separately designed, backward-compatible source configuration contract and administrator UI.
- This policy does not determine factual correctness when two non-empty sources disagree; it provides deterministic behavior and preserves provenance for later review.
- No source is enabled by this document. Data-use rights, upstream terms, and access-control boundaries remain separate source-review gates.
- This phase does not implement automated retrieval that bypasses login, paywalls, CAPTCHA, anti-bot challenges, geographic restrictions, rate limits, or other access controls.

## Verification

Additional URL-identity regression tests cover tracking-parameter removal/query-order normalization and preservation of meaningful query parameters. These tests are authored but not executed locally.

Focused unit tests now cover first-value-wins field and external-link conflicts, deterministic configured-source order despite out-of-order provider completion, blank-value filtering, catalogue-key collision isolation, JAV catalogue-number identity, category isolation, explicit relationship-capability enforcement, within-source relationship deduplication, URL-based entity identity, aliases and source provenance, relationship whitespace normalization, relationship-cap URL enrichment, Perverzija calendar-date validation, 600 ms lane spacing, `Retry-After` and `X-RateLimit-Reset` cooldown handling, cache hit/miss, invalid-cache refresh, cache allowlisting without unused image/media fields, coordinator fail-closed behavior, production-network mapping, global result cap and per-source count behavior, post-cap duplicate enrichment and attribution preservation, and Eporner performer/category/tag mapping plus URL validation. The focused tests are executed as part of the complete CI workflow. CI run [#46001993558](https://github.com/shenshou/AIOResourceSearch/actions/runs/46001993558) passed on branch head `432346d06e790c74e5889a59e1d990bcb4406e5a`, including lint, Worker unit tests, Durable Object runtime tests, frontend production build, and Worker type-check.

## Structured relationships

- A normalized work may carry typed relationships for performers, directors, studios, production networks, labels, series, genres, and tags.
- Relationship names are trimmed and bounded; optional entity URLs must be HTTPS and credential-free under the same URL validator used for other public links.
- Duplicate relationships are combined by type plus canonical entity URL when available. Without URLs, only a unique same-name identity is merged using NFKC normalization, whitespace folding, and case-insensitive comparison. A URL-backed record may enrich one unique name-only record; a name-only record is not attached to an existing URL-backed identity without evidence. This is deterministic identity matching, not fuzzy person/entity resolution.
- The first relationship display name and canonical URL remain authoritative; alternate observed names are retained as aliases, and contributing Provider sources are recorded. The 40-item cap limits new unique relationships but does not block evidence-backed URL enrichment for existing relationships. Ambiguous same-name records and records with conflicting URLs remain separate.
- The search UI renders relationship names and only links them when a validated HTTPS URL is supplied.
- Perverzija DB maps its documented studio, performer, and tag names into structured relationships while retaining the existing description text and attribution links. Its API calls use a shared 600 ms Durable Object lane (100 requests/minute, below the documented 120/minute/IP ceiling) and successful scene envelopes are cached for 300 seconds; cache hits bypass the coordinator. Its response does not establish canonical performer/studio URLs, so no entity URLs are fabricated.
- Eporner maps documented `pornstars` to performer relationships, `categories` to genre relationships, and comma-separated `keywords` to tag relationships. Its search request asks for `fields=pornstars,categories` in the same API call. Performer/category URLs are accepted only when they match the canonical HTTPS Eporner host and the documented `/pornstar/` or `/cat/` path. The existing active-status check, removal-feed gate, cache allowlist, shared request lane, and no-embed/no-image behavior remain intact.
- This is a shared result-contract foundation. Other Providers are not assumed to provide these fields until their response contracts are explicitly reviewed and their adapters are updated and tested.


## Multi-source downloadable resource links (2026-11-27)

- The shared result contract now supports a collection of downloadable resource links with explicit types: magnet, torrent, and ed2k.
- Each normalized link carries source attribution. When multiple Providers return the same work, distinct links are retained; identical type/URL pairs are deduplicated while their contributing source attributions are combined.
- Existing `magnetUri`, `torrentUrl`, and `ed2kUri` single-value fields remain populated as compatibility fields for older clients and integrations.
- Link values are accepted only when the matching source capability is declared and the value passes its protocol-specific validation. The Provider cannot override source attribution.
- The search interface now renders every normalized link, provides copy/open actions for magnet and ed2k, copy/download actions for Torrent links, and displays the source attribution for each link. It retains a legacy-field fallback for older API responses.
- Focused tests cover distinct links from separate sources, duplicate-link attribution merging, and rejection of provider-supplied forged attribution or links outside the declared capability.
- No candidate source is automatically enabled by this change.


## Generic HTML extraction: magnet, torrent and ed2k selectors (2026-11-27)

- The declarative HTML adapter (version 1.1.0) now supports independent CSS selectors for magnet, Torrent download and ed2k links, in addition to metadata, images and custom metadata fields.
- Source validation requires every declared downloadable-link capability to have its matching selector and rejects undeclared selector/capability mismatches.
- The parser collects up to 30 distinct selected links per result, including multiple links of the same type. It only reads anchor `href` values selected by the administrator. The Provider validates magnet info hashes, accepts only same-host HTTPS Torrent URLs without embedded credentials, and validates the ed2k file-link shape before returning them.
- The source-management interface exposes the three selectors separately. No script execution, browser emulation, redirect following, challenge solving, or access-control workaround is introduced.


## Current compiled Provider downloadable-link coverage (2026-11-27)

| Provider | Magnet | Torrent file URL | ED2K |
| --- | --- | --- | --- |
| DMHY RSS | Yes | — | — |
| Sukebei RSS | Yes | — | — |
| Torlock Torznab | Yes | — | — |
| The RarBg JSON | Yes | — | — |
| YourBittorrent JSON | Yes | Yes | — |
| AniBT Torznab | — | Yes | — |
| Generic HTML | Configurable | Configurable | Configurable |

- The YourBittorrent source-catalog entry now declares the Torrent capability as well as Magnet, so its returned `.torrent` URL is not discarded during source normalization.
- There is currently no dedicated API/RSS Provider returning ED2K links. The generic HTML adapter can extract ED2K from an explicitly configured public search page when the source's ED2K capability and CSS selector are both configured.
- This is a code capability matrix, not an assertion that every source is enabled, authorized for production aggregation, or currently reachable from Cloudflare. Existing source review and enablement gates remain in force.


## Per-field metadata source priority and provenance (2026-11-27)

- Runtime source configuration now supports `fieldPriorities`, a map from field key to an ordered list of Provider source IDs. Supported scalar fields are `title`, `catalogNumber`, `releaseDate`, `imageUrl`, and `description`; dynamic metadata keys use `metadata.<key>`.
- A missing field entry or an empty list preserves the existing global source order. Sources listed for a field are ranked first in the listed order; unlisted sources follow in their global source order. Only registered Provider source IDs are accepted.
- Field priorities are edited in the source-management interface and saved through an ETag-protected Worker admin endpoint. The setting is persisted in the existing source KV config and takes effect at runtime without redeployment.
- Every normalized scalar/metadata field records its winning `sourceId` and `sourceName` in `fieldAttributions`. The search UI exposes this provenance in a collapsible “字段来源” section.
- Source creation/import preserves the current priority map. Source deletion removes that source ID from all priority lists; an emptied list naturally falls back to global order.
- This does not change relationship aggregation (actors/studios/labels remain a deduplicated union) or downloadable-link attribution. The original global source order remains the deterministic tie-breaker.


## Related-entity identity and provenance (2026-11-27)

- Performer, studio, director and tag relationships retain the original display name and now record observed aliases plus the Provider source(s) that supplied the relationship.
- When a related-entity URL is present, matching uses relationship type plus canonical URL (tracking parameters and fragments are ignored). This can unify different display names that resolve to the same entity page.
- Name-only matching remains conservative: NFKC normalization, whitespace folding and case-insensitive comparison. If the same name points to different canonical URLs, the records remain separate; no fuzzy-name or transliteration guessing is performed.
- If exactly one same-name relationship has no URL, a later URL-backed record can enrich it. Ambiguous same-name records are not merged.
- Provider-supplied source attribution is discarded and replaced by the Worker source identity. The search UI displays aliases and contributing sources with each related entity.


### Explicit relationship capability

- Related entities are a distinct source capability, `relationships`, rather than being implicitly exposed by the scalar `metadata` capability.
- Sources must declare `relationships` before Worker normalization will expose performer, studio, director, genre, network, or tag records. The source catalog and source-management UI expose this capability explicitly.
- Eporner and Perverzija DB declare both `metadata` and `relationships`; sources that declare only `metadata` cannot leak relationship fields.


## CI repair and verification (2026-11-27)

- CI runs #45997951907 and #46000221955 exposed fixture, relationship-capability, validation, and frontend label synchronization failures.
- The fixes include a time-relative Eporner removal-sync fixture, a test Durable Object rate-limit coordinator, explicit relationship-capability declarations and validation, corrected normalized relationship/provenance assertions, stable shared work URLs in the blank-field merge fixture, the registered Perverzija adapter version expectation, and the missing Adapter Management capability label.
- The complete CI run [#46001993558](https://github.com/shenshou/AIOResourceSearch/actions/runs/46001993558) passed on the exact latest branch head `432346d06e790c74e5889a59e1d990bcb4406e5a`.
