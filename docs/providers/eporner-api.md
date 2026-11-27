# Eporner public API Provider

**Status: implemented in Worker code; source and adapter remain disabled pending hosted verification**

## Scope

Use only the documented Eporner API v2.1.0. The Provider supports keyword search and returns text metadata plus the canonical Eporner video page URL.

Included fields:
- Video title and canonical page URL.
- Keywords, view count, rating, duration in seconds, and the source's original added-time string.
- Structured performer relationships from `fields=pornstars`, genre relationships from `fields=categories`, and tag relationships from the comma-separated `keywords` field.

Explicitly excluded:
- Thumbnail/image URLs.
- Embed markup, player URLs, and video/media files.
- Downloads, torrent extraction, and AI/ML training or testing.

The legacy added-time value has no timezone offset in the API contract. It is retained as `addedAtSource` and is not converted into a fabricated UTC timestamp.

## Request flow

1. The Worker checks that the official removal-feed sync has completed within the last 36 hours and has no pending continuation cursor. Missing, malformed, stale, or incomplete sync state fails closed.
2. Search uses `GET https://www.eporner.com/api/v2/video/search/` with `query`, `per_page=50`, `page=1`, `thumbs=none`, `format=json`, `gay=1`, and `fields=pornstars,categories`. These optional fields are returned in the same search response; no extra performer/category request is added.
3. The Worker validates each result's 11-character case-sensitive ID and canonical same-host video URL.
4. The Worker calls `GET https://www.eporner.com/api/v2/video/status/` for the returned IDs and retains only records explicitly marked `active`. Missing, unknown, removed, or unavailable statuses are not returned.
5. Search and status responses use edge-cache TTLs matching the documented five-minute and one-minute intervals. Cache failures do not discard valid upstream responses.
6. All upstream calls use the shared `eporner` Durable Object lane with one-second spacing and an exclusive 60-second lease, held until the response body is fully buffered (up to 2 MiB), so separate Worker requests cannot overlap upstream calls. Within a search, the search endpoint is called before the status endpoint. Redirects are not followed; 503 and `Retry-After` are not treated as empty results or retried in a tight loop.

## Removal-feed synchronization

A Worker Cron Trigger runs every 15 minutes and consumes one page per invocation from `GET https://www.eporner.com/api/v2/video/removed/`, using `since` for a new window and the opaque `after` cursor for continuation. It uses `per_page=250`, validates every removal record, and commits the cursor only after the entire page is validated.

The sync state is stored as one small record in the existing `SOURCES_KV` namespace under `eporner:removal-sync:v1`. On the first run, the initial 24-hour `since` watermark is persisted before the upstream request, so a failed bootstrap attempt retries the same window instead of shifting the lookback forward. The record contains only the feed cursor, timestamps, and last-page count. The 250-record page size is deliberately bounded for the Workers Free Cron CPU budget (10 ms CPU per Cron invocation); verify actual CPU use in the hosted test environment. It does not store removed IDs, search results, user data, or media. If a page fails, the cursor is not advanced; the next scheduled invocation safely retries that page. A completed sync is considered fresh for 36 hours. While a continuation cursor is pending, the Provider fails closed.

The Provider also checks the status of every search result before returning it, so removed IDs are not returned from stale search responses. Search results are never persisted by this project.

## Administrator registration

The built-in adapter is identified by:

| Field | Value |
|---|---|
| Adapter ID | `eporner-api` |
| Mechanism | `api` |
| Version | `1.1.0` |
| Source category | `other-index` |
| Content category | `jav` |
| Capabilities | `metadata`, `relationships` |
| Search modes | `keyword` |

The source catalog entry uses source ID `eporner` and points to adapter `eporner-api`. In the administrator UI, register the adapter first and enable the adapter only after the Worker version containing this Provider is deployed to a non-production environment. Then register the catalog source and leave the source itself disabled until the scheduled sync and hosted checks pass. No source or adapter KV record is created by this code change.

## Enablement requirements

- Register the adapter and source in KV through the administrator UI; keep both disabled until the first successful scheduled feed sync and non-production Cloudflare verification.
- Verify the Cron Trigger, KV propagation, Durable Object lane, and API response/cache behavior in a non-production Cloudflare environment.
- Complete the project's jurisdiction-specific launch assessment and implement any controls that assessment establishes as applicable.
- Keep the Provider disabled if the feed becomes stale or the ordinary documented API stops working.

Official documentation: https://www.eporner.com/api/v2/
