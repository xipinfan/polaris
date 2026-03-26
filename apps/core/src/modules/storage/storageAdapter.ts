import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  AppSetting,
  JsonValue,
  MockRule,
  ProxyRule,
  RequestRecord,
  SavedRequest
} from "@polaris/shared-types";
import { defaultSettings } from "../../app/config";
import { ensurePolarisDir, getPolarisDataPath, migrateLegacyFile } from "../../app/paths";
import { RequestStore } from "./requestStore";

interface StorageSnapshot {
  settings: AppSetting;
  savedRequests: SavedRequest[];
  mockRules: MockRule[];
  proxyRules: ProxyRule[];
}

interface LegacyStorageSnapshot extends StorageSnapshot {
  requests?: RequestRecord[];
}

const storageDirName = "data";
const storageFileName = "polaris-v1.json";
const storageFile = getPolarisDataPath(storageDirName, storageFileName);
const DEBOUNCE_DELAY = 500;
const MAX_DEBOUNCE_DELAY = 2000;

function truncateBody(body: string | JsonValue | null, maxSize: number): string | JsonValue | null {
  if (body == null || maxSize <= 0) {
    return body;
  }

  const serialized = JSON.stringify(body);
  if (typeof serialized !== "string") {
    return body;
  }

  if (serialized.length <= maxSize) {
    return body;
  }

  return `[truncated, original size: ${serialized.length} chars]`;
}

const emptySnapshot: StorageSnapshot = {
  settings: defaultSettings,
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
  private requestStore = new RequestStore(defaultSettings.maxRequestCount);

  constructor(options?: { readOnly?: boolean }) {
    this.readOnly = options?.readOnly ?? false;
  }

  async init(): Promise<void> {
    await ensurePolarisDir(storageDirName);
    await migrateLegacyFile(`${storageDirName}/${storageFileName}`);

    try {
      const raw = await readFile(storageFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<LegacyStorageSnapshot>;
      const rawProxyRules = parsed.proxyRules ?? [];
      let proxyRulesChanged = false;
      let needsPersist = false;
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
        savedRequests: parsed.savedRequests ?? [],
        mockRules: parsed.mockRules ?? [],
        proxyRules: nextProxyRules,
        settings: {
          ...defaultSettings,
          ...(parsed.settings ?? {})
        }
      };

      delete (this.snapshot as LegacyStorageSnapshot).requests;
      if ((parsed.requests ?? []).length > 0) {
        needsPersist = true;
      }

      this.requestStore = new RequestStore(this.snapshot.settings.maxRequestCount);
      for (const record of (parsed.requests ?? []).slice().reverse()) {
        this.requestStore.append(record);
      }

      if (proxyRulesChanged || needsPersist) {
        await this.persistImmediate();
      }
    } catch {
      this.requestStore = new RequestStore(defaultSettings.maxRequestCount);
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
    const previousMaxRequestCount = this.snapshot.settings.maxRequestCount;
    this.snapshot.settings = settings;
    await this.persistImmediate();
    if (previousMaxRequestCount !== settings.maxRequestCount) {
      this.requestStore.resize(settings.maxRequestCount);
    }
  }

  getRequests(): RequestRecord[] {
    return this.requestStore.toArray();
  }

  getRequestById(id: string): RequestRecord | undefined {
    return this.requestStore.getById(id);
  }

  appendRequest(request: RequestRecord): void {
    const maxRequestBodySize = this.snapshot.settings.maxRequestBodySize;
    this.requestStore.append({
      ...request,
      requestBody: truncateBody(request.requestBody, maxRequestBodySize),
      responseBody: truncateBody(request.responseBody, maxRequestBodySize)
    });
  }

  async clearRequests(): Promise<void> {
    this.requestStore.clear();
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
