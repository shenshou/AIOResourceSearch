<script setup lang="ts">
import { ref } from "vue";
import { CONTENT_CATEGORIES, CONTENT_CATEGORY_LABELS } from "@aio-resource-search/shared";
import { useSearch } from "../composables/useSearch";

const {
  query,
  mode,
  contentCategory,
  loading,
  errorMessage,
  response,
  hasResults,
  submitSearch,
} = useSearch();

const copyMessage = ref("");
const showImages = ref(readImagePreference());

function readImagePreference(): boolean {
  try {
    return localStorage.getItem("aio-resource-search:show-images") !== "false";
  } catch {
    return true;
  }
}

function updateImagePreference(value: boolean) {
  showImages.value = value;
  try {
    localStorage.setItem("aio-resource-search:show-images", String(value));
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

async function copyResourceLink(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    copyMessage.value = `${label}链接已复制。`;
  } catch {
    copyMessage.value = "复制失败：浏览器未授予剪贴板权限。";
  }
}

const statusLabels: Record<string, string> = {
  ok: "已完成",
  error: "请求失败",
  timeout: "请求超时",
  unavailable: "暂不可用",
};

const resourceLinkLabels: Record<string, string> = {
  magnet: "Magnet",
  torrent: "Torrent",
  ed2k: "ED2K",
};

const relationshipLabels: Record<string, string> = {
  performer: "演员",
  director: "导演",
  studio: "制作商",
  network: "制作网络",
  label: "发行商",
  series: "系列",
  genre: "类型",
  tag: "标签",
};

const errorLabels: Record<string, string> = {
  adapter_unavailable: "适配器尚未实现或未启用",
  adapter_incompatible: "适配器能力与数据源配置不匹配",
  provider_failed: "数据源请求或解析失败",
  provider_timeout: "超过该数据源的请求时限",
};
</script>

<template>
  <main class="search-page">
    <section class="intro">
      <p class="eyebrow">MULTI-SOURCE SEARCH</p>
      <h1>一个入口，聚合多个资源数据源</h1>
      <p class="intro-copy">
        输入番号或关键词，自动查询已实现的 Provider，并为启用的外部搜索入口生成原站链接。结果展示作品元数据、可下载资源链接及原站入口。
      </p>
    </section>

    <section class="search-panel" aria-labelledby="search-title">
      <div class="search-panel-heading">
        <h2 id="search-title">聚合搜索</h2>
        <label class="image-toggle">
          <input type="checkbox" :checked="showImages" @change="updateImagePreference(($event.target as HTMLInputElement).checked)">
          <span>显示图片</span>
        </label>
      </div>

      <form class="search-form" @submit.prevent="submitSearch">
        <div class="search-controls">
          <label class="search-mode content-category">
            <span>内容分类</span>
            <select v-model="contentCategory">
              <option value="all">全部分类</option>
              <option v-for="category in CONTENT_CATEGORIES" :key="category" :value="category">{{ CONTENT_CATEGORY_LABELS[category] }}</option>
            </select>
          </label>
          <label class="search-mode">
            <span>搜索类型</span>
            <select v-model="mode">
              <option value="number">番号</option>
              <option value="keyword">关键词</option>
            </select>
          </label>
          <label class="query-field">
            <span class="visually-hidden">搜索内容</span>
            <input
              v-model="query"
              type="search"
              maxlength="120"
              autocomplete="off"
              placeholder="输入番号、标题或关键词"
              aria-label="输入番号、标题或关键词"
            >
          </label>
          <button class="primary-button search-submit" type="submit" :disabled="loading || !query.trim()">
            {{ loading ? "搜索中…" : "搜索" }}
          </button>
        </div>
      </form>
      <p class="panel-note">Worker 自动抓取结果取决于已审查并注册的适配器；外部搜索入口会单独列出。</p>
      <p v-if="errorMessage" class="feedback error" role="alert">{{ errorMessage }}</p>
    </section>

    <section v-if="response" class="results-section" aria-live="polite">
      <div class="results-heading">
        <div>
          <h2>搜索结果</h2>
          <p>“{{ response.query }}” · {{ response.mode === "number" ? "番号搜索" : "关键词搜索" }} · {{ contentCategory === "all" ? "全部分类" : CONTENT_CATEGORY_LABELS[contentCategory] }}</p>
        </div>
        <strong>{{ response.meta.totalResults }} 条结果</strong>
      </div>

      <div class="search-summary">
        <span>数据源：{{ response.sources.length }}</span>
        <span>成功：{{ response.meta.successfulSources }}</span>
        <span>异常/不可用：{{ response.meta.failedSources }}</span>
      </div>

      <section v-if="response.externalSearches?.length" class="external-search-section">
        <h3>外部搜索入口</h3>
        <p class="panel-note">以下来源会在原站打开搜索结果或站点首页，不会由我们的 Worker 抓取。</p>
        <div class="external-search-list">
          <a
            v-for="source in response.externalSearches"
            :key="source.sourceId"
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
          >{{ source.sourceName }} <small>{{ source.kind === "search" ? "站内搜索" : "访问首页" }}</small> <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <div v-if="!hasResults" class="empty-state">
        <strong>暂无搜索结果</strong>
        <span>当前没有 Worker 抓取结果；可以使用上方外部搜索入口，或等待已启用的 Provider 返回结果。</span>
      </div>

      <div v-else class="result-list">
        <article v-for="item in response.results" :key="item.sourceId + ':' + item.id" class="result-card">
          <img v-if="showImages && item.imageUrl" class="result-image" :src="item.imageUrl" :alt="item.title" loading="lazy" referrerpolicy="no-referrer">
          <div class="result-body">
            <div class="result-meta">
              <span class="result-source">{{ item.sourceName }}</span>
              <span v-if="item.sourceAttributions && item.sourceAttributions.length > 1">
                其他来源：{{ item.sourceAttributions.slice(1).map((source) => source.sourceName).join("、") }}
              </span>
              <span v-if="item.contentCategory">{{ CONTENT_CATEGORY_LABELS[item.contentCategory] }}</span>
              <span v-if="item.catalogNumber">{{ item.catalogNumber }}</span>
              <span v-if="item.releaseDate">{{ item.releaseDate }}</span>
            </div>
            <h3><a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a></h3>
            <p v-if="item.description" class="result-description">{{ item.description }}</p>
            <div v-if="item.metadata && Object.keys(item.metadata).length" class="result-meta">
              <span v-for="(value, key) in item.metadata" :key="key">{{ key }}：{{ value }}</span>
            </div>
            <div v-if="item.relationships?.length" class="result-meta">
              <span v-for="(relationship, index) in item.relationships" :key="relationship.type + ':' + relationship.name + ':' + index">
                {{ relationshipLabels[relationship.type] }}：<a v-if="relationship.url" :href="relationship.url" target="_blank" rel="noopener noreferrer">{{ relationship.name }}</a><template v-else>{{ relationship.name }}</template>
              </span>
            </div>
            <div v-if="item.resourceLinks?.length || item.magnetUri || item.ed2kUri || item.torrentUrl || item.externalLinks?.length" class="result-links">
              <template v-if="item.resourceLinks?.length">
                <template v-for="link in item.resourceLinks" :key="link.type + ':' + link.url">
                  <template v-if="link.type === 'magnet' || link.type === 'ed2k'">
                    <button type="button" @click="copyResourceLink(link.url, resourceLinkLabels[link.type])">复制 {{ resourceLinkLabels[link.type] }}</button>
                    <a :href="link.url">打开 {{ resourceLinkLabels[link.type] }}</a>
                  </template>
                  <a v-else :href="link.url" target="_blank" rel="noopener noreferrer">下载 Torrent</a>
                  <small v-if="link.sourceAttributions?.length" class="resource-link-source">
                    来源：{{ link.sourceAttributions.map((source) => source.sourceName).join("、") }}
                  </small>
                </template>
              </template>
              <template v-else>
                <button v-if="item.magnetUri" type="button" @click="copyResourceLink(item.magnetUri, 'Magnet')">复制 Magnet</button>
                <a v-if="item.magnetUri" :href="item.magnetUri">打开 Magnet</a>
                <button v-if="item.ed2kUri" type="button" @click="copyResourceLink(item.ed2kUri, 'ED2K')">复制 ED2K</button>
                <a v-if="item.ed2kUri" :href="item.ed2kUri">打开 ED2K</a>
                <a v-if="item.torrentUrl" :href="item.torrentUrl" target="_blank" rel="noopener noreferrer">下载 Torrent</a>
              </template>
              <a v-for="(link, index) in item.externalLinks || []" :key="index" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
            </div>
          </div>
        </article>
      </div>
      <p v-if="copyMessage" class="copy-feedback" role="status">{{ copyMessage }}</p>

      <div class="source-status-section">
        <h3>数据源执行状态</h3>
        <div v-if="response.sources.length" class="source-status-list">
          <div v-for="source in response.sources" :key="source.sourceId" class="source-status-row">
            <span>{{ source.sourceName }}</span>
            <span class="source-status" :class="{ disabled: source.status !== 'ok' }">{{ statusLabels[source.status] || source.status }}</span>
            <small>{{ source.resultCount }} 条{{ source.errorCode ? " · " + (errorLabels[source.errorCode] || source.errorCode) : "" }}</small>
          </div>
        </div>
        <p v-else class="panel-note">本次没有执行 Worker 抓取源；外部入口见上方。</p>
      </div>
    </section>
  </main>
</template>
