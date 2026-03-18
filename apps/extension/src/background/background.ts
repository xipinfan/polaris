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

const HEALTH_CHECK_INTERVAL = 5000;
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let lastKnownProxyMode: "direct" | "global" | "rules" | "system" = "direct";
let lastKnownProxyPort = 0;
let lastKnownApiPort = 0;

function applyProxyMode(message: ApplyProxyMessage): Promise<void> {
  lastKnownProxyMode = message.mode;
  lastKnownProxyPort = message.proxyPort;
  lastKnownApiPort = message.apiPort;

  startHealthCheck();

  const config: chrome.proxy.ProxyConfig =
    message.mode === "direct"
      ? { mode: "direct" }
      : message.mode === "system"
        ? { mode: "system" }
        : message.mode === "global"
          ? {
              mode: "fixed_servers",
              rules: {
                singleProxy: {
                  scheme: "http",
                  host: "127.0.0.1",
                  port: message.proxyPort
                },
                bypassList: ["<local>"]
              }
            }
          : {
              mode: "pac_script",
              pacScript: {
                url: `http://127.0.0.1:${message.apiPort}/api/proxy/pac`
              }
            };

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

async function checkCoreHealth(): Promise<boolean> {
  const apiPort = lastKnownApiPort || 9001;
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload?.data?.online === true;
  } catch {
    return false;
  }
}

async function restoreProxyToDirect(): Promise<void> {
  console.log("[Polaris] Core offline, restoring proxy to direct mode");
  await applyProxyMode({
    type: "apply-proxy-mode",
    mode: "direct",
    proxyPort: lastKnownProxyPort,
    apiPort: lastKnownApiPort
  });
}

function startHealthCheck(): void {
  if (healthCheckTimer) {
    return;
  }

  healthCheckTimer = setInterval(async () => {
    const isOnline = await checkCoreHealth();
    if (!isOnline && lastKnownProxyMode !== "direct" && lastKnownProxyMode !== "system") {
      await restoreProxyToDirect();
      lastKnownProxyMode = "direct";
    }
  }, HEALTH_CHECK_INTERVAL);
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
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
  startHealthCheck();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Polaris extension started");
  startHealthCheck();
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "apply-proxy-mode") {
    applyProxyMode(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message: "unknown error" }));

    return true;
  }

  if (message.type === "open-certificate-settings") {
    openCertificateSettings()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message: "unknown error" }));

    return true;
  }

  return false;
});
