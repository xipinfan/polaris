const API_PORT_STORAGE_KEY = "polaris.apiPort";
const DEFAULT_API_PORT = 19601;
const API_PORT_SCAN_SIZE = 20;
const FETCH_TIMEOUT_MS = 2000;
const API_PORT_CANDIDATES = Array.from({ length: API_PORT_SCAN_SIZE }, (_, index) => DEFAULT_API_PORT + index);
let cachedApiBaseUrl: string | null = null;
let cachedConsoleBaseUrl: string | null = null;
let apiBaseUrlPromise: Promise<string> | null = null;
let consoleBaseUrlPromise: Promise<string> | null = null;

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

async function isApiPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
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

export function invalidateApiCache(): void {
  cachedApiBaseUrl = null;
  cachedConsoleBaseUrl = null;
  apiBaseUrlPromise = null;
  consoleBaseUrlPromise = null;
}

export async function getApiBaseUrl(): Promise<string> {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  if (apiBaseUrlPromise) {
    return apiBaseUrlPromise;
  }

  apiBaseUrlPromise = (async () => {
    const stored = await readStoredApiPort();
    if (stored && (await isApiPortAvailable(stored))) {
      cachedApiBaseUrl = `http://127.0.0.1:${stored}/api`;
      return cachedApiBaseUrl;
    }

    const candidates = API_PORT_CANDIDATES.filter((port) => port !== stored);
    try {
      const port = await Promise.any(
        candidates.map(async (candidate) => {
          if (await isApiPortAvailable(candidate)) {
            return candidate;
          }
          throw new Error(`Port ${candidate} unavailable`);
        })
      );
      await writeStoredApiPort(port);
      cachedApiBaseUrl = `http://127.0.0.1:${port}/api`;
      return cachedApiBaseUrl;
    } catch {
      throw new Error("Polaris Core API not found on localhost");
    }
  })();

  try {
    return await apiBaseUrlPromise;
  } finally {
    apiBaseUrlPromise = null;
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
    const apiBaseUrl = await getApiBaseUrl();
    const apiUrl = new URL(apiBaseUrl);
    cachedConsoleBaseUrl = `http://${apiUrl.host}`;
    return cachedConsoleBaseUrl;
  })();

  try {
    return await consoleBaseUrlPromise;
  } finally {
    consoleBaseUrlPromise = null;
  }
}
