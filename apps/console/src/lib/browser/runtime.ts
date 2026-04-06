export function getBrowserHostname(fallback = "127.0.0.1") {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.location.hostname || fallback;
}

export function getBrowserPort() {
  if (typeof window === "undefined") {
    return null;
  }

  const currentPort = Number(window.location.port);
  return Number.isInteger(currentPort) && currentPort > 0 ? currentPort : null;
}

export function getBrowserQueryParam(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(key);
}

export function reloadBrowserWindow() {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}
