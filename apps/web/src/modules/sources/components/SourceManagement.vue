<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  SEARCH_MODES,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  type AdapterDefinition,
  type SearchMode,
  type SourceCapability,
  type SourceCategory,
  type SourceDefinition,
} from "@aio-resource-search/shared";
import { useSourceManager } from "../composables/useSourceManager";
import { adapterApi } from "../../../services/adapterApi";

const manager = useSourceManager();
const availableAdapters = ref<AdapterDefinition[]>([]);
const loginToken = ref("");
const showEditor = ref(false);
const editingId = ref<string | null>(null);
const showToken = ref(false);
const categoryLabels: Record<SourceCategory, string> = {
  jav: "JAV 资源站",
  torrent: "BT / Torrent 搜索引擎",
  forum: "论坛",
  "other-index": "其他资源索引",
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
  adapterId: "",
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

onMounted(async () => {
  if (manager.authenticated.value) await manager.reload();
  try {
    const result = await adapterApi.getPublicAdapters();
    availableAdapters.value = result.adapters;
  } catch {
    availableAdapters.value = [];
  }
});

function beginCreate() {
  Object.assign(form, emptyForm());
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginEdit(source: SourceDefinition) {
  Object.assign(form, {
    ...source,
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
  const source: SourceDefinition = {
    ...form,
    id: form.id.trim(),
    name: form.name.trim(),
    adapterId: form.adapterId.trim(),
    baseUrl: form.baseUrl?.trim() || undefined,
    credentialBinding: form.credentialBinding?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
    searchModes: [...form.searchModes],
    capabilities: [...form.capabilities],
  };
  if (!source.searchModes.length || !source.capabilities.length) {
    manager.error.value = "至少选择一种搜索方式和一种结果能力。";
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
        <p class="manager-description">管理已接入适配器的数据源配置。配置保存到 Cloudflare KV，不需要重新部署。</p>
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
        <span>先添加已经实现对应 Provider 适配器的数据源。</span>
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
            <p class="source-meta">{{ categoryLabels[source.category] }} · {{ source.id }} · Adapter: {{ source.adapterId }}</p>
            <div class="source-tags">
              <span v-for="mode in source.searchModes" :key="mode">{{ modeLabels[mode] }}</span>
              <span v-for="capability in source.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span>
            </div>
            <p v-if="source.baseUrl" class="source-url">{{ source.baseUrl }}</p>
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
            <label>适配器
              <select v-model="form.adapterId" required :disabled="!availableAdapters.length">
                <option value="" disabled>选择已实现且启用的适配器</option>
                <option v-if="form.adapterId && !availableAdapters.some((adapter) => adapter.id === form.adapterId)" :value="form.adapterId">{{ form.adapterId }}（当前不可用）</option>
                <option v-for="adapter in availableAdapters" :key="adapter.id" :value="adapter.id">{{ adapter.name }} · {{ adapter.id }}</option>
              </select>
            </label>
            <label class="wide">基础 URL（HTTPS）<input v-model="form.baseUrl" type="url" placeholder="https://example.com" /></label>
            <label>请求超时（毫秒）<input v-model.number="form.timeoutMs" type="number" min="1000" max="30000" step="500" required /></label>
            <label class="checkbox-line"><input v-model="form.enabled" type="checkbox" /> 保存后启用</label>
            <fieldset class="wide choice-field">
              <legend>支持的搜索方式</legend>
              <label v-for="mode in SEARCH_MODES" :key="mode" class="choice"><input type="checkbox" :checked="form.searchModes.includes(mode)" @change="toggleMode(mode)" />{{ modeLabels[mode] }}</label>
            </fieldset>
            <fieldset class="wide choice-field">
              <legend>可提供的结果能力</legend>
              <label v-for="capability in SOURCE_CAPABILITIES" :key="capability" class="choice"><input type="checkbox" :checked="form.capabilities.includes(capability)" @change="toggleCapability(capability)" />{{ capabilityLabels[capability] }}</label>
            </fieldset>
            <label class="wide">Worker Secret 名称（可选）<input v-model="form.credentialBinding" pattern="[A-Z][A-Z0-9_]{0,63}" placeholder="例如：SOURCE_API_TOKEN" /></label>
            <label class="wide">备注（仅管理员可见）<textarea v-model="form.notes" maxlength="500" rows="2" placeholder="访问方式、授权状态或维护说明"></textarea></label>
          </div>
          <p class="form-hint">这里只能选择已在 Worker 中实现并启用的适配器。当前没有可用适配器时，需要先完成适配器代码并部署 Worker。Secret 名称只引用 Worker 中已配置的 Secret；不要在此填写密码、Cookie 或 Token 的实际值。</p>
          <div class="dialog-actions">
            <button class="secondary-button" type="button" @click="closeEditor">取消</button>
            <button class="primary-button" type="submit" :disabled="manager.saving.value">{{ manager.saving.value ? "保存中…" : "保存配置" }}</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>
