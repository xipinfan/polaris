import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  AppSetting,
  MockRule,
  ProxyRule,
  RequestRecord,
  SavedRequest
} from "@polaris/shared-types";
import { defaultSettings } from "../../app/config";
import { ensurePolarisDir, getPolarisDataPath, migrateLegacyFile } from "../../app/paths";

interface StorageSnapshot {
  settings: AppSetting;
  requests: RequestRecord[];
  savedRequests: SavedRequest[];
  mockRules: MockRule[];
  proxyRules: ProxyRule[];
}

const storageDirName = "data";
const storageFileName = "polaris-v1.json";
const storageFile = getPolarisDataPath(storageDirName, storageFileName);
const DEBOUNCE_DELAY = 500;
const MAX_DEBOUNCE_DELAY = 2000;

const emptySnapshot: StorageSnapshot = {
  settings: defaultSettings,
  requests: [],
  savedRequests: [],
  mockRules: [],
  proxyRules: []
};

export class StorageAdapter {
  private snapshot: StorageSnapshot = emptySnapshot;
  private persistQueue: Promise<void> = Promise.resolve();
  private readonly readOnly: boolean;
  private dirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private firstDirtyTimestamp = 0;

  constructor(options?: { readOnly?: boolean }) {
    this.readOnly = options?.readOnly ?? false;
  }

  async init(): Promise<void> {
    await ensurePolarisDir(storageDirName);
    await migrateLegacyFile(`${storageDirName}/${storageFileName}`);

    try {
      const raw = await readFile(storageFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<StorageSnapshot>;
      const rawProxyRules = parsed.proxyRules ?? [];
      let proxyRulesChanged = false;
      const nextProxyRules = rawProxyRules.map((rule) => {
        if (rule && typeof rule.id === "string" && rule.id.trim()) {
          return rule;
        }
        proxyRulesChanged = true;
        return { ...rule, id: randomUUID() } as ProxyRule;
      });
      this.snapshot = {
        ...emptySnapshot,
        ...parsed,
        requests: parsed.requests ?? [],
        savedRequests: parsed.savedRequests ?? [],
        mockRules: parsed.mockRules ?? [],
        proxyRules: nextProxyRules,
        settings: {
          ...defaultSettings,
          ...(parsed.settings ?? {})
        }
      };
      if (proxyRulesChanged) {
        await this.persistImmediate();
      }
    } catch {
      await this.persistImmediate();
    }
  }

  private flushNow(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.dirty = false;
    this.firstDirtyTimestamp = 0;
    if (this.readOnly) {
      return;
    }

    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(() => writeFile(storageFile, JSON.stringify(this.snapshot, null, 2), "utf8"));
  }

  private schedulePersist(): void {
    if (this.readOnly) {
      return;
    }

    this.dirty = true;
    if (!this.firstDirtyTimestamp) {
      this.firstDirtyTimestamp = Date.now();
    }

    if (Date.now() - this.firstDirtyTimestamp >= MAX_DEBOUNCE_DELAY) {
      this.flushNow();
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.flushNow();
    }, DEBOUNCE_DELAY);
  }

  private async persistImmediate(): Promise<void> {
    this.flushNow();
    await this.persistQueue;
  }

  async flush(): Promise<void> {
    if (this.dirty) {
      this.flushNow();
    }
    await this.persistQueue;
  }

  getSettings(): AppSetting {
    return this.snapshot.settings;
  }

  async setSettings(settings: AppSetting): Promise<void> {
    this.snapshot.settings = settings;
    await this.persistImmediate();
  }

  getRequests(): RequestRecord[] {
    return [...this.snapshot.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  appendRequest(request: RequestRecord): void {
    this.snapshot.requests = [request, ...this.snapshot.requests].slice(0, 200);
    this.schedulePersist();
  }

  async clearRequests(): Promise<void> {
    this.snapshot.requests = [];
    await this.persistImmediate();
  }

  getSavedRequests(): SavedRequest[] {
    return [...this.snapshot.savedRequests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setSavedRequests(savedRequests: SavedRequest[]): Promise<void> {
    this.snapshot.savedRequests = savedRequests;
    await this.persistImmediate();
  }

  getMockRules(): MockRule[] {
    return [...this.snapshot.mockRules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setMockRules(mockRules: MockRule[]): Promise<void> {
    this.snapshot.mockRules = mockRules;
    await this.persistImmediate();
  }

  getProxyRules(): ProxyRule[] {
    return [...this.snapshot.proxyRules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setProxyRules(proxyRules: ProxyRule[]): Promise<void> {
    this.snapshot.proxyRules = proxyRules;
    await this.persistImmediate();
  }
}
