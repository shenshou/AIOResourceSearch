# Deferred source development backlog

This document tracks sources or acquisition techniques that are intentionally **not being developed now** because normal permitted access is not available or the source requires bypassing an access control.

A backlog entry is not an approval, implementation promise, or indication that the source is currently reachable.

## Reconsideration criteria

Reopen an item only when at least one of the following becomes true:

- The source publishes a stable official API/RSS/export interface that permits the intended automated use.
- The source explicitly authorizes the integration in writing.
- The source removes the relevant access restriction and its current terms permit normal automated access.
- A legitimate account/API credential is issued to the operator and the source permits its use by this service.

Do not reconsider an item merely because a third-party project demonstrates a challenge solver, proxy, TLS fingerprint, cookie import, or other bypass technique.

## Deferred techniques and candidate classes

| Candidate / technique | Current blocker | Reconsideration condition |
|---|---|---|
| Lustpress challenge-solver path | Requires solving anti-bot/Cloudflare challenges; bypass logic is explicitly excluded from this project | A target source provides an ordinary permitted API/RSS/feed or explicitly authorizes automated access |
| FetchJAV proxy, TLS-fingerprint, Cloudflare-cookie, or challenge-bypass paths | These mechanisms are not imported; they can defeat source-side access controls | A target source exposes a permitted ordinary endpoint or grants explicit authorization |
| CAPTCHA-protected sources | Automated CAPTCHA solving would bypass an access control | Source offers a permitted API or normal account session without CAPTCHA automation |
| Paywall / paid-membership-only sources | Access requires payment or bypass; paid services are not accepted for this project | A free, authorized public endpoint becomes available |
| Geo/IP-restricted sources | Routing around a source's geographic or IP restriction is not allowed | Source explicitly permits the Worker deployment region/IP or offers an authorized endpoint |
| Sources blocking ordinary Worker requests with anti-bot controls | Do not add challenge solvers, proxy rotation, forged browser fingerprints, or cookie replay to force access | Source approves the Worker/service or exposes an allowed integration endpoint |
| Sources whose published request limits cannot be met | Do not evade throttling or rotate identities to bypass limits | A compliant request schedule fits the published limits, or the source authorizes a higher quota |

## Review workflow

For each newly discovered candidate:

1. Record the canonical domain and the exact endpoint/feature that is blocked.
2. Identify whether the blocker is authentication, a technical challenge, a paywall, a geographic restriction, or a rate limit. Do not conflate normal login with bypass.
3. Capture the source's official terms/API policy and the exact observed behavior.
4. Keep the source as external-search only or unregistered if opening the original site is permitted; do not create a Worker Provider that attempts the blocked path.
5. Reassess only when a documented reconsideration condition is met.

## Current project rule

- Ordinary free-account authentication is allowed when the source permits automated use and the operator legitimately controls the credential.
- Worker credentials use source-scoped Secret bindings; they are never stored in KV or browser storage.
- Personal subscription feeds/tokens are not shared search APIs.
- No CAPTCHA solving, anti-bot challenge bypass, paywall bypass, geo/IP evasion, rate-limit evasion, forged sessions, or unauthorized credential reuse.
