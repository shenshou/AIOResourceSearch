import type { AdapterDefinition, AdaptersConfig } from "@aio-resource-search/shared";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");

export class AdapterApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "AdapterApiError";
  }
}

async function request<T>(
  path: string,
  options: { token?: string; method?: string; etag?: string; body?: unknown } = {},
): Promise<{ data: T; etag: string | null }> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.etag) headers.set("If-Match", options.etag);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new AdapterApiError("无法连接 Worker API。请检查 API 地址和 Worker 是否运行。", 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string } } | null)?.error;
    throw new AdapterApiError(error?.message || `请求失败（HTTP ${response.status}）`, response.status, error?.code);
  }

  return { data: payload as T, etag: response.headers.get("ETag") };
}

export const adapterApi = {
  async getPublicAdapters() {
    const result = await request<{ version: number; adapters: AdapterDefinition[] }>("/api/adapters");
    return result.data;
  },
  async getAdminAdapters(token: string) {
    const result = await request<AdaptersConfig>("/api/admin/adapters", { token });
    if (!result.etag) throw new AdapterApiError("服务器没有返回配置版本号，无法安全保存。", 502);
    return { config: result.data, etag: result.etag };
  },
  async createAdapter(token: string, etag: string, adapter: AdapterDefinition) {
    return request<AdaptersConfig>("/api/admin/adapters", {
      token, method: "POST", etag, body: { adapter },
    });
  },
  async updateAdapter(token: string, etag: string, adapter: AdapterDefinition) {
    return request<AdaptersConfig>(`/api/admin/adapters/${encodeURIComponent(adapter.id)}`, {
      token, method: "PATCH", etag, body: { adapter },
    });
  },
  async deleteAdapter(token: string, etag: string, adapterId: string) {
    return request<AdaptersConfig>(`/api/admin/adapters/${encodeURIComponent(adapterId)}`, {
      token, method: "DELETE", etag,
    });
  },
};
