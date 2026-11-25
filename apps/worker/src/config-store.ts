import { isProviderImplemented } from "./providers/registry";
import { validateAdapter, validateSource } from "./validation";
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
    typeof parsed.version !== "number" ||
    !Number.isSafeInteger(parsed.version) ||
    parsed.version < 0 ||
    !("adapters" in parsed) ||
    !Array.isArray(parsed.adapters) ||
    ("updatedAt" in parsed && parsed.updatedAt !== null && typeof parsed.updatedAt !== "string")
  ) {
    throw new Error("Stored adapter configuration is invalid.");
  }

  const ids = new Set<string>();
  const adapters = parsed.adapters.map((item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item) ||
        !("id" in item) || typeof item.id !== "string" ||
        !("enabled" in item) || typeof item.enabled !== "boolean") {
      throw new Error("Stored adapter configuration contains an invalid adapter.");
    }
    if (ids.has(item.id)) throw new Error("Stored adapter configuration contains duplicate adapter IDs.");
    ids.add(item.id);
    const adapter = validateAdapter({
      ...item,
      enabled: item.enabled && isProviderImplemented(item.id),
    });
    if (!adapter) throw new Error("Stored adapter configuration contains an invalid adapter.");
    return adapter;
  });

  return {
    version: parsed.version,
    updatedAt: "updatedAt" in parsed && typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    adapters,
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
    !Number.isSafeInteger(parsed.version) ||
    parsed.version < 0 ||
    !("sources" in parsed) ||
    !Array.isArray(parsed.sources) ||
    ("updatedAt" in parsed && parsed.updatedAt !== null && typeof parsed.updatedAt !== "string")
  ) {
    throw new Error("Stored source configuration is invalid.");
  }

  const ids = new Set<string>();
  const sources = parsed.sources.map((item: unknown) => {
    const source = validateSource(item);
    if (!source) throw new Error("Stored source configuration contains an invalid source.");
    if (ids.has(source.id)) throw new Error("Stored source configuration contains duplicate source IDs.");
    ids.add(source.id);
    return source;
  });

  return {
    version: parsed.version,
    updatedAt: "updatedAt" in parsed && typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    sources,
  };
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

export function publicSource(source: SourceDefinition): Omit<SourceDefinition, "credentialBinding" | "notes"> {
  const { credentialBinding, notes, ...safeSource } = source;
  void credentialBinding;
  void notes;
  return safeSource;
}

export function publicAdapter(adapter: AdapterDefinition): Omit<AdapterDefinition, "notes"> {
  const { notes, ...safeAdapter } = adapter;
  void notes;
  return safeAdapter;
}
