import { computed, ref } from "vue";
import type { ContentCategory, SearchMode } from "@aio-resource-search/shared";
import { searchResources, type SearchResponse } from "../../../services/searchApi";

export function useSearch() {
  const query = ref("");
  const mode = ref<SearchMode>("number");
  const contentCategory = ref<ContentCategory | "all">("all");
  const loading = ref(false);
  const errorMessage = ref("");
  const response = ref<SearchResponse | null>(null);

  const hasResults = computed(() => (response.value?.results.length ?? 0) > 0);

  async function submitSearch() {
    const normalizedQuery = query.value.trim();
    if (!normalizedQuery || loading.value) return;
    if (normalizedQuery.length > 120) {
      errorMessage.value = "搜索内容不能超过 120 个字符。";
      return;
    }

    loading.value = true;
    errorMessage.value = "";
    response.value = null;
    try {
      response.value = await searchResources(normalizedQuery, mode.value, contentCategory.value);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "搜索失败，请稍后重试。";
    } finally {
      loading.value = false;
    }
  }

  return {
    query,
    mode,
    contentCategory,
    loading,
    errorMessage,
    response,
    hasResults,
    submitSearch,
  };
}
