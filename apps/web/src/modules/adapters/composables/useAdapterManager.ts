import { computed, ref } from "vue";
import { useAdminSession } from "../../admin/composables/useAdminSession";
import type { AdapterDefinition } from "@aio-resource-search/shared";
import { AdapterApiError, adapterApi } from "../../../services/adapterApi";

export function useAdapterManager() {
  const session = useAdminSession();
  const token = session.token;
  const authenticated = session.authenticated;
  const adapters = ref<AdapterDefinition[]>([]);
  const revision = ref(0);
  const etag = ref("");
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  const notice = ref("");

  const enabledCount = computed(() => adapters.value.filter((adapter) => adapter.enabled && adapter.implemented).length);
  const implementedCount = computed(() => adapters.value.filter((adapter) => adapter.implemented).length);

  function clearMessages() {
    error.value = "";
    notice.value = "";
  }

  async function reload() {
    if (!token.value) return false;
    loading.value = true;
    clearMessages();
    try {
      const result = await adapterApi.getAdminAdapters(token.value);
      adapters.value = result.config.adapters;
      revision.value = result.config.version;
      etag.value = result.etag;
      authenticated.value = true;
      return true;
    } catch (cause) {
      if (cause instanceof AdapterApiError && cause.status === 401) {
        session.clear();
        error.value = "管理员令牌无效，请重新输入。";
      } else {
        error.value = cause instanceof Error ? cause.message : "读取适配器失败。";
      }
      return false;
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
    const success = await reload();
    if (success) notice.value = "管理员验证成功。";
    else session.clear();
    return success;
  }

  function logout() {
    session.clear();
    adapters.value = [];
    etag.value = "";
    revision.value = 0;
    clearMessages();
  }

  async function persist(
    action: () => Promise<{ data: { version: number; adapters: AdapterDefinition[] }; etag: string | null }>,
    successMessage: string,
  ) {
    saving.value = true;
    clearMessages();
    try {
      const result = await action();
      adapters.value = result.data.adapters;
      revision.value = result.data.version;
      if (result.etag) etag.value = result.etag;
      notice.value = successMessage;
      return true;
    } catch (cause) {
      if (cause instanceof AdapterApiError && cause.status === 409) {
        error.value = cause.message;
        await reload();
      } else {
        error.value = cause instanceof Error ? cause.message : "保存失败。";
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function save(adapter: AdapterDefinition, isNew: boolean) {
    if (!etag.value) return false;
    return persist(
      () => isNew
        ? adapterApi.createAdapter(token.value, etag.value, adapter)
        : adapterApi.updateAdapter(token.value, etag.value, adapter),
      isNew ? "适配器配置已新增。" : "适配器配置已更新。",
    );
  }

  async function remove(adapterId: string) {
    if (!etag.value) return false;
    return persist(
      () => adapterApi.deleteAdapter(token.value, etag.value, adapterId),
      "适配器配置已删除。",
    );
  }

  return {
    token, authenticated, adapters, revision, loading, saving, error, notice,
    enabledCount, implementedCount, login, logout, reload, save, remove, clearMessages,
  };
}
