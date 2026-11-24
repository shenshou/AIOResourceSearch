# Architecture

## Product boundary

AIOResourceSearch is an aggregator, not a media-management product. The user submits one query; the application queries enabled and implemented providers, normalizes their responses, deduplicates equivalent results, and presents metadata and source-supplied links.

### Included capabilities

- Multi-provider search
- JAV metadata, Torrent index, forum, and other-index source categories
- Result normalization and deduplication
- Metadata and optional image presentation
- Magnet, ED2K, Torrent, and external-link actions when a permitted provider supplies them
- Source administration (CRUD, enable/disable, connection/search diagnostics as adapters become available)
- Theme and image-display preferences in browser storage only

### Explicit non-goals

- User registration or profiles
- Cloud favorites or search history
- Media hosting, streaming, or local media management
- D1 database
- Cross-device synchronization of personal user data
- Arbitrary website scraping without a dedicated, reviewed adapter

## Runtime topology

```text
Vue 3 frontend (Cloudflare Pages)
        |
        | HTTPS / JSON
        v
Cloudflare Worker API
        |
        +---- Workers KV: source configuration
        |
        +---- Provider adapters (one adapter per supported protocol/source family)
                    |
                    +---- permitted source APIs / feeds / public endpoints
```

Pages and Worker are separate deployable targets in one repository. The frontend must not call source websites directly; provider requests belong behind the Worker boundary.

## Module responsibilities

- `apps/web`: routes, page composition, UI components, browser-only preferences, API client.
- `apps/worker`: HTTP routing, admin authorization, input validation, source configuration persistence, provider orchestration.
- `packages/shared`: framework-independent API and source configuration contracts.
- Provider adapters: translate one source's permitted protocol into the shared result contract. An adapter is code, not a URL entered in the management UI.

A source can be added through configuration only when its `adapterId` is already implemented. A new protocol or page structure requires a reviewed code adapter first.

## Source configuration

The first implementation stores one versioned JSON document under the KV key `sources:config:v1`. This keeps the initial management model small and makes a full configuration read inexpensive.

KV is eventually consistent and does not provide compare-and-swap transactions. The API uses a revision precondition to catch ordinary stale-editor updates, but this is not a distributed lock. Avoid concurrent administrator edits; if multi-admin transactional editing becomes a real requirement, revisit the storage primitive.

Only source configuration belongs in KV. Search responses, images, media, favorites, and search history are not persisted there.

## Security

- All source mutations require a Worker secret named `ADMIN_API_TOKEN`.
- The browser must send the token as a Bearer token; never place it in a URL or commit it.
- CORS must be restricted to exact frontend origins using `ALLOWED_ORIGINS`.
- Per-source credentials belong in Worker secrets. KV may contain a credential binding name, never the credential value.
- Source URLs must use HTTPS and must not embed credentials or query-string secrets.
- Public source listings omit private credential-binding metadata.
- Validate all management input before writing it to KV.

The initial admin API is a backend foundation. The frontend management screen and a complete administrator interaction flow are separate implementation steps.

## Search flow

```text
Search page
  -> frontend API client
  -> Worker search endpoint
  -> enabled source configurations
  -> implemented provider adapters
  -> shared result normalization
  -> deduplication
  -> response to frontend
  -> result cards and link actions
```

Search orchestration is not enabled until the provider audit identifies sources and access methods that can be integrated appropriately.
