import { getProviderAdapter, isProviderImplemented } from "./providers/registry";
import type {
  AdapterDefinition,
  AdaptersConfig,
  SourceDefinition,
  SourcesConfig,
} from "@aio-resource-search/shared";
import type { Env } from "./env";

const CONFIG_KEY = "sources:config:v1";
const ADAPTER_CONFIG_KEY = "adapters:config:v1";

const DEFAULT_CONFIG: SourcesConfig = {
  version: 0,
  updatedAt: null,
  sources: [],
};
const DEFAULT_ADAPTERS_CONFIG: AdaptersConfig = {
  version: 0,
  updatedAt: null,
  adapters: [],
};

export async function readAdaptersConfig(env: Env): Promise<AdaptersConfig> {
  const raw = await env.SOURCES_KV.get(ADAPTER_CONFIG_KEY, "text", { cacheTtl: 30 });
  if (!raw) return { ...DEFAULT_ADAPTERS_CONFIG, adapters: [] };

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("adapters" in parsed) ||
    !Array.isArray(parsed.adapters)
  ) {
    throw new Error("Stored adapter configuration is invalid.");
  }

  const config = parsed as AdaptersConfig;
  return {
    ...config,
    adapters: config.adapters.map((adapter) => {
      const implementation = getProviderAdapter(adapter.id);
      const implemented = isProviderImplemented(adapter.id);
      return {
        ...adapter,
        mechanism: implementation?.mechanism ?? adapter.mechanism ?? "api",
        contentCategories: [...(implementation?.contentCategories ?? adapter.contentCategories ?? ["jav"])],
        implemented,
        enabled: Boolean(adapter.enabled && implemented),
      };
    }),
  };
}

export async function readConfig(env: Env): Promise<SourcesConfig> {
  const raw = await env.SOURCES_KV.get(CONFIG_KEY, "text", { cacheTtl: 30 });
  if (!raw) return { ...DEFAULT_CONFIG, sources: [] };

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("sources" in parsed) ||
    !Array.isArray(parsed.sources)
  ) {
    throw new Error("Stored source configuration is invalid.");
  }

  return parsed as SourcesConfig;
}

export async function saveAdaptersConfig(
  env: Env,
  current: AdaptersConfig,
  adapters: AdapterDefinition[],
): Promise<AdaptersConfig> {
  const next: AdaptersConfig = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    adapters,
  };
  await env.SOURCES_KV.put(ADAPTER_CONFIG_KEY, JSON.stringify(next));
  return next;
}

export async function saveConfig(env: Env, current: SourcesConfig, sources: SourceDefinition[]): Promise<SourcesConfig> {
  const next: SourcesConfig = {
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    sources,
  };
  await env.SOURCES_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

