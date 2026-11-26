# Source Catalog

目录的保留、来源归属、完整性核对和状态管理遵循[数据源目录管理规范](./source-catalog-policy.md)。候选记录不代表自动化授权、Provider 已实现或来源已启用。

本目录汇总了 Atlas、Lustpress、FetchJAV 三个公开仓库中与本项目范围相关的候选来源，并补充少量跨分类外部入口；管理页面提供统一的预置登记入口。

<badge>共 119 个去重候选</badge>

**重要：候选目录不等于已接入或已授权。** 所有预置来源登记后默认禁用。上游仓库提供的域名和搜索模板只作为初始参考，仍需核验站点现状、使用条款、robots 规则、自动化访问限制及 Cloudflare Workers 出口兼容性。


**产品范围与后续开发：** JAV / 成人相关搜索、元数据和数据源管理是本项目的核心功能之一，与其他内容分类同等作为一等产品范围，不得通过全局隐藏或批量删除将其边缘化。目录中尚未实现的适用来源是后续分阶段开发储备；技术调研可借鉴其他开源项目的实现方式，不限于官方 API，但必须分别评估技术可行性、访问限制和数据使用条件。详见[数据源目录管理规范](./source-catalog-policy.md)。

## 来源类型

- **外部搜索入口**：只生成用户主动打开的 HTTPS 链接。配置搜索模板时会把查询词 URL 编码后替换 `{query}`；没有搜索模板时仅打开站点首页。Worker 不会请求或解析目标网站。
- **Worker 抓取源**：由经过审查并实现的 Provider 请求和解析。必须有编译进 Worker 的适配器代码。
- **待审核**：预置目录中的所有条目初始状态。登记时默认禁用。

## 来源目录

## 当前审查快照（2026-11-26）

## Atlas multi-category review completion (2026-11-25)

The additional 63 Atlas SQL rows outside the original 57 Atlas-tagged catalog candidates have now all been reviewed and reconciled. They are documented in [source-review.md](./source-review.md), but are **not automatically imported** into the runtime catalog: review completion does not imply approval or Provider readiness. Several rows are cross-category aliases or duplicate platform identities. At the time of that Atlas reconciliation, the catalog contained 91 candidates. Subsequent reviewed supplemental entries bring the current catalog total to 111; the 63 reviewed Atlas rows remain unimported.



下方各分类表格主要记录候选来源的初始导入清单和上游项目归属；其中“有上游搜索模板”等字样是初始导入状态，不代表当前仍保留该模板，也不代表来源已获准自动访问。当前实际 URL、搜索模板和逐站审查结论以 `apps/web/src/modules/sources/sourceCatalog.ts` 与 [来源审查日志](./source-review.md) 为准。

- 119 条去重候选：Atlas 标签 67、FetchJAV 标签 28、Lustpress 标签 8、AIOResourceSearch 自有来源 22；标签存在交叉，不能将标签数直接相加当作来源总数。The RarBg 的 5 条分类记录均计入本项目自有来源。
- 当前保留 6 条外部搜索模板：JAV.guru、r/JAV、YourBittorrent、DMHY、Mikan Project、AniBT。它们都只是用户主动打开的外部入口；DMHY 和 AniBT 另外有独立 Provider 实现。
- 当前 10 个具体 Provider：Sukebei RSS、DMHY RSS、Eporner API、Perverzija DB、Torlock Torznab、YourBittorrent JSON、MangaDex metadata API、MusicBrainz metadata API、AniBT Torznab、The RarBg JSON。The RarBg 的 5 条分类源记录共用一个 Provider；Eporner 使用官方 API，并配有移除 Feed 同步与共享限流协调。新 Provider 仍需部署 Worker、登记适配器和来源记录，并完成 Hosted Cloudflare 验证后才能启用。DMHY、MangaDex、MusicBrainz、AniBT、Eporner 等实现也仍需按各自门槛完成 KV 配置和验证；另有可配置的通用 HTML adapter。
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

## BT / Torrent（29）

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
| DMHY | AIOResourceSearch | 官方关键词 RSS；Provider 已实现，待 Hosted 验证 |
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

## 其他资源索引（29）

| 来源 | 上游项目 | 初始入口状态 |
|---|---|---|
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

## 补充跨分类来源

- DMHY：官方 FAQ 明确提供关键词 RSS；Provider 已实现，仍需 Cloudflare Hosted 可达性、请求节奏及内容合规复核，保持禁用。
- Mikan Project：官方站内关键词搜索页已验证，加入动漫外部搜索目录；RSS/Search 仅有第三方客户端使用证据，个人 MyBangumi Token Feed 不作为共享数据源，暂不做 Worker 抓取。
- Nyaa：动漫 BT 索引入口，仅提供用户主动访问的首页链接；未完成精确域名的自动化访问政策、robots 与 Worker 可达性审查，不实现抓取。
- Shana Project：官网帮助页公开说明其站点 RSS 只包含最近 50 条发布；个人私有 RSS 是账户持有人的安全订阅，不得作为共享数据源。由于公开 RSS 不是关键词检索接口，暂只提供原站入口。
- AniBT：官方公开 Torznab 文档明确支持 Sonarr/Radarr/Prowlarr，无需登录或 API Key；已实现独立 Provider，按官方 60 次/分钟/IP 限制使用共享 1.1 秒限流通道，不缓存 Torznab 响应，仍保持禁用等待 Hosted 验证。

## 补充影视元数据候选（2026-11-26）

- TVmaze：公开节目名搜索 API，数据采用 CC BY-SA；先完成来源字段溯源、署名和 ShareAlike 兼容性设计，再评估 Provider。
- Wikidata：结构化数据采用 CC0；文本搜索应优先评估 `wbsearchentities`，WDQS 仅用于范围明确的关系查询，暂不做批量下载或 Provider。
- TMDB：官方 API 法律声明禁止将其数据/图片用于色情内容相关场景，与本项目 JAV 核心功能冲突；仅保留用户主动访问的官网入口，不集成 API。
- IMDb：公开 TSV 数据集许可仅限个人非商业用途，并禁止复用数据建立影视数据库；仅保留官网外部入口。
- 上述来源均未新增 Provider、搜索模板、KV 配置或启用状态。

## 补充影视元数据候选（2026-11-26，第二批）

- Trakt：API 允许一般影视搜索和公开发现功能，但禁止将其数据用于推广版权侵权/盗版的应用；本项目包含 Torrent / 磁力资源搜索，暂不接入。
- TheTVDB：有免费署名 API 层，但 API 法律声明禁止将数据/图片用于色情内容相关场景，与本项目成人内容核心范围冲突，不接入。
- Letterboxd：API 仅接受申请且不保证授权，当前明确不向若干数据分析/推荐/复刻付费功能项目开放；仅保留官网入口。
- OMDb：API 页面标示 CC BY-NC 4.0 和每日免费额度，但其 Terms 另有禁止未经书面许可建立索引的条款；许可适用范围未澄清前不接入。
- 上述来源均未新增 Provider、搜索模板、KV 配置或启用状态。

## 来源项目范围说明

### Atlas
- 已纳入 Atlas `database/seeds/003_search_sources.sql` 中与 JAV、Torrent、Community 相关的 56 个默认源（动漫、影视、漫画、小说类不纳入本项目）。
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
