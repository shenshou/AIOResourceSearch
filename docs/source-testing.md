# Administrator source testing

Source tests are available only through the authenticated Worker administration API. They execute one selected, enabled Provider source; they do not invoke the public all-source search fan-out.

## Endpoints

Both endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.

### Connection test

`POST /api/admin/sources/:sourceId/test-connection`

This is a bounded Provider smoke search, not a TCP ping or a separate protocol-level health endpoint. The Worker chooses `keyword` when the source supports it, otherwise `number`, and submits a fixed probe query. A valid upstream response is considered a successful connection even when it contains zero valid results.

### Query test

`POST /api/admin/sources/:sourceId/test-search`

Request body:

```json
{
  "query": "ABP-123",
  "mode": "number"
}
```

The query must contain 1–120 characters after trimming, and the selected mode must be supported by the source and its compiled Provider implementation.

## Diagnostic response

A completed diagnostic returns HTTP 200 with a result object, including when the upstream Provider fails:

- `status`: `success`, `error`, or `timeout`
- `elapsedMs`: elapsed wall-clock time
- `resultCount`: number of normalized results
- `sampleResults`: at most three entries containing title, canonical result URL, and optional catalog number/release date
- `errorCode` and a safe diagnostic message on Provider failure

Invalid requests, missing sources, disabled sources, external-search entries, and unavailable/incompatible adapters use ordinary non-2xx HTTP responses. The endpoint does not expose upstream response bodies, request headers, credentials, or full resource payloads.

## Execution and safety boundaries

- Source and adapter configuration is read from the existing KV configuration keys; tests never write either key or alter enablement state.
- The Worker reuses the compile-time Provider registry and the same single-source execution, compatibility checks, normalization, cancellation, and source timeout behavior used by normal search.
- Only the selected source is executed. There is no multi-source fan-out and no retry loop added by the diagnostic endpoint.
- Request JSON remains subject to the shared 64 KiB streaming body limit.
- Provider samples are capped at three and omit images, Magnet/ED2K/torrent links, descriptions, and other unnecessary metadata.
- `external-search` entries are browser-opened destinations. The Worker never fetches or parses them for a connection or query test; the UI explains why these actions are unavailable.
- A successful smoke test establishes that the Provider returned a valid response for the probe query at that moment. It does not establish source policy approval, stable availability, or permission to enable the source.
- Source-specific access controls and usage rules remain in force. No login, paywall, CAPTCHA, anti-bot challenge, geographic restriction, rate limit, or other access control is bypassed.

The frontend exposes separate **测试连接** and **测试搜索** actions for enabled Provider sources. The connection action is explicitly described as a smoke search rather than a TCP ping. Query tests allow the administrator to choose a supported search mode and display status, elapsed time, result count, and up to three samples.


## Authenticated source diagnostics

- If a source declares a `SOURCE_CREDENTIAL_*` `credentialBinding`, the Worker resolves that exact named Worker Secret binding and passes the value only to the selected Provider through `ProviderContext.credential`.
- If the binding is missing or empty, the diagnostic fails closed with `credential_unavailable`; no upstream request is made.
- The credential value is never included in the diagnostic response, source API response, KV configuration, or sample results.
- Configure deployed credentials as Worker Secrets, not plaintext `vars`. For local development, use an ignored `.dev.vars` file beside the Wrangler configuration. Never commit it.
- `wrangler secret put` creates a new Worker version and deploys it immediately; use a dedicated non-production Worker/environment for credential setup and verification. Do not use production secrets during testing.
- A binding name is only a reference to a secret; it does not specify the auth protocol. The Provider must implement the source's documented Bearer/API-key/Cookie behavior and must send the credential only to the canonical approved HTTPS host.
