const API_PORT_STORAGE_KEY = "polaris.apiPort";
const API_PORT_QUERY_KEY = "apiPort";
const apiPortCandidates = Array.from({ length: 100 }, (_, index) => 9001 + index);
let cachedApiBaseUrl: string | null = null;

function readStoredPort(): number | null {
  const queryPort = new URLSearchParams(window.location.search).get(API_PORT_QUERY_KEY);
  if (queryPort && Number.isInteger(Number(queryPort))) {
    return Number(queryPort);
  }

  const stored = window.localStorage.getItem(API_PORT_STORAGE_KEY);
  return stored && Number.isInteger(Number(stored)) ? Number(stored) : null;
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

  const firstChoice = readStoredPort();
  const candidates = [...new Set([firstChoice, ...apiPortCandidates].filter((item): item is number => Boolean(item)))];

  for (const port of candidates) {
    if (await isApiPortAvailable(port)) {
      window.localStorage.setItem(API_PORT_STORAGE_KEY, String(port));
      cachedApiBaseUrl = `http://127.0.0.1:${port}/api`;
      return cachedApiBaseUrl;
    }
  }

  throw new Error("Polaris Core API not found on localhost");
}
