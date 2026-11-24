import type { ProviderAdapter } from "./types";

/**
 * Compile-time allowlist of executable provider adapters.
 *
 * Register an adapter here only when its implementation and tests are included
 * in the same Worker change. Never populate this registry from KV or user input.
 */
const providerAdapters = [
  // Concrete adapters are registered here after their source access method,
  // parsing behavior, and normalized output have been reviewed and tested.
] satisfies readonly ProviderAdapter[];

const registry = new Map<string, ProviderAdapter>(
  providerAdapters.map((adapter) => [adapter.id, adapter]),
);

export function getProviderAdapter(adapterId: string): ProviderAdapter | null {
  return registry.get(adapterId) ?? null;
}

export function isProviderImplemented(adapterId: string): boolean {
  return registry.has(adapterId);
}

export function listProviderAdapters(): readonly ProviderAdapter[] {
  return providerAdapters;
}
