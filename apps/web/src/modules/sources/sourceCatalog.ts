import type { SearchMode, SourceCategory } from "@aio-resource-search/shared";

export interface SourceCatalogEntry {
  id: string;
  name: string;
  category: SourceCategory;
  searchModes: SearchMode[];
  projects: string[];
  note: string;
}

/**
 * Candidate inventory from Atlas, Lustpress, and FetchJAV.
 * Entries are not pre-enabled: admins must provide and verify a search URL
 * template before an external-search source can be saved.
 */
export const SOURCE_CATALOG: SourceCatalogEntry[] = [
  { id: "javbus", name: "JavBus", category: "jav", searchModes: ["number", "keyword"], projects: ["Atlas"], note: "Atlas implements a JavBus detail provider; review access policy before implementing our own." },
  { id: "javdb", name: "JavDB", category: "jav", searchModes: ["number", "keyword"], projects: ["Atlas", "FetchJAV"], note: "Referenced by both projects; no official public API is assumed." },
  { id: "dmm-fanza", name: "DMM / FANZA", category: "jav", searchModes: ["number", "keyword"], projects: ["Atlas"], note: "Metadata/search candidate; do not add a paid API." },
  { id: "jav-guru", name: "JAV.guru", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Discovery and metadata candidate." },
  { id: "javdatabase", name: "JAVDatabase", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Metadata enrichment candidate." },
  { id: "jabletv", name: "JableTV", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Primary FetchJAV site adapter." },
  { id: "missav", name: "MissAV", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Primary FetchJAV site adapter; mirrors require separate review." },
  { id: "supjav", name: "SupJav", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Primary FetchJAV site adapter; mirrors require separate review." },
  { id: "jable-org", name: "Jable.org", category: "jav", searchModes: ["number", "keyword"], projects: ["FetchJAV"], note: "Listed as a JableTV mirror; group with JableTV in the UI." },
  { id: "hanime1", name: "Hanime1", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Listed FetchJAV site adapter." },
  { id: "hanimetv", name: "HanimeTV", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Listed FetchJAV site adapter." },
  { id: "tnaflix", name: "TnaFlix", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Listed FetchJAV site adapter." },
  { id: "91porn", name: "91Porn", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Listed FetchJAV site adapter." },
  { id: "thisav", name: "ThisAV", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pigav", name: "PigAV", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "porn5f", name: "Porn5F", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "85tube", name: "85Tube", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornbest", name: "PornBest", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "hanime-xyz", name: "HAnime XYZ", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "porntw", name: "PornTW", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornjp", name: "PornJP", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornhk", name: "PornHK", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornhoho", name: "PornHoHo", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornnvr", name: "PornNVR", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "video01", name: "Video01", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornlulu", name: "PornLuLu", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "mien321", name: "MIEN321", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "aapp11", name: "AApp11", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "seselah", name: "Seselah", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "xjishi", name: "XJISHI", category: "other-index", searchModes: ["keyword"], projects: ["FetchJAV"], note: "Additional FetchJAV site." },
  { id: "pornhub", name: "PornHub", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; no challenge solver or anti-bot bypass will be ported." },
  { id: "xnxx", name: "XNXX", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "redtube", name: "RedTube", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "xvideos", name: "XVideos", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "xhamster", name: "XHamster", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "youporn", name: "YouPorn", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "eporner", name: "Eporner", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
  { id: "txxx", name: "TXXX", category: "other-index", searchModes: ["keyword"], projects: ["Lustpress"], note: "Lustpress provider; external search preferred pending review." },
];
