import type { SourceDefinition, SourcesConfig } from "@aio-resource-search/shared";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");

export interface VersionedSources {
  config: SourcesConfig;
  etag: string;
}

export class SourceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "SourceApiError";
  }
}

async function request<T>(
  path: string,
  options: {
    token?: string;
    method?: string;
    etag?: string;
    body?: unknown;
  } = {},
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
    throw new SourceApiError("无法连接 Worker API。请检查 API 地址和 Worker 是否运行。", 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string } } | null)?.error;
    throw new SourceApiError(
      error?.message || `请求失败（HTTP ${response.status}）`,
      response.status,
      error?.code,
    );
  }

  return {
    data: payload as T,
    etag: response.headers.get("ETag"),
  };
}

export const sourceApi = {
  async getPublicSources() {
    const result = await request<{ version: number; sources: Omit<SourceDefinition, "credentialBinding" | "notes">[] }>("/api/sources");
    return result.data;
  },

  async getAdminSources(token: string): Promise<VersionedSources> {
    const result = await request<SourcesConfig>("/api/admin/sources", { token });
    if (!result.etag) throw new SourceApiError("服务器没有返回配置版本号，无法安全保存。", 502);
    return { config: result.data, etag: result.etag };
  },

  async createSource(token: string, etag: string, source: SourceDefinition) {
    return request<SourcesConfig>("/api/admin/sources", {
      token,
      method: "POST",
      etag,
      body: { source },
    });
  },

  async updateSource(token: string, etag: string, source: SourceDefinition) {
    return request<SourcesConfig>(`/api/admin/sources/${encodeURIComponent(source.id)}`, {
      token,
      method: "PATCH",
      etag,
      body: { source },
    });
  },

  async deleteSource(token: string, etag: string, sourceId: string) {
    return request<SourcesConfig>(`/api/admin/sources/${encodeURIComponent(sourceId)}`, {
      token,
      method: "DELETE",
      etag,
    });
  },
};
