import type { ServiceSnapshot } from "@polaris/shared-contracts";
import type { AppSetting, ServiceStatus } from "@polaris/shared-types";

type CacheEntry<T> = {
  value: T;
  savedAt: string;
};

const CACHE_PREFIX = "polaris.console.cache";
const BOOTSTRAP_CACHE_KEY = `${CACHE_PREFIX}.bootstrap`;
const SETTINGS_CACHE_KEY = `${CACHE_PREFIX}.settings`;
const HEALTH_CACHE_KEY = `${CACHE_PREFIX}.health`;

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: CacheEntry<T> = {
      value,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage errors so the network path remains the source of truth.
  }
}

export function readCachedBootstrap(): ServiceSnapshot | null {
  return readCache<ServiceSnapshot>(BOOTSTRAP_CACHE_KEY);
}

export function writeCachedBootstrap(snapshot: ServiceSnapshot): void {
  writeCache(BOOTSTRAP_CACHE_KEY, snapshot);
}

export function readCachedSettings(): AppSetting | null {
  return readCache<AppSetting>(SETTINGS_CACHE_KEY);
}

export function writeCachedSettings(settings: AppSetting): void {
  writeCache(SETTINGS_CACHE_KEY, settings);
}

export function readCachedHealth(): ServiceStatus | null {
  return readCache<ServiceStatus>(HEALTH_CACHE_KEY);
}

export function writeCachedHealth(status: ServiceStatus): void {
  writeCache(HEALTH_CACHE_KEY, status);
}
