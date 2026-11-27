const LOCAL_WORKER_API = "http://localhost:8787";

/**
 * Resolve the Worker origin at request time.
 * Local development may use Wrangler's default address; production must be
 * configured explicitly so a Pages deployment can never silently call a
 * visitor's own localhost.
 */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configured) {
    if (import.meta.env.DEV) return LOCAL_WORKER_API;
    throw new Error(
      "生产环境未配置 VITE_API_BASE_URL。请在 Cloudflare Pages 环境变量中设置 Worker API 的 HTTPS 地址。",
    );
  }

  if (import.meta.env.PROD) {
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new Error("VITE_API_BASE_URL 必须是完整的 HTTPS Worker 地址。");
    }
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("生产环境的 VITE_API_BASE_URL 必须是 HTTPS Worker 根地址，不能包含路径、查询参数或凭据。");
    }
  }

  return configured.replace(/\/+$/, "");
}
