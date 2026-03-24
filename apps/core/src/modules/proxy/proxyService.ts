import { randomUUID } from "node:crypto";
import type { AppSetting, ProxyMode, ProxyRule } from "@polaris/shared-types";
import { StorageAdapter } from "../storage/storageAdapter";

type UpsertSiteRuleInput = {
  host: string;
  action: "proxy" | "direct";
  forwardMode?: ProxyRule["forwardMode"];
  targetUrl?: ProxyRule["targetUrl"];
  rewriteHost?: ProxyRule["rewriteHost"];
  rewritePath?: ProxyRule["rewritePath"];
};

export interface ProxyForwardDecision {
  mode: "proxy_forward" | "direct";
  source: "proxy_rules" | "proxy_global" | "none";
  matchedRuleId?: string;
  matchedRuleName?: string;
  forwardMode?: ProxyRule["forwardMode"];
  targetUrl?: string;
  rewriteHost?: string;
  rewritePath?: string;
  reason: string;
}

export class ProxyService {
  constructor(private readonly storage: StorageAdapter) {}
  private readonly allowedModes: ProxyMode[] = ["direct", "global", "rules", "system"];
  private readonly allowedActions: Array<ProxyRule["action"]> = ["proxy", "direct"];

  private normalizePattern(pattern: string): string {
    return String(pattern ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  }

  private isValidRule(rule: Partial<ProxyRule> | undefined): rule is ProxyRule {
    if (!rule) {
      return false;
    }

    const normalizedPattern = this.normalizePattern(rule.pattern ?? "");
    return (
      typeof rule.id === "string" &&
      normalizedPattern.length > 0 &&
      rule.matchType === "host" &&
      (rule.action === "proxy" || rule.action === "direct") &&
      typeof rule.enabled === "boolean" &&
      typeof rule.createdAt === "string" &&
      typeof rule.updatedAt === "string"
    );
  }

  private normalizedRules(): ProxyRule[] {
    return this.storage
      .getProxyRules()
      .filter((rule) => this.isValidRule(rule))
      .map((rule) => ({
        ...rule,
        pattern: this.normalizePattern(rule.pattern)
      }))
      .filter((rule) => rule.pattern.length > 0);
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
    if (!this.allowedModes.includes(mode)) {
      throw new Error("Invalid proxy mode");
    }
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
    return this.normalizedRules();
  }

  getForwardDecision(host: string): ProxyForwardDecision {
    const normalizedHost = this.normalizePattern(host);
    const mode = this.getMode();

    if (!normalizedHost) {
      return {
        mode: "direct",
        source: "none",
        reason: "Host is empty"
      };
    }

    const matchedRule = this.listRules().find((rule) => rule.enabled && this.matchesHostPattern(normalizedHost, rule.pattern));
    if (matchedRule) {
      return {
        mode: matchedRule.action === "proxy" ? "proxy_forward" : "direct",
        source: "proxy_rules",
        matchedRuleId: matchedRule.id,
        matchedRuleName: matchedRule.pattern,
        forwardMode: matchedRule.forwardMode,
        targetUrl: matchedRule.targetUrl,
        rewriteHost: matchedRule.rewriteHost,
        rewritePath: matchedRule.rewritePath,
        reason: `Matched rule ${matchedRule.pattern} (${matchedRule.action})`
      };
    }

    if (mode === "global") {
      return {
        mode: "proxy_forward",
        source: "proxy_global",
        reason: "Proxy mode is global"
      };
    }

    if (mode === "rules") {
      return {
        mode: "direct",
        source: "none",
        reason: "No enabled proxy rule matched host"
      };
    }

    return {
      mode: "direct",
      source: "none",
      reason: `Proxy mode is ${mode}`
    };
  }

  isHostProxied(host: string): boolean {
    return this.getForwardDecision(host).mode === "proxy_forward";
  }

  async upsertSiteRule(input: UpsertSiteRuleInput): Promise<ProxyRule> {
    const { action } = input;
    if (!this.allowedActions.includes(action)) {
      throw new Error("Invalid proxy action");
    }
    const pattern = this.normalizePattern(input.host);
    if (!pattern) {
      throw new Error("Host is required");
    }
    const now = new Date().toISOString();
    const rules = this.listRules();
    const existing = rules.find((rule) => this.normalizePattern(rule.pattern) === pattern);

    const nextRule: ProxyRule = existing
      ? {
          ...existing,
          action,
          forwardMode: input.forwardMode,
          targetUrl: input.targetUrl,
          rewriteHost: input.rewriteHost,
          rewritePath: input.rewritePath,
          enabled: true,
          updatedAt: now
        }
      : {
          id: randomUUID(),
          pattern,
          matchType: "host",
          action,
          forwardMode: input.forwardMode,
          targetUrl: input.targetUrl,
          rewriteHost: input.rewriteHost,
          rewritePath: input.rewritePath,
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
    if (!pattern) {
      throw new Error("Host is required");
    }
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
