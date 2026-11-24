<script setup lang="ts">
import { computed, ref } from "vue";
import type { SearchMode } from "@aio-resource-search/shared";
import { searchResources, type SearchResponse } from "../../../services/searchApi";

const query = ref("");
const mode = ref<SearchMode>("number");
const loading = ref(false);
const errorMessage = ref("");
const copyMessage = ref("");
const response = ref<SearchResponse | null>(null);
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

const hasResults = computed(() => (response.value?.results.length ?? 0) > 0);

const statusLabels: Record<string, string> = {
  ok: "已完成",
  error: "请求失败",
  timeout: "请求超时",
  unavailable: "暂不可用",
};

const errorLabels: Record<string, string> = {
  adapter_unavailable: "适配器尚未实现或未启用",
  adapter_incompatible: "适配器能力与数据源配置不匹配",
  provider_failed: "数据源请求或解析失败",
  provider_timeout: "超过该数据源的请求时限",
};

async function submitSearch() {
  const normalizedQuery = query.value.trim();
  if (!normalizedQuery || loading.value) return;
  if (normalizedQuery.length > 120) {
    errorMessage.value = "搜索内容不能超过 120 个字符。";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  copyMessage.value = "";
  response.value = null;
  try {
    response.value = await searchResources(normalizedQuery, mode.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "搜索失败，请稍后重试。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="search-page">
    <section class="intro">
      <p class="eyebrow">MULTI-SOURCE SEARCH</p>
      <h1>一个入口，聚合多个资源数据源</h1>
      <p class="intro-copy">
        输入番号或关键词，自动查询已实现的 Provider，并为启用的外部搜索入口生成原站链接。结果只展示元数据和资源站提供的外部链接。
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
              placeholder="输入番号或关键词"
              aria-label="输入番号或关键词"
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
          <p>“{{ response.query }}” · {{ response.mode === "number" ? "番号搜索" : "关键词搜索" }}</p>
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
          >{{ source.sourceName }} <span aria-hidden="true">↗</span></a>
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
              <span v-if="item.catalogNumber">{{ item.catalogNumber }}</span>
              <span v-if="item.releaseDate">{{ item.releaseDate }}</span>
            </div>
            <h3><a :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}</a></h3>
            <p v-if="item.description" class="result-description">{{ item.description }}</p>
            <div v-if="item.magnetUri || item.ed2kUri || item.torrentUrl || item.externalLinks?.length" class="result-links">
              <button v-if="item.magnetUri" type="button" @click="copyResourceLink(item.magnetUri, 'Magnet')">复制 Magnet</button>
              <a v-if="item.magnetUri" :href="item.magnetUri">打开 Magnet</a>
              <button v-if="item.ed2kUri" type="button" @click="copyResourceLink(item.ed2kUri, 'ED2K')">复制 ED2K</button>
              <a v-if="item.ed2kUri" :href="item.ed2kUri">打开 ED2K</a>
              <a v-if="item.torrentUrl" :href="item.torrentUrl" target="_blank" rel="noopener noreferrer">下载 Torrent</a>
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
