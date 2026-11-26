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


## Named candidates currently deferred

The following names are intentionally retained in the source catalog and review log. This index is a navigation aid; the source-specific evidence and reconsideration conditions remain in `docs/source-review.md`. **No item below is an enabled Provider.** Where the catalog has no safe, verified destination, it remains name-only rather than receiving a guessed mirror URL.

| Candidate | Current disposition | Reconsider only when |
|---|---|---|
| Bitsearch | External-search only; official anonymous API exists, but third-party metadata display terms are unverified and the shared egress quota is restrictive | First-party terms or written permission clarify metadata display, and a sustainable quota is available |
| BTSOW | Unverified directory reference; canonical operator/domain and API/RSS contract unresolved | Operator confirms canonical domain and publishes a supported interface and automation policy |
| iJavTorrent | External-only; human search UI is not an automation contract | First-party API/RSS or explicit automation permission is published |
| JAVBEE | Unverified homepage reference | Canonical site becomes verifiable and publishes a supported interface/policy |
| My JAV Bay | Homepage-only; no official feed/API or metadata-republication permission; third-party scraper is paid and excluded | Official free API/feed and applicable metadata-use rules are published |
| OneJAV | External-only; official feed does not provide the required BT search, while third-party RSSHub route is a scraper; observed 403 is not to be bypassed | Operator publishes a BT-capable feed/API and permits the intended automation |
| 141PPV | External-only; official feed's BT-search capability is not established; third-party RSSHub route is not authorization | Operator publishes a supported BT search feed/API and metadata-use rules |
| Project JAV | External-only; public search UI and magnets do not establish automated-access permission | First-party automation policy and stable public API/feed are published |
| TorrentKitty | External-only; search contract and cross-domain Terms applicability are unresolved | Operator confirms canonical domain, current terms, and supported search interface |
| XXXClub | External-only; homepage returned 403 and third-party indexer routes do not establish permission | Normal public access and first-party API/feed or explicit automation permission become verifiable |
| Tokyo Toshokan | Homepage-only; historical RSS support is not enough to establish a current feed contract or permission | Current official feed URL, query behavior, and automation policy are verified |
| EZTV | Deferred; documented API does not provide the required free-text keyword search | Official stable keyword-search endpoint is documented, or a clearly permitted narrow enrichment use is established |
| YTS | Deferred; current canonical API host and contract are not verified | YTS publishes the current API specification and canonical API host on an official domain |
| AniDB | Deferred; available official API material does not establish a stable keyword-search Provider contract for this use | Current official search endpoint, HTTPS behavior, and permitted use are documented |
| Notify.moe | Deferred; API is described as evolving and stable public keyword search/data-use terms remain unclear | Stable documented search contract and metadata-use terms are published |
| South-Plus | Homepage-only; canonical policy/interface could not be verified; regional blocking is not a reason to proxy around it | Canonical terms and a supported public search/API/RSS interface are published |
| T66Y / 草榴社区 | User-initiated external link only; first-party visitor notice explicitly says not to use scripts and warns against abnormal access | First-party notice/policy changes and an expressly permitted integration interface is published |
| 夯鸭论坛 | Homepage-only; 18+ age gate is not an automation permission or API contract | Current terms and a supported public interface are published; no age-gate bypass |
| 色花堂98堂 | Unverified external reference; listed domains do not currently establish a canonical, functioning site or API | Operator confirms canonical domain and publishes current terms plus a supported interface |
| Empornium | External link only; private tracker with account/invite access | A genuinely public, operator-authorized interface becomes available; no account-cookie automation |
| 85Tube | Name-only; third-party scans report a redirect to 85ro.com, but no first-party evidence confirms the 85Tube alias. 85ro.com Terms apply to 85ro.com and permit only personal, non-commercial linking; no automated metadata permission/API/feed verified | First-party confirmation of the 85Tube-to-85RO canonical relationship plus a supported public interface and applicable automation/data-use policy |
| Jable.org | Name-only; exact domain returned third-party-observed 401/generated-host redirect; FetchJAV mirror listing is not first-party proof | First-party confirmation of canonical domain plus a supported, permitted public interface |
| Porn5F | Historical name-only record; latest located third-party WHOIS snapshot reports 2026-07-03 expiry; no current operator-controlled site or canonical replacement verified | Operator confirms active canonical domain and publishes current terms plus a supported interface |
| PornBest | Name-only; third-party status/WHOIS reports conflict around the 2026-11-23 expiry and HTTP 403; no first-party canonical domain or automation policy verified | First-party confirmation of current canonical service and a permitted API/RSS/search interface |
| Seselah | Name-only; third-party scans report redirect to Papalah, but no first-party confirmation of alias/successor relationship or automation permission | First-party confirmation of the Seselah/Papalah relationship and a permitted public interface |
| PornHK | Historical name-only record; RDAP reports registration through 2028-01-17 but DAN marketplace nameservers indicate parking; no active operator-controlled service or interface verified | First-party confirmation of an active canonical service and a permitted public interface |
| PornHoHo | Historical name-only record; third-party WHOIS expiry snapshot (2025-12-12) conflicts with 2026 Cloudflare DNS observations; current operator/service status unresolved | First-party confirmation of active canonical domain, current terms, and a permitted public interface |
| AApp11 | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| HAnime XYZ | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| MIEN321 | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| PornJP | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| PornNVR | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| PornTW | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| Video01 | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| XJISHI | Name-only; FetchJAV lists the name only; no canonical domain, first-party terms, or supported API/RSS verified; FetchJAV adapter code is not first-party authorization and anti-bot bypass components are excluded | First-party confirmation of canonical domain plus a supported public interface and applicable automation/data-use terms |
| SexInSex | External access only; 21+ warning and email activation required for full access; no public API/RSS contract or third-party metadata permission verified; first-party notice reports crawler-related visitor restrictions | Operator publishes a public interface and explicitly permits third-party metadata collection without account/session automation |
| SIS001 | External access only; official FAQ documents user-facing search and RSS features but no public feed URL/query contract or third-party collection permission was verified; current research fetch returns 403 | Operator documents a public feed/API contract and permits this aggregator's intended metadata use |
| 91论坛 | External access only; exact forum destination returned 403; no first-party current Terms or authorized public search/feed contract verified; no regional-block evasion | First-party terms and a stable public search/API/RSS interface explicitly permit the intended access |
| JAVLeak | Homepage-only; visible search form but no verified Terms, official API/RSS, stable supported search contract, or metadata-aggregation permission | Operator publishes current terms and a supported public search/API/feed contract permitting aggregation |
| JavMost | External access only; observed javmost.com redirect to javmost.ws; current Legal page is a 2257 statement, not Terms; no public API/RSS or metadata permission verified | Operator confirms canonical domain and publishes current automation/data-use terms plus a supported public interface |
| 5278.cc | Homepage-only; exact homepage returned 403; recent TLS/DNS activity is not access permission; no first-party terms or public API/RSS/search contract verified | First-party current terms and a supported public search/API/feed explicitly permit automated metadata use |
| OurSogo | Homepage-only; exact homepage returned 403; no first-party terms, official API/RSS, or supported public search contract verified | Operator publishes current terms and a supported public interface permitting the intended automation |
| Sex8.cc | Homepage-only; domain not retrievable; operator-associated Linktree evidence does not establish current terms, API/RSS, or metadata-extraction permission | First-party terms and a stable public search/API/feed permit third-party metadata extraction |
| 91Porn | External access only; first-party 18+ and mainland-China access notice; RSSHub marks strict anti-crawling; no official API/RSS contract or aggregation permission verified | Operator publishes an expressly permitted public interface; no age-gate automation or regional restriction evasion |
| Hanime1 | External access only; first-party 18+ compliance statement but homepage returns 403; no official API/RSS or metadata-aggregation permission verified | Operator publishes current automation terms and a supported public interface; no challenge or geographic restriction bypass |
| JAVGG | First-party Terms prohibit data mining, data harvesting, and data extraction; no official API/RSS exception verified | Operator publishes an expressly permitted API/feed or grants written authorization for metadata aggregation |
| JavyNow | First-party Terms prohibit scrapers, spiders, robots, and automated extraction absent express authorization; third-party content redistribution is also restricted | Operator expressly authorizes this service or publishes a supported interface with applicable reuse terms |
| JAVDatabase | Homepage-only external entry; no first-party public API or automation permission verified; third-party scraper/API options are not eligible | Official free API/feed and applicable automation/data-use terms are published |
| JAVDB / JAVLibrary / JAV.guru | External-search candidates only; no verified public API contract and/or automation permission for this aggregator | First-party API/feed or explicit written authorization permits the intended metadata use |
| javinfo / Datawebot scraper services | Not eligible under the project's no-paid-services rule | A free official interface becomes available; paid third-party scraping remains excluded |

This named list is not exhaustive of every catalog entry. It covers the reviewed candidates whose current status is especially likely to be mistaken for an implemented source. For the complete source inventory, use `sourceCatalog.ts`; for the full evidence trail, use `source-review.md`.
