import type { ProxyMode, ServiceStatus } from "@polaris/shared-types";

export async function applyBrowserProxyMode(mode: ProxyMode, status: Pick<ServiceStatus, "proxyPort" | "apiPort">) {
  const response = await chrome.runtime.sendMessage({
    type: "apply-proxy-mode",
    mode,
    proxyPort: status.proxyPort,
    apiPort: status.apiPort
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? "Failed to apply browser proxy mode");
  }
}
