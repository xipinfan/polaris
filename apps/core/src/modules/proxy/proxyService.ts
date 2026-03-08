import { randomUUID } from "node:crypto";
import type { AppSetting, ProxyMode, ProxyRule } from "@polaris/shared-types";
import { StorageAdapter } from "../storage/storageAdapter";

export class ProxyService {
  constructor(private readonly storage: StorageAdapter) {}

  getSettings(): AppSetting {
    return this.storage.getSettings();
  }

  getMode(): ProxyMode {
    return this.storage.getSettings().currentProxyMode;
  }

  async setMode(mode: ProxyMode): Promise<ProxyMode> {
    const settings = this.storage.getSettings();
    await this.storage.setSettings({
      ...settings,
      currentProxyMode: mode
    });
    return mode;
  }

  listRules(): ProxyRule[] {
    return this.storage.getProxyRules();
  }

  isHostProxied(host: string): boolean {
    return this.listRules().some((rule) => rule.enabled && rule.action === "proxy" && rule.pattern === host);
  }

  async upsertSiteRule(host: string, action: "proxy" | "direct"): Promise<ProxyRule> {
    const now = new Date().toISOString();
    const rules = this.listRules();
    const existing = rules.find((rule) => rule.pattern === host);

    const nextRule: ProxyRule = existing
      ? { ...existing, action, enabled: true, updatedAt: now }
      : {
          id: randomUUID(),
          pattern: host,
          matchType: "host",
          action,
          enabled: true,
          createdAt: now,
          updatedAt: now
        };

    const nextRules = existing
      ? rules.map((rule) => (rule.id === existing.id ? nextRule : rule))
      : [nextRule, ...rules];

    await this.storage.setProxyRules(nextRules);
    return nextRule;
  }

  async removeSiteRule(host: string): Promise<void> {
    const nextRules = this.listRules().filter((rule) => rule.pattern !== host);
    await this.storage.setProxyRules(nextRules);
  }

  generatePacScript(): string {
    const rules = this.listRules()
      .filter((rule) => rule.enabled && rule.action === "proxy")
      .map((rule) => rule.pattern);
    const port = this.storage.getSettings().localProxyPort;

    return `
function FindProxyForURL(url, host) {
  const hosts = ${JSON.stringify(rules)};
  if (hosts.includes(host)) {
    return "PROXY 127.0.0.1:${port}";
  }
  return "DIRECT";
}`.trim();
  }
}
