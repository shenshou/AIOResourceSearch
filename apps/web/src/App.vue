<script setup lang="ts">
import { SOURCE_CATEGORIES } from "@aio-resource-search/shared";

const categoryLabels: Record<(typeof SOURCE_CATEGORIES)[number], string> = {
  jav: "JAV 资源站",
  torrent: "BT / Torrent 搜索引擎",
  forum: "论坛",
  "other-index": "其他资源索引",
};
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="AIOResourceSearch 首页">
        <span class="brand-mark">A</span>
        <span>AIOResourceSearch</span>
      </a>
      <span class="header-caption">多数据源聚合搜索</span>
    </header>

    <main class="main-content">
      <section class="intro">
        <p class="eyebrow">MULTI-SOURCE SEARCH</p>
        <h1>一个入口，聚合多个资源数据源</h1>
        <p class="intro-copy">
          统一搜索、标准化结果，并在数据源允许提供时展示资源信息与链接。
        </p>
      </section>

      <section class="search-panel" aria-labelledby="search-title">
        <h2 id="search-title">搜索</h2>
        <div class="search-placeholder">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <span>搜索接口将在数据源适配器审计后接入</span>
        </div>
        <p class="panel-note">
          当前处于项目基础搭建阶段，尚未接入实际数据源。
        </p>
      </section>

      <section class="source-types" aria-labelledby="source-types-title">
        <h2 id="source-types-title">计划支持的数据源类型</h2>
        <div class="category-grid">
          <article v-for="category in SOURCE_CATEGORIES" :key="category" class="category-card">
            <span class="category-dot" aria-hidden="true"></span>
            <span>{{ categoryLabels[category] }}</span>
          </article>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      AIOResourceSearch · Search and aggregate, not host media.
    </footer>
  </div>
</template>
