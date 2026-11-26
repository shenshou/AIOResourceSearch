# Source Catalog Governance Policy

This document defines the durable governance rules for the AIOResourceSearch source inventory. It is normative for source discovery, catalog maintenance, policy review, Provider planning, and deferred work. The implementation and review rules in [development-standards.md](./development-standards.md) require compliance with this policy.

## Purpose and scope

The source catalog is a long-lived inventory of candidate upstream sources and integration opportunities. It is not a list of currently reachable websites, approved automated targets, implemented Providers, or enabled production sources.

These rules apply to every source category, including JAV/adult metadata, anime, film/TV, manga, novels, games, music, torrent indexes, forums, and general resource indexes. Do not apply a blanket category exclusion where a source-specific assessment is required.

## The eight governing principles

### 1. The catalog is a durable source-asset inventory

Keep discovered sources in the catalog even when they are currently unreachable, lack an API, have unclear terms, block ordinary requests, or cannot yet be implemented. A candidate's presence records project knowledge and future integration potential; it does not authorize access or imply endorsement.

### 2. Do not delete a source merely because development is blocked

A temporary technical, legal, policy, operational, or evidence gap is a status change, not a deletion reason. Prefer a retained record with a precise status and explanation. Remove a record only when it is a confirmed duplicate after reconciliation, demonstrably erroneous or unrelated to project scope, superseded by a verified canonical identity where history is preserved, or explicitly requested by the project owner. When permanently discontinued, retain a historical/deprecated record where it still provides useful provenance.

### 3. Every source decision must be traceable

Preserve source provenance (including Atlas, Lustpress, FetchJAV, and project-discovered entries), canonical identity evidence, reviewed URLs/endpoints, relevant first-party terms or API documentation, observed access behavior, review date, decision rationale, and reconsideration conditions. Clearly distinguish first-party evidence from third-party reports, inferred aliases, and unverified claims. Never invent a canonical domain, successor, mirror, API, or feed.

### 4. Keep inventory, policy, implementation, configuration, and runtime status separate

A source can be catalogued without being approved for automation. Track at least these distinct facts: catalog presence; review disposition; acquisition interface and permission; Provider/adapter implementation and compile-time registration; KV configuration; enabled/disabled state; and non-production/Hosted Cloudflare verification. None of these states implies another. In particular, code existing does not mean a source is configured, enabled, deployed, reachable, or verified.

### 5. Evaluate acquisition mechanisms individually and preserve viable alternatives

For each source, investigate applicable supported mechanisms rather than assuming every source needs HTML scraping: official API, official RSS/Atom, documented JSON/feed endpoints, public HTML search pages with permission, or another explicitly supported interface. Record which mechanism is evidenced, which is merely hypothesized, and what remains unknown. Prefer first-party documented interfaces. Reuse of an upstream project's adapter code, endpoint list, or scraper is not proof of permission or a stable contract. Do not remove a source simply because one acquisition mechanism is unavailable.

### 6. Access restrictions and data-use permission are hard implementation gates

Public visibility, a working browser page, a robots.txt entry, an open-source scraper, or a successful HTTP response does not by itself grant permission to automate access, aggregate metadata, republish fields, or display images. Do not implement or enable an acquisition path that requires bypassing authentication, paywalls, CAPTCHA, anti-bot/Cloudflare challenges, geo/IP restrictions, rate limits, or other access controls. Do not rotate identities, forge browser fingerprints/sessions, replay private cookies, or evade published quotas.

Ordinary free-account authentication may be considered only when the source permits this service's automation, the operator legitimately controls the credential, and the flow does not defeat another access control. Keep credentials in source-scoped Worker Secret bindings, never in the catalog, KV values, repository files, browser storage, public responses, or logs. Personal/private RSS tokens are not shared public data sources. Paid third-party APIs or scraping services remain excluded under the project's no-paid-services requirement.

When evidence is incomplete or contradictory, keep the source disabled and record the uncertainty. A future investigation may seek first-party permission, a documented supported endpoint, a compliant request schedule, or another lawful alternative; it must not be treated as advance approval to bypass restrictions.

### 7. External navigation is distinct from automated acquisition

Where permitted, retain a user-initiated external homepage or search link even when Worker automation is deferred. External Search must only generate a user-opened HTTPS destination; it must not silently fetch, scrape, proxy, preflight, or parse the destination through the Worker. A source may be external-only, homepage-only, or name-only when no safe verified destination exists. Do not guess a mirror or replace a historical domain with an unverified redirect target.

A restriction on Worker acquisition does not automatically require removing an otherwise permitted user-opened external link. Conversely, the existence of an external link does not authorize a Provider.

### 8. Reconcile upstream inventories completely and preserve provenance

For Atlas, Lustpress, FetchJAV, and future reference projects, maintain a source-level reconciliation between the upstream inventory and this project's catalog/review records. Record the upstream file or section, the number of raw entries, normalization and deduplication rules, multi-category identities, excluded/out-of-scope entries, and unresolved differences. Do not claim that an upstream inventory is fully imported based only on a label count or a partial README list. Preserve upstream project attribution even when a candidate is also discovered independently or shared across categories.

## Required source record and review outcomes

For every candidate, retain as much of the following as is known:

- Stable source ID and display name; source kind and one or more content categories.
- Provenance and upstream project references.
- Canonical homepage/domain and exact public endpoint/search/feed URL, if verified.
- Acquisition mechanism: API, RSS/Atom, documented JSON, HTML, external navigation, or unknown.
- Evidence links and evidence quality (first-party, third-party, observed, or unverified).
- Automation and metadata/image/link reuse policy status.
- Current disposition, review date, blocker, and explicit reconsideration condition.
- Implementation ID/version, KV state, enablement, and runtime verification as separate fields or linked records where applicable.

Use precise dispositions such as Provider candidate, implemented but not configured, configured but disabled, external-search only, homepage-only, name-only, deferred, pending evidence, and not eligible. Do not collapse them into a single vague "supported" flag. If the existing data model cannot represent a distinction, document it in the review log/backlog rather than fabricating a runtime capability.

## Operational workflow

1. Discover and record the candidate with its original provenance before judging implementation readiness.
2. Verify canonical identity and first-party interface/policy evidence; label third-party evidence as such.
3. Assess automation permission and data-use rights separately from simple reachability.
4. Evaluate the available acquisition mechanisms independently.
5. Select the narrowest safe disposition: Provider candidate, external-only, homepage-only, name-only, pending, or deferred.
6. If blocked, keep the candidate and record the concrete blocker plus a testable reconsideration condition in [deferred-source-backlog.md](./deferred-source-backlog.md).
7. Implement only a permitted, documented mechanism; then track code registration, KV configuration, enablement, and hosted verification independently.
8. Reconcile reference-project inventories and update source counts only after source-level deduplication and provenance checks.

## Document ownership

- [source-catalog.md](./source-catalog.md) describes inventory composition and upstream provenance.
- [source-review.md](./source-review.md) is the evidence and decision log.
- [deferred-source-backlog.md](./deferred-source-backlog.md) records blocked candidates and reconsideration conditions.
- `apps/web/src/modules/sources/sourceCatalog.ts` is the runtime candidate catalog; its records must not be treated as proof of authorization or Provider readiness.
- [development-standards.md](./development-standards.md) makes these requirements part of the engineering workflow.

When these documents disagree, this policy governs the source-inventory and source-review principles; implementation contracts and runtime safety requirements in the development standards remain binding.
