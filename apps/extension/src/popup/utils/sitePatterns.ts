export function isIpOrLocalhost(host: string): boolean {
  return host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function getRegistrableDomain(host: string): string | null {
  const normalized = host.trim().toLowerCase();
  if (!normalized || isIpOrLocalhost(normalized)) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const sldSuffixes = new Set(["co.uk", "org.uk", "com.cn", "net.cn", "org.cn", "com.hk", "com.tw"]);
  const tail = segments.slice(-2).join(".");
  if (segments.length >= 3 && sldSuffixes.has(tail)) {
    return segments.slice(-3).join(".");
  }

  return segments.slice(-2).join(".");
}

export function buildSitePatterns(host: string): string[] {
  const normalized = host.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const patterns = new Set<string>([normalized]);
  const registrable = getRegistrableDomain(normalized);
  if (registrable && registrable !== normalized) {
    patterns.add(`*.${registrable}`);
  }

  return [...patterns];
}

export function matchesPattern(host: string, pattern: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();
  if (!normalizedHost || !normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
  }

  return normalizedHost === normalizedPattern;
}
