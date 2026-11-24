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
        +---- Workers KV: source configuration (sources:config:v1)
        |
        +---- Workers KV: adapter metadata (adapters:config:v1)
        |
        +---- Provider adapters (one adapter per supported protocol/source family)
                    |
                    +---- permitted source APIs / feeds / public endpoints
```

Pages and Worker are separate deployable targets in one repository. The frontend must not call source websites directly; provider requests belong behind the Worker boundary.

## Module responsibilities

- `apps/web`: routes, page composition, UI components, browser-only preferences, API client.
- `apps/worker`: HTTP routing, admin authorization, input validation, source/adapter configuration persistence, provider orchestration.
- `packages/shared`: framework-independent API and source configuration contracts.
- Adapter management records: describe adapter identity, version, supported categories/capabilities, and administrative state. They do not contain executable code.
- Provider adapters: translate one source's permitted protocol into the shared result contract. An adapter is code, not a URL entered in the management UI.

A source can be added through configuration only when its `adapterId` exists in adapter metadata, is enabled, and has a matching implementation registered in Worker code. The Worker maintains an explicit implementation allowlist; changing a KV record cannot claim that code exists. A new protocol or page structure requires a reviewed code adapter first.

## Source configuration

The configuration layer stores two independent versioned JSON documents in the same KV namespace:
- `sources:config:v1`: data-source definitions.
- `adapters:config:v1`: adapter administrative metadata.

This keeps source and adapter edits independent without introducing another storage product.

KV is eventually consistent and does not provide compare-and-swap transactions. The API uses a revision precondition to catch ordinary stale-editor updates, but this is not a distributed lock. Avoid concurrent administrator edits; if multi-admin transactional editing becomes a real requirement, revisit the storage primitive.

Only source and adapter management configuration belongs in KV. Adapter executable code remains in the Worker bundle. Search responses, images, media, favorites, and search history are not persisted there.

Source and adapter metadata CRUD are runtime operations. The admin page sends authenticated requests to the Worker, which validates and writes configuration to KV. These changes do not modify source code or trigger a deployment. KV propagation can be delayed by its eventual-consistency model and the configured edge cache TTL. A new provider implementation, protocol, or parser is code and requires a Worker deployment. Deleting an adapter is rejected while any source still references it; disabling an adapter is rejected while enabled sources reference it.

## Security

- All source mutations require a Worker secret named `ADMIN_API_TOKEN`.
- The browser must send the token as a Bearer token; never place it in a URL or commit it.
- The frontend keeps the administrator token in component memory only; it is not persisted to LocalStorage or SessionStorage.
- CORS must be restricted to exact frontend origins using `ALLOWED_ORIGINS`.
- Per-source credentials belong in Worker secrets. KV may contain a credential binding name, never the credential value.
- Source URLs must use HTTPS and must not embed credentials or query-string secrets.
- Public source listings omit private credential-binding metadata and administrator notes.
- Validate all management input before writing it to KV.

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


## Provider adapter runtime

Executable adapters are registered in `apps/worker/src/providers/registry.ts`. The registry is a compile-time allowlist backed by imported TypeScript implementations; it is never populated from KV. `isProviderImplemented` is the single source of truth used by adapter administration to determine whether an adapter ID has executable code.

The Provider contract lives in `apps/worker/src/providers/types.ts`. Each implementation declares its stable ID, code version, supported source categories, capabilities, and search modes, and exposes a `search` method that returns normalized resources. The context supplies the configured source, Worker Fetch API, and abort signal.

The registry is intentionally empty until a concrete provider has passed source-access review and implementation tests. An adapter record in KV alone cannot make an adapter executable or searchable. Registering or changing executable code requires a Worker deployment; changing administrative metadata remains a KV-only operation.


## Search orchestration

The public `POST /api/search` endpoint accepts a query and either `number` or `keyword` mode. The Worker loads enabled source and adapter metadata, resolves each source's adapter from the compile-time registry, and invokes compatible providers concurrently.

Each source receives its own timeout signal. A provider failure or timeout is isolated to that source and reported as a source status; other sources can still contribute results. Provider output is validated and normalized against the configured source identity. Result URLs and optional external links must be HTTPS; Magnet and ED2K values are checked against their expected URI formats. Results are deduplicated by canonical result URL, capped at 50 per source and 100 total.

The registry currently contains no concrete adapters, so the endpoint can return an empty result set with explicit unavailable source statuses until a reviewed provider implementation is added. No source is fetched merely because a URL was entered in its configuration.
