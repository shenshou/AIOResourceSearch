# Source Catalog

This catalog records adult-resource source candidates found in the reviewed public repositories. It is an inventory, not an assertion that every site permits automated access or that every source is currently operational.

## Source types

- **External search**: opens a source's own search page using a configured HTTPS URL template. A Worker does not fetch or parse that site.
- **Provider**: a reviewed Worker adapter performs a permitted request and maps the response into the shared result contract.
- **Pending review**: the source is listed for administration, but its canonical URL, search template, access policy, and Cloudflare compatibility have not all been verified. It must remain disabled until reviewed.

No entry in this document is automatically enabled. The repository does not copy third-party scraping code or anti-bot bypass logic.

## Atlas

| Candidate | Intended role | Evidence / notes |
|---|---|---|
| JavBus | JAV metadata/detail candidate | Atlas's JAV provider directly requests JavBus detail pages and magnet data. Requires a separate access-policy and Cloudflare compatibility review before implementation. |
| JavDB | JAV metadata / external-search candidate | Referenced by Atlas's JAV source/ranking features; do not assume an official public API. |
| DMM / FANZA | JAV metadata / external-search candidate | Referenced as metadata sources in Atlas documentation. No paid API is to be added to this project. |
| Atlas configurable JAV search sources | External-search candidates | Atlas supports administrator-configured URL templates. The current repository does not provide a portable, authoritative live source list to import wholesale; each URL template must be independently verified. |

Unrelated Atlas categories (anime, manga, movies, novels), user accounts, community, history, ranking storage, and D1-backed features are outside this project's scope.

## Lustpress

Lustpress documents these eight site providers:

| Candidate | Category |
|---|---|
| PornHub | other-index |
| XNXX | other-index |
| RedTube | other-index |
| XVideos | other-index |
| XHamster | other-index |
| YouPorn | other-index |
| Eporner | other-index |
| TXXX | other-index |

Lustpress primarily uses HTML scraping. Its README also warns that some sites block automated requests from CI/shared IP ranges. The PornHub challenge solver is intentionally excluded: do not port challenge solving, anti-bot bypass, or access-control circumvention.

## FetchJAV

FetchJAV's README lists the following site adapters:

| Candidate | Notes |
|---|---|
| JableTV | Primary site adapter |
| MissAV | Primary site adapter; README mentions mirrors |
| SupJav | Primary site adapter; README mentions mirrors |
| Hanime1 | Listed site adapter |
| HanimeTV | Listed site adapter |
| TnaFlix | Listed site adapter |
| 91Porn | Listed site adapter |
| JavDB | Listed site adapter |
| Jable.org | Listed as a JableTV mirror/inherited site |
| ThisAV | Additional site |
| PigAV | Additional site |
| Porn5F | Additional site |
| 85Tube | Additional site |
| PornBest | Additional site |
| HAnime XYZ | Additional site |
| PornTW | Additional site |
| PornJP | Additional site |
| PornHK | Additional site |
| PornHoHo | Additional site |
| PornNVR | Additional site |
| Video01 | Additional site |
| PornLuLu | Additional site |
| MIEN321 | Additional site |
| AApp11 | Additional site |
| Seselah | Additional site |
| XJISHI | Additional site |

FetchJAV's metadata fetcher also references JAV.guru and JAVDatabase for discovery / metadata enrichment. These are metadata candidates, not proof of an authorized or stable API.

The following FetchJAV features are excluded: streaming, video downloading, subtitle search providers, local download history, local media libraries, proxy/cookie import, and Cloudflare/TLS-fingerprint bypass mechanisms.

## Deduplicated candidate inventory

The combined inventory currently contains the following distinct names (Jable.org is retained as a separately configurable mirror entry, but should be grouped under JableTV in the UI):

- JAV metadata/search: JavBus, JavDB, DMM/FANZA, JAV.guru, JAVDatabase, JableTV, Jable.org, MissAV, SupJav
- Other resource indexes: Hanime1, HanimeTV, TnaFlix, 91Porn, HAnime XYZ, ThisAV, PigAV, Porn5F, 85Tube, PornBest, PornTW, PornJP, PornHK, PornHoHo, PornNVR, Video01, PornLuLu, MIEN321, AApp11, Seselah, XJISHI, PornHub, XNXX, RedTube, XVideos, XHamster, YouPorn, Eporner, TXXX

No forum-specific source was identified in the reviewed provider lists. Forum sources remain a supported category in the product model, but should be added only after a specific public forum source is identified and reviewed.

## Admission checklist

Before an inventory entry becomes an active source:

1. Confirm the canonical HTTPS homepage and the site's current search URL format.
2. Confirm that the search page is publicly accessible without login, paywall, CAPTCHA, or other access-control circumvention.
3. Review the site's terms, robots policy, copyright/authorization constraints, and acceptable request rate.
4. Verify whether Cloudflare Workers can reach the site; local desktop success does not prove data-center egress compatibility.
5. Choose external-search unless a concrete, permitted, stable public interface or page parser has been reviewed.
6. For a Provider, implement and test the adapter in Worker code. A KV record alone never makes executable code available.
7. Keep new candidates disabled until the checks above are complete.

## Upstream references

- Atlas: https://github.com/Zoroaaa/Atlas
- Lustpress: https://github.com/sinkaroid/lustpress
- FetchJAV: https://github.com/FetchJAV/FetchJAV_Public
