import { getBrowserHostname, getBrowserPort, getBrowserQueryParam } from "../lib/browser/runtime";
import { persistenceKeys, readPersistence, writePersistence } from "../lib/persistence";

const API_PORT_QUERY_KEY = "apiPort";
const DEFAULT_API_PORT = 19601;
const API_PORT_SCAN_SIZE = 8;
let cachedApiBaseUrl: string | null = null;
let apiBaseUrlPromise: Promise<string> | null = null;

function getCurrentHostname(): string {
  return getBrowserHostname();
}

function readCurrentPort(): number | null {
  return getBrowserPort();
}

function readStoredPort(): number | null {
  const queryPort = getBrowserQueryParam(API_PORT_QUERY_KEY);
  if (queryPort && Number.isInteger(Number(queryPort))) {
    return Number(queryPort);
  }

  const stored = readPersistence<string | null>(persistenceKeys.apiPort, null);
  return stored && Number.isInteger(Number(stored)) ? Number(stored) : null;
}

function getApiPortCandidates(): number[] {
  const storedPort = readStoredPort();
  const currentPort = readCurrentPort();
  const nearbyDefaultPorts = Array.from({ length: API_PORT_SCAN_SIZE }, (_, index) => DEFAULT_API_PORT + index);
  return [...new Set([storedPort, currentPort, ...nearbyDefaultPorts].filter((item): item is number => Boolean(item)))];
}

async function isApiPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${getCurrentHostname()}:${port}/api/health`);
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
    const candidates = getApiPortCandidates();
    for (const port of candidates) {
      if (await isApiPortAvailable(port)) {
        writePersistence(persistenceKeys.apiPort, String(port));
        cachedApiBaseUrl = `http://${getCurrentHostname()}:${port}/api`;
        return cachedApiBaseUrl;
      }
    }

    throw new Error("Polaris Core API not found on current host");
  })();

  try {
    return await apiBaseUrlPromise;
  } finally {
    apiBaseUrlPromise = null;
  }
}
