# LibriVox Provider — implementation and verification status

**Review date:** 2026-11-27  
**Disposition:** Worker Provider implemented and registered; source and adapter remain unconfigured/disabled; Cloudflare hosted verification pending.

## Decision and scope

LibriVox is integrated as a metadata-only audiobook catalogue search Provider. Its official API is released, explicitly supports JSON, title-prefix search, bounded result sets, and field selection. LibriVox welcomes third-party applications sharing/re-sharing its recordings. The Provider links users to the canonical LibriVox project page; it does not proxy, download, host, or repackage recordings.

LibriVox's public-domain statement applies to its recordings in the United States. It does not establish that every underlying source text is public domain in every jurisdiction. The app must not imply worldwide public-domain status for every work.

## First-party response evidence

The official API information page links to a live JSON example for audiobook ID 52. The captured response confirms:
- Top-level envelope: books array.
- Record identifiers and titles are strings.
- Canonical project URL is supplied in url_librivox.
- authors is an array of objects with first_name and last_name.
- Example record: 'Letters of Two Brides', ID 52, author Honoré de Balzac, runtime 9:09:20.

The structurally faithful response fixture is stored at apps/worker/tests/fixtures/librivox-audiobooks.json.

Official references:
- https://librivox.org/api/info
- https://librivox.org/2026/09/16/librivox-api-update/
- https://librivox.org/pages/public-domain/

The API documentation states that genres and sections are optional extended fields. They are deliberately excluded from the initial Provider request; the observed real response and initial product scope do not require them.

## Implemented contract

| Property | Implementation |
|---|---|
| Provider ID | librivox-api |
| Version | 1.0.0 |
| Mechanism | api |
| Source category | other-index |
| Content category | audiobook |
| Capability | metadata only |
| Search mode | keyword only |
| Endpoint | Fixed https://librivox.org/api/feed/audiobooks/ |
| Search semantics | Title prefix (title=^<query>), not arbitrary full-text |
| Interactive result cap | 20 |
| Shared rate limit | Durable Object lane librivox, 5,000 ms minimum spacing |
| Cache | None |
| Source link | Canonical url_librivox project page |

The request explicitly selects only:
id,title,description,language,copyright_year,num_sections,url_librivox,totaltime,totaltimesecs,authors.

It deliberately excludes genres, sections, url_rss, url_zip_file, Archive.org links, cover art, and all audio assets. RSS and audio links are not fetched or surfaced.

Normalized metadata fields include LibriVox ID, authors, language, source-text copyright year, section count, and runtime. Descriptions are reduced to plain text. Each result carries a LibriVox attribution link.

## Safety, reliability, and limits

- Fixed HTTPS host; manual redirect handling; unexpected host or redirect rejected.
- Non-2xx, unexpected content type, invalid JSON/envelope, and oversized response are errors, not empty successful results.
- Response body is capped at 1 MiB.
- Malformed records and non-canonical/untrusted project URLs are dropped.
- Search query must contain 1–120 characters.
- No cache, no full-catalog import, no background polling, no external media fetch.
- All real upstream requests use the shared Durable Object coordinator. Missing coordinator fails closed; the shared cooldown path handles upstream 429/503 and Retry-After.
- The five-second lane is enforced across Worker instances, not by per-isolate sleeps.

## Code and test coverage

- Provider: apps/worker/src/providers/librivox-api.ts
- Registry: apps/worker/src/providers/registry.ts
- Provider tests: apps/worker/tests/providers/librivox-api.test.ts
- Real-response fixture: apps/worker/tests/fixtures/librivox-audiobooks.json
- Shared pacing lane: apps/worker/src/rate-limit-coordinator.ts
- Node lane test: apps/worker/tests/rate-limit-coordinator.test.ts
- Local workerd concurrency test: apps/worker/runtime-tests/rate-limit-coordinator.test.ts
- Source catalog entry: apps/web/src/modules/sources/sourceCatalog.ts

The worker test script includes the focused Provider test. Validation coverage checks that the adapter and source are accepted with the audiobook category while remaining disabled.

## Deployment and activation status

- Worker implementation: registered in code.
- Source catalog: registered as a Provider candidate.
- Adapter KV record: not created.
- Source KV record: not created.
- Adapter enabled: no.
- Source enabled: no.
- Production KV mutation: none.
- Deployment: none.
- Complete CI: pending module integration.
- Non-production Cloudflare hosted verification: not started.

The source catalog UI requires an administrator to register and enable the compiled adapter before registering the source. When eventually created, both records must initially remain disabled. No production enablement is authorized by this implementation.
