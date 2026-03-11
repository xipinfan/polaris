import { readFile, writeFile } from "node:fs/promises";
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

  async init(): Promise<void> {
    await ensurePolarisDir(storageDirName);
    await migrateLegacyFile(`${storageDirName}/${storageFileName}`);

    try {
      const raw = await readFile(storageFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<StorageSnapshot>;
      this.snapshot = {
        ...emptySnapshot,
        ...parsed,
        requests: parsed.requests ?? [],
        savedRequests: parsed.savedRequests ?? [],
        mockRules: parsed.mockRules ?? [],
        proxyRules: parsed.proxyRules ?? [],
        settings: {
          ...defaultSettings,
          ...(parsed.settings ?? {})
        }
      };
    } catch {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(() => writeFile(storageFile, JSON.stringify(this.snapshot, null, 2), "utf8"));
    await this.persistQueue;
  }

  getSettings(): AppSetting {
    return this.snapshot.settings;
  }

  async setSettings(settings: AppSetting): Promise<void> {
    this.snapshot.settings = settings;
    await this.persist();
  }

  getRequests(): RequestRecord[] {
    return [...this.snapshot.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async appendRequest(request: RequestRecord): Promise<void> {
    this.snapshot.requests = [request, ...this.snapshot.requests].slice(0, 200);
    await this.persist();
  }

  async clearRequests(): Promise<void> {
    this.snapshot.requests = [];
    await this.persist();
  }

  getSavedRequests(): SavedRequest[] {
    return [...this.snapshot.savedRequests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setSavedRequests(savedRequests: SavedRequest[]): Promise<void> {
    this.snapshot.savedRequests = savedRequests;
    await this.persist();
  }

  getMockRules(): MockRule[] {
    return [...this.snapshot.mockRules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setMockRules(mockRules: MockRule[]): Promise<void> {
    this.snapshot.mockRules = mockRules;
    await this.persist();
  }

  getProxyRules(): ProxyRule[] {
    return [...this.snapshot.proxyRules].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setProxyRules(proxyRules: ProxyRule[]): Promise<void> {
    this.snapshot.proxyRules = proxyRules;
    await this.persist();
  }
}
