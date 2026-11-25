export interface KVNamespace {
  get(key: string, type: "text", options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  SOURCES_KV: KVNamespace;
  ADMIN_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}
