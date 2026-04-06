type ApplyProxyMessage = {
  type: "apply-proxy-mode";
  mode: "direct" | "global" | "rules" | "system";
  proxyPort: number;
  apiPort: number;
};

type OpenCertificateSettingsMessage = {
  type: "open-certificate-settings";
};

type ExtensionMessage = ApplyProxyMessage | OpenCertificateSettingsMessage;

interface HealthPayload {
  data?: {
    online?: boolean;
    proxyPort?: number;
    apiPort?: number;
    proxyMode?: "direct" | "global" | "rules" | "system";
  };
}

const HEALTH_CHECK_INTERVAL = 5000;
const API_PORT_STORAGE_KEY = "polaris.apiPort";
const DEFAULT_API_PORT = 19601;
const API_PORT_SCAN_SIZE = 20;
const FETCH_TIMEOUT_MS = 2000;
const API_PORT_CANDIDATES = Array.from({ length: API_PORT_SCAN_SIZE }, (_, index) => DEFAULT_API_PORT + index);

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

async function readStoredApiPort(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(API_PORT_STORAGE_KEY, (result) => {
      const value = result[API_PORT_STORAGE_KEY];
      resolve(Number.isInteger(value) ? value : null);
    });
  });
}

async function writeStoredApiPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [API_PORT_STORAGE_KEY]: port }, () => resolve());
  });
}

async function tryHealthCheck(port: number): Promise<HealthPayload | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as HealthPayload;
    if (
      payload.data?.online === true &&
      typeof payload.data.proxyPort === "number" &&
      typeof payload.data.apiPort === "number" &&
      typeof payload.data.proxyMode === "string"
    ) {
      return payload;
    }

    return null;
  } catch {
    return null;
  }
}

async function discoverCore(): Promise<{ port: number; payload: HealthPayload } | null> {
  const storedPort = await readStoredApiPort();
  if (storedPort) {
    const payload = await tryHealthCheck(storedPort);
    if (payload) {
      return { port: storedPort, payload };
    }
  }

  const candidates = API_PORT_CANDIDATES.filter((port) => port !== storedPort);
  if (candidates.length === 0) {
    return null;
  }

  try {
    const result = await Promise.any(
      candidates.map(async (port) => {
        const payload = await tryHealthCheck(port);
        if (!payload) {
          throw new Error(`Core unavailable on port ${port}`);
        }
        return { port, payload };
      })
    );
    await writeStoredApiPort(result.port);
    return result;
  } catch {
    return null;
  }
}

function buildProxyConfig(
  mode: "direct" | "global" | "rules" | "system",
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

function applyProxyConfig(config: chrome.proxy.ProxyConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.set(
      {
        value: config,
        scope: "regular"
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function syncWithCore(): Promise<void> {
  const discovery = await discoverCore();
  if (!discovery) {
    console.log("[Polaris] Core offline, restoring proxy to direct mode");
    await applyProxyConfig(buildProxyConfig("direct", 0, DEFAULT_API_PORT));
    return;
  }

  const {
    proxyMode = "direct",
    proxyPort = 0,
    apiPort = discovery.port
  } = discovery.payload.data ?? {};

  await writeStoredApiPort(apiPort);
  await applyProxyConfig(buildProxyConfig(proxyMode, proxyPort, apiPort));
}

function startHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }

  healthCheckTimer = setInterval(() => {
    void syncWithCore().catch((error) => {
      console.error("[Polaris] Failed to sync proxy state", error);
    });
  }, HEALTH_CHECK_INTERVAL);
}

function openCertificateSettings(): Promise<void> {
  const isEdge = navigator.userAgent.includes("Edg/");
  const targetUrl = isEdge ? "edge://certificate-manager/" : "chrome://settings/certificates";

  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url: targetUrl }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

void syncWithCore().catch((error) => {
  console.error("[Polaris] Initial sync failed", error);
});
startHealthCheck();

chrome.runtime.onInstalled.addListener(() => {
  console.log("Polaris extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Polaris extension started");
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "apply-proxy-mode") {
    applyProxyConfig(buildProxyConfig(message.mode, message.proxyPort, message.apiPort))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

    return true;
  }

  if (message.type === "open-certificate-settings") {
    openCertificateSettings()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

    return true;
  }

  return false;
});
