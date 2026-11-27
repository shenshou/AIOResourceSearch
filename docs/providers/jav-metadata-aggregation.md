# JAV Metadata Aggregation

This document defines the current Worker-side aggregation contract for JAV metadata. It is an implementation policy, not a claim that every candidate source is approved for automated retrieval or data reuse.

## Work identity

- Canonical detail URL is the primary identity key.
- For resources categorized as JAV, a conservative catalogue-number key is a secondary identity hint: NFKC normalization, uppercase, removal of non-ASCII alphanumeric separators, 4–40 characters, and at least one letter plus one digit.
- Catalogue-number matching is not applied to non-JAV categories.
- Titles, performer names, fuzzy similarity, and substring matches are not identity keys.
- A catalogue-number match may combine distinct source URLs into one result; all contributing source attributions and unique external links are retained.

## Field conflict policy

- Source results are processed in configured source order. The first valid, non-empty value is authoritative when sources disagree.
- Later sources may fill fields that are absent from the surviving result; they do not overwrite a selected title, canonical URL, catalogue number, release date, cover, description, or existing metadata key.
- Metadata is merged by key: an existing non-empty value wins, while previously absent keys can be supplied by later sources.
- Blank optional catalogue numbers, release dates, descriptions, and metadata values are discarded during normalization, so they cannot block a later source from filling the field.
- Resource links are combined by URL, deduplicated, and capped by the existing normalizer/aggregator limits.
- Source attribution is accumulated once per source ID. Per-source result counts continue to represent that Provider's pre-deduplication result count.

## Deliberate limitations

- There is no configurable per-field source-priority system yet. Adding one would require a separately designed, backward-compatible source configuration contract and administrator UI.
- This policy does not determine factual correctness when two non-empty sources disagree; it provides deterministic behavior and preserves provenance for later review.
- No source is enabled by this document. Data-use rights, upstream terms, and access-control boundaries remain separate source-review gates.
- This phase does not implement automated retrieval that bypasses login, paywalls, CAPTCHA, anti-bot challenges, geographic restrictions, rate limits, or other access controls.

## Verification

Focused unit tests cover first-value-wins conflicts, filling missing metadata keys, blank-value filtering, JAV catalogue-number identity, and category isolation. Full CI is deferred until the complete JAV metadata aggregation module has passed integration and acceptance review, in accordance with the project delivery policy.
