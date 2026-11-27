import type { SourceDefinition } from "@aio-resource-search/shared";
import type { RateLimitCoordinatorNamespace } from "./rate-limit-coordinator";

export interface KVNamespace {
  get(key: string, type: "text", options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  /** Named Worker secret bindings are resolved only on the Worker side. */
  [bindingName: string]: unknown;
  SOURCES_KV: KVNamespace;
  RATE_LIMIT_COORDINATOR?: RateLimitCoordinatorNamespace;
  ADMIN_API_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

/** Resolve only the secret binding explicitly assigned to this source. */
export function readSourceCredential(env: Env | undefined, source: SourceDefinition): string | undefined {
  if (!source.credentialBinding) return undefined;
  const value = env?.[source.credentialBinding];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
