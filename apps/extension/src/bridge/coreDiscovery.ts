const API_PORT_STORAGE_KEY = "polaris.apiPort";
const CONSOLE_PORT_STORAGE_KEY = "polaris.consolePort";
const CONSOLE_PORT_CANDIDATES = Array.from({ length: 15 }, (_, index) => 5173 + index);
const API_PORT_CANDIDATES = Array.from({ length: 100 }, (_, index) => 9001 + index);
let cachedApiBaseUrl: string | null = null;
let cachedConsoleBaseUrl: string | null = null;

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
}

export async function getConsoleBaseUrl(): Promise<string> {
  if (cachedConsoleBaseUrl) {
    return cachedConsoleBaseUrl;
  }

  const stored = await getStoredConsolePort();
  const candidates = [...new Set([stored, ...CONSOLE_PORT_CANDIDATES].filter((item): item is number => Boolean(item)))];
  for (const port of candidates) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 800);
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        method: "GET",
        signal: controller.signal,
      });
      if (!response.ok) {
        continue;
      }

      const html = await response.text();
      if (html.includes("<div id=\"root\">") || html.includes("Polaris") || html.includes("北极星")) {
        await setStoredConsolePort(port);
        cachedConsoleBaseUrl = `http://127.0.0.1:${port}`;
        return cachedConsoleBaseUrl;
      }
    } catch {
      continue;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  return "http://127.0.0.1:5173";
}
