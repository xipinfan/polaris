const API_PORT_STORAGE_KEY = "polaris.apiPort";
const CONSOLE_PORT_STORAGE_KEY = "polaris.consolePort";
const CONSOLE_PORT_CANDIDATES = Array.from({ length: 15 }, (_, index) => 5173 + index);
const DEFAULT_API_PORT = 19601;
const API_PORT_CANDIDATES = Array.from({ length: 8 }, (_, index) => DEFAULT_API_PORT + index);
let cachedApiBaseUrl: string | null = null;
let cachedConsoleBaseUrl: string | null = null;
let apiBaseUrlPromise: Promise<string> | null = null;
let consoleBaseUrlPromise: Promise<string> | null = null;

async function getStoredApiPort(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(API_PORT_STORAGE_KEY, (result) => {
      const value = result[API_PORT_STORAGE_KEY];
      resolve(Number.isInteger(value) ? value : null);
    });
  });
}

async function setStoredApiPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [API_PORT_STORAGE_KEY]: port }, () => resolve());
  });
}

async function getStoredConsolePort(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(CONSOLE_PORT_STORAGE_KEY, (result) => {
      const value = result[CONSOLE_PORT_STORAGE_KEY];
      resolve(Number.isInteger(value) ? value : null);
    });
  });
}

async function setStoredConsolePort(port: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CONSOLE_PORT_STORAGE_KEY]: port }, () => resolve());
  });
}

async function isApiPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return (
      payload?.data?.online === true &&
      typeof payload?.data?.apiPort === "number" &&
      typeof payload?.data?.proxyPort === "number" &&
      typeof payload?.data?.mcpPort === "number"
    );
  } catch {
    return false;
  }
}

export async function getApiBaseUrl(): Promise<string> {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  if (apiBaseUrlPromise) {
    return apiBaseUrlPromise;
  }

  apiBaseUrlPromise = (async () => {
    const stored = await getStoredApiPort();
    const candidates = [...new Set([stored, ...API_PORT_CANDIDATES].filter((item): item is number => Boolean(item)))];
    for (const port of candidates) {
      if (await isApiPortAvailable(port)) {
        await setStoredApiPort(port);
        cachedApiBaseUrl = `http://127.0.0.1:${port}/api`;
        return cachedApiBaseUrl;
      }
    }

    throw new Error("Polaris Core API not found on localhost");
  })();

  try {
    return await apiBaseUrlPromise;
  } finally {
    apiBaseUrlPromise = null;
  }
}

async function isConsoleAvailable(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 800);

  try {
    const response = await fetch(`${baseUrl}/`, {
      method: "GET",
      signal: controller.signal
    });
    if (!response.ok) {
      return false;
    }

    const html = await response.text();
    return html.includes("<div id=\"root\">") || html.includes("Polaris");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function getConsoleBaseUrl(): Promise<string> {
  if (cachedConsoleBaseUrl) {
    return cachedConsoleBaseUrl;
  }

  if (consoleBaseUrlPromise) {
    return consoleBaseUrlPromise;
  }

  consoleBaseUrlPromise = (async () => {
    try {
      const apiBaseUrl = await getApiBaseUrl();
      const apiUrl = new URL(apiBaseUrl);
      const packagedConsoleBaseUrl = `http://${apiUrl.hostname}:${apiUrl.port}`;
      if (await isConsoleAvailable(packagedConsoleBaseUrl)) {
        cachedConsoleBaseUrl = packagedConsoleBaseUrl;
        return cachedConsoleBaseUrl;
      }
    } catch {
      // Fall back to legacy Vite console discovery.
    }

    const stored = await getStoredConsolePort();
    const candidates = [...new Set([stored, ...CONSOLE_PORT_CANDIDATES].filter((item): item is number => Boolean(item)))];
    for (const port of candidates) {
      const baseUrl = `http://127.0.0.1:${port}`;
      if (await isConsoleAvailable(baseUrl)) {
        await setStoredConsolePort(port);
        cachedConsoleBaseUrl = baseUrl;
        return cachedConsoleBaseUrl;
      }
    }

    return "http://127.0.0.1:5173";
  })();

  try {
    return await consoleBaseUrlPromise;
  } finally {
    consoleBaseUrlPromise = null;
  }
}
