import type { SearchMode } from "@aio-resource-search/shared";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");

export interface SearchResource {
  id: string;
  sourceId: string;
  sourceName: string;
  category: string;
  title: string;
  url: string;
  catalogNumber?: string;
  releaseDate?: string;
  imageUrl?: string;
  description?: string;
  magnetUri?: string;
  ed2kUri?: string;
  torrentUrl?: string;
  externalLinks?: Array<{ label: string; url: string }>;
}

export interface SourceSearchStatus {
  sourceId: string;
  sourceName: string;
  status: "ok" | "error" | "timeout" | "unavailable";
  resultCount: number;
  errorCode?: string;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  results: SearchResource[];
  sources: SourceSearchStatus[];
  meta: {
    totalResults: number;
    successfulSources: number;
    failedSources: number;
  };
}

export async function searchResources(query: string, mode: SearchMode): Promise<SearchResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/search`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, mode }),
    });
  } catch {
    throw new Error("无法连接搜索 API。请检查 Worker 地址和服务状态。");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message || `搜索请求失败（HTTP ${response.status}）`);
  }
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as SearchResponse).results)) {
    throw new Error("搜索 API 返回的数据格式不正确。");
  }
  return payload as SearchResponse;
}
