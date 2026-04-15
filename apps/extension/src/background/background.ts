import {
  buildProxyConfig,
  resolveProxySyncAction,
  shouldPollCore,
  type ExtensionProxyMode,
  type HealthPayload
} from "./proxyState";

type ApplyProxyMessage = {
  type: "apply-proxy-mode";
  mode: ExtensionProxyMode;
  proxyPort: number;
  apiPort: number;
};

type SyncCoreStateMessage = {
  type: "sync-core-state";
};

type SetPopupStateMessage = {
  type: "set-popup-state";
  isOpen: boolean;
};

type OpenCertificateSettingsMessage = {
  type: "open-certificate-settings";
};

type ExtensionMessage = ApplyProxyMessage | SyncCoreStateMessage | SetPopupStateMessage | OpenCertificateSettingsMessage;
const HEALTH_CHECK_INTERVAL = 5000;
const API_PORT_STORAGE_KEY = "polaris.apiPort";
const DEFAULT_API_PORT = 19601;
const API_PORT_SCAN_SIZE = 20;
const FETCH_TIMEOUT_MS = 2000;
const API_PORT_CANDIDATES = Array.from({ length: API_PORT_SCAN_SIZE }, (_, index) => DEFAULT_API_PORT + index);
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let popupOpen = false;
let keepMonitoringWhileConnected = false;

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

function clearProxyConfig(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear({ scope: "regular" }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

function startHealthCheck(): void {
  if (healthCheckTimer) {
    return;
  }

  healthCheckTimer = setInterval(() => {
    void syncWithCore().catch((error) => {
      console.error("[Polaris] Failed to sync proxy state", error);
    });
  }, HEALTH_CHECK_INTERVAL);
}

function reconcileHealthCheck(): void {
  if (shouldPollCore(popupOpen, keepMonitoringWhileConnected)) {
    startHealthCheck();
    return;
  }

  stopHealthCheck();
}

async function syncWithCore(): Promise<void> {
  const discovery = await discoverCore();
  const action = resolveProxySyncAction(discovery);

  if (action.type === "clear") {
    console.log("[Polaris] Core offline, clearing extension proxy control");
    keepMonitoringWhileConnected = false;
    await clearProxyConfig();
    reconcileHealthCheck();
    return;
  }

  keepMonitoringWhileConnected = true;
  if (typeof action.apiPort === "number") {
    await writeStoredApiPort(action.apiPort);
  }
  await applyProxyConfig(action.config);
  reconcileHealthCheck();
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("Polaris extension installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Polaris extension started");
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "apply-proxy-mode") {
    discoverCore()
      .then(async (discovery) => {
        if (!discovery) {
          await clearProxyConfig();
          throw new Error("Core offline");
        }

        const proxyPort = discovery.payload.data?.proxyPort ?? message.proxyPort;
        const apiPort = discovery.payload.data?.apiPort ?? message.apiPort;
        keepMonitoringWhileConnected = true;
        await writeStoredApiPort(apiPort);
        await applyProxyConfig(buildProxyConfig(message.mode, proxyPort, apiPort));
        reconcileHealthCheck();
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

    return true;
  }

  if (message.type === "sync-core-state") {
    syncWithCore()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

    return true;
  }

  if (message.type === "set-popup-state") {
    popupOpen = message.isOpen;
    reconcileHealthCheck();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "open-certificate-settings") {
    openCertificateSettings()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

    return true;
  }

  return false;
});
