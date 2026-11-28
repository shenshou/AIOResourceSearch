<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABELS,
  SEARCH_MODES,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  SOURCE_TYPES,
  type AdapterDefinition,
  type SearchMode,
  type SourceCapability,
  type SourceCategory,
  type SourceDefinition,
  type SourceType,
} from "@aio-resource-search/shared";
import { SOURCE_CATALOG, type SourceCatalogEntry } from "../sourceCatalog";
import { getSourceCatalogDisplayNote } from "../sourceCatalogPresentation";
import { UiButton } from "../../../components/ui";
import AdminLoginPanel from "../../../components/AdminLoginPanel.vue";
import { useSourceManager } from "../composables/useSourceManager";
import { adapterApi } from "../../../services/adapterApi";
import { SourceApiError, sourceApi, type SourceTestResponse } from "../../../services/sourceApi";

const manager = useSourceManager();
const availableAdapters = ref<AdapterDefinition[]>([]);
const testQueries = reactive<Record<string, string>>({});
const testModes = reactive<Record<string, SearchMode>>({});
const testFeedback = reactive<Record<string, {
  status: "success" | "error" | "timeout";
  elapsedMs?: number;
  resultCount?: number;
  sampleResults?: SourceTestResponse["sampleResults"];
  message?: string;
} | undefined>>({});
const testingSourceId = ref<string | null>(null);
const showEditor = ref(false);
const editingId = ref<string | null>(null);
const catalogQuery = ref("");
const htmlFieldsJson = ref("{}");
const fieldPrioritiesJson = ref("{}");
const contentCategoryLabels = CONTENT_CATEGORY_LABELS;

watch(manager.fieldPriorities, (value) => {
  fieldPrioritiesJson.value = JSON.stringify(value, null, 2);
}, { deep: true, immediate: true });

const categoryLabels: Record<SourceCategory, string> = {
  jav: "JAV 资源站",
  torrent: "BT / Torrent 搜索引擎",
  forum: "论坛",
  "other-index": "其他资源索引",
};
const sourceTypeLabels: Record<SourceType, string> = {
  provider: "Worker 抓取源",
  "external-search": "外部搜索 / 站点入口",
};
const capabilityLabels: Record<SourceCapability, string> = {
  metadata: "元数据",
  relationships: "关联实体",
  image: "图片",
  magnet: "磁力链接",
  ed2k: "ED2K",
  torrent: "种子文件",
  "forum-post": "论坛帖子",
};
const modeLabels: Record<SearchMode, string> = {
  number: "番号",
  keyword: "关键词",
};

const emptyForm = (): SourceDefinition => ({
  id: "",
  name: "",
  category: "other-index",
  contentCategory: "jav",
  type: "provider",
  adapterId: "",
  searchUrlTemplate: "",
  externalSearchUrlTemplate: "",
  externalSearchBaseUrl: "",
  providerSearchUrlTemplate: "",
  htmlSelectors: { result: "", title: "", link: "", fields: {} },
  enabled: false,
  baseUrl: "",
  searchModes: ["keyword"],
  capabilities: ["metadata"],
  timeoutMs: 10000,
  credentialBinding: "",
  notes: "",
});

const form = reactive<SourceDefinition>(emptyForm());
let previousFormType: SourceDefinition["type"] = "provider";
const isEditing = computed(() => editingId.value !== null);
const unregisteredCatalogEntries = computed(() => {
  const registeredIds = new Set(manager.sources.value.map((source) => source.id));
  return SOURCE_CATALOG.filter((entry) => !registeredIds.has(entry.id));
});
const unregisteredExternalCatalogEntries = computed(() =>
  unregisteredCatalogEntries.value.filter((entry) => (entry.type ?? "external-search") === "external-search"),
);
const unregisteredProviderCatalogEntries = computed(() =>
  unregisteredCatalogEntries.value.filter((entry) => entry.type === "provider"),
);
const visibleCatalogEntries = computed(() => {
  const query = catalogQuery.value.trim().toLowerCase();
  return unregisteredCatalogEntries.value.filter((entry) =>
    !query ||
    entry.name.toLowerCase().includes(query) ||
    entry.projects.some((project) => project.toLowerCase().includes(query)) ||
    entry.category.includes(query) ||
    (entry.contentCategory?.includes(query) ?? false) ||
    contentCategoryLabels[entry.contentCategory ?? "jav"].toLowerCase().includes(query),
  );
});

onMounted(async () => {
  if (manager.authenticated.value) await manager.reload();
  try {
    const result = await adapterApi.getPublicAdapters();
    availableAdapters.value = result.adapters;
  } catch {
    availableAdapters.value = [];
  }
});

async function saveFieldPriorities() {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fieldPrioritiesJson.value || "{}");
  } catch {
    manager.error.value = "字段优先级 JSON 格式无效。";
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    manager.error.value = "字段优先级必须是 JSON 对象。";
    return;
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length > 100 || entries.some(([, ids]) =>
    !Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string")
  )) {
    manager.error.value = "最多配置 100 个字段；每个字段最多列出 100 个来源 ID。";
    return;
  }
  await manager.saveFieldPriorities(parsed as Record<string, string[]>);
}

async function importAllCatalogSources() {
  const candidates: SourceDefinition[] = unregisteredExternalCatalogEntries.value.map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    contentCategory: entry.contentCategory ?? "jav",
    type: "external-search",
    enabled: false,
    ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
    ...(entry.searchUrlTemplate ? { searchUrlTemplate: entry.searchUrlTemplate } : {}),
    searchModes: [...entry.searchModes],
    capabilities: [],
    timeoutMs: 10000,
    notes: `候选来源：${entry.projects.join("、")}。 ${getSourceCatalogDisplayNote(entry)} 尚未核验搜索 URL、访问规则和 Worker 可用性。`,
  }));
  if (!candidates.length) return;
  if (!window.confirm(`将一次性登记全部 ${candidates.length} 个外部搜索候选。它们都会保持禁用，不会参与搜索。Provider 类型来源需先启用对应适配器，再逐条登记。确认继续吗？`)) return;
  await manager.importExternalSources(candidates);
}

function beginCatalogCreate(entry: SourceCatalogEntry) {
  if (entry.type === "provider" && !availableAdapters.value.some((adapter) => adapter.id === entry.adapterId)) {
    manager.error.value = `请先在“适配器管理”中登记并启用已部署的 ${entry.adapterId} 适配器，再登记该 Provider 数据源。`;
    return;
  }
  htmlFieldsJson.value = "{}";
  Object.assign(form, {
    ...emptyForm(),
    id: entry.id,
    name: entry.name,
    category: entry.category,
    contentCategory: entry.contentCategory ?? "jav",
    type: entry.type ?? "external-search",
    adapterId: entry.adapterId ?? "",
    searchUrlTemplate: entry.searchUrlTemplate ?? "",
    externalSearchUrlTemplate: entry.externalSearchUrlTemplate ?? "",
    externalSearchBaseUrl: entry.externalSearchBaseUrl ?? "",
    baseUrl: entry.baseUrl ?? "",
    enabled: false,
    searchModes: [...entry.searchModes],
    capabilities: [...(entry.capabilities ?? [])],
    notes: `候选来源：${entry.projects.join("、")}。 ${getSourceCatalogDisplayNote(entry)}`,
  });
  previousFormType = form.type ?? "provider";
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginCreate() {
  htmlFieldsJson.value = "{}";
  Object.assign(form, emptyForm());
  previousFormType = form.type ?? "provider";
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginEdit(source: SourceDefinition) {
  htmlFieldsJson.value = JSON.stringify(source.htmlSelectors?.fields ?? {}, null, 2);
  const catalogEntry = SOURCE_CATALOG.find((entry) => entry.id === source.id);
  const localizedCatalogNotes = catalogEntry && source.notes?.includes(catalogEntry.note)
    ? `候选来源：${catalogEntry.projects.join("、")}。 ${getSourceCatalogDisplayNote(catalogEntry)}`
    : source.notes;
  Object.assign(form, {
    ...source,
    notes: localizedCatalogNotes,
    contentCategory: source.contentCategory ?? "jav",
    type: source.type ?? "provider",
    adapterId: source.adapterId ?? "",
    searchUrlTemplate: source.searchUrlTemplate ?? "",
    externalSearchUrlTemplate: source.externalSearchUrlTemplate ?? "",
    externalSearchBaseUrl: source.externalSearchBaseUrl ?? "",
    providerSearchUrlTemplate: source.providerSearchUrlTemplate ?? "",
    htmlSelectors: source.htmlSelectors ? { ...source.htmlSelectors } : { result: "", title: "", link: "" },
    searchModes: [...source.searchModes],
    capabilities: [...source.capabilities],
  });
  previousFormType = form.type ?? "provider";
  editingId.value = source.id;
  showEditor.value = true;
  manager.clearMessages();
}

function handleSourceTypeChange() {
  const nextType = form.type ?? "provider";
  if (nextType === "external-search" && previousFormType === "provider") {
    const originalSource = editingId.value
      ? manager.sources.value.find((item) => item.id === editingId.value)
      : undefined;
    const currentBaseUrl = form.baseUrl?.trim() ?? "";
    const originalProviderBaseUrl = originalSource?.baseUrl?.trim() ?? "";
    const hasUserEditedBaseUrl = !originalSource || currentBaseUrl !== originalProviderBaseUrl;
    form.baseUrl = form.externalSearchBaseUrl?.trim() ||
      (hasUserEditedBaseUrl ? currentBaseUrl : "");
  } else if (nextType === "provider" && previousFormType === "external-search") {
    form.externalSearchBaseUrl = form.baseUrl?.trim() ?? "";
  }
  previousFormType = nextType;
}

function closeEditor() {
  showEditor.value = false;
}

function toggleMode(mode: SearchMode) {
  form.searchModes = form.searchModes.includes(mode)
    ? form.searchModes.filter((item) => item !== mode)
    : [...form.searchModes, mode];
}

function toggleCapability(capability: SourceCapability) {
  form.capabilities = form.capabilities.includes(capability)
    ? form.capabilities.filter((item) => item !== capability)
    : [...form.capabilities, capability];
}

async function submitForm() {
  let htmlFields: Record<string, string> | undefined;
  if (form.type === "provider" && form.adapterId === "generic-html") {
    try {
      const parsed: unknown = JSON.parse(htmlFieldsJson.value || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("字段映射必须是 JSON 对象。");
      const entries = Object.entries(parsed as Record<string, unknown>);
      if (entries.length > 20 || entries.some(([key, selector]) =>
        !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) ||
        typeof selector !== "string" || !selector.trim() || selector.length > 200
      )) throw new Error("字段映射最多 20 项；键名必须是字母开头的字段名，选择器长度不能超过 200。");
      htmlFields = Object.fromEntries(entries) as Record<string, string>;
    } catch (error) {
      manager.error.value = error instanceof Error ? error.message : "HTML 字段映射 JSON 无效。";
      return;
    }
  }
  const originalSource = editingId.value
    ? manager.sources.value.find((item) => item.id === editingId.value)
    : undefined;
  const navigationTemplate = form.externalSearchUrlTemplate?.trim() || form.searchUrlTemplate?.trim() || undefined;
  const source: SourceDefinition = {
    ...form,
    id: form.id.trim(),
    name: form.name.trim(),
    baseUrl: form.baseUrl?.trim() || undefined,
    ...(form.type === "provider" ? { adapterId: form.adapterId?.trim() ?? "" } : { adapterId: undefined }),
    ...(form.type === "external-search"
      ? {
          searchUrlTemplate: navigationTemplate,
          externalSearchUrlTemplate: undefined,
          externalSearchBaseUrl: undefined,
          baseUrl: form.baseUrl?.trim() || undefined,
        }
      : {
          searchUrlTemplate: undefined,
          externalSearchUrlTemplate: navigationTemplate,
          externalSearchBaseUrl: form.externalSearchBaseUrl?.trim() ||
            (originalSource?.type === "external-search" ? form.baseUrl?.trim() : undefined),
        }),
    ...(form.type === "provider" && form.adapterId === "generic-html"
      ? { providerSearchUrlTemplate: form.providerSearchUrlTemplate?.trim() || undefined, htmlSelectors: { ...form.htmlSelectors!, fields: htmlFields } }
      : { providerSearchUrlTemplate: undefined, htmlSelectors: undefined }),
    credentialBinding: form.credentialBinding?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
    searchModes: [...form.searchModes],
    capabilities: [...form.capabilities],
  };
  if (source.type === "external-search" && !source.searchUrlTemplate && !source.baseUrl) {
    manager.error.value = "外部搜索入口必须配置搜索 URL 模板或 HTTPS 基础 URL。";
    return;
  }
  if (!source.searchModes.length || (source.type === "provider" && !source.capabilities.length)) {
    manager.error.value = "至少选择一种搜索方式；Worker 抓取源还必须选择一种结果能力。";
    return;
  }
  const saved = await manager.save(source, !isEditing.value);
  if (saved) closeEditor();
}

async function runSourceTest(source: SourceDefinition, kind: "connection" | "search") {
  if (testingSourceId.value || !manager.token.value) return;
  if ((source.type ?? "provider") !== "provider") return;
  if (!source.enabled) {
    testFeedback[source.id] = { status: "error", message: "请先启用数据源，再执行测试。" };
    return;
  }
  if (!availableAdapters.value.some((adapter) => adapter.id === source.adapterId)) {
    testFeedback[source.id] = { status: "error", message: "适配器当前未启用或没有 Worker 实现。" };
    return;
  }
  const query = testQueries[source.id]?.trim() ?? "";
  if (kind === "search" && (!query || query.length > 120)) {
    testFeedback[source.id] = { status: "error", message: "请输入 1 到 120 个字符的测试关键词。" };
    return;
  }
  const mode = testModes[source.id] ?? (source.searchModes.includes("keyword") ? "keyword" : source.searchModes[0]);
  testingSourceId.value = source.id;
  testFeedback[source.id] = undefined;
  try {
    const result = kind === "connection"
      ? await sourceApi.testConnection(manager.token.value, source.id)
      : await sourceApi.testSearch(manager.token.value, source.id, query, mode);
    if (!manager.authenticated.value) return;
    testFeedback[source.id] = {
      status: result.status,
      elapsedMs: result.elapsedMs,
      resultCount: result.resultCount,
      sampleResults: result.sampleResults,
      message: result.message,
    };
  } catch (error) {
    if (!manager.authenticated.value) return;
    testFeedback[source.id] = {
      status: error instanceof SourceApiError && error.code === "provider_timeout" ? "timeout" : "error",
      message: error instanceof Error ? error.message : "数据源测试失败。",
    };
  } finally {
    if (testingSourceId.value === source.id) testingSourceId.value = null;
  }
}

async function deleteSource(source: SourceDefinition) {
  if (!window.confirm(`确定删除数据源“${source.name}”吗？此操作会立即更新配置。`)) return;
  await manager.remove(source.id);
}

</script>

<template>
  <section class="manager-page">
    <div class="manager-heading">
      <div>
        <p class="eyebrow">SOURCE CONTROL</p>
        <h1>数据源管理</h1>
        <p class="manager-description">管理 Worker 抓取源和外部搜索入口。配置保存到 Cloudflare KV，不需要重新部署。</p>
      </div>
      <span v-if="manager.authenticated.value" class="auth-state">管理员已验证</span>
    </div>

    <AdminLoginPanel
      v-if="!manager.authenticated.value"
      :loading="manager.loading.value"
      :authenticated="manager.authenticated.value"
      description="请输入 Worker 管理令牌。令牌仅保存在当前页面内存中，关闭页面或退出管理后即清除。"
      @submit="manager.login"
    />

    <template v-else>
      <details class="source-catalog-panel">
        <summary>预置来源目录 · {{ unregisteredCatalogEntries.length }} 个尚未登记</summary>
        <p class="form-hint">目录收录 Atlas、Lustpress、FetchJAV 及本项目补充的 {{ SOURCE_CATALOG.length }} 个候选来源。外部入口可批量登记且默认禁用；内置 Provider 候选必须先有已部署、已启用的适配器，再逐条登记并保持禁用。目录不代表来源已获授权或已完成线上验证。</p>
        <p v-if="unregisteredProviderCatalogEntries.length" class="form-hint">其中 {{ unregisteredProviderCatalogEntries.length }} 条为 Provider 来源，不会混入外部入口的批量登记。The RarBg 的 5 条分类记录共用同一个 the-rarbg-json 适配器。</p>
        <div class="source-catalog-toolbar">
          <input v-model="catalogQuery" class="catalog-search" type="search" placeholder="搜索来源名称、项目或分类…" aria-label="搜索预置来源目录">
          <button class="primary-button small" type="button" :disabled="manager.saving.value || !unregisteredExternalCatalogEntries.length" @click="importAllCatalogSources">
            批量登记外部候选（{{ unregisteredExternalCatalogEntries.length }}）
          </button>
        </div>
        <div class="source-catalog-list">
          <article v-for="entry in visibleCatalogEntries" :key="entry.id" class="source-catalog-item">
            <div>
              <strong>{{ entry.name }}</strong>
              <small>{{ categoryLabels[entry.category] }} / {{ contentCategoryLabels[entry.contentCategory ?? "jav"] }} · {{ entry.projects.join(" / ") }}</small>
              <small>{{ getSourceCatalogDisplayNote(entry) }}</small>
            </div>
            <UiButton class="secondary-button small" variant="secondary" type="button" @click="beginCatalogCreate(entry)">配置并登记</UiButton>
          </article>
        </div>
        <p v-if="!unregisteredCatalogEntries.length" class="panel-note">所有预置候选来源均已登记。</p>
        <p v-else-if="!visibleCatalogEntries.length" class="panel-note">没有匹配的候选来源。</p>
      </details>

      <section class="field-priority-panel">
        <div>
          <h2>字段来源优先级</h2>
          <p>可分别指定标题、番号、发行日期、封面、简介及 metadata 子字段的来源顺序。未配置或空数组时沿用数据源列表顺序；列出的来源优先于未列出的来源。支持字段：title、catalogNumber、releaseDate、imageUrl、description、metadata.字段名。</p>
          <p class="form-hint">来源 ID：{{ manager.sources.value.filter((source) => (source.type ?? "provider") === "provider").map((source) => source.id).join("、") || "暂无已登记来源" }}</p>
        </div>
        <label class="wide">字段优先级 JSON
          <textarea v-model="fieldPrioritiesJson" rows="7" maxlength="12000" spellcheck="false" placeholder='{"catalogNumber":["jav-metadata-a","jav-metadata-b"],"metadata.studio":["studio-db","jav-metadata-a"]}'></textarea>
        </label>
        <div class="field-priority-actions">
          <button class="primary-button small" type="button" :disabled="manager.saving.value" @click="saveFieldPriorities">保存字段优先级</button>
          <span class="form-hint">这是运行时配置，保存后立即生效，不需要重新部署 Worker。</span>
        </div>
      </section>

      <div class="manager-toolbar">
        <div class="stats">
          <div class="stat-card"><strong>{{ manager.sources.value.length }}</strong><span>全部数据源</span></div>
          <div class="stat-card"><strong>{{ manager.enabledCount.value }}</strong><span>已启用</span></div>
          <div class="stat-card"><strong>v{{ manager.revision.value }}</strong><span>配置版本</span></div>
        </div>
        <div class="toolbar-actions">
          <button class="secondary-button" type="button" :disabled="manager.loading.value" @click="manager.reload()">刷新</button>
          <button class="primary-button" type="button" @click="beginCreate">＋ 新增数据源</button>
          <button class="text-button" type="button" @click="manager.logout()">退出管理</button>
        </div>
      </div>

      <div v-if="manager.loading.value" class="empty-state">正在读取数据源配置…</div>
      <div v-else-if="!manager.sources.value.length" class="empty-state">
        <strong>还没有配置数据源</strong>
        <span>可以从上方预置来源目录登记外部搜索入口，或添加已实现适配器的 Worker 抓取源。</span>
      </div>
      <div v-else class="source-list">
        <article v-for="source in manager.sources.value" :key="source.id" class="source-row">
          <div class="source-main">
            <div class="source-title-line">
              <h3>{{ source.name }}</h3>
              <span class="source-status" :class="{ disabled: !source.enabled }">
                {{ source.enabled ? "已启用" : "已禁用" }}
              </span>
            </div>
            <p class="source-meta">{{ categoryLabels[source.category] }} / {{ contentCategoryLabels[source.contentCategory ?? "jav"] }} · {{ source.id }} · {{ sourceTypeLabels[source.type ?? "provider"] }}<template v-if="(source.type ?? 'provider') === 'provider'"> · Adapter: {{ source.adapterId }}</template></p>
            <div class="source-tags">
              <span v-for="mode in source.searchModes" :key="mode">{{ modeLabels[mode] }}</span>
              <span v-for="capability in source.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span>
            </div>
            <p v-if="source.baseUrl" class="source-url">{{ source.baseUrl }}</p>
            <p v-if="source.searchUrlTemplate" class="source-url">{{ source.searchUrlTemplate }}</p>
            <p v-if="source.externalSearchUrlTemplate" class="source-url">外部搜索：{{ source.externalSearchUrlTemplate }}</p>
            <p v-else-if="source.externalSearchBaseUrl" class="source-url">外部站点：{{ source.externalSearchBaseUrl }}</p>
            <div v-if="(source.type ?? 'provider') === 'provider'" class="source-test-tools">
              <div class="source-test-actions">
                <button class="secondary-button small" type="button" :disabled="!source.enabled || testingSourceId !== null || !availableAdapters.some((adapter) => adapter.id === source.adapterId)" @click="runSourceTest(source, 'connection')">
                  {{ testingSourceId === source.id ? "测试中…" : "测试连接" }}
                </button>
                <input v-model="testQueries[source.id]" type="search" maxlength="120" placeholder="输入测试关键词" :disabled="!source.enabled || testingSourceId !== null" :aria-label="source.name + ' 测试关键词'">
                <select v-model="testModes[source.id]" :disabled="!source.enabled || testingSourceId !== null" :aria-label="source.name + ' 测试搜索方式'">
                  <option v-for="mode in source.searchModes" :key="mode" :value="mode">{{ modeLabels[mode] }}</option>
                </select>
                <button class="secondary-button small" type="button" :disabled="!source.enabled || testingSourceId !== null || !testQueries[source.id]?.trim() || !availableAdapters.some((adapter) => adapter.id === source.adapterId)" @click="runSourceTest(source, 'search')">测试搜索</button>
              </div>
              <p class="form-hint">连接测试会使用默认探测词执行一次 Provider 搜索，不是独立的 TCP Ping；上游正常响应但结果为 0 条也算连接成功。</p>
              <div v-if="testFeedback[source.id]" class="source-test-feedback" :class="testFeedback[source.id]?.status" role="status">
                <strong>{{ testFeedback[source.id]?.status === "success" ? "测试成功" : testFeedback[source.id]?.status === "timeout" ? "请求超时" : "测试失败" }}</strong>
                <span v-if="testFeedback[source.id]?.elapsedMs !== undefined">耗时 {{ testFeedback[source.id]?.elapsedMs }} ms</span>
                <span v-if="testFeedback[source.id]?.resultCount !== undefined">结果 {{ testFeedback[source.id]?.resultCount }} 条</span>
                <span v-if="testFeedback[source.id]?.message">{{ testFeedback[source.id]?.message }}</span>
                <ul v-if="testFeedback[source.id]?.sampleResults?.length">
                  <li v-for="sample in testFeedback[source.id]?.sampleResults" :key="sample.url">{{ sample.title }} · {{ sample.url }}</li>
                </ul>
              </div>
            </div>
            <p v-else class="form-hint">外部搜索入口只负责生成原站链接，不会由 Worker 请求目标网站，因此不提供连接或搜索测试。</p>
          </div>
          <div class="source-actions">
            <button class="secondary-button small" type="button" :disabled="manager.saving.value" @click="manager.toggle(source)">
              {{ source.enabled ? "禁用" : "启用" }}
            </button>
            <button class="secondary-button small" type="button" :disabled="manager.saving.value" @click="beginEdit(source)">编辑</button>
            <button class="danger-button small" type="button" :disabled="manager.saving.value" @click="deleteSource(source)">删除</button>
          </div>
        </article>
      </div>
    </template>

    <div v-if="manager.error.value" class="feedback error" role="alert">{{ manager.error.value }}</div>
    <div v-if="manager.notice.value" class="feedback success" role="status">{{ manager.notice.value }}</div>

    <div v-if="showEditor" class="modal-backdrop" @click.self="closeEditor">
      <section class="editor-dialog" role="dialog" aria-modal="true" :aria-label="isEditing ? '编辑数据源' : '新增数据源'">
        <div class="dialog-heading">
          <div><p class="eyebrow">SOURCE CONFIGURATION</p><h2>{{ isEditing ? "编辑数据源" : "新增数据源" }}</h2></div>
          <button class="icon-button" type="button" aria-label="关闭" @click="closeEditor">×</button>
        </div>
        <form class="source-form" @submit.prevent="submitForm">
          <div class="form-grid">
            <label>数据源名称<input v-model="form.name" required maxlength="80" placeholder="例如：Example Index" /></label>
            <label>唯一 ID<input v-model="form.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" :disabled="isEditing" placeholder="example-index" /></label>
            <label>数据源分类
              <select v-model="form.category">
                <option v-for="category in SOURCE_CATEGORIES" :key="category" :value="category">{{ categoryLabels[category] }}</option>
              </select>
            </label>
            <label>内容分类
              <select v-model="form.contentCategory">
                <option v-for="category in CONTENT_CATEGORIES" :key="category" :value="category">{{ contentCategoryLabels[category] }}</option>
              </select>
            </label>
            <label>来源类型
              <select v-model="form.type" @change="handleSourceTypeChange">
                <option v-for="type in SOURCE_TYPES" :key="type" :value="type">{{ sourceTypeLabels[type] }}</option>
              </select>
            </label>
            <label v-if="form.type === 'provider'">适配器
              <select v-model="form.adapterId" required :disabled="!availableAdapters.length">
                <option value="" disabled>选择已实现且启用的适配器</option>
                <option v-if="form.adapterId && !availableAdapters.some((adapter) => adapter.id === form.adapterId)" :value="form.adapterId">{{ form.adapterId }}（当前不可用）</option>
                <option v-for="adapter in availableAdapters" :key="adapter.id" :value="adapter.id">{{ adapter.name }} · {{ adapter.id }}</option>
              </select>
            </label>
            <label v-if="form.type === 'external-search'" class="wide">搜索 URL 模板（可选；必须包含 {query}，留空则使用基础 URL）
              <input v-model="form.searchUrlTemplate" type="text" maxlength="2048" placeholder="https://example.com/search?q={query}" />
            </label>
            <template v-if="form.type === 'provider'">
              <label class="wide">外部搜索 URL 模板（可选；用户主动打开，不由 Worker 请求；必须包含一个 {query}）
                <input v-model="form.externalSearchUrlTemplate" type="text" maxlength="2048" placeholder="https://example.com/search?q={query}" />
              </label>
              <label class="wide">外部站点首页（可选；与外部搜索模板独立配置）
                <input v-model="form.externalSearchBaseUrl" type="url" maxlength="2048" placeholder="https://example.com" />
              </label>
            </template>
            <template v-if="form.type === 'provider' && form.adapterId === 'generic-html'">
              <label class="wide">Worker 搜索 URL 模板（必须包含且仅包含一个 {query}，并与基础 URL 同域）
                <input v-model="form.providerSearchUrlTemplate" type="text" maxlength="2048" required placeholder="https://example.com/search?q={query}" />
              </label>
              <label>结果卡片 CSS 选择器<input v-model="form.htmlSelectors!.result" required maxlength="200" placeholder="article.result" /></label>
              <label>标题 CSS 选择器<input v-model="form.htmlSelectors!.title" required maxlength="200" placeholder=".title" /></label>
              <label>详情链接 CSS 选择器<input v-model="form.htmlSelectors!.link" required maxlength="200" placeholder="a.title" /></label>
              <label>图片 CSS 选择器（可选）<input v-model="form.htmlSelectors!.image" maxlength="200" placeholder="img.cover" /></label>
              <label>简介 CSS 选择器（可选）<input v-model="form.htmlSelectors!.description" maxlength="200" placeholder=".description" /></label>
              <label>Magnet 链接 CSS 选择器（可选）<input v-model="form.htmlSelectors!.magnet" maxlength="200" placeholder="a[href^='magnet:']" /></label>
              <label>Torrent 下载链接 CSS 选择器（可选）<input v-model="form.htmlSelectors!.torrent" maxlength="200" placeholder="a[href$='.torrent']" /></label>
              <label>ED2K 链接 CSS 选择器（可选）<input v-model="form.htmlSelectors!.ed2k" maxlength="200" placeholder="a[href^='ed2k:']" /></label>
              <label class="wide">分类专属字段选择器映射（JSON，可选）
                <textarea v-model="htmlFieldsJson" rows="4" maxlength="5000" placeholder='{"releaseDate":".release-date","author":".author","isbn":".isbn"}'></textarea>
              </label>
            </template>
            <label class="wide">基础 URL（HTTPS）<input v-model="form.baseUrl" type="url" :required="(form.type === 'external-search' && !form.searchUrlTemplate?.trim()) || (form.type === 'provider' && form.adapterId === 'generic-html')" placeholder="https://example.com" /></label>
            <label v-if="form.type === 'provider'">请求超时（毫秒）<input v-model.number="form.timeoutMs" type="number" min="1000" max="30000" step="500" required /></label>
            <label class="checkbox-line"><input v-model="form.enabled" type="checkbox" /> 保存后启用</label>
            <fieldset class="wide choice-field">
              <legend>支持的搜索方式</legend>
              <label v-for="mode in SEARCH_MODES" :key="mode" class="choice"><input type="checkbox" :checked="form.searchModes.includes(mode)" @change="toggleMode(mode)" />{{ modeLabels[mode] }}</label>
            </fieldset>
            <fieldset v-if="form.type === 'provider'" class="wide choice-field">
              <legend>可提供的结果能力</legend>
              <label v-for="capability in SOURCE_CAPABILITIES" :key="capability" class="choice"><input type="checkbox" :checked="form.capabilities.includes(capability)" @change="toggleCapability(capability)" />{{ capabilityLabels[capability] }}</label>
            </fieldset>
            <label v-if="form.type === 'provider'" class="wide">Worker Secret 名称（可选）<input v-model="form.credentialBinding" pattern="[A-Z][A-Z0-9_]{0,63}" placeholder="例如：SOURCE_API_TOKEN" /></label>
            <label class="wide">备注（仅管理员可见）<textarea v-model="form.notes" maxlength="500" rows="2" placeholder="访问方式、授权状态或维护说明"></textarea></label>
          </div>
          <p class="form-hint">Worker 抓取源必须选择已实现并启用的适配器；通用 HTML 适配器只访问基础 URL 同域的 HTTPS 搜索页，使用 CSS 选择器提取结果，拒绝重定向并限制响应体为 2 MiB；支持独立配置 Magnet、Torrent、ED2K 链接选择器和最多 20 个自定义元数据字段选择器；外部搜索入口只生成 HTTPS 搜索链接，不会由 Worker 请求或解析目标网站，URL 模板必须且只能包含一个 {query}。Secret 名称只引用 Worker 中已配置的 Secret；不要在此填写密码、Cookie 或 Token 的实际值。</p>
          <div class="dialog-actions">
            <button class="secondary-button" type="button" @click="closeEditor">取消</button>
            <button class="primary-button" type="submit" :disabled="manager.saving.value">{{ manager.saving.value ? "保存中…" : "保存配置" }}</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.source-test-tools { display: grid; gap: 0.5rem; margin-top: 0.75rem; }
.source-test-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.source-test-actions input, .source-test-actions select { min-width: 9rem; max-width: 14rem; }
.source-test-feedback { display: grid; gap: 0.25rem; padding: 0.65rem 0.8rem; border: 1px solid var(--border-color, #d1d5db); border-radius: 0.5rem; font-size: 0.875rem; overflow-wrap: anywhere; }
.source-test-feedback.success { border-color: var(--success-color, #16a34a); }
.source-test-feedback.error, .source-test-feedback.timeout { border-color: var(--danger-color, #dc2626); }
.source-test-feedback ul { margin: 0.25rem 0 0; padding-left: 1.25rem; }
.source-test-feedback li { overflow-wrap: anywhere; }
@media (max-width: 640px) { .source-test-actions input, .source-test-actions select { flex: 1 1 100%; max-width: none; } }
  .field-priority-panel { display: grid; gap: 0.8rem; margin: 1rem 0 1.25rem; padding: 1rem; border: 1px solid var(--border-color, #d1d5db); border-radius: 0.75rem; background: var(--panel-bg, rgba(148,163,184,.04)); }
  .field-priority-panel h2 { margin: 0 0 .35rem; font-size: 1rem; }
  .field-priority-panel p { margin: .25rem 0; }
  .field-priority-panel textarea { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; }
  .field-priority-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }
</style>
