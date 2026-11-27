import type { SearchMode, SourceDefinition, SourcesConfig } from "@aio-resource-search/shared";

import { getApiBaseUrl } from "./apiBase";

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

  const apiBaseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
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

export interface SourceTestResponse {
  sourceId: string;
  kind: "test-connection" | "test-search";
  status: "success" | "error" | "timeout";
  elapsedMs: number;
  resultCount: number;
  sampleResults: Array<{ title: string; url: string; catalogNumber?: string; releaseDate?: string }>;
  errorCode?: string;
  message?: string;
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

  async updateFieldPriorities(token: string, etag: string, fieldPriorities: Record<string, string[]>) {
    return request<SourcesConfig>("/api/admin/sources/settings/field-priorities", {
      token,
      method: "PATCH",
      etag,
      body: { fieldPriorities },
    });
  },

  async createSource(token: string, etag: string, source: SourceDefinition) {
    return request<SourcesConfig>("/api/admin/sources", {
      token,
      method: "POST",
      etag,
      body: { source },
    });
  },

  async importExternalSources(token: string, etag: string, sources: SourceDefinition[]) {
    return request<SourcesConfig>("/api/admin/sources", {
      token,
      method: "POST",
      etag,
      body: { sources },
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

  async testConnection(token: string, sourceId: string): Promise<SourceTestResponse> {
    const result = await request<SourceTestResponse>(`/api/admin/sources/${encodeURIComponent(sourceId)}/test-connection`, {
      token,
      method: "POST",
    });
    return result.data;
  },

  async testSearch(token: string, sourceId: string, query: string, mode: SearchMode): Promise<SourceTestResponse> {
    const result = await request<SourceTestResponse>(`/api/admin/sources/${encodeURIComponent(sourceId)}/test-search`, {
      token,
      method: "POST",
      body: { query, mode },
    });
    return result.data;
  },
};
