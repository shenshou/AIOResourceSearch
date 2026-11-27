import type { ContentCategory, FieldAttribution, ResourceLink, ResourceRelationship, SearchMode } from "@aio-resource-search/shared";

import { getApiBaseUrl } from "./apiBase";

export interface SearchResource {
  id: string;
  sourceId: string;
  sourceName: string;
  category: string;
  sourceAttributions?: Array<{
    sourceId: string;
    sourceName: string;
    category: string;
  }>;
  contentCategory?: ContentCategory;
  title: string;
  url: string;
  catalogNumber?: string;
  releaseDate?: string;
  imageUrl?: string;
  description?: string;
  metadata?: Record<string, string>;
  magnetUri?: string;
  ed2kUri?: string;
  torrentUrl?: string;
  resourceLinks?: ResourceLink[];
  fieldAttributions?: Record<string, FieldAttribution>;
  externalLinks?: Array<{ label: string; url: string }>;
  relationships?: ResourceRelationship[];
}

export interface SourceSearchStatus {
  sourceId: string;
  sourceName: string;
  status: "ok" | "error" | "timeout" | "unavailable";
  resultCount: number;
  errorCode?: string;
}

export interface ExternalSearchLink {
  sourceId: string;
  sourceName: string;
  category: string;
  kind: "search" | "homepage";
  url: string;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  results: SearchResource[];
  sources: SourceSearchStatus[];
  externalSearches: ExternalSearchLink[];
  meta: {
    totalResults: number;
    successfulSources: number;
    failedSources: number;
  };
}

export async function searchResources(query: string, mode: SearchMode, contentCategory: ContentCategory | "all" = "all"): Promise<SearchResponse> {
  const apiBaseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/api/search`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, mode, contentCategory }),
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
