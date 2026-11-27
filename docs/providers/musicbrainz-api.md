# MusicBrainz API Provider

## Status

The Worker implementation is registered in the compile-time Provider registry, but **the adapter and source remain unconfigured/disabled**. No KV record has been written, no Cloudflare binding has been deployed, and no live MusicBrainz request has been made from Cloudflare.

- Provider ID: `musicbrainz-api`
- Version: `1.0.0`
- Mechanism: API
- Source category: `other-index`
- Content category: `music`
- Search mode: keyword only
- Rate-limit lane: `musicbrainz` (at least 1,000 ms between application-wide requests)
- Capabilities: metadata only

## API contract

- Endpoint: `https://musicbrainz.org/ws/2/release-group`
- Method: `GET`
- Query: Lucene `query` parameter; plain-query mode enabled with `dismax=true`
- JSON: `fmt=json`
- `limit=20`, `offset=0`
- Descriptive User-Agent: `AIOResourceSearch/0.1.0` with the public repository URL
- No API key or user account is required for read-only search.
- The API is free for non-commercial use; any monetization or commercial use requires a fresh policy review.

The Provider performs one release-group search request per cache miss. It does not perform artist/release lookups, browse requests, pagination, or cover-art requests.

## Result mapping

| MusicBrainz field | Shared result |
|---|---|
| `release-groups[].id` | Stable result ID and `metadata.musicBrainzId` |
| `title` | Result title |
| `artist-credit[].name` / `artist-credit[].artist.name` | `metadata.artist` |
| `primary-type` | `metadata.primaryType` |
| `first-release-date` | `releaseDate` only when full YYYY-MM-DD precision is present; otherwise `metadata.firstReleaseDate` and `metadata.year` |
| MusicBrainz ID | Canonical `https://musicbrainz.org/release-group/{id}` URL |

Each result includes a visible MusicBrainz attribution link. The Provider deliberately omits tags, ratings, annotations, cover art, user data, and any fields not needed for the first metadata-only search. This keeps the initial mapping focused on core database metadata rather than supplementary licensed data.

## Licensing and operational conditions

- MusicBrainz documents non-commercial use of its Web Service as free and does not require an API key for read-only requests.
- Every request must include a meaningful User-Agent.
- The documented limit is an average of one API call per second per source IP. All Worker requests share the Durable Object `musicbrainz` lane at a minimum 1,000 ms interval; this must not be replaced by per-isolate pacing.
- MusicBrainz core database data is CC0. Supplementary data is CC BY-NC-SA 3.0 and requires attribution and share-alike for derivative works. This Provider intentionally does not map tags, ratings, or annotations.
- The API does not contain cover art; cover art is provided by a separate service and is not requested.
- Reassess eligibility before adding ads, paid tiers, commercial use, supplementary fields, or bulk access.

Official references:
- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/MusicBrainz_API/Search
- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- https://musicbrainz.org/doc/About/Data_License

## Runtime safeguards

- Fixed HTTPS endpoint and exact upstream host validation.
- Manual redirect handling; no redirect following.
- JSON Content-Type validation.
- 2 MiB streamed response-size ceiling plus Content-Length pre-check.
- UUID validation for MusicBrainz IDs; malformed records are dropped.
- Cache lookup occurs before coordinated fetch; one-hour edge cache TTL.
- Cache hit does not reserve a Durable Object slot.
- Missing/unavailable `musicbrainz` coordinator fails closed.
- No tight retry loop; HTTP 503 is handled by the shared coordinator cooldown logic.
- Request cancellation is passed through the coordinated fetch path.

## Required administrative records (disabled template only)

These are examples for a future, separately approved configuration change. They have **not** been written to KV.

Adapter record:

```json
{
  "id": "musicbrainz-api",
  "name": "MusicBrainz API",
  "description": "Public non-commercial MusicBrainz release-group metadata search.",
  "mechanism": "api",
  "contentCategories": ["music"],
  "version": "1.0.0",
  "enabled": false,
  "categories": ["other-index"],
  "capabilities": ["metadata"],
  "implemented": true
}
```

Source record:

```json
{
  "id": "musicbrainz",
  "name": "MusicBrainz",
  "category": "other-index",
  "contentCategory": "music",
  "type": "provider",
  "adapterId": "musicbrainz-api",
  "enabled": false,
  "baseUrl": "https://musicbrainz.org",
  "searchModes": ["keyword"],
  "capabilities": ["metadata"],
  "timeoutMs": 8000
}
```

Do not create these records in production KV as part of code implementation. A future operator configuration must remain disabled until hosted non-production binding, quota, attribution, and policy checks are complete.
