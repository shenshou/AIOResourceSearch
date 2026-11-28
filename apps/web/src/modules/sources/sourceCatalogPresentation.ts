import type { SourceCatalogEntry } from "./sourceCatalog";

/**
 * User-facing Chinese summaries for the source research notes.
 * The original English research notes remain in sourceCatalog.ts as evidence;
 * this function presents their operational conclusion in concise Chinese.
 */
export function getSourceCatalogDisplayNote(entry: SourceCatalogEntry): string {
  const note = entry.note.toLowerCase();
  const parts: string[] = [];

  if (entry.type === "provider") {
    const providerNotes: Record<string, string> = {
      "perverzija-db": "已实现只读 JSON Provider，可检索作品元数据及演员、制作商、制作网络和标签等关联信息；仅支持关键词搜索，不提供磁链、种子、图片或播放器内容。当前仍需单独完成数据源登记、启用和线上验收。",
      "mangadex": "已有内置 Provider，仅检索漫画作品元数据；不获取章节、封面图片、账户或用户数据。当前来源与适配器仍需单独配置并保持禁用，不能据此视为已完成线上验收。",
      "musicbrainz": "已有内置 Provider，仅检索音乐发行组基础元数据；不获取用户数据、评分、封面或其他社区字段。当前来源与适配器仍需单独配置并保持禁用。",
      "librivox": "已有内置有声书元数据 Provider，仅按书名开头检索目录信息；不获取音频文件、RSS、封面或 Archive.org 资源。当前来源与适配器仍需单独配置并验收。",
      "audiosilo-meta": "已有内置元数据 Provider，仅映射许可范围内的 CC0 作品事实字段；排除封面、描述、章节及其他非 CC0 社区字段。当前来源与适配器仍需单独配置并验收。",
      "eporner": "已有官方 API Provider 实现，但启用前必须先完成移除内容同步、定时任务配置、托管环境验证及适用政策审查；这些前置条件未完成前不得启用。",
      "the-rarbg-jav": "共用 The RarBg JSON Provider 的 JAV 分类来源。适配器和来源必须分别登记；完成 Staging 验证前保持禁用。",
      "the-rarbg-anime": "共用 The RarBg JSON Provider 的 Anime 分类来源。适配器和来源必须分别登记；完成 Staging 验证前保持禁用。",
      "the-rarbg-film-tv": "共用 The RarBg JSON Provider 的影视分类来源。适配器和来源必须分别登记；完成 Staging 验证前保持禁用。",
      "the-rarbg-game": "共用 The RarBg JSON Provider 的游戏分类来源。适配器和来源必须分别登记；完成 Staging 验证前保持禁用。",
      "the-rarbg-music": "共用 The RarBg JSON Provider 的音乐分类来源。适配器和来源必须分别登记；完成 Staging 验证前保持禁用。",
    };
    if (providerNotes[entry.id]) return providerNotes[entry.id];
    return "该条目对应项目内置 Provider。启用前仍需核对接口契约、返回字段、缓存与限流要求，并单独登记和验收数据源；登记本身不会自动启用搜索。";
  }

  const homepageOnly = /homepage-only|homepage only|external access only|user-initiated external|retain only a user-initiated|keep external-only|external-only/.test(note);
  const templateRemoved = /search template removed|template removed|search route was not verified|search route.*not verified/.test(note);
  const noAutomation = /no worker|no automated access|no scraping|no crawling|no metadata extraction|no provider|do not crawl|do not scrape|not verified/.test(note);

  if (templateRemoved) {
    parts.push("尚未验证可稳定使用的官方搜索路径，已不提供未经核实的搜索模板；目前仅保留原站访问入口。");
  } else if (homepageOnly || noAutomation) {
    parts.push("目前仅保留用户主动访问原站的入口；尚未确认可供本项目使用的官方公开接口、稳定搜索契约或自动化采集授权，因此不进行 Worker 抓取和页面元数据提取。");
  } else {
    parts.push("该候选来源尚未完成接入审查。当前不自动抓取、不提取或缓存站点内容，仅保留目录记录供后续核验。");
  }

  if (/\b403\b/.test(note)) {
    parts.push("核查记录中出现 HTTP 403；这不代表允许通过代理、备用域名、Cookie 或挑战绕过方式访问。");
  } else if (/\b451\b/.test(note)) {
    parts.push("核查记录中出现 HTTP 451；不尝试规避站点或地区访问限制。");
  } else if (/\b429\b|rate.?limit/.test(note)) {
    parts.push("需遵守上游限流要求，不通过代理轮换或其他方式规避限制。");
  }

  if (/canonical homepage|canonical home page|canonical domain|official homepage/.test(note)) {
    parts.push("官方主页或规范域名身份尚未完成核验，第三方域名记录不能替代运营方的正式说明。");
  }
  if (/current .*terms|terms.*could not be verified|terms.*not verified|no .*terms|automation policy/.test(note)) {
    parts.push("现行服务条款及自动化访问政策尚未得到充分确认。");
  }
  if (/third-party/.test(note)) {
    parts.push("第三方扫描、域名记录或社区维护的抓取脚本不构成该站对本项目的自动化访问授权。");
  }
  if (/public search|public api|api\/rss|rss contract|search contract|search endpoint/.test(note)) {
    parts.push("官方公开搜索、API 或 RSS 接口契约尚未核实，不能仅凭网页可访问就推定可自动检索。");
  }
  if (/metadata|post extraction|data reuse|republish|redistribut/.test(note)) {
    parts.push("尚未确认允许本项目采集、缓存或再展示相关元数据的授权范围。");
  }
  if (/invite-only|invitation|invite code|account registration|requires an account|personal api key|api token/.test(note)) {
    parts.push("上游访问涉及账户、邀请或个人 API 凭据；当前不接入需要此类受限凭据的路径。");
  }
  if (/paid|billing|usage-based|commercial.*fee|subscription|\$[0-9]/.test(note)) {
    parts.push("该方案涉及付费、计费或商业许可要求，不作为当前免费接入方案。");
  }
  if (/cc0|creative commons|cc by|apache-2\.0|agpl-3\.0/.test(note)) {
    parts.push("记录中涉及开源或内容许可声明；软件许可证不自动等同于上游数据库内容的再利用授权，仍需按字段核验来源和许可范围。");
  }
  if (/explicitly says not to use scripts|do not use scripts|automated crawlers/.test(note)) {
    parts.push("站点公告或条款明确限制脚本、爬虫或自动化访问；遵守该限制，不进行 Worker 抓取。");
  }
  if (/mirror.?link list|mirror list|mirror discovery/.test(note)) {
    parts.push("若上游明确允许自动读取镜像列表，该许可仅限镜像发现，不扩展为内容搜索或元数据采集。");
  }
  if (/terms prohibit|terms explicitly prohibit|prohibits scraping|prohibit bots|prohibits bots|no-crawling|no scraping/.test(note)) {
    parts.push("审查记录显示，上游条款对爬虫、自动提取或数据收集设有限制；当前不实施自动采集。");
  }
  if (/21\+|18\+|age.?gate|age verification/.test(note)) {
    parts.push("来源存在年龄确认或年龄验证环节；当前不自动操作年龄门槛或绕过访问流程。");
  }
  if (/regional blocking|region restriction|geoblock|geo.?blocking|blocked.*region/.test(note)) {
    parts.push("记录涉及地区访问限制；不通过代理、备用域名或其他手段规避地区限制。");
  }
  if (/magnet|torrent|ed2k/.test(note)) {
    parts.push("目录记录中涉及下载资源链接能力；是否接入仍以实际接口、内容来源和单独审查结果为准。");
  }
  return parts.join(" ");
}
