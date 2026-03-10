import type { ProxyMode, ProxyRule, ServiceStatus } from "@polaris/shared-types";
import { getApiBaseUrl } from "./coreDiscovery";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Bridge request failed");
  }
  return payload.data as T;
}

export const coreBridge = {
  health: () => request<ServiceStatus>("/health"),
  setProxyMode: (mode: ProxyMode) =>
    request<{ mode: ProxyMode }>("/proxy-mode", { method: "POST", body: JSON.stringify({ mode }) }),
  addSiteRule: (host: string) =>
    request<ProxyRule>("/proxy-rules/site", { method: "POST", body: JSON.stringify({ host, action: "proxy" }) }),
  removeSiteRule: (host: string) => request<{ host: string }>(`/proxy-rules/site/${host}`, { method: "DELETE" }),
  listRules: () => request<ProxyRule[]>("/proxy-rules")
};
