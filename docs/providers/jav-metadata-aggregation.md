# JAV Metadata Aggregation

This document defines the current Worker-side aggregation contract for JAV metadata. It is an implementation policy, not a claim that every candidate source is approved for automated retrieval or data reuse.

## Work identity

- Canonical detail URL is the primary identity key.
- For resources categorized as JAV, a conservative catalogue-number key is a secondary identity hint: NFKC normalization, uppercase, removal of non-ASCII alphanumeric separators, 4–40 characters, and at least one letter plus one digit.
- Catalogue-number matching is not applied to non-JAV categories.
- Titles, performer names, fuzzy similarity, and substring matches are not identity keys.
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

Focused unit tests now cover first-value-wins field and external-link conflicts, deterministic configured-source order despite out-of-order provider completion, blank-value filtering, catalogue-key collision isolation, JAV catalogue-number identity, category isolation, within-source relationship deduplication, relationship whitespace normalization, relationship-cap URL enrichment, Perverzija calendar-date validation, shared-lane Retry-After handling, cache hit/miss and invalid-cache behavior, coordinator fail-closed behavior, and Eporner performer/category/tag mapping plus URL validation. These tests are authored but not executed locally. Full CI is deferred until the complete JAV metadata aggregation module has passed integration and acceptance review, in accordance with the project delivery policy.

## Structured relationships

- A normalized work may carry typed relationships for performers, directors, studios, labels, series, genres, and tags.
- Relationship names are trimmed and bounded; optional entity URLs must be HTTPS and credential-free under the same URL validator used for other public links.
- Duplicate relationships are combined by type plus NFKC-normalized, whitespace-collapsed, case-insensitive name. The first display name wins; a later URL may fill an empty URL. This is deterministic identity matching, not fuzzy person/entity resolution.
- The first relationship name and URL remain authoritative. If the first occurrence has no URL, a later matching relationship may fill it. The 40-item cap limits new unique relationships but does not block URL enrichment for existing relationships. Distinct names remain distinct even when they may refer to the same real-world entity.
- The search UI renders relationship names and only links them when a validated HTTPS URL is supplied.
- Perverzija DB maps its documented studio, performer, and tag names into structured relationships while retaining the existing description text and attribution links. Its API calls use a shared 600 ms Durable Object lane (100 requests/minute, below the documented 120/minute/IP ceiling) and successful scene envelopes are cached for 300 seconds; cache hits bypass the coordinator. Its response does not establish canonical performer/studio URLs, so no entity URLs are fabricated.
- Eporner maps documented `pornstars` to performer relationships, `categories` to genre relationships, and comma-separated `keywords` to tag relationships. Its search request asks for `fields=pornstars,categories` in the same API call. Performer/category URLs are accepted only when they match the canonical HTTPS Eporner host and the documented `/pornstar/` or `/cat/` path. The existing active-status check, removal-feed gate, cache allowlist, shared request lane, and no-embed/no-image behavior remain intact.
- This is a shared result-contract foundation. Other Providers are not assumed to provide these fields until their response contracts are explicitly reviewed and their adapters are updated and tested.
