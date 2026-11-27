import type { AdapterDefinition } from "@aio-resource-search/shared";
import type { ProviderAdapter } from "./types";
import { genericHtmlProvider } from "./generic-html";
import { dmhyRssProvider } from "./dmhy-rss";
import { epornerApiProvider } from "./eporner-api";
import { anibtTorznabProvider } from "./anibt-torznab";
import { mangaDexProvider } from "./mangadex-api";
import { musicBrainzProvider } from "./musicbrainz-api";
import { libriVoxProvider } from "./librivox-api";
import { audioSiloMetaProvider } from "./audiosilo-meta-api";
import { perverzijaDbProvider } from "./perverzija-db";
import { sukebeiRssProvider } from "./sukebei-rss";
import { torlockProvider } from "./torlock-torznab";
import { theRarBgProvider } from "./the-rarbg-json";
import { yourBittorrentProvider } from "./yourbittorrent-json";

/**
 * Compile-time allowlist of executable provider adapters.
 *
 * Register an adapter here only when its implementation and tests are included
 * in the same Worker change. Never populate this registry from KV or user input.
 */
const providerAdapters: readonly ProviderAdapter[] = [
  genericHtmlProvider,
  anibtTorznabProvider,
  dmhyRssProvider,
  epornerApiProvider,
  sukebeiRssProvider,
  perverzijaDbProvider,
  torlockProvider,
  theRarBgProvider,
  yourBittorrentProvider,
  mangaDexProvider,
  musicBrainzProvider,
  libriVoxProvider,
  audioSiloMetaProvider,
];

const registry = new Map<string, ProviderAdapter>(
  providerAdapters.map((adapter) => [adapter.id, adapter]),
);

export function getProviderAdapter(adapterId: string): ProviderAdapter | null {
  return registry.get(adapterId) ?? null;
}

export function isProviderImplemented(adapterId: string): boolean {
  return registry.has(adapterId);
}

export function listProviderAdapters(): readonly ProviderAdapter[] {
  return providerAdapters;
}

const adapterPresentation: Record<string, { name: string; description: string }> = {
  "generic-html": {
    name: "通用 HTML 解析器",
    description: "基于已审查 CSS selectors 的通用 HTML 搜索解析器；每个来源仍需独立配置和验收。",
  },
  "anibt-torznab": {
    name: "AniBT Torznab",
    description: "AniBT 的 Torznab XML 搜索接口，返回经过校验的种子文件链接。",
  },
  "dmhy-rss": {
    name: "动漫花园 RSS",
    description: "动漫花园公开 RSS 搜索，支持规范化条目和 Magnet 链接。",
  },
  "eporner-api": {
    name: "Eporner API v2",
    description: "Eporner 官方 API v2 元数据搜索，包含作品状态校验和移除同步约束。",
  },
  "sukebei-rss": {
    name: "Sukebei Nyaa RSS",
    description: "Sukebei 公开 RSS 搜索，支持 Magnet 资源链接。",
  },
  "perverzija-db": {
    name: "Perverzija DB",
    description: "Perverzija DB JSON API，提供 JAV 元数据及结构化关联信息。",
  },
  "torlock-torznab": {
    name: "Torlock Torznab",
    description: "Torlock Torznab 搜索接口，支持 Magnet 资源链接。",
  },
  "the-rarbg-json": {
    name: "The RarBg JSON API",
    description: "The RarBg JSON 搜索 API，支持多个内容分类和 Magnet 链接。",
  },
  "yourbittorrent-json": {
    name: "YourBittorrent JSON API",
    description: "YourBittorrent JSON 搜索接口，支持 Magnet 和 Torrent 文件链接。",
  },
  "mangadex-api": {
    name: "MangaDex API",
    description: "MangaDex 公共 API，限于符合项目规则的漫画元数据。",
  },
  "musicbrainz-api": {
    name: "MusicBrainz API",
    description: "MusicBrainz Web Service，提供音乐发行组基础元数据。",
  },
  "librivox-api": {
    name: "LibriVox API",
    description: "LibriVox 公共 API，提供有声书目录元数据。",
  },
  "audiosilo-meta-api": {
    name: "AudioSilo Meta API",
    description: "AudioSilo Meta 公共 API，仅映射允许使用的作品事实元数据。",
  },
};

export function listImplementedAdapterDefinitions(): AdapterDefinition[] {
  return providerAdapters.map((adapter) => {
    const presentation = adapterPresentation[adapter.id];
    return {
      id: adapter.id,
      name: presentation?.name ?? adapter.id,
      description: presentation?.description ?? "Built-in Worker Provider implementation.",
      mechanism: adapter.mechanism ?? "api",
      contentCategories: [...(adapter.contentCategories ?? ["jav"])],
      version: adapter.version,
      enabled: false,
      categories: [...adapter.categories],
      capabilities: [...adapter.capabilities],
      implemented: true,
      notes: "Built-in Worker implementation. Registration does not create or enable any source; source-specific review and configuration are still required.",
    };
  });
}
