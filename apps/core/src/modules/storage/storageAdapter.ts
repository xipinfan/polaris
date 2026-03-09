import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AppSetting,
  MockRule,
  ProxyRule,
  RequestRecord,
  SavedRequest
} from "@polaris/shared-types";
import { defaultSettings } from "../../app/config";

interface StorageSnapshot {
  settings: AppSetting;
  requests: RequestRecord[];
  savedRequests: SavedRequest[];
  mockRules: MockRule[];
  proxyRules: ProxyRule[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageDir = path.resolve(__dirname, "../../../data");
const storageFile = path.join(storageDir, "polaris-v1.json");

const emptySnapshot: StorageSnapshot = {
  settings: defaultSettings,
  requests: [],
  savedRequests: [],
  mockRules: [],
  proxyRules: []
};

export class StorageAdapter {
  private snapshot: StorageSnapshot = emptySnapshot;

  async init(): Promise<void> {
    await mkdir(storageDir, { recursive: true });

    try {
      const raw = await readFile(storageFile, "utf8");
      const parsed = JSON.parse(raw) as Partial<StorageSnapshot>;
      const hadPersistedRequests =
        Array.isArray(parsed.requests) && parsed.requests.length > 0;
      this.snapshot = {
        ...emptySnapshot,
        ...parsed,
        requests: [],
        settings: {
          ...(parsed.settings ?? {}),
          ...defaultSettings
        }
      };
      if (hadPersistedRequests) {
        await this.persist();
      }
    } catch {
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    await writeFile(
      storageFile,
      JSON.stringify({ ...this.snapshot, requests: [] }, null, 2),
      "utf8",
    );
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
  }

  clearRequests(): void {
    this.snapshot.requests = [];
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
