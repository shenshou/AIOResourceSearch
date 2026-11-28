<script setup lang="ts">
import { ref } from "vue";
import SearchPage from "./modules/search/components/SearchPage.vue";
import SourceManagement from "./modules/sources/components/SourceManagement.vue";
import AdapterManagement from "./modules/adapters/components/AdapterManagement.vue";

const activeView = ref<"search" | "sources" | "adapters">("search");
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="AIOResourceSearch 首页" @click.prevent="activeView = 'search'">
        <span class="brand-mark">A</span>
        <span>AIOResourceSearch</span>
      </a>
      <nav class="main-nav" aria-label="主导航">
        <button :class="{ active: activeView === 'search' }" type="button" @click="activeView = 'search'">聚合搜索</button>
        <button :class="{ active: activeView === 'sources' }" type="button" @click="activeView = 'sources'">数据源管理</button>
        <button :class="{ active: activeView === 'adapters' }" type="button" @click="activeView = 'adapters'">适配器管理</button>
      </nav>
      <span class="header-caption">多来源聚合检索</span>
    </header>

    <SearchPage v-if="activeView === 'search'" />
    <SourceManagement v-else-if="activeView === 'sources'" />
    <AdapterManagement v-else />

    <footer class="site-footer">
      AIOResourceSearch · 聚合搜索，不托管媒体文件。
    </footer>
  </div>
</template>
