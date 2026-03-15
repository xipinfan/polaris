import { randomUUID } from "node:crypto";
import type { AppSetting, ProxyMode, ProxyRule } from "@polaris/shared-types";
import { StorageAdapter } from "../storage/storageAdapter";

export class ProxyService {
  constructor(private readonly storage: StorageAdapter) {}

  private normalizePattern(pattern: string): string {
    return pattern.trim().toLowerCase().replace(/:\d+$/, "");
  }

  private matchesHostPattern(host: string, pattern: string): boolean {
    const normalizedHost = this.normalizePattern(host);
    const normalizedPattern = this.normalizePattern(pattern);

    if (normalizedPattern.startsWith("*.")) {
      const suffix = normalizedPattern.slice(2);
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`);
    }

    return normalizedHost === normalizedPattern;
  }

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

  async setCertificateInstalled(certificateInstalled: boolean): Promise<AppSetting> {
    const settings = this.storage.getSettings();
    const nextSettings = {
      ...settings,
      certificateInstalled
    };
    await this.storage.setSettings(nextSettings);
    return nextSettings;
  }

  async setSettings(settings: AppSetting): Promise<AppSetting> {
    await this.storage.setSettings(settings);
    return settings;
  }

  listRules(): ProxyRule[] {
    return this.storage.getProxyRules();
  }

  isHostProxied(host: string): boolean {
    return this.listRules().some(
      (rule) => rule.enabled && rule.action === "proxy" && this.matchesHostPattern(host, rule.pattern)
    );
  }

  async upsertSiteRule(host: string, action: "proxy" | "direct"): Promise<ProxyRule> {
    const pattern = this.normalizePattern(host);
    const now = new Date().toISOString();
    const rules = this.listRules();
    const existing = rules.find((rule) => this.normalizePattern(rule.pattern) === pattern);

    const nextRule: ProxyRule = existing
      ? { ...existing, action, enabled: true, updatedAt: now }
      : {
          id: randomUUID(),
          pattern,
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
    const pattern = this.normalizePattern(host);
    const nextRules = this.listRules().filter((rule) => this.normalizePattern(rule.pattern) !== pattern);
    await this.storage.setProxyRules(nextRules);
  }

  generatePacScript(): string {
    const rules = this.listRules()
      .filter((rule) => rule.enabled && rule.action === "proxy")
      .map((rule) => rule.pattern);
    const port = this.storage.getSettings().localProxyPort;

    return `
function matchesHost(host, pattern) {
  if (pattern.indexOf("*.") === 0) {
    const suffix = pattern.slice(2);
    return host === suffix || host.endsWith("." + suffix);
  }
  return host === pattern;
}

function FindProxyForURL(url, host) {
  const patterns = ${JSON.stringify(rules)};
  const normalizedHost = String(host || "").toLowerCase();
  for (let i = 0; i < patterns.length; i += 1) {
    if (matchesHost(normalizedHost, String(patterns[i] || "").toLowerCase())) {
      return "PROXY 127.0.0.1:${port}";
    }
  }
  return "DIRECT";
}`.trim();
  }
}
