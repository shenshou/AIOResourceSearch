# Perverzija DB Provider

## Registration

- Adapter ID: `perverzija-db`
- Provider implementation version: `1.1.0`
- Upstream API version: `v1.2.0` (backwards-compatible v1; the 2026-11-06 release added performer profile/image fields that this scene-search Provider does not request or consume)
- Category: `other-index`
- Capabilities: `metadata`, `relationships`
- Search modes: `keyword` only
- API endpoint: `https://api.perverzija.com/v1/scenes`
- Authentication: none
- API key: not required
- Shared rate-limit lane: `perverzija` (600 ms minimum spacing)

The source must be configured as a Worker Provider with `adapterId: "perverzija-db"`, category `other-index`, capabilities `metadata` and `relationships`, and keyword search mode only. Use `https://db.perverzija.com` as the source's base URL for administration display. Keep the source disabled until its configuration has been reviewed and explicit enablement is approved.

## Staging verification snapshot (2026-11-28)

- A live Staging Worker keyword search using `Kira Noir` succeeded, returning 30 results in approximately 840 ms.
- The connection smoke test returned 0 results in approximately 1077 ms. This is not a contradiction: the smoke test uses a fixed probe term and treats a valid upstream response with no matches as a successful connection check.
- These observations verify one Staging request path at that time. They do not authorize enabling the source or establish ongoing availability. Keep the source disabled unless and until its configuration and source-policy review are complete and enablement is explicitly approved.

## Request behavior

The adapter supports keyword search only. It forwards the supplied text as the API `q` parameter; the implementation does not distinguish number mode from keyword mode or perform a dedicated JAV catalogue-number lookup. The adapter issues one GET request on a cache miss; a valid Worker Cache API hit avoids an upstream request:

```text
GET /v1/scenes?q=<encoded-query>&per_page=50
Accept: application/json
```

- Does not scrape HTML or use browser emulation.
- Does not retry 429 responses. The API supplies `Retry-After`; the next user search can retry after that interval.
- Uses `redirect: "manual"` and validates the response host.
- Enforces a 2 MiB streaming response limit.
- Caches valid JSON scene envelopes for 300 seconds using the existing Worker Cache API; malformed cache entries are ignored and refreshed.
- Requires JSON content type and a valid `data[]` response envelope.
- Does not consume the API's cover image, embed, or player fields.

## Result mapping and attribution

- Stable API scene ID → normalized result ID.
- Scene title → result title.
- Release date → result release date.
- `urls.page` on `db.perverzija.com/scene/` → primary result URL.
- `urls.watch` on `tube.perverzija.com` → separately labelled external link.
- Studio, network, performers, and tags → both structured relationships and concise description; duration → concise description.
- Performer, studio, network, and tag names are bounded and normalized. The API response does not establish canonical performer/studio URLs, so no entity URLs are fabricated.

The primary result URL is the Perverzija DB scene page, which provides the visible attribution link required by its terms. The provider intentionally does not use `cover` as `imageUrl`: the API's data model states that images belong to their respective owners and are for identification/reference, and the project's image-display conditions have not been separately confirmed.

## Rate limits and freshness

The API documents 120 requests per minute per IP, a sliding 60-second window, and a 429 response with `Retry-After`. The Provider uses the shared `perverzija` Durable Object lane at 600 ms spacing (100 requests/minute) and caches a 300-second allowlisted JSON payload containing only fields used by the search result (including names and source links, but excluding unused image/media metadata) through the existing Worker Cache API. Cache hits do not reserve a rate-limit slot. It does not run a retry loop; 429/503 `Retry-After` and successful responses with `X-RateLimit-Remaining: 0` plus `X-RateLimit-Reset` are handled by the shared coordinator.

The upstream CDN and the Worker Cache API can both reduce repeated requests. Distinct search terms still count as distinct requests; the shared application lane leaves headroom below the documented IP quota. Keep the source disabled if hosted observations show repeated 429 responses.

## Tests and verification boundary

The Worker test suite includes fixture-based checks for:
- keyword query construction and API endpoint;
- result mapping and attribution links;
- no image/embed consumption;
- rejection of untrusted result/watch hosts;
- no retry on 429;
- five-minute cache hits/misses and invalid-cache refresh;
- shared 600 ms Durable Object rate-lane registration and fail-closed behavior when the coordinator is unavailable;
- malformed JSON rejection.

These tests use mocked Fetch. They do not prove that Cloudflare Workers can reach the live API. Do not enable the source until the deployed test Worker confirms connectivity and the operator has reviewed the API's adult-only terms for the intended audience.

## Official references

- API introduction: https://api.perverzija.com/docs
- Quickstart: https://api.perverzija.com/docs/getting-started
- Data model: https://api.perverzija.com/docs/objects
- Rate limits: https://api.perverzija.com/docs/rate-limits
- Caching and freshness: https://api.perverzija.com/docs/caching
- Terms of use: https://api.perverzija.com/docs/terms
