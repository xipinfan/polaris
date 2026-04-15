export type ExtensionProxyMode = "direct" | "global" | "rules" | "system";

export interface HealthPayload {
  data?: {
    online?: boolean;
    proxyPort?: number;
    apiPort?: number;
    proxyMode?: ExtensionProxyMode;
  };
}

export type DiscoveryResult = { port: number; payload: HealthPayload } | null;

export type ProxySyncAction =
  | { type: "clear" }
  | { type: "set"; config: chrome.proxy.ProxyConfig; apiPort?: number };

export function shouldPollCore(isPopupOpen: boolean, keepMonitoringWhileConnected: boolean): boolean {
  return isPopupOpen || keepMonitoringWhileConnected;
}

export function buildProxyConfig(
  mode: ExtensionProxyMode,
  proxyPort: number,
  apiPort: number
): chrome.proxy.ProxyConfig {
  if (mode === "direct") {
    return { mode: "direct" };
  }

  if (mode === "system") {
    return { mode: "system" };
  }

  if (mode === "global") {
    return {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: "127.0.0.1",
          port: proxyPort
        },
        bypassList: ["<local>"]
      }
    };
  }

  return {
    mode: "pac_script",
    pacScript: {
      url: `http://127.0.0.1:${apiPort}/api/proxy/pac`
    }
  };
}

export function resolveProxySyncAction(discovery: DiscoveryResult): ProxySyncAction {
  if (!discovery) {
    return { type: "clear" };
  }

  const {
    proxyMode = "direct",
    proxyPort = 0,
    apiPort = discovery.port
  } = discovery.payload.data ?? {};

  return {
    type: "set",
    apiPort,
    config: buildProxyConfig(proxyMode, proxyPort, apiPort)
  };
}
