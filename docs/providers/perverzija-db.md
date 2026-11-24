# Perverzija DB Provider

## Registration

- Adapter ID: `perverzija-db`
- Version: `1.0.0`
- Category: `other-index`
- Capabilities: `metadata`
- Search modes: `number`, `keyword`
- API endpoint: `https://api.perverzija.com/v1/scenes`
- Authentication: none
- API key: not required

The source must be configured as a Worker Provider with `adapterId: "perverzija-db"`, category `other-index`, capability `metadata`, and both search modes. Use `https://db.perverzija.com` as the source's base URL for administration display. Keep the source disabled until a live Cloudflare Worker request has been verified.

## Request behavior

The adapter issues one GET request per search:

```text
GET /v1/scenes?q=<encoded-query>&per_page=50
Accept: application/json
```

- Does not scrape HTML or use browser emulation.
- Does not retry 429 responses. The API supplies `Retry-After`; the next user search can retry after that interval.
- Uses `redirect: "manual"` and validates the response host.
- Enforces a 2 MiB streaming response limit.
- Requires JSON content type and a valid `data[]` response envelope.
- Does not consume the API's cover image, embed, or player fields.

## Result mapping and attribution

- Stable API scene ID → normalized result ID.
- Scene title → result title.
- Release date → result release date.
- `urls.page` on `db.perverzija.com/scene/` → primary result URL.
- `urls.watch` on `tube.perverzija.com` → separately labelled external link.
- Studio, performers, tags, and duration → concise description.

The primary result URL is the Perverzija DB scene page, which provides the visible attribution link required by its terms. The provider intentionally does not use `cover` as `imageUrl`: the API's data model states that images belong to their respective owners and are for identification/reference, and the project's image-display conditions have not been separately confirmed.

## Rate limits and freshness

The API documents 120 requests per minute per IP, a sliding 60-second window, and a 429 response with `Retry-After`. It recommends caching responses for at least a few minutes. Its data endpoints advertise `Cache-Control: public, max-age=300, s-maxage=1800`; the provider does not run a retry loop.

The upstream CDN may serve repeated requests from cache without consuming the API quota. Distinct search terms still count as distinct requests, so keep the source disabled if the Worker begins producing repeated 429 responses. A future shared request limiter may be added if real usage warrants it.

## Tests and verification boundary

The Worker test suite includes fixture-based checks for:
- query construction and API endpoint;
- result mapping and attribution links;
- no image/embed consumption;
- rejection of untrusted result/watch hosts;
- no retry on 429;
- malformed JSON rejection.

These tests use mocked Fetch. They do not prove that Cloudflare Workers can reach the live API. Do not enable the source until the deployed test Worker confirms connectivity and the operator has reviewed the API's adult-only terms for the intended audience.

## Official references

- API introduction: https://api.perverzija.com/docs
- Quickstart: https://api.perverzija.com/docs/getting-started
- Data model: https://api.perverzija.com/docs/objects
- Rate limits: https://api.perverzija.com/docs/rate-limits
- Caching and freshness: https://api.perverzija.com/docs/caching
- Terms of use: https://api.perverzija.com/docs/terms
