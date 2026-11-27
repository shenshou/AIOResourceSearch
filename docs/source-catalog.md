# Source Catalog

目录的保留、来源归属、完整性核对和状态管理遵循[数据源目录管理规范](./source-catalog-policy.md)。候选记录不代表自动化授权、Provider 已实现或来源已启用。

本目录汇总了 Atlas、Lustpress、FetchJAV 三个公开仓库中与本项目范围相关的候选来源，并补充少量跨分类外部入口；管理页面提供统一的预置登记入口。

<badge>共 170 个去重候选</badge>

**重要：候选目录不等于已接入或已授权。** 所有预置来源登记后默认禁用。上游仓库提供的域名和搜索模板只作为初始参考，仍需核验站点现状、使用条款、robots 规则、自动化访问限制及 Cloudflare Workers 出口兼容性。


**产品范围与后续开发：** JAV / 成人相关搜索、元数据和数据源管理是本项目的核心功能之一，与其他内容分类同等作为一等产品范围，不得通过全局隐藏或批量删除将其边缘化。目录中尚未实现的适用来源是后续分阶段开发储备；技术调研可借鉴其他开源项目的实现方式，不限于官方 API，但必须分别评估技术可行性、访问限制和数据使用条件。详见[数据源目录管理规范](./source-catalog-policy.md)。

## 来源类型

- **外部搜索入口**：只生成用户主动打开的 HTTPS 链接。配置搜索模板时会把查询词 URL 编码后替换 `{query}`；没有搜索模板时仅打开站点首页。Worker 不会请求或解析目标网站。
- **Worker 抓取源**：由经过审查并实现的 Provider 请求和解析。必须有编译进 Worker 的适配器代码。
- **待审核**：预置目录中的所有条目初始状态。登记时默认禁用。

## 来源目录

## 当前审查快照（2026-11-27）

## Atlas multi-category review completion (2026-11-25)

The additional 63 Atlas SQL rows outside the original 57 Atlas-tagged catalog candidates have now all been reviewed and reconciled. They are documented in [source-review.md](./source-review.md), but are **not bulk-imported** into the runtime catalog: review completion does not imply approval or Provider readiness. Several rows are cross-category aliases or duplicate platform identities. Eight Atlas novel/e-book candidates from that reconciliation have since been individually retained in the catalog; the remaining reviewed rows are not automatically imported. At the time of the original Atlas reconciliation, the catalog contained 91 candidates. Subsequent reviewed supplemental entries produced several dated historical snapshots (including 146 and 153 candidates); those figures are not current totals. The authoritative current total is calculated from the runtime catalog and stated in the current inventory summary below.



下方各分类表格主要记录候选来源的初始导入清单和上游项目归属；其中“有上游搜索模板”等字样是初始导入状态，不代表当前仍保留该模板，也不代表来源已获准自动访问。当前实际 URL、搜索模板和逐站审查结论以 `apps/web/src/modules/sources/sourceCatalog.ts` 与 [来源审查日志](./source-review.md) 为准。

- **当前目录：170 条去重候选**：JAV 28、torrent 30、forum 16、other-index 96；AIOResourceSearch 自有来源标签 64（与上游项目标签存在交叉，不能直接相加）。The RarBg 的 5 条分类记录均计入本项目自有来源；AdultEmbed 是 2026-11-27 新增的成人视频目录 API 待审候选；StashDB、ThePornDB、JAVStash、FansDB 和 PMV Stash 是本轮新增的成人元数据候选，均暂保留首页入口。
- 当前保留 9 条用户主动打开的外部搜索模板：JAV.guru、r/JAV、YourBittorrent、DMHY、Mikan Project、AniBT、Open Library、Library of Congress、Steam Store。其中 YourBittorrent、DMHY、AniBT 已与各自 Worker Provider 合并到同一数据源目录记录；Open Library 与 Library of Congress 的模板只在用户点击后由浏览器打开，Worker 不会请求目标站点。
- **当前 12 个具体 Provider**：Sukebei RSS、DMHY RSS、Eporner API、Perverzija DB、Torlock Torznab、YourBittorrent JSON、MangaDex metadata API、MusicBrainz metadata API、AniBT Torznab、The RarBg JSON、LibriVox metadata API、AudioSilo Meta metadata API。The RarBg 的 5 条分类源记录共用一个 Provider。12 个 Provider 均已登记在代码注册表；是否可启用仍须分别完成来源审查、KV 配置和 Hosted Cloudflare 验证。另有可配置的通用 HTML adapter。
- 所有候选来源默认禁用；代码实现、目录登记、KV 配置、启用状态和 Cloudflare 线上验证是不同状态。


## JAV 资源站（28）

| 来源 | 上游项目 | 初始入口状态 |
|---|---|---|
| AV01 | Atlas | 有上游搜索模板，需复核 |
| BestJavPorn | Atlas | 有上游搜索模板，需复核 |
| DMM / FANZA | Atlas | 仅首页入口或 URL 待补 |
| Jable.org | FetchJAV | 仅首页入口或 URL 待补 |
| JableTV | Atlas / FetchJAV | 有上游搜索模板，需复核 |
| JAV Ass Lover | Atlas | 有上游搜索模板，需复核 |
| JAV Desu | Atlas | 有上游搜索模板，需复核 |
| JAV Subtitle | Atlas | 有上游搜索模板，需复核 |
| JAV Subtitled | Atlas | 有上游搜索模板，需复核 |
| JAV.guru | Atlas / FetchJAV | 有上游搜索模板，需复核 |
| JAV.sb | Atlas | 有上游搜索模板，需复核 |
| JavBus | Atlas | 有上游搜索模板，需复核 |
| JAVCL | Atlas | 有上游搜索模板，需复核 |
| JAVDatabase | FetchJAV | 仅首页入口或 URL 待补 |
| JavDB | Atlas / FetchJAV | 有上游搜索模板，需复核 |
| JavDoe | Atlas | 有上游搜索模板，需复核 |
| JavGG | Atlas | 有上游搜索模板，需复核 |
| JAVHDPorn.net | Atlas | 有上游搜索模板，需复核 |
| JAVLeak | Atlas | 有上游搜索模板，需复核 |
| JavLibrary | Atlas | 有上游搜索模板，需复核 |
| JavMost | Atlas | 有上游搜索模板，需复核 |
| JAVOut | Atlas | 有上游搜索模板，需复核 |
| JAVSeen | Atlas | 有上游搜索模板，需复核 |
| JAVTsunami | Atlas | 有上游搜索模板，需复核 |
| JavyNow | Atlas | 有上游搜索模板，需复核 |
| MissAV | Atlas / FetchJAV | 有上游搜索模板，需复核 |
| r/JAV | Atlas | 有上游搜索模板，需复核 |
| SupJAV | Atlas / FetchJAV | 有上游搜索模板，需复核 |

## BT / Torrent（30）

| 来源 | 上游项目 | 初始入口状态 |
|---|---|---|
| 141PPV | Atlas | 仅首页入口或 URL 待补 |
| BTSOW | Atlas | 仅首页入口或 URL 待补 |
| Empornium | Atlas | 仅首页入口或 URL 待补 |
| iJavTorrent | Atlas | 仅首页入口或 URL 待补 |
| JAVBEE | Atlas | 仅首页入口或 URL 待补 |
| JavJunkies | Atlas | 仅首页入口或 URL 待补 |
| LoveTorrent | Atlas | 仅首页入口或 URL 待补 |
| MagnetDL | Atlas | 仅首页入口或 URL 待补 |
| My JAV Bay | Atlas | 仅首页入口或 URL 待补 |
| NextJAV | Atlas | 仅首页入口或 URL 待补 |
| OneJAV | Atlas | 仅首页入口或 URL 待补 |
| Project Jav | Atlas | 仅首页入口或 URL 待补 |
| Sukebei | Atlas | 仅首页入口或 URL 待补 |
| TorrentKitty | Atlas | 仅首页入口或 URL 待补 |
| Torlock | AIOResourceSearch | 已实现 Torznab Provider；同时保留原站首页入口 |
| YourBittorrent | AIOResourceSearch | 已实现免费 JSON Provider；同时保留原站首页入口 |
| Bitsearch | AIOResourceSearch | 仅首页入口；API 数据再展示许可待确认 |
| XXXClub | Atlas | 仅首页入口或 URL 待补 |
| Nyaa | AIOResourceSearch | 动漫分类；仅原站首页入口，自动化访问待审查 |
| AnimeBytes | AIOResourceSearch | 私人 tracker；仅原站首页入口，无公开目录 API/RSS |
| 動漫花園 (DMHY) | AIOResourceSearch | 官方关键词 RSS；Provider 已实现，待 Hosted 验证 |
| Shana Project | AIOResourceSearch | 动漫分类；仅原站首页入口，公开 RSS 非查询型 |
| Tokyo Toshokan | AIOResourceSearch | 动漫分类；仅官方首页外部入口，当前 RSS/自动化许可未核实 |
| Mikan Project | Atlas / AIOResourceSearch | 动漫分类；官方关键词搜索外部入口，私有 RSS 不接入 |
| AniBT | AIOResourceSearch | 动漫分类；官方公开 Torznab Provider 已实现，待 Hosted 验证 |

| The RarBg · JAV | AIOResourceSearch | 共用 the-rarbg-json Provider；目录候选，默认禁用 |
| The RarBg · Anime | AIOResourceSearch | 共用 the-rarbg-json Provider；目录候选，默认禁用 |
| The RarBg · Film / TV | AIOResourceSearch | 共用 the-rarbg-json Provider；目录候选，默认禁用 |
| The RarBg · Games | AIOResourceSearch | 共用 the-rarbg-json Provider；目录候选，默认禁用 |
| The RarBg · Music | AIOResourceSearch | 共用 the-rarbg-json Provider；目录候选，默认禁用 |

## 论坛（16）

| 来源 | 上游项目 | 初始入口状态 |
|---|---|---|
| 141HongKong | Atlas | 仅首页入口或 URL 待补 |
| 5278.cc | Atlas | 仅首页入口或 URL 待补 |
| 52AV | Atlas | 仅首页入口或 URL 待补 |
| 91论坛 | Atlas | 仅首页入口或 URL 待补 |
| Cool18 | Atlas | 仅首页入口或 URL 待补 |
| EYNY | Atlas | 仅首页入口或 URL 待补 |
| HJD2048 | Atlas | 仅首页入口或 URL 待补 |
| JKForum | Atlas | 仅首页入口或 URL 待补 |
| OurSogo | Atlas | 仅首页入口或 URL 待补 |
| Sex8.cc | Atlas | 仅首页入口或 URL 待补 |
| SexInSex | Atlas | 仅首页入口或 URL 待补 |
| SIS001 | Atlas | 仅首页入口或 URL 待补 |
| South-Plus | Atlas | 仅首页入口或 URL 待补 |
| T66Y草榴社区 | Atlas | 仅首页入口或 URL 待补 |
| 夯鸭论坛 | Atlas | 仅首页入口或 URL 待补 |
| 色花堂98堂 | Atlas | 仅首页入口或 URL 待补 |

## 其他资源索引（96）

| 来源 | 上游项目 | 初始入口状态 |
|---|---|---|
| AdultEmbed | AIOResourceSearch | 有公开成人视频目录 API；接口开放不代表聚合/再展示许可，暂仅首页入口 |
| FansDB | AIOResourceSearch | 独立成人创作者元数据；申请/邀请/API Key 门槛，暂仅首页入口 |
| JAVStash | AIOResourceSearch | 日本 AV 日文元数据；私有 Discord 邀请和 GraphQL，暂仅首页入口 |
| PMV Stash | AIOResourceSearch | PMV/粉丝混剪元数据；邀请/API Key 门槛，暂仅首页入口 |
| StashDB | AIOResourceSearch | 多取向成人场景/演员/片商元数据；注册需邀请和 API Key，暂仅首页入口 |
| ThePornDB | AIOResourceSearch | 成人场景/JAV/影片元数据；需账户 API Token，聚合再利用许可待确认 |
| 85Tube | FetchJAV | 仅首页入口或 URL 待补 |
| 91Porn | FetchJAV | 仅首页入口或 URL 待补 |
| AApp11 | FetchJAV | 仅首页入口或 URL 待补 |
| Eporner | Lustpress | 仅首页入口或 URL 待补 |
| HAnime XYZ | FetchJAV | 仅首页入口或 URL 待补 |
| Hanime1 | FetchJAV | 仅首页入口或 URL 待补 |
| HanimeTV | FetchJAV | 仅首页入口或 URL 待补 |
| MIEN321 | FetchJAV | 仅首页入口或 URL 待补 |
| PigAV | FetchJAV | 仅首页入口或 URL 待补 |
| Porn5F | FetchJAV | 仅首页入口或 URL 待补 |
| PornBest | FetchJAV | 仅首页入口或 URL 待补 |
| PornHK | FetchJAV | 仅首页入口或 URL 待补 |
| PornHoHo | FetchJAV | 仅首页入口或 URL 待补 |
| PornHub | Lustpress | 仅首页入口或 URL 待补 |
| PornJP | FetchJAV | 仅首页入口或 URL 待补 |
| PornLuLu | FetchJAV | 仅首页入口或 URL 待补 |
| PornNVR | FetchJAV | 仅首页入口或 URL 待补 |
| PornTW | FetchJAV | 仅首页入口或 URL 待补 |
| RedTube | Lustpress | 仅首页入口或 URL 待补 |
| Seselah | FetchJAV | 仅首页入口或 URL 待补 |
| ThisAV | FetchJAV | 仅首页入口或 URL 待补 |
| TnaFlix | FetchJAV | 仅首页入口或 URL 待补 |
| TXXX | Lustpress | 仅首页入口或 URL 待补 |
| Video01 | FetchJAV | 仅首页入口或 URL 待补 |
| XHamster | Lustpress | 仅首页入口或 URL 待补 |
| XJISHI | FetchJAV | 仅首页入口或 URL 待补 |
| XNXX | Lustpress | 仅首页入口或 URL 待补 |
| XVideos | Lustpress | 仅首页入口或 URL 待补 |
| YouPorn | Lustpress | 仅首页入口或 URL 待补 |
| Bangumi | Atlas / AIOResourceSearch | 官方 subject 搜索 API 存在；第三方元数据复用许可待确认，暂仅首页入口 |
| MyAnimeList | Atlas / AIOResourceSearch | API v2 与 Client ID 要求存在，但第一方条款/配额/再利用许可待核验 |
| AniDB | Atlas / AIOResourceSearch | HTTP/UDP API 规范存在；当前自动化政策与第三方聚合许可未核实 |
| Kitsu | Atlas / AIOResourceSearch | 公开 GET 搜索接口存在；R18 门槛及数据复用许可待确认 |
| LiveChart | Atlas / AIOResourceSearch | 未核实第一方公开 API/RSS 或元数据复用许可；仅首页入口 |
| Douban (Anime/Film) | Atlas / AIOResourceSearch | 第一方条款要求书面许可；仅外部入口 |
| Notify.moe | Atlas / AIOResourceSearch | 第一方 API 存在，但第三方聚合许可与配额不明；仅外部入口 |
| AniList | Atlas / AIOResourceSearch | 第一方条款限制同类竞争性服务和大规模收集；仅外部入口 |
| TVmaze | AIOResourceSearch | CC BY-SA API；署名、ShareAlike 和限流要求待产品级处理 |
| The Movie Database (TMDB) | AIOResourceSearch | API 条款与 JAV/成人内容核心范围冲突；不接入 API |
| IMDb | AIOResourceSearch | 数据集许可限个人非商业用途且禁止建立影视数据库；仅官网入口 |
| Wikidata · Film / TV | AIOResourceSearch | CC0 结构化数据；待查询范围与质量测试 |
| Trakt | AIOResourceSearch | API 政策禁止用于推广侵权/盗版的应用；仅外部入口 |
| TheTVDB | AIOResourceSearch | API 法律声明与成人内容范围冲突；不接入 API |
| Letterboxd | AIOResourceSearch | API 需申请且未获批准；仅官网入口 |
| OMDb API | AIOResourceSearch | API Terms 限制未经书面许可建立索引；仅外部入口 |
| RAWG | AIOResourceSearch | API 数据分发限制及成人内容限制冲突；仅官网入口 |
| Giant Bomb | AIOResourceSearch | 第一方 API 当前不可用；仅官网入口 |
| Discogs | AIOResourceSearch | 部分字段 CC0，但字段级许可/署名/外链限制待书面澄清 |
| MangaDex | AIOResourceSearch | Provider 已实现但禁用；仅公开标题元数据，受免费无广告条件约束 |
| MusicBrainz | AIOResourceSearch | Provider 已实现但禁用；仅非商业 release-group 元数据 |
| Perverzija DB | AIOResourceSearch | Provider 已实现但禁用；公开 JSON 场景元数据，待 Hosted 验证 |
| Z-Library | Atlas | 官方域名线索已核验；仅外部首页入口，无公开元数据 API |
| Anna's Archive | Atlas | 仅外部首页入口；不使用会员 API 或批量数据库 |
| 知轩藏书（用户整理存档） | Atlas | 明确标注非原站官方；仅外部入口，不抓取 |
| 奇书网 | Atlas | 名称保留；当前无可确认的官方域名 |
| SoBooks | Atlas | 仅外部首页入口；自动化许可未核验 |
| Lunarora | Atlas | 名称保留；当前无可确认的官方身份/域名 |
| PDFs.top | Atlas | 仅外部首页入口；不抓取或取文件 |
| 读书派 | Atlas | 仅外部首页入口；不抓取目录或文件 |
| Open Library | AIOResourceSearch | 官方搜索 API 存在，但明确不建议作为第三方服务后端；仅用户主动搜索 |
| Google Books | AIOResourceSearch | API 数据涉及第三方许可且 API 条款限制收费；仅外部入口 |
| Project Gutenberg | AIOResourceSearch | 公共领域目录和 OPDS 可用；暂仅首页入口，后续可评估有界 OPDS Provider |
| Internet Archive | AIOResourceSearch | 官方元数据搜索 API 存在；条目权利因上传者而异，暂仅首页入口 |
| Standard Ebooks | AIOResourceSearch | 新书 RSS/Atom 免费公开；全量 OPDS 受 Patrons Circle 权限限制，暂仅首页入口 |
| Library of Congress | AIOResourceSearch | 官方 JSON/YAML 搜索 API 公开；20 次/分钟，条目权利需逐项核验 |
| Wikisource | AIOResourceSearch | 公共领域或兼容自由许可；逐作品检查许可，暂仅首页入口 |
| Royal Road | AIOResourceSearch | 未核实第一方 API；Terms 抓取条款需复核，暂仅首页入口 |
| Wattpad | AIOResourceSearch | 未核实第一方 API；第三方条款转录提示禁止抓取，暂仅首页入口 |
| WebNovel | AIOResourceSearch | 第一方条款限定个人非商业使用并保留平台内容权利；仅首页入口 |
| Wuxiaworld | AIOResourceSearch | 第一方条款明确禁止未经书面许可的自动化提取；仅首页入口 |
| Scribble Hub | AIOResourceSearch | 无公开 API/元数据复用许可；仅首页入口 |
| Novel Updates | AIOResourceSearch | 第一方 Terms 页面暂无法核验、无公开 API；仅首页入口 |
| Steam Store | AIOResourceSearch | 官方商店搜索 URL 已核验；仅用户主动搜索，无通用公开目录 API |
| Spotify | AIOResourceSearch | Web API 有 Premium 要求且条款限制自动化索引；仅首页入口 |
| Apple Music | AIOResourceSearch | API 需开发者令牌且使用范围受限；不接入 API，仅首页入口 |

## 补充跨分类来源

- DMHY：官方 FAQ 明确提供关键词 RSS；Provider 已实现，仍需 Cloudflare Hosted 可达性、请求节奏及内容合规复核，保持禁用。
- Mikan Project：官方站内关键词搜索页已验证，加入动漫外部搜索目录；RSS/Search 仅有第三方客户端使用证据，个人 MyBangumi Token Feed 不作为共享数据源，暂不做 Worker 抓取。
- Nyaa：动漫 BT 索引入口，仅提供用户主动访问的首页链接；未完成精确域名的自动化访问政策、robots 与 Worker 可达性审查，不实现抓取。
- Shana Project：官网帮助页公开说明其站点 RSS 只包含最近 50 条发布；个人私有 RSS 是账户持有人的安全订阅，不得作为共享数据源。由于公开 RSS 不是关键词检索接口，暂只提供原站入口。
- AniBT：官方公开 Torznab 文档明确支持 Sonarr/Radarr/Prowlarr，无需登录或 API Key；已实现独立 Provider，按官方 60 次/分钟/IP 限制使用共享 1.1 秒限流通道，不缓存 Torznab 响应，仍保持禁用等待 Hosted 验证。

## 补充影视元数据候选（2026-11-26）

- TVmaze：公开节目名搜索 API，数据采用 CC BY-SA；先完成来源字段溯源、署名和 ShareAlike 兼容性设计，再评估 Provider。
- Wikidata：结构化数据采用 CC0；文本搜索应优先评估 `wbsearchentities`，WDQS 仅用于范围明确的关系查询，暂不做批量下载或 Provider。2026 年 Wikimedia API 新限流基线为合规 User-Agent 未认证请求 200 次/分钟、并发不超过 3，429/503 必须遵循 `Retry-After`；实施前需复核实时政策。
- TMDB：官方 API 法律声明禁止将其数据/图片用于色情内容相关场景，与本项目 JAV 核心功能冲突；仅保留用户主动访问的官网入口，不集成 API。
- IMDb：公开 TSV 数据集许可仅限个人非商业用途，并禁止复用数据建立影视数据库；仅保留官网外部入口。
- 上述来源均未新增 Provider、搜索模板、KV 配置或启用状态。

## 补充影视元数据候选（2026-11-26，第二批）

- Trakt：API 允许一般影视搜索和公开发现功能，但禁止将其数据用于推广版权侵权/盗版的应用；本项目包含 Torrent / 磁力资源搜索，暂不接入。
- TheTVDB：有免费署名 API 层，但 API 法律声明禁止将数据/图片用于色情内容相关场景，与本项目成人内容核心范围冲突，不接入。
- Letterboxd：API 仅接受申请且不保证授权，当前明确不向若干数据分析/推荐/复刻付费功能项目开放；仅保留官网入口。
- OMDb：API 页面标示 CC BY-NC 4.0 和每日免费额度，但其 Terms 另有禁止未经书面许可建立索引的条款；许可适用范围未澄清前不接入。
- 上述来源均未新增 Provider、搜索模板、KV 配置或启用状态。

## 补充动漫元数据候选（2026-11-26）

- AniList：公开 GraphQL 元数据接口存在，但第一方条款限制大规模收集，并限制用于同类竞争性服务；未取得针对本项目的书面确认前，仅保留外部入口。
- Bangumi：第一方文档提供 subject 关键词搜索 API，并要求非浏览器客户端使用可识别的项目 User-Agent；当前尚未确认第三方聚合展示许可和明确的数值配额，暂保留首页入口。
- MyAnimeList：第三方技术资料提及 API v2 与 Client ID 要求，但本轮未核实当前第一方 API 条款、限额和元数据复用许可；不复用从官方 App 或第三方代码提取的 Client ID。
- AniDB：第一方 HTTP/UDP API 规范存在，但当前政策和第三方聚合许可未核实；暂保留首页入口。
- Kitsu：第一方文档说明公开 GET 和动漫搜索接口，但 R18 内容有访问门槛，且文档仓库许可不等于目录数据再发布许可；暂不接入。
- LiveChart：未核实第一方公开 API/RSS 合约或元数据复用许可；仅保留首页入口，不进行网页抓取或未公开接口探测。
- Douban：第一方法律声明要求对条目元数据、评分、评论和采集使用事先取得书面许可；仅保留外部入口。
- Notify.moe：第一方 API 存在，条款反对 HTML 抓取并指向 API，但第三方聚合许可、配额和服务持续性尚未确认；不进行 API 批量获取。
- 上述候选均保留在目录中，未新增 Provider、搜索模板、KV 配置或启用状态。

## 补充小说与电子书候选（2026-11-26）

- Z-Library、Anna's Archive、知轩藏书、奇书网、SoBooks、Lunarora、PDFs.top、读书派：将已审查的 8 个 Atlas 小说/电子书候选补入持久目录；其中身份不明的条目保持 name-only，明确为用户创建的知轩藏书存档不冒充原站。所有条目均无 Worker 自动获取路径。
- Open Library：官方 Search API 面向实时人工检索，但明确不建议作为第三方服务的数据后端；只提供用户主动打开的搜索链接。
- Google Books：API 数据涉及第三方授权，且条款限制收费应用并要求侵权内容移除流程；只保留官网入口。
- Project Gutenberg：机器可读公共领域目录和 OPDS 发现接口存在；OPDS 有 User-Agent、联系地址、请求节奏和 landing-page 链接要求，后续再评估有界 Provider。
- Internet Archive：官方元数据搜索 API 存在，但内容权利随具体上传项目变化；在权利筛选和内容范围设计前仅保留官网入口。
- 上述来源均未新增 Provider、KV 配置、来源启用或文件获取功能。

## 补充公共领域电子书、国家图书馆与协作文本来源（2026-11-26）

- Standard Ebooks：新书 RSS/Atom 对所有人开放，但完整 OPDS 和其他 Feed 需要 Patrons Circle 捐赠/资格；不使用受限 Feed 或付费访问，公开新书 Feed 也不是关键词搜索接口，因此仅保留首页入口。
- Library of Congress：官方 JSON/YAML API 可搜索数字化馆藏和站点内容，不需要 API Key；JSON/YAML API 限额为 20 次/分钟，超限会封锁一小时，429/CAPTCHA 必须暂停而非规避。未数字化的图书馆目录记录不在 API 中，内容权利按条目判断；仅提供用户主动搜索入口。
- Wikisource：作品须为公有领域或兼容自由许可，原始贡献通常为 CC BY-SA/GFDL，但每个作品的来源许可与公共领域状态需要逐项确认；Wikimedia API 需标识 User-Agent 并遵守限流，不得规避。仅保留首页入口。
- 上述来源均未新增 Provider、KV 配置、来源启用或文件获取功能。

## 补充连载小说与网络文学平台（2026-11-26）

- Royal Road：未核实第一方公开搜索 API；官方 Terms 页面当前研究抓取返回 403，第三方 Terms 索引提示存在反爬条款但尚未独立核验；仅首页入口。
- Wattpad：未核实第一方公开 API；第三方条款转录显示禁止抓取且限制个人非商业使用，但第一方条款页未能在本轮直接核验；仅首页入口。
- WebNovel：第一方条款授予个人、非商业、有限使用许可，保留平台 Materials 权利并禁止绕过安全/访问控制；部分功能收费；仅首页入口。
- Wuxiaworld：2025-09-15 生效的第一方条款明确禁止未经书面许可的 bot、scraper、crawler 或其他自动提取，并禁止绕过登录、付费章节锁和 API 限流；仅首页入口。
- Scribble Hub：第一方条款允许其在自身服务中展示用户内容，但未核实公开 API 或第三方元数据复用许可；条款没有明确写出一般抓取禁令，不据此推定授权；仅首页入口。
- Novel Updates：有公开小说索引，但第一方 Terms 页面返回 403，未核实公开 API 或元数据复用许可；仅首页入口。
- 上述来源均未新增 Provider、KV 配置、来源启用或章节/文件获取功能。

## 补充游戏与音乐元数据候选（2026-11-26）

- RAWG：官方游戏 API 有免费层，但 API 条款限制数据进一步分发，并禁止将数据/图片用于色情或淫秽内容场景；与本项目成人内容核心范围存在产品级冲突，仅保留官网外部入口。
- Giant Bomb：第一方状态页明确表示游戏等 API 当前不可用，替代 Wiki 仍处于早期状态；仅保留官网外部入口。
- Discogs：API 中部分唱片/艺人/厂牌字段标为 CC0，但受限数据、图片、字段级署名和时效要求，以及将流量导向非 Discogs 服务的限制，需要先取得书面澄清；暂不接入。
- ListenBrainz：官方 API 主要用于读取或提交用户听歌记录，不是通用音乐目录搜索接口；不作为共享目录数据源，不收集用户 Token。
- 上述审查未新增 Provider、搜索模板、KV 配置或启用状态。

## 来源项目范围说明

### Atlas
- 已纳入 Atlas `database/seeds/003_search_sources.sql` 中与 JAV、Torrent、Community 相关的 56 个默认源；另将已逐项审查的 8 个小说/电子书候选补入目录。动漫、影视、漫画候选仍按各自审查结果单独管理。
- 另纳入 README 提及的 DMM/FANZA 元数据候选。
- Atlas 的源列表支持自定义 URL 模板；这里收录的是公开仓库中的默认 seed，不代表生产环境当前全部数据源。

### Lustpress
- 已纳入其 README 和 Provider 目录列出的 8 个站点：PornHub、XNXX、RedTube、XVideos、XHamster、YouPorn、Eporner、TXXX。
- Lustpress 主要使用 HTML scraping，README 提醒部分站点会阻断 CI/共享 IP 自动化请求。
- 不移植 PornHub challenge solver、验证码求解、反机器人或访问控制绕过逻辑。

### FetchJAV
- 已纳入 README 的 26 个站点适配器，以及 metadata_fetcher.py 提及的 JAV.guru / JAVDatabase 元数据来源。
- 不纳入字幕 Provider、下载、播放、媒体库、历史记录、代理/Cookie 导入或 TLS 指纹/Cloudflare 绕过机制。

### 论坛来源
- Atlas 默认目录中包含 16 个社区/论坛入口，均只登记为外部入口；不会自动抓取论坛帖子或评论。
- 其他两个项目未提供同类论坛适配器清单。

## 暂缓开发的来源

- 当前开发阶段，必须通过处理或绕过验证码、反机器人挑战、Cloudflare Challenge、付费墙、地区/IP 限制、速率限制等访问控制才能获取的来源，不进入 Provider 实施和启用范围。
- 这属于阶段性暂缓，不是永久排除。来源和技术方案继续登记在 [备用开发需求](./deferred-source-backlog.md)，记录具体阻断、证据和未来重新评估条件；后续阶段可按第 11 条原则单独立项研究并进行来源级审查。
- 普通免费账号登录、官方 API Token 或合法 Cookie 不因“需要登录”而自动排除；仍须确认站点允许自动化访问。

## 登记和启用规则

1. 从数据源管理页打开“预置来源目录”；可以逐个配置，也可以一次性批量登记全部未登记候选。目录条目可声明独立的内容分类，批量登记和单条登记都必须保留该分类。
2. 批量登记会把候选一次写入 KV，所有条目均保持禁用；没有确认 URL 的条目允许先作为待配置记录存在。逐个配置时，对有上游搜索模板的条目先核对当前站点 URL 格式；对仅首页入口的条目可使用基础 URL。
3. 没有可确认的 HTTPS 首页或搜索 URL 时，保持禁用，补齐 URL 并核验后再启用。
4. 所有目录条目默认禁用；启用前必须确认访问规则和目标站点仍可正常访问。
5. 外部搜索入口不需要 Provider，也不会向 Worker 增加抓取请求。
6. 只有公开访问且允许自动化、并且经过实际测试的来源，才考虑实现 Provider。
7. 当前开发阶段不实施必须绕过验证码、反爬、登录、付费墙或其他访问控制的自动获取路径；这不是永久禁区，未来阶段的研究和实施须遵循第 11 条原则并经过单独审查。不使用付费元数据 API。

## 上游参考

- Atlas: https://github.com/Zoroaaa/Atlas
- Atlas default source seed: https://github.com/Zoroaaa/Atlas/blob/main/database/seeds/003_search_sources.sql
- Lustpress: https://github.com/sinkaroid/lustpress
- FetchJAV: https://github.com/FetchJAV/FetchJAV_Public


## 补充游戏与音乐外部入口（2026-11-27）

- Steam Store：官方商店搜索页与 `?term=` 查询 URL 已通过真实搜索结果验证；Steamworks Web API 文档未提供适用于本项目的通用公开商品目录搜索契约。仅提供用户主动打开的搜索模板，不调用未文档化 Storefront 接口、不抓取页面。
- Spotify：Web API 文档支持音乐搜索，但当前入门要求 Premium 账户与应用凭据；Developer Terms 禁止未经许可的机器人、站内搜索/检索工具抓取、复制或索引 Spotify 服务内容。仅保留首页入口，不实现 API 搜索。
- Apple Music：API 有目录搜索能力，但需开发者令牌和 Media Services 私钥；Apple Developer Program 年费为 99 美元，且 MusicKit 条款将用途限定于帮助终端用户使用 Apple Music 订阅服务。当前不符合项目的免费接入及产品用途边界，仅保留首页入口。
- 本批新增 3 个候选：Steam Store、Spotify、Apple Music。目录更新为 156 条去重候选（JAV 28、torrent 30、forum 16、other-index 82）；AIOResourceSearch 自有来源标签 51（标签交叉）。外部搜索模板由 8 条增至 9 条。未新增 Provider、凭据、KV 配置、启用状态或部署。


## 游戏与音乐平台补充外部入口（2026-11-27，第二批）

- GOG：第一方 User Agreement 明确禁止未经授权的机器人、爬虫、脚本和信息提取工具与 GOG 服务交互；官方 Galaxy SDK 面向开发者，没有核实到通用公开目录搜索 API 或第三方元数据复用许可。仅保留首页入口。
- Epic Games Store：官方商店 Browse 页面提供目录浏览和类型导航，但本次未核实到面向第三方的公开目录搜索 API 或元数据复用授权。仅保留首页入口；不因条款摘录中未发现明确 scraping 条款而推定自动化获准。
- Deezer：历史开发者条款虽描述 Search API，但在线应用须经 Deezer 审批；Deezer 社区管理员 2025 年表示已暂停向个人开发者开放新的 API 访问，2026 年社区报告搜索行为不稳定。当前无可确认访问授权或第三方聚合许可，仅保留首页入口。
- Bandcamp：第一方 Acceptable Use Policy 明确禁止自动抓取及文本/数据挖掘；其 API 面向厂牌和商品履约合作方，需单独申请 OAuth 凭据，不是通用目录搜索 API。仅保留首页入口。
- 本批新增 4 个候选，目录更新为 153 条去重候选（JAV 28、torrent 30、forum 16、other-index 79）；AIOResourceSearch 自有来源标签 48（标签交叉）。外部搜索模板仍为 9 条；未新增 Provider、凭据、KV 配置、启用状态或部署。


## 独立游戏与音乐服务补充审查（2026-11-27，第三批）

- itch.io：第一方文档明确提供 browse-page RSS 和新游戏/精选/促销 feed；其服务器 API 需要账户凭据，主要涉及账户、购买和拥有游戏数据，不是通用公开目录搜索 API。Terms 禁止信息收集等行为，但没有确认第三方目录元数据再发布许可。暂时只保留首页入口；RSS 是未来候选，不在当前阶段轮询或聚合。
- TIDAL：第一方 Developer Terms 将工具用途限定于非商业产品，要求有效 TIDAL 登录凭据，并禁止自动抓取/站内检索工具复制或索引平台内容，也禁止建立内容数据库。当前聚合用途不具备明确许可，仅保留首页入口。
- Qobuz：可查到的第一方 API Terms（2011 年生效，未来使用前须复核是否仍有效）要求 Qobuz 签发的 Application ID/secret/key，并禁止将服务内容提供给非用户、广告/赞助变现、索引服务内容、收集用户信息和绕过元数据地域限制。当前不接入 API，仅保留首页入口。
- 本批新增 3 个候选，目录更新为 156 条去重候选（JAV 28、torrent 30、forum 16、other-index 82）；AIOResourceSearch 自有来源标签 51（标签交叉）。外部搜索模板仍为 9 条；具体 Provider 实现现为 11 个。没有新增自动获取路径。


## 补充音乐平台外部入口（2026-11-27，第四批）

- SoundCloud：官方 API 支持曲目、用户和播放列表搜索，但需要注册应用及平台签发凭据；API 条款禁止未经 API 授权的数据抓取/聚合，并明确禁止将 API 或用户内容用于展示露骨性图像或销售/宣传色情内容的应用。鉴于 JAV/成人内容是本项目核心分类，不接入 API，仅保留首页外部入口。
- Game Jolt：官方 API 面向游戏内数据存储、分数、会话、奖杯和用户功能，不是公共游戏目录搜索 API；第一方条款禁止成人内容及抓取/复制平台内容，因此不纳入本项目来源目录。
- 本批新增 SoundCloud 1 条，目录更新为 157 条去重候选（JAV 28、torrent 30、forum 16、other-index 83）；AIOResourceSearch 自有来源标签 52（标签交叉）。外部搜索模板仍为 9 条；具体 Provider 实现仍为 10 个。未新增 Provider、凭据、KV 配置、启用状态或部署。


## 补充音乐目录与开放音乐平台（2026-11-27，第五批）

- Audius：官方 API 支持公开只读曲目/用户/播放列表搜索，但内容受创作者选择的 API 开关、Open Music License 和具体许可约束；没有确认可对整个目录进行持久化再发布的统一授权。仅保留首页入口，后续须逐字段审查 API Terms 和 OML。
- Jamendo：官方 API v3 支持曲目/专辑/艺人搜索，非商业免费层标示每月最多 35,000 次请求；API Terms 要求遵守每项内容的 Creative Commons 许可、署名创作者和 Jamendo 并提供作品页回链，商业用途（包括广告/联盟收入）需联系授权团队，可能收费。当前仅保留首页入口，不配置 API。
- Free Music Archive：官方说明旧 API 已关闭；未经明确批准不得转发用户搜索词并抓取返回 HTML，也不得热链其音乐文件。仅保留首页入口。
- 本批新增 3 个候选，目录更新为 160 条去重候选（JAV 28、torrent 30、forum 16、other-index 86）；AIOResourceSearch 自有来源标签 55（标签交叉）。外部搜索模板仍为 9 条；具体 Provider 实现仍为 10 个。没有新增自动获取路径。


## 播客与有声读物来源（2026-11-27，第六批）

- LibriVox：第一方明确欢迎第三方应用、档案机构、流媒体和策展者分享/再分享其公共领域录音，并提供官方目录 API，支持标题/作者/类型搜索、JSON、字段选择、分页和 since 增量更新。当前上限 500 条/请求，并要求批量请求间隔数秒。已实现 metadata-only librivox-api Provider：标题前缀搜索、20 条上限、字段白名单、5 秒共享限速和 LibriVox 项目页回链；不获取音频、RSS、封面或 Archive.org 资源。适配器和来源仍未配置/启用，等待非生产 Cloudflare 验证。
- Podcast Index：有播客发现 API，但其官方条款仓库标示当前版本为 v2.0，本轮未能独立核验 v2.0 正文。可访问的 v1.1 条款明确限制将 API 返回内容建立永久数据库/副本（除非内容权利人或法律另行允许），并限制缓存。暂时仅保留首页入口，不调用 API 或轮询 feed，待核实当前条款与元数据使用许可。
- 本批新增 2 个候选，目录更新为 162 条去重候选（JAV 28、torrent 30、forum 16、other-index 88）；AIOResourceSearch 自有来源标签 57（标签交叉）。外部搜索模板仍为 9 条；具体 Provider 实现仍为 10 个。未新增 Provider、凭据、KV 配置、启用状态或部署。


## 有声读物目录补充（2026-11-27，第七批）

- AudioSilo Meta：保留为潜在有声读物元数据 Provider 候选。其事实核心数据（作品、录音、人物、系列）明确采用 CC0-1.0，但线上 API/SQLite artifact 同时组合独立的 CC BY-SA 4.0 社区层；未来若接入，必须只使用 CC0 核心字段，排除社区派生字段、出版商简介和封面图，并遵守客户端限速与 Retry-After。
- AudiobookDB：保留为首页外链候选。官方条款要求任何第三方/多用户应用（包括免费的公共应用）在使用 API 前取得单独书面集成协议；个人 API 访问不授权目录复制、再分发或永久发现索引。
- 本批新增 2 个候选，目录更新为 164 条去重候选（JAV 28、torrent 30、forum 16、other-index 90）；AIOResourceSearch 自有来源标签 59（标签交叉）。外部搜索模板仍为 9 条；该批结束时具体 Provider 实现为 10 个。
- 该批结束时未新增 Provider、API 调用、凭据、KV 配置、来源启用或部署；后续 LibriVox 实现进展见下方更新。
\n## LibriVox Provider implementation update（2026-11-27）\n
- LibriVox 已从“未来候选”升级为代码已实现的 Provider 候选：librivox-api v1.0.0，metadata-only，有声读物分类，标题前缀搜索，单次最多 20 条，字段白名单和 5 秒共享 Durable Object 限速。
- Worker 不获取音频、RSS、封面或 Archive.org 文件；每条结果回链 LibriVox 项目页。源码和 adapter catalog 已登记，但生产 KV 中尚无 adapter/source 记录，均未启用。
- 当前目录仍为 164 个唯一候选（JAV 28、torrent 30、forum 16、other-index 90）；AIOResourceSearch 自有来源标签 59（交叉标签）；用户主动外部搜索模板 9 条；LibriVox 完成后具体 Provider 实现数为 11，随后 AudioSilo Meta 加入后当前为 12。
- AudioSilo Meta 完整 CI 已于 2026-11-27 通过：[#45949235669](https://github.com/shenshou/AIOResourceSearch/actions/runs/45949235669)，验证提交 `c0745998e51d10a8481ca113941270b1da1ed007`，包含 lint、Worker 单元测试、Durable Object workerd runtime 测试、前端构建和 Worker 类型检查。非生产 Cloudflare Hosted 验证仍未开始；本次 CI 不代表已部署或可用于生产。

## AudioSilo Meta Provider implementation update（2026-11-27）

- AudioSilo Meta 已实现为 `audiosilo-meta-api v1.0.0`，使用官方 `/api/v1/works/search` 搜索接口，单次最多 20 条，结果回链其规范作品页。
- Worker 仅映射 CC0 事实核心字段：作品标题/slug、作者和朗读者姓名、语言、系列名称/卷序、发行日期；忽略封面 URL、描述、流派、人物、剧情摘要、章节及其他 CC BY-SA 社区层字段。
- 使用独立共享 Durable Object 限速通道，最小间隔 1 秒；共享协调器持久处理上游 429/503 和 Retry-After。无全量同步、批量快照、缓存、音频或封面获取。
- Provider 已加入 Worker 注册表与预置来源目录，测试和 fixture 已补齐。来源和 adapter 仍未写入 KV、未启用；尚未执行真实上游请求、CI 或 Cloudflare Hosted 验证。
- 目录仍为 164 条唯一候选（JAV 28、torrent 30、forum 16、other-index 90）；项目来源标签 59（交叉标签）；用户主动外部搜索模板 9 条；具体 Provider 实现数更新为 12。
- 详细字段许可边界和验证状态见 [AudioSilo Meta Provider readiness](./providers/audiosilo-meta-readiness.md)。


## 成人元数据目录与 Stash-Box 实例补充审查（2026-11-27）

- StashDB：官方指南确认其提供不同取向的成人场景、演员和片商元数据，JAV 可收录但适用单独社区规则；读取需邀请码注册和个人 API Key。没有核实允许公共多用户聚合器持久化、索引和再展示元数据的许可，暂仅首页入口。
- ThePornDB：官方 Stash 文档列出其 GraphQL endpoint，并要求注册账户后生成 API Token；官方 API 文档另列出 scenes、JAV、movies、performers、studios 等目录接口。个人 API Token 不等于多源搜索服务的再利用授权；字段许可、缓存、署名、保留和删除义务未核实，暂仅首页入口。
- JAVStash：官方 Stash 文档确认其聚焦日本 AV 原始日文元数据，提供 GraphQL endpoint，但加入入口指向私有 Discord 邀请；未核实公开注册和第三方聚合许可，暂仅首页入口。
- FansDB：官方文档确认其为邀请制独立成人创作者元数据库，需申请、邀请码、账户和 API Key；仅收录满足其年龄验证、原创创作者导向等规则的网络，不是专业片商 JAV 目录的替代品。暂仅首页入口。
- PMV Stash：官方 Stash 文档确认其聚焦 PMV、Cock Hero、Hypno Vids 和混剪等社区元数据，需邀请码、账户和 API Key；未核实第三方聚合许可，暂仅首页入口。
- Stash-Box 是 MIT 许可的开源服务端软件；该软件许可证不自动覆盖各托管实例的数据集。五个候选分别保留，不能把它们合并成一个许可或访问模型。
- 本批新增 5 个候选，目录更新为 170 条去重候选（JAV 28、torrent 30、forum 16、other-index 96）；AIOResourceSearch 自有来源标签 64（标签交叉）。外部搜索模板仍为 9 条，具体 Provider 实现仍为 12 个。未新增 Provider、凭据、API 调用、KV 配置、来源启用或部署。
