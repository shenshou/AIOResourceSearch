<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
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
import { useSourceManager } from "../composables/useSourceManager";
import { adapterApi } from "../../../services/adapterApi";

const manager = useSourceManager();
const availableAdapters = ref<AdapterDefinition[]>([]);
const loginToken = ref("");
const showEditor = ref(false);
const editingId = ref<string | null>(null);
const showToken = ref(false);
const catalogQuery = ref("");
const htmlFieldsJson = ref("{}");
const contentCategoryLabels = CONTENT_CATEGORY_LABELS;
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
  providerSearchUrlTemplate: "",
  htmlSelectors: { result: "", title: "", link: "", fields: {} },
  enabled: true,
  baseUrl: "",
  searchModes: ["keyword"],
  capabilities: ["metadata"],
  timeoutMs: 10000,
  credentialBinding: "",
  notes: "",
});

const form = reactive<SourceDefinition>(emptyForm());
const isEditing = computed(() => editingId.value !== null);
const unregisteredCatalogEntries = computed(() => {
  const registeredIds = new Set(manager.sources.value.map((source) => source.id));
  return SOURCE_CATALOG.filter((entry) => !registeredIds.has(entry.id));
});
const visibleCatalogEntries = computed(() => {
  const query = catalogQuery.value.trim().toLowerCase();
  return unregisteredCatalogEntries.value.filter((entry) =>
    !query ||
    entry.name.toLowerCase().includes(query) ||
    entry.projects.some((project) => project.toLowerCase().includes(query)) ||
    entry.category.includes(query),
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

async function importAllCatalogSources() {
  const candidates: SourceDefinition[] = unregisteredCatalogEntries.value.map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    contentCategory: "jav",
    type: "external-search",
    enabled: false,
    ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
    ...(entry.searchUrlTemplate ? { searchUrlTemplate: entry.searchUrlTemplate } : {}),
    searchModes: [...entry.searchModes],
    capabilities: [],
    timeoutMs: 10000,
    notes: `候选来源：${entry.projects.join("、")}。 ${entry.note} 尚未核验搜索 URL、访问规则和 Workers 可用性。`,
  }));
  if (!candidates.length) return;
  if (!window.confirm(`将一次性登记全部 ${candidates.length} 个候选来源。它们都会保持禁用，不会参与搜索。确认继续吗？`)) return;
  await manager.importExternalSources(candidates);
}

function beginCatalogCreate(entry: SourceCatalogEntry) {
  htmlFieldsJson.value = "{}";
  Object.assign(form, {
    ...emptyForm(),
    id: entry.id,
    name: entry.name,
    category: entry.category,
    contentCategory: "jav",
    type: "external-search" as const,
    adapterId: "",
    searchUrlTemplate: entry.searchUrlTemplate ?? "",
    baseUrl: entry.baseUrl ?? "",
    enabled: false,
    searchModes: [...entry.searchModes],
    capabilities: [],
    notes: `候选来源：${entry.projects.join("、")}。 ${entry.note} 尚未核验搜索 URL、访问规则和 Workers 可用性。`,
  });
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginCreate() {
  htmlFieldsJson.value = "{}";
  Object.assign(form, emptyForm());
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginEdit(source: SourceDefinition) {
  htmlFieldsJson.value = JSON.stringify(source.htmlSelectors?.fields ?? {}, null, 2);
  Object.assign(form, {
    ...source,
    contentCategory: source.contentCategory ?? "jav",
    type: source.type ?? "provider",
    adapterId: source.adapterId ?? "",
    searchUrlTemplate: source.searchUrlTemplate ?? "",
    providerSearchUrlTemplate: source.providerSearchUrlTemplate ?? "",
    htmlSelectors: source.htmlSelectors ? { ...source.htmlSelectors } : { result: "", title: "", link: "" },
    searchModes: [...source.searchModes],
    capabilities: [...source.capabilities],
  });
  editingId.value = source.id;
  showEditor.value = true;
  manager.clearMessages();
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
  const source: SourceDefinition = {
    ...form,
    id: form.id.trim(),
    name: form.name.trim(),
    ...(form.type === "provider" ? { adapterId: form.adapterId?.trim() ?? "" } : { adapterId: undefined }),
    ...(form.type === "external-search"
      ? { searchUrlTemplate: form.searchUrlTemplate?.trim() || undefined }
      : { searchUrlTemplate: undefined }),
    ...(form.type === "provider" && form.adapterId === "generic-html"
      ? { providerSearchUrlTemplate: form.providerSearchUrlTemplate?.trim() || undefined, htmlSelectors: { ...form.htmlSelectors!, fields: htmlFields } }
      : { providerSearchUrlTemplate: undefined, htmlSelectors: undefined }),
    baseUrl: form.baseUrl?.trim() || undefined,
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

async function deleteSource(source: SourceDefinition) {
  if (!window.confirm(`确定删除数据源“${source.name}”吗？此操作会立即更新配置。`)) return;
  await manager.remove(source.id);
}

async function submitLogin() {
  await manager.login(loginToken.value);
  if (manager.authenticated.value) loginToken.value = "";
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

    <div v-if="!manager.authenticated.value" class="login-panel">
      <div class="login-icon" aria-hidden="true">⌘</div>
      <h2>管理员验证</h2>
      <p>请输入 Worker 管理令牌。令牌仅保存在当前页面内存中，关闭页面或退出管理后即清除。</p>
      <form class="login-form" @submit.prevent="submitLogin">
        <div class="token-field">
          <input
            v-model="loginToken"
            :type="showToken ? 'text' : 'password'"
            autocomplete="off"
            placeholder="ADMIN_API_TOKEN"
            aria-label="管理员令牌"
          />
          <button type="button" class="visibility-button" @click="showToken = !showToken">
            {{ showToken ? "隐藏" : "显示" }}
          </button>
        </div>
        <button class="primary-button" type="submit" :disabled="manager.loading.value || !loginToken.trim()">
          {{ manager.loading.value ? "验证中…" : "验证并进入管理" }}
        </button>
      </form>
    </div>

    <template v-else>
      <details class="source-catalog-panel">
        <summary>预置来源目录 · {{ unregisteredCatalogEntries.length }} 个尚未登记</summary>
        <p class="form-hint">目录收录 Atlas、Lustpress、FetchJAV 中识别到的 {{ SOURCE_CATALOG.length }} 个候选来源。登记时默认创建禁用的外部入口；上游模板和首页地址只是参考，必须核验。目录不代表来源已获授权或可被 Worker 自动抓取。</p>
        <div class="source-catalog-toolbar">
          <input v-model="catalogQuery" class="catalog-search" type="search" placeholder="搜索来源名称、项目或分类…" aria-label="搜索预置来源目录">
          <button class="primary-button small" type="button" :disabled="manager.saving.value || !unregisteredCatalogEntries.length" @click="importAllCatalogSources">
            批量登记全部未登记候选（{{ unregisteredCatalogEntries.length }}）
          </button>
        </div>
        <div class="source-catalog-list">
          <article v-for="entry in visibleCatalogEntries" :key="entry.id" class="source-catalog-item">
            <div>
              <strong>{{ entry.name }}</strong>
              <small>{{ categoryLabels[entry.category] }} · {{ entry.projects.join(" / ") }}</small>
              <small>{{ entry.note }}</small>
            </div>
            <button class="secondary-button small" type="button" @click="beginCatalogCreate(entry)">配置并登记</button>
          </article>
        </div>
        <p v-if="!unregisteredCatalogEntries.length" class="panel-note">所有预置候选来源均已登记。</p>
        <p v-else-if="!visibleCatalogEntries.length" class="panel-note">没有匹配的候选来源。</p>
      </details>

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
            <p class="source-meta">{{ categoryLabels[source.category] }} / {{ contentCategoryLabels[source.contentCategory ?? (source.category === "other-index" ? "general" : "jav")] }} · {{ source.id }} · {{ sourceTypeLabels[source.type ?? "provider"] }}<template v-if="(source.type ?? 'provider') === 'provider'"> · Adapter: {{ source.adapterId }}</template></p>
            <div class="source-tags">
              <span v-for="mode in source.searchModes" :key="mode">{{ modeLabels[mode] }}</span>
              <span v-for="capability in source.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span>
            </div>
            <p v-if="source.baseUrl" class="source-url">{{ source.baseUrl }}</p>
            <p v-if="source.searchUrlTemplate" class="source-url">{{ source.searchUrlTemplate }}</p>
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
              <select v-model="form.type">
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
          <p class="form-hint">Worker 抓取源必须选择已实现并启用的适配器；通用 HTML 适配器只访问基础 URL 同域的 HTTPS 搜索页，使用 CSS 选择器提取结果，拒绝重定向并限制响应体为 2 MiB；支持最多 20 个自定义元数据字段选择器；外部搜索入口只生成 HTTPS 搜索链接，不会由 Worker 请求或解析目标网站，URL 模板必须且只能包含一个 {query}。Secret 名称只引用 Worker 中已配置的 Secret；不要在此填写密码、Cookie 或 Token 的实际值。</p>
          <div class="dialog-actions">
            <button class="secondary-button" type="button" @click="closeEditor">取消</button>
            <button class="primary-button" type="submit" :disabled="manager.saving.value">{{ manager.saving.value ? "保存中…" : "保存配置" }}</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>
