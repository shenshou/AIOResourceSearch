# JAV 来源核验状态盘点

盘点基准：`feature/adapter-management` 分支，提交 `88db3ae18a51ed367a4479c50572c4b89e377616`。  
范围：`apps/web/src/modules/sources/sourceCatalog.ts` 中 `category: "jav"` 的 35 个目录条目。

## 统计结论

| 状态 | 数量 | 解释 |
|---|---:|---|
| 已完成当前阶段核验，现阶段明确不做自动接入 | 14 | 已有足够证据作出当前决策；若未来条件变化再重新评估 |
| 已有初步核验，但仍需补关键证据 | 20 | 不是完全没看过，而是域名、条款、接口、授权链或运行情况尚未闭环 |
| 已具备第一方公开许可、待技术可行性评估 | 1 | 已确认公开 CC0 数据 dump，但尚未决定是否适合当前架构 |
| 合计 | 35 | 与当前 JAV 目录条目数一致 |

**因此，当前需继续补证的是 20 个；另有 1 个来源已具备公开数据许可，但仍需技术可行性评估。**  
这些待补证/技术评估来源也不代表最终都能开发成 Provider。只有补证后同时满足公开接口、授权/使用条件、免费依赖和访问控制边界的来源，才进入开发队列。

## A. 当前阶段已形成明确结论（12）

| ID | 来源 | 当前结论 |
|---|---|---|
| `av01` | AV01 | 仅允许使用运营方发布的镜像清单作镜像发现；不允许据此抓取内容或自动绕过地区限制，不作为元数据 Provider |
| `dmm-fanza` | DMM / FANZA | 官方 API 的联盟资格、用途及共享/竞争服务限制与本项目模式冲突；除非取得覆盖本项目的书面许可，否则仅保留用户主动访问入口 |
| `jass-db` | JASS | 已核对第一方 FAQ/About；目前没有可验证的公开 API/RSS、稳定查询 URL 或第三方元数据使用许可，仅外部入口 |
| `jabletv` | JableTV | 第一方条款只支持有限的个人非商业链接用途；不抓取、不提取元数据，仅外部入口 |
| `jav-guru` | JAV.guru | 条款仅支持有限的个人非商业链接用途；保留用户主动外部搜索，不做 Worker 抓取或元数据复用 |
| `javdatabase` | JAVDatabase | 第一方公告记录地区访问限制；未确认公开 API/RSS 和第三方聚合许可，不抓取、不绕过地区限制 |
| `javdb` | JavDB | 第一方条款要求运营服务前取得书面同意；未取得覆盖本项目的书面许可前不接入 |
| `javgg` | JavGG | 第一方条款明确禁止数据挖掘、收集和提取；仅保留目录参考，不自动检索 |
| `javynow` | JavyNow | 第一方条款禁止未经授权的自动化抓取/提取；不恢复搜索模板，不自动访问 |
| `missav` | MissAV | 第一方条款明确限制美国访客访问；当前不作为通用来源展示或由 Worker 请求，不能绕过地域限制 |
| `javseen` | JAVSeen | JAVSeen 首页直接链接的第一方 Terms 禁止使用自动化系统获取服务内容或信息，并禁止未经书面许可的商业复制/利用；条款正文将服务描述为 Javhd.today，域名适用范围仍有表述不一致。采取保守处理：未获运营方澄清前不做自动检索/采集，仅保留用户主动外部访问；不得自动切换其备份域名 |
| `kanojo` | Kanojo | 官方 GitHub 主仓库已归档（最后代码提交 2023-09-27）；其 API 路由整体置于 `auth:sanctum` 中，需要认证，不是匿名公开检索 API。未验证现行公共服务或独立数据许可；当前不做自动接入，保留来源目录，待官方恢复公开接口后再评估 |
| `rjav` | r/JAV | Reddit 数据访问要求 API/OAuth、审批及内容使用合规；未获所需授权前仅保留用户主动外部搜索 |
| `knighjok-jav-dataset` | Japanese Adult Videos Dataset | 数据集声明 NC-SA 且来源授权链不清；不下载、不摄取、不缓存、不再发布 |

## B. 需要补证/继续验证（23）

| ID | 来源 | 下一步必须确认的事项 |
|---|---|---|
| `bestjavporn` | BestJavPorn | 第一方当前条款、公开搜索/API/RSS 契约及自动化/元数据使用许可 |
| `jable-org` | Jable.org | 确认准确运营域名、第一方条款及公开接口；不得与 JableTV 混为一谈 |
| `javasslove` | JAV Ass Lover | 确认规范首页、当前条款和受支持的公开检索接口 |
| `javdesu` | JAV Desu | 确认 javdesu.tv 的运营身份、第一方条款和公开检索接口；不以相似域名替代 |
| `javsubtitle` | JAV Subtitle | 确认 javsubtitle.xyz 的第一方条款和接口；不套用其他相似域名条款 |
| `javsubtitled` | JAV Subtitled | 确认规范首页、第一方条款和公开检索接口 |
| `javsb` | JAV.sb | 需要第一方条款和普通公开接口证据；不得处理/绕过 Cloudflare challenge |
| `javbus` | JavBus | 核实第一方条款、年龄验证要求和第三方元数据使用许可；不得自动处理年龄门槛 |
| `javcl` | JAVCL | 核实第一方条款、普通公开搜索/API/RSS 契约及聚合许可 |
| `javdoe` | JavDoe | 确认当前规范域名、运营方、第一方条款和公开接口；不得替换成相似域名 |
| `javhdporn2` | JAVHDPorn.net | 核实规范首页、第一方条款和公开检索契约 |
| `javleak` | JAVLeak | 虽有搜索 UI，但仍需第一方条款、稳定公开查询契约和元数据聚合许可 |
| `javlibrary` | JavLibrary | 核实当前条款、普通公开搜索可用性及第三方元数据使用许可 |
| `javmost` | JavMost | 确认当前运营域名、第一方条款和公开接口；不根据历史跳转猜测镜像 |
| `javout` | JAVOut | 核实规范首页、当前条款和稳定公开检索接口 |

| `javtsunami` | JAVTsunami | 核实第一方自动化许可、公开 API/RSS/搜索契约及稳定性 |
| `supjav` | SupJAV | 核实第一方条款、公开接口和元数据聚合许可；不绕过 403 或地区限制 |
| `av-search` | AV Search | 需要运营方公开的 API/稳定查询 URL、适用条款和 Worker 查询转发/元数据复用许可 |
| `data-mv-hf` | Data-MV | 补齐数据许可、上游来源及再授权证明；同时评估数据不完整问题，不下载其中视频 |
| `javplay-metadata` | JavPlay Metadata Index | 需要维护者确认上游数据授权链、公共聚合复用权、署名和删除处理机制 |


## 口径与后续执行规则

1. “已完成当前阶段核验”不等于永远不再复查，而是当前证据足以支持现阶段不自动接入的决定。只有出现新的第一方条款、正式 API 或书面授权时才重新打开。
2. “需要补证/继续验证”不等于来源完全没有研究记录；它表示目前仍缺少作出最终接入判断所需的关键证据。
3. 不把 HTTP 403、超时或第三方扫描结果单独视为授权、封禁或可绕过的依据。
4. 不实现需要登录、付费墙、验证码、反机器人挑战、地域限制或速率限制绕过的路径。
5. 不删除任何候选。不能自动接入的来源仍保留目录记录；用户主动外部跳转与自动抓取是两回事。
6. 只有通过补证的来源才进入 Provider 开发队列。接口配置可运行时管理；新增解析器/协议代码仍按项目部署流程处理。
7. 本盘点只更新研究状态，不新增 Provider、不启用来源、不写生产 KV、不部署，也不触发本轮 CI。

## 盘点后的工作顺序

优先对 23 个待补证来源做低成本的第一方证据复核；对数据集/API 候选（Data-MV、JavPlay、Kanojo、R18.dev、AV Search）分别确认授权链与正式接口。每次复核后更新本表状态，避免已完成项重新进入待办。通过验证的来源再按 JAV 元数据字段覆盖度（番号、标题、演员、发行日期、制作商）排序开发。


## Batch log

### Batch 25 — 2026-11-27
- Rechecked: `bestjavporn`, `jable-org`, `javasslove`, `javdesu`, `javsubtitle`.
- Result: 0 promoted; all 5 remain in the 23-item evidence backlog.
- BestJavPorn's visible search form is not treated as an API contract or automation permission. The other four lack sufficient first-party evidence; observed HTTP errors are not bypassed.
- Current count remains: 12 with a current no-auto-integration decision; 23 requiring further evidence.

### Batch 26 — 2026-11-27
- Rechecked: `javsubtitled`, `javsb`, `javbus`, `javcl`, `javdoe`.
- Result: 0 promoted; all 5 remain in the 23-item evidence backlog.
- JAV Subtitled: exact first-party domain not independently accessible; no first-party terms or supported public interface verified.
- JAV.sb: third-party page capture is not an API contract or automation grant; previous challenge observations remain a stop condition.
- JavBus: age-verification page observed; no age-gate automation or Worker fetching.
- JAVCL: third-party scan found no privacy-policy link, but no API/search contract or automation permission was established.
- JavDoe: exact `.to` domain timed out; mainland-China interference is not bypassed and similarly named domains are not substituted.
- No access controls were bypassed; no Provider, search template, KV configuration, source enablement, deployment or production data was changed.
- Current count remains: 12 with a current no-auto-integration decision; 23 requiring further evidence.

### Batch 27 — 2026-11-27
- Rechecked: `javhdporn2`, `javleak`, `javlibrary`, `javmost`, `javout`.
- Result: 0 promoted; all 5 remain in the 23-item evidence backlog.
- JAVHDPorn.net and JAVOut: exact catalog domains could not be independently accessed; no first-party interface/terms evidence found.
- JAVLeak: homepage and Advanced Search expose search UI and rich catalogue metadata, but no first-party terms, supported API/RSS contract or automation/data-use grant was verified.
- JavLibrary: research fetch returned HTTP 403; no cookies, proxies or challenge workarounds used.
- JavMost: `.ws` homepage is reachable and has catalogue/search navigation; its Legal page is only a 2257 compliance statement, not a Terms/API licence. No canonical-domain migration or automation permission inferred.
- No access controls were bypassed; no Provider, search template, KV configuration, source enablement, deployment or production data was changed.
- Current count remains: 12 with a current no-auto-integration decision; 23 requiring further evidence.
### Batch 28 — 2026-11-27
- Rechecked: `javseen`, `javtsunami`, `supjav`, `av-search`, `data-mv-hf`.
- Result: 0 Provider promotions and 0 search templates added.
- `javseen` moved from pending to the current no-automation group: its homepage directly links first-party Terms prohibiting automated systems from using the Service or obtaining content/information. The Terms describe the service as Javhd.today, leaving a domain-scope ambiguity; this is not treated as permission. User-initiated external navigation remains distinct from automated retrieval.
- JAVTsunami timed out; SupJAV and AV Search returned 403. None of these responses was bypassed.
- Data-MV's current Hugging Face card displays Apache-2.0, but also describes bundled MP4 files and an incomplete metadata catalogue. The uploader has not established upstream authorization/provenance or the licence scope across the metadata and media assets; no download or ingestion.
- Updated count: 13 current no-automation decisions; 22 requiring further evidence; 35 total JAV catalog entries.
- No access controls were bypassed; no Provider, search template, KV configuration, source enablement, deployment or production data was changed.
### Batch 29 — 2026-11-27
- Rechecked: `javplay-metadata`, `kanojo`, `r18dev`.
- JavPlay: README declares CC BY 4.0 and identifies JavPlay.tv/ja7play.com as the source, but upstream authorization, public production aggregator scope and removal handling remain unconfirmed; keep pending, no data ingestion.
- Kanojo: official repository is archived; all API routes are behind `auth:sanctum`; AGPL-3.0 covers software, not database data. Moved to current no-automation group; no authenticated endpoint or scraper reuse.
- R18.dev: first-party dumps page publishes weekly SQL/GZip snapshots, programmatic latest-dump URL and an explicit CC0 grant for structured data. Moved to licensed technical-feasibility queue; no dump downloaded or imported.
- Initial 23-item evidence backlog is fully reviewed. Updated 35-item disposition: 14 current no-automation decisions; 20 pending evidence items; 1 licensed technical-feasibility candidate.
- No access controls were bypassed; no Provider, KV configuration, source enablement, deployment or production data was changed.

