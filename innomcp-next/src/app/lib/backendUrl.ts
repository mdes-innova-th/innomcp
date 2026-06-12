// Centralized backend URL resolution replacing scattered hardcoded dead-port fallbacks.
// cc-team U1 (deepseek/deepseek-v4-pro) — CC-TEAM-2026-06-12-UIFIX
export const BACKEND: string = (() => {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== "") return envUrl.trim();
  if (typeof window !== "undefined" && window.location.port === "3000") return "http://localhost:3015";
  return "";
})();

export const WS_BACKEND: string = (() => {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl && wsUrl.trim() !== "") return wsUrl.trim();
  if (!BACKEND) return "";
  return BACKEND.replace(/^http(s)?:\/\//, (_, s) => `ws${s ? "s" : ""}://`);
})();

export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const fetchInit: RequestInit = {
    ...init,
    credentials: "include",
    headers,
  };
  return fetch(BACKEND + path, fetchInit);
}
