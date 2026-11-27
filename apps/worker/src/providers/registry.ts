import type { ProviderAdapter } from "./types";
import { genericHtmlProvider } from "./generic-html";
import { dmhyRssProvider } from "./dmhy-rss";
import { epornerApiProvider } from "./eporner-api";
import { anibtTorznabProvider } from "./anibt-torznab";
import { mangaDexProvider } from "./mangadex-api";
import { musicBrainzProvider } from "./musicbrainz-api";
import { libriVoxProvider } from "./librivox-api";
import { perverzijaDbProvider } from "./perverzija-db";
import { sukebeiRssProvider } from "./sukebei-rss";
import { torlockProvider } from "./torlock-torznab";
import { theRarBgProvider } from "./the-rarbg-json";
import { yourBittorrentProvider } from "./yourbittorrent-json";

/**
 * Compile-time allowlist of executable provider adapters.
 *
 * Register an adapter here only when its implementation and tests are included
 * in the same Worker change. Never populate this registry from KV or user input.
 */
const providerAdapters: readonly ProviderAdapter[] = [
  genericHtmlProvider,
  anibtTorznabProvider,
  dmhyRssProvider,
  epornerApiProvider,
  sukebeiRssProvider,
  perverzijaDbProvider,
  torlockProvider,
  theRarBgProvider,
  yourBittorrentProvider,
  mangaDexProvider,
  musicBrainzProvider,
  libriVoxProvider,
];

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
