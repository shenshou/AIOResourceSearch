import { getProviderAdapter, isProviderImplemented } from "./providers/registry";
import { CONTENT_CATEGORIES, FETCH_MECHANISMS } from "@aio-resource-search/shared";
import type {
  SEARCH_MODES,
  SOURCE_CAPABILITIES,
  SOURCE_CATEGORIES,
  AdapterDefinition,
  SourceDefinition,
} from "@aio-resource-search/shared";

const categories = ["jav", "torrent", "forum", "other-index"] satisfies readonly (typeof SOURCE_CATEGORIES)[number][];
const contentCategories = [...CONTENT_CATEGORIES];
const fetchMechanisms = [...FETCH_MECHANISMS];
const sourceTypes = ["provider", "external-search"] as const;
const searchModes = ["number", "keyword"] satisfies readonly (typeof SEARCH_MODES)[number][];
const capabilities = ["metadata", "image", "magnet", "ed2k", "torrent", "forum-post"] satisfies readonly (typeof SOURCE_CAPABILITIES)[number][];

export function validateSource(input: unknown): SourceDefinition | null {
  if (typeof input !== "object" || input === null) return null;
  const value = input as Record<string, unknown>;

  if (typeof value.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) return null;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.length > 80) return null;
  if (typeof value.category !== "string" || !categories.includes(value.category as SourceDefinition["category"])) return null;
  if (value.contentCategory !== undefined && (typeof value.contentCategory !== "string" || !contentCategories.includes(value.contentCategory as (typeof CONTENT_CATEGORIES)[number]))) return null;
  const type = value.type === undefined ? "provider" : value.type;
  if (typeof type !== "string" || !sourceTypes.includes(type as (typeof sourceTypes)[number])) return null;
  if (type === "provider" &&
      (typeof value.adapterId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.adapterId))) return null;
  if (type === "provider" && value.providerSearchUrlTemplate !== undefined) {
    if (typeof value.providerSearchUrlTemplate !== "string" ||
        value.providerSearchUrlTemplate.length > 2048 ||
        (value.providerSearchUrlTemplate.match(/\{query\}/g) ?? []).length !== 1 ||
        typeof value.baseUrl !== "string") return null;
    try {
      const base = new URL(value.baseUrl);
      const target = new URL(value.providerSearchUrlTemplate.replace("{query}", "AIO_QUERY_TOKEN"));
      if (target.protocol !== "https:" || target.origin !== base.origin ||
          target.username || target.password || target.hostname.toLowerCase().includes("aio_query_token")) return null;
    } catch {
      return null;
    }
  }
  if (value.htmlSelectors !== undefined) {
    if (typeof value.htmlSelectors !== "object" || value.htmlSelectors === null || Array.isArray(value.htmlSelectors)) return null;
    const selectors = value.htmlSelectors as Record<string, unknown>;
    for (const key of ["result", "title", "link"]) {
      if (typeof selectors[key] !== "string" || !selectors[key].trim() || selectors[key].length > 200) return null;
    }
    for (const key of ["image", "description", "magnet"]) {
      if (selectors[key] !== undefined && (typeof selectors[key] !== "string" || !selectors[key].trim() || selectors[key].length > 200)) return null;
    }
    if (selectors.fields !== undefined) {
      if (typeof selectors.fields !== "object" || selectors.fields === null || Array.isArray(selectors.fields)) return null;
      const fields = Object.entries(selectors.fields as Record<string, unknown>);
      if (fields.length > 20 || fields.some(([key, selector]) =>
        !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) ||
        typeof selector !== "string" || !selector.trim() || selector.length > 200
      )) return null;
    }
  }
  if (type === "provider" && value.adapterId === "generic-html" &&
      (typeof value.baseUrl !== "string" || typeof value.providerSearchUrlTemplate !== "string" || !value.htmlSelectors)) return null;
  if (type === "provider" && value.adapterId !== "generic-html" &&
      (value.providerSearchUrlTemplate !== undefined || value.htmlSelectors !== undefined)) return null;
  if (type === "external-search" && (value.providerSearchUrlTemplate !== undefined || value.htmlSelectors !== undefined)) return null;
  if (type === "provider" && value.externalSearchUrlTemplate !== undefined) {
    if (typeof value.externalSearchUrlTemplate !== "string" ||
        value.externalSearchUrlTemplate.length > 2048 ||
        (value.externalSearchUrlTemplate.match(/\\{query\\}/g) ?? []).length !== 1) return null;
    try {
      const templateUrl = new URL(value.externalSearchUrlTemplate.replace("{query}", "AIO_QUERY_TOKEN"));
      if (templateUrl.protocol !== "https:" || templateUrl.username || templateUrl.password ||
          templateUrl.hostname.toLowerCase().includes("aio_query_token")) return null;
    } catch {
      return null;
    }
  }
  if (type === "provider" && value.externalSearchBaseUrl !== undefined) {
    if (typeof value.externalSearchBaseUrl !== "string" || value.externalSearchBaseUrl.length > 2048) return null;
    try {
      const homepage = new URL(value.externalSearchBaseUrl);
      if (homepage.protocol !== "https:" || homepage.username || homepage.password || homepage.search || homepage.hash) return null;
    } catch {
      return null;
    }
  }
  if (type === "external-search" &&
      (value.externalSearchUrlTemplate !== undefined || value.externalSearchBaseUrl !== undefined)) return null;
  if (type === "external-search" && value.searchUrlTemplate !== undefined) {
    if (typeof value.searchUrlTemplate !== "string" ||
        value.searchUrlTemplate.length > 2048 ||
        (value.searchUrlTemplate.match(/\{query\}/g) ?? []).length !== 1) return null;
    try {
      const templateUrl = new URL(value.searchUrlTemplate.replace("{query}", "AIO_QUERY_TOKEN"));
      if (templateUrl.protocol !== "https:" ||
          templateUrl.username ||
          templateUrl.password ||
          templateUrl.hostname.toLowerCase().includes("aio_query_token")) return null;
    } catch {
      return null;
    }
  }
  if (typeof value.enabled !== "boolean") return null;
  if (!Array.isArray(value.searchModes) || value.searchModes.length === 0 ||
      !value.searchModes.every((item) => searchModes.includes(item as SourceDefinition["searchModes"][number]))) return null;
  if (!Array.isArray(value.capabilities) ||
      !value.capabilities.every((item) => capabilities.includes(item as SourceDefinition["capabilities"][number])) ||
      (type === "provider" && value.capabilities.length === 0)) return null;
  if (type === "provider" && value.adapterId === "generic-html") {
    const selectors = value.htmlSelectors as Record<string, unknown>;
    const declaredCapabilities = value.capabilities as string[];
    const hasImageSelector = typeof selectors.image === "string" && Boolean(selectors.image.trim());
    const hasMagnetSelector = typeof selectors.magnet === "string" && Boolean(selectors.magnet.trim());
    if (declaredCapabilities.includes("image") !== hasImageSelector ||
        declaredCapabilities.includes("magnet") !== hasMagnetSelector) return null;
  }
  if (type === "external-search" &&
      (value.capabilities.length > 0 ||
       value.adapterId !== undefined ||
       value.credentialBinding !== undefined ||
       (value.searchUrlTemplate === undefined && typeof value.baseUrl !== "string" && value.enabled !== false))) return null;
  if (type === "provider" && value.searchUrlTemplate !== undefined) return null;
  if (typeof value.timeoutMs !== "number" || !Number.isInteger(value.timeoutMs) || value.timeoutMs < 1000 || value.timeoutMs > 30000) return null;

  if (value.baseUrl !== undefined) {
    if (typeof value.baseUrl !== "string" || value.baseUrl.length > 2048) return null;
    try {
      const url = new URL(value.baseUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
      if (value.adapterId === "generic-html" &&
          (url.hostname === "localhost" || url.hostname.endsWith(".local") ||
           url.hostname.endsWith(".internal") || url.hostname.startsWith("[") ||
           /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) || !url.hostname.includes("."))) return null;
    } catch {
      return null;
    }
  }

  if (value.credentialBinding !== undefined) {
    if (typeof value.credentialBinding !== "string" || !/^SOURCE_CREDENTIAL_[A-Z0-9_]{1,48}$/.test(value.credentialBinding)) return null;
  }

  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) return null;

  return {
    id: value.id,
    name: value.name.trim(),
    category: value.category as SourceDefinition["category"],
    ...(typeof value.contentCategory === "string" ? { contentCategory: value.contentCategory as SourceDefinition["contentCategory"] } : {}),
    type: type as SourceDefinition["type"],
    ...(typeof value.adapterId === "string" ? { adapterId: value.adapterId } : {}),
    ...(typeof value.searchUrlTemplate === "string" ? { searchUrlTemplate: value.searchUrlTemplate } : {}),
    ...(typeof value.externalSearchUrlTemplate === "string" ? { externalSearchUrlTemplate: value.externalSearchUrlTemplate } : {}),
    ...(typeof value.externalSearchBaseUrl === "string" ? { externalSearchBaseUrl: value.externalSearchBaseUrl } : {}),
    ...(typeof value.providerSearchUrlTemplate === "string" ? { providerSearchUrlTemplate: value.providerSearchUrlTemplate } : {}),
    ...(value.htmlSelectors && typeof value.htmlSelectors === "object" ? { htmlSelectors: value.htmlSelectors as SourceDefinition["htmlSelectors"] } : {}),
    enabled: value.enabled,
    ...(typeof value.baseUrl === "string" ? { baseUrl: value.baseUrl } : {}),
    searchModes: value.searchModes as SourceDefinition["searchModes"],
    capabilities: value.capabilities as SourceDefinition["capabilities"],
    timeoutMs: value.timeoutMs,
    ...(typeof value.credentialBinding === "string" ? { credentialBinding: value.credentialBinding } : {}),
    ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
  };
}

export function validateAdapter(input: unknown): AdapterDefinition | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;

  if (typeof value.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.id)) return null;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.length > 80) return null;
  if (typeof value.description !== "string" || value.description.length > 500) return null;
  if (typeof value.version !== "string" || value.version.trim().length < 1 || value.version.length > 40) return null;
  if (typeof value.enabled !== "boolean") return null;
  if (value.mechanism !== undefined && (typeof value.mechanism !== "string" || !fetchMechanisms.includes(value.mechanism as (typeof fetchMechanisms)[number]))) return null;
  if (value.contentCategories !== undefined && (!Array.isArray(value.contentCategories) || value.contentCategories.length < 1 || !value.contentCategories.every((item) => contentCategories.includes(item as (typeof contentCategories)[number])))) return null;
  if (!Array.isArray(value.categories) || value.categories.length < 1 ||
      !value.categories.every((item) => categories.includes(item as SourceDefinition["category"]))) return null;
  if (!Array.isArray(value.capabilities) ||
      !value.capabilities.every((item) => capabilities.includes(item as SourceDefinition["capabilities"][number]))) return null;
  if (value.notes !== undefined && (typeof value.notes !== "string" || value.notes.length > 500)) return null;

  const implementation = getProviderAdapter(value.id);
  const implemented = isProviderImplemented(value.id);
  if (value.enabled && !implemented) return null;

  return {
    id: value.id,
    name: value.name.trim(),
    description: value.description.trim(),
    mechanism: (implementation?.mechanism ?? value.mechanism ?? "api") as AdapterDefinition["mechanism"],
    contentCategories: (implementation?.contentCategories ?? value.contentCategories ?? ["jav"]) as AdapterDefinition["contentCategories"],
    version: implementation?.version ?? value.version.trim(),
    enabled: value.enabled,
    categories: implementation
      ? [...implementation.categories]
      : [...new Set(value.categories as SourceDefinition["category"][])],
    capabilities: implementation
      ? [...implementation.capabilities]
      : [...new Set(value.capabilities as SourceDefinition["capabilities"])],
    implemented,
    ...(typeof value.notes === "string" ? { notes: value.notes } : {}),
  };
}

