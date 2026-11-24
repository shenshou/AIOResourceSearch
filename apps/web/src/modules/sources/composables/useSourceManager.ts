import { computed, ref } from "vue";
import type { SourceDefinition } from "@aio-resource-search/shared";
import { SourceApiError, sourceApi } from "../../../services/sourceApi";

export function useSourceManager() {
  const token = ref("");
  const authenticated = ref(false);
  const sources = ref<SourceDefinition[]>([]);
  const revision = ref(0);
  const etag = ref("");
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  const notice = ref("");

  const enabledCount = computed(() => sources.value.filter((source) => source.enabled).length);

  function clearMessages() {
    error.value = "";
    notice.value = "";
  }

  async function reload() {
    if (!token.value) return;
    loading.value = true;
    clearMessages();
    try {
      const result = await sourceApi.getAdminSources(token.value);
      sources.value = result.config.sources;
      revision.value = result.config.version;
      etag.value = result.etag;
      authenticated.value = true;
    } catch (cause) {
      if (cause instanceof SourceApiError && cause.status === 401) {
        authenticated.value = false;
        error.value = "管理员令牌无效，请重新输入。";
      } else {
        error.value = cause instanceof Error ? cause.message : "读取数据源失败。";
      }
      throw cause;
    } finally {
      loading.value = false;
    }
  }

  async function login(value: string) {
    token.value = value.trim();
    if (!token.value) {
      error.value = "请输入管理员令牌。";
      return false;
    }
    try {
      await reload();
      notice.value = "管理员验证成功。";
      return true;
    } catch {
      token.value = "";
      return false;
    }
  }

  function logout() {
    token.value = "";
    authenticated.value = false;
    sources.value = [];
    etag.value = "";
    revision.value = 0;
    clearMessages();
  }

  async function persist(action: () => Promise<{ data: { version: number; sources: SourceDefinition[] }; etag: string | null }>, successMessage: string) {
    saving.value = true;
    clearMessages();
    try {
      const result = await action();
      sources.value = result.data.sources;
      revision.value = result.data.version;
      if (result.etag) etag.value = result.etag;
      notice.value = successMessage;
      return true;
    } catch (cause) {
      if (cause instanceof SourceApiError && cause.status === 409) {
        error.value = "配置已被其他操作更新。已尝试重新载入，请确认最新数据后再操作。";
        try {
          await reload();
        } catch {
          // Preserve the original conflict message if the refresh also fails.
        }
      } else {
        error.value = cause instanceof Error ? cause.message : "保存失败。";
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function save(source: SourceDefinition, isNew: boolean) {
    if (!etag.value) return false;
    return persist(
      () => isNew
        ? sourceApi.createSource(token.value, etag.value, source)
        : sourceApi.updateSource(token.value, etag.value, source),
      isNew ? "数据源已新增。" : "数据源已更新。",
    );
  }

  async function remove(sourceId: string) {
    if (!etag.value) return false;
    return persist(
      () => sourceApi.deleteSource(token.value, etag.value, sourceId),
      "数据源已删除。",
    );
  }

  async function toggle(source: SourceDefinition) {
    return save({ ...source, enabled: !source.enabled }, false);
  }

  return {
    token, authenticated, sources, revision, loading, saving, error, notice,
    enabledCount, login, logout, reload, save, remove, toggle, clearMessages,
  };
}
