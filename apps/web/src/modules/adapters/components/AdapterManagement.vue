<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  CONTENT_CATEGORIES,
  CONTENT_CATEGORY_LABELS,
  FETCH_MECHANISMS,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  type AdapterDefinition,
  type ContentCategory,
  type FetchMechanism,
  type SourceCapability,
  type SourceCategory,
} from "@aio-resource-search/shared";
import { useAdapterManager } from "../composables/useAdapterManager";

const manager = useAdapterManager();
const loginToken = ref("");
const showToken = ref(false);
const showEditor = ref(false);
const editingId = ref<string | null>(null);

const categoryLabels: Record<SourceCategory, string> = {
  jav: "JAV 资源站",
  torrent: "BT / Torrent 搜索引擎",
  forum: "论坛",
  "other-index": "其他资源索引",
};
const mechanismLabels: Record<FetchMechanism, string> = { api: "API（JSON / XML 等）", rss: "RSS / Atom", html: "HTML 网页解析" };
const capabilityLabels: Record<SourceCapability, string> = {
  metadata: "元数据",
  image: "图片",
  magnet: "磁力链接",
  ed2k: "ED2K",
  torrent: "种子文件",
  "forum-post": "论坛帖子",
};

const emptyForm = (): AdapterDefinition => ({
  id: "",
  name: "",
  description: "",
  mechanism: "api",
  contentCategories: ["jav"],
  version: "1.0.0",
  enabled: false,
  categories: ["other-index"],
  capabilities: ["metadata"],
  implemented: false,
  notes: "",
});
const form = reactive<AdapterDefinition>(emptyForm());
const isEditing = computed(() => editingId.value !== null);

onMounted(() => {
  if (manager.authenticated.value) void manager.reload();
});

function beginCreate() {
  Object.assign(form, emptyForm());
  editingId.value = null;
  showEditor.value = true;
  manager.clearMessages();
}

function beginEdit(adapter: AdapterDefinition) {
  Object.assign(form, {
    ...adapter,
    categories: [...adapter.categories],
    contentCategories: [...(adapter.contentCategories ?? ["jav"])],
    capabilities: [...adapter.capabilities],
  });
  editingId.value = adapter.id;
  showEditor.value = true;
  manager.clearMessages();
}

function toggleCategory(category: SourceCategory) {
  form.categories = form.categories.includes(category)
    ? form.categories.filter((item) => item !== category)
    : [...form.categories, category];
}

function toggleContentCategory(category: ContentCategory) {
  const selected = form.contentCategories ?? [];
  form.contentCategories = selected.includes(category) ? selected.filter((item) => item !== category) : [...selected, category];
}

function toggleCapability(capability: SourceCapability) {
  form.capabilities = form.capabilities.includes(capability)
    ? form.capabilities.filter((item) => item !== capability)
    : [...form.capabilities, capability];
}

async function submitForm() {
  if (!form.categories.length || !(form.contentCategories?.length)) {
    manager.error.value = "至少选择一个来源类型和内容分类。";
    return;
  }
  const adapter: AdapterDefinition = {
    ...form,
    id: form.id.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    version: form.version.trim(),
    notes: form.notes?.trim() || undefined,
    categories: [...form.categories],
    contentCategories: [...(form.contentCategories ?? [])],
    capabilities: [...form.capabilities],
    // The Worker determines this from its compiled implementation registry.
    implemented: false,
  };
  const saved = await manager.save(adapter, !isEditing.value);
  if (saved) showEditor.value = false;
}

async function deleteAdapter(adapter: AdapterDefinition) {
  if (!window.confirm(`确定删除适配器“${adapter.name}”吗？如果仍有数据源引用，服务器会拒绝删除。`)) return;
  await manager.remove(adapter.id);
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
        <p class="eyebrow">ADAPTER CONTROL</p>
        <h1>数据源适配器管理</h1>
        <p class="manager-description">管理适配器的注册信息、能力声明和启用状态。适配器执行代码仍随 Worker 部署，不从 KV 动态加载或执行代码。</p>
      </div>
      <span v-if="manager.authenticated.value" class="auth-state">管理员已验证</span>
    </div>

    <div v-if="!manager.authenticated.value" class="login-panel">
      <div class="login-icon" aria-hidden="true">⌘</div>
      <h2>管理员验证</h2>
      <p>请输入 Worker 管理令牌。令牌仅保存在当前页面内存中。</p>
      <form class="login-form" @submit.prevent="submitLogin">
        <div class="token-field">
          <input v-model="loginToken" :type="showToken ? 'text' : 'password'" autocomplete="off" placeholder="ADMIN_API_TOKEN" aria-label="管理员令牌" />
          <button type="button" class="visibility-button" @click="showToken = !showToken">{{ showToken ? "隐藏" : "显示" }}</button>
        </div>
        <button class="primary-button" type="submit" :disabled="manager.loading.value || !loginToken.trim()">
          {{ manager.loading.value ? "验证中…" : "验证并进入管理" }}
        </button>
      </form>
    </div>

    <template v-else>
      <div class="manager-toolbar">
        <div class="stats">
          <div class="stat-card"><strong>{{ manager.adapters.value.length }}</strong><span>全部适配器</span></div>
          <div class="stat-card"><strong>{{ manager.implementedCount.value }}</strong><span>已有代码实现</span></div>
          <div class="stat-card"><strong>{{ manager.enabledCount.value }}</strong><span>可供数据源使用</span></div>
          <div class="stat-card"><strong>v{{ manager.revision.value }}</strong><span>配置版本</span></div>
        </div>
        <div class="toolbar-actions">
          <button class="secondary-button" type="button" :disabled="manager.loading.value" @click="manager.reload()">刷新</button>
          <button class="primary-button" type="button" @click="beginCreate">＋ 新增适配器</button>
          <button class="text-button" type="button" @click="manager.logout()">退出管理</button>
        </div>
      </div>

      <div v-if="manager.loading.value" class="empty-state">正在读取适配器配置…</div>
      <div v-else-if="!manager.adapters.value.length" class="empty-state">
        <strong>还没有注册适配器</strong>
        <span>可以先登记适配器规划信息；实际执行能力需要后续编写并部署 Worker 代码。</span>
      </div>
      <div v-else class="source-list">
        <article v-for="adapter in manager.adapters.value" :key="adapter.id" class="source-row">
          <div class="source-main">
            <div class="source-title-line">
              <h3>{{ adapter.name }}</h3>
              <span class="source-status" :class="{ disabled: !adapter.enabled || !adapter.implemented }">
                {{ adapter.enabled && adapter.implemented ? "可用" : adapter.implemented ? "已实现 / 未启用" : "仅登记 / 未实现" }}
              </span>
            </div>
            <p class="source-meta">{{ adapter.id }} · v{{ adapter.version }} · {{ mechanismLabels[adapter.mechanism ?? "api"] }} · {{ (adapter.contentCategories ?? ["jav"]).map((item) => CONTENT_CATEGORY_LABELS[item]).join("、") }}</p>
            <p v-if="adapter.description" class="source-url">{{ adapter.description }}</p>
            <div class="source-tags">
              <span v-for="capability in adapter.capabilities" :key="capability">{{ capabilityLabels[capability] }}</span>
            </div>
            <p v-if="adapter.notes" class="source-meta">备注：{{ adapter.notes }}</p>
          </div>
          <div class="source-actions">
            <button class="secondary-button small" type="button" :disabled="manager.saving.value || !adapter.implemented" @click="manager.save({ ...adapter, enabled: !adapter.enabled }, false)">
              {{ adapter.enabled ? "禁用" : "启用" }}
            </button>
            <button class="secondary-button small" type="button" :disabled="manager.saving.value" @click="beginEdit(adapter)">编辑</button>
            <button class="danger-button small" type="button" :disabled="manager.saving.value" @click="deleteAdapter(adapter)">删除</button>
          </div>
        </article>
      </div>
    </template>

    <div v-if="manager.error.value" class="feedback error" role="alert">{{ manager.error.value }}</div>
    <div v-if="manager.notice.value" class="feedback success" role="status">{{ manager.notice.value }}</div>

    <div v-if="showEditor" class="modal-backdrop" @click.self="showEditor = false">
      <section class="editor-dialog" role="dialog" aria-modal="true" :aria-label="isEditing ? '编辑适配器' : '新增适配器'">
        <div class="dialog-heading">
          <div><p class="eyebrow">ADAPTER REGISTRATION</p><h2>{{ isEditing ? "编辑适配器" : "新增适配器" }}</h2></div>
          <button class="icon-button" type="button" aria-label="关闭" @click="showEditor = false">×</button>
        </div>
        <form class="source-form" @submit.prevent="submitForm">
          <div class="form-grid">
            <label>适配器名称<input v-model="form.name" required maxlength="80" placeholder="例如：Example JSON API" /></label>
            <label>唯一 ID<input v-model="form.id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" :disabled="isEditing" placeholder="example-json-api" /></label>
            <label>获取机制
              <select v-model="form.mechanism">
                <option v-for="mechanism in FETCH_MECHANISMS" :key="mechanism" :value="mechanism">{{ mechanismLabels[mechanism] }}</option>
              </select>
            </label>
            <label>版本<input v-model="form.version" required maxlength="40" placeholder="1.0.0" /></label>
            <label class="checkbox-line"><input v-model="form.enabled" type="checkbox" :disabled="!form.implemented" /> 启用适配器</label>
            <label class="wide">功能说明<textarea v-model="form.description" maxlength="500" rows="2" placeholder="描述适配器支持的协议或数据结构"></textarea></label>
            <fieldset class="wide choice-field">
              <legend>适用的数据源分类</legend>
              <label v-for="category in SOURCE_CATEGORIES" :key="category" class="choice">
                <input type="checkbox" :checked="form.categories.includes(category)" @change="toggleCategory(category)" />{{ categoryLabels[category] }}
              </label>
            </fieldset>
            <fieldset class="wide choice-field">
              <legend>支持的内容分类</legend>
              <label v-for="category in CONTENT_CATEGORIES" :key="category" class="choice">
                <input type="checkbox" :checked="(form.contentCategories ?? []).includes(category)" @change="toggleContentCategory(category)" />{{ CONTENT_CATEGORY_LABELS[category] }}
              </label>
            </fieldset>
            <fieldset class="wide choice-field">
              <legend>能力声明</legend>
              <label v-for="capability in SOURCE_CAPABILITIES" :key="capability" class="choice">
                <input type="checkbox" :checked="form.capabilities.includes(capability)" @change="toggleCapability(capability)" />{{ capabilityLabels[capability] }}
              </label>
            </fieldset>
            <label class="wide">备注<textarea v-model="form.notes" maxlength="500" rows="2" placeholder="实现计划、协议限制或维护说明"></textarea></label>
          </div>
          <p class="form-hint">“新增适配器”目前只登记元数据，不会生成解析代码。Worker 会根据代码内的实现注册表判断是否已实现；未实现的适配器不能启用，也不能被数据源使用。新增协议或解析逻辑仍需修改并重新部署 Worker。</p>
          <div class="dialog-actions">
            <button class="secondary-button" type="button" @click="showEditor = false">取消</button>
            <button class="primary-button" type="submit" :disabled="manager.saving.value">{{ manager.saving.value ? "保存中…" : "保存配置" }}</button>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>
