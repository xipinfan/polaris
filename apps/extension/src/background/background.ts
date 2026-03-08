type ApplyProxyMessage = {
  type: "apply-proxy-mode";
  mode: "direct" | "global" | "rules" | "system";
  proxyPort: number;
  apiPort: number;
};

function applyProxyMode(message: ApplyProxyMessage): Promise<void> {
  return new Promise((resolve, reject) => {
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("Polaris extension installed");
});

chrome.runtime.onMessage.addListener((message: ApplyProxyMessage, _sender, sendResponse) => {
  if (message.type !== "apply-proxy-mode") {
    return false;
  }

  applyProxyMode(message)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "unknown error" }));

  return true;
});
