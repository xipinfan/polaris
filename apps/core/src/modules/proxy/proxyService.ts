import { randomUUID } from "node:crypto";
import type { AppSetting, ProxyMode, ProxyRule } from "@polaris/shared-types";
import { StorageAdapter } from "../storage/storageAdapter";
import type { SystemProxyManager } from "./systemProxy";

type UpsertSiteRuleInput = {
  id?: string;
  host: string;
  path?: string;
  method?: string;
  action: "proxy" | "direct";
  enabled?: boolean;
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
  constructor(
    private readonly storage: StorageAdapter,
    private readonly systemProxyManager: SystemProxyManager,
  ) {}

  private readonly allowedModes: ProxyMode[] = ["direct", "global", "rules", "system"];
  private readonly allowedActions: Array<ProxyRule["action"]> = ["proxy", "direct"];

  private normalizePattern(pattern: string): string {
    return String(pattern ?? "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/:\d+$/, "");
  }

  private normalizeMethod(method: string | null | undefined): string | undefined {
    const normalized = String(method ?? "").trim().toUpperCase();
    if (!normalized || normalized === "ALL" || normalized === "*") {
      return undefined;
    }
    return normalized;
  }

  private normalizePath(input: string | null | undefined): string | undefined {
    const raw = String(input ?? "").trim();
    if (!raw || raw === "/") {
      return undefined;
    }

    const pathOnly = raw.split("?")[0] ?? raw;
    const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
    const collapsed = normalized.replace(/\/{2,}/g, "/");
    if (collapsed === "/") {
      return undefined;
    }
    return collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
  }

  private isValidRule(rule: Partial<ProxyRule> | undefined): rule is ProxyRule {
    if (!rule) {
      return false;
    }

    const normalizedPattern = this.normalizePattern(rule.pattern ?? "");
    const matchType = rule.matchType;
    return (
      typeof rule.id === "string" &&
      normalizedPattern.length > 0 &&
      (matchType == null || matchType === "host" || matchType === "host+path") &&
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
      .map((rule) => {
        const path = this.normalizePath(rule.path);
        const method = this.normalizeMethod(rule.method);
        const matchType = rule.matchType ?? (path ? "host+path" : "host");
        return {
          ...rule,
          pattern: this.normalizePattern(rule.pattern),
          matchType,
          path: matchType === "host+path" ? path : undefined,
          method,
        };
      })
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

  private matchesPath(rulePath: string | undefined, requestPath: string | undefined): boolean {
    const normalizedRulePath = this.normalizePath(rulePath);
    if (!normalizedRulePath) {
      return true;
    }

    const normalizedRequestPath = this.normalizePath(requestPath) ?? "/";
    return (
      normalizedRequestPath === normalizedRulePath ||
      normalizedRequestPath.startsWith(`${normalizedRulePath}/`)
    );
  }

  private matchesMethod(ruleMethod: string | undefined, requestMethod: string | undefined): boolean {
    const normalizedRuleMethod = this.normalizeMethod(ruleMethod);
    if (!normalizedRuleMethod) {
      return true;
    }
    const normalizedRequestMethod = this.normalizeMethod(requestMethod) ?? "GET";
    return normalizedRequestMethod === normalizedRuleMethod;
  }

  private ruleMatchScore(rule: ProxyRule): number {
    let score = 0;
    if (this.normalizePath(rule.path)) {
      score += 2;
    }
    if (this.normalizeMethod(rule.method)) {
      score += 1;
    }
    return score;
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
      currentProxyMode: mode,
    });
    return mode;
  }

  async setCertificateInstalled(certificateInstalled: boolean): Promise<AppSetting> {
    const settings = this.storage.getSettings();
    const nextSettings = {
      ...settings,
      certificateInstalled,
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

  getForwardDecision(
    host: string,
    requestPath?: string,
    requestMethod?: string,
  ): ProxyForwardDecision {
    const normalizedHost = this.normalizePattern(host);
    const mode = this.getMode();

    if (!normalizedHost) {
      return {
        mode: "direct",
        source: "none",
        reason: "Host is empty",
      };
    }

    const matchedRule = this.listRules()
      .filter(
        (rule) =>
          rule.enabled &&
          this.matchesHostPattern(normalizedHost, rule.pattern) &&
          this.matchesPath(rule.path, requestPath) &&
          this.matchesMethod(rule.method, requestMethod),
      )
      .sort((left, right) => {
        const score = this.ruleMatchScore(right) - this.ruleMatchScore(left);
        if (score !== 0) {
          return score;
        }
        const pathLength =
          (this.normalizePath(right.path)?.length ?? 0) -
          (this.normalizePath(left.path)?.length ?? 0);
        if (pathLength !== 0) {
          return pathLength;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0];

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
        reason: `Matched rule ${matchedRule.pattern} (${matchedRule.action})`,
      };
    }

    if (mode === "global") {
      return {
        mode: "proxy_forward",
        source: "proxy_global",
        reason: "Proxy mode is global",
      };
    }

    if (mode === "rules") {
      return {
        mode: "direct",
        source: "none",
        reason: "No enabled proxy rule matched request",
      };
    }

    return {
      mode: "direct",
      source: "none",
      reason: `Proxy mode is ${mode}`,
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

    const targetUrl = input.targetUrl
      ? (/^https?:\/\//i.test(input.targetUrl) ? input.targetUrl : `http://${input.targetUrl}`)
      : undefined;
    const rewriteHost = input.rewriteHost ? input.rewriteHost.replace(/^https?:\/\//i, "") : undefined;

    const normalizedPath = this.normalizePath(input.path);
    const normalizedMethod = this.normalizeMethod(input.method);
    const matchType: ProxyRule["matchType"] = normalizedPath ? "host+path" : "host";
    const now = new Date().toISOString();
    const rules = this.listRules();
    const existing = input.id ? rules.find((rule) => rule.id === input.id) : undefined;

    const nextRule: ProxyRule = existing
      ? {
          ...existing,
          pattern,
          matchType,
          path: matchType === "host+path" ? normalizedPath : undefined,
          method: normalizedMethod,
          action,
          forwardMode: input.forwardMode,
          targetUrl,
          rewriteHost,
          rewritePath: input.rewritePath,
          enabled: input.enabled ?? existing.enabled ?? true,
          updatedAt: now,
        }
      : {
          id: input.id ?? randomUUID(),
          pattern,
          matchType,
          path: matchType === "host+path" ? normalizedPath : undefined,
          method: normalizedMethod,
          action,
          forwardMode: input.forwardMode,
          targetUrl,
          rewriteHost,
          rewritePath: input.rewritePath,
          enabled: input.enabled ?? true,
          createdAt: now,
          updatedAt: now,
        };

    const nextRules = existing
      ? rules.map((rule) => (rule.id === existing.id ? nextRule : rule))
      : [nextRule, ...rules];

    await this.storage.setProxyRules(nextRules);
    return nextRule;
  }

  async removeRuleById(id: string): Promise<void> {
    const normalizedId = String(id ?? "").trim();
    if (!normalizedId) {
      throw new Error("Rule id is required");
    }
    const nextRules = this.listRules().filter((rule) => rule.id !== normalizedId);
    await this.storage.setProxyRules(nextRules);
  }

  async removeSiteRule(host: string): Promise<void> {
    const pattern = this.normalizePattern(host);
    if (!pattern) {
      throw new Error("Host is required");
    }
    const nextRules = this.listRules().filter(
      (rule) => this.normalizePattern(rule.pattern) !== pattern,
    );
    await this.storage.setProxyRules(nextRules);
  }

  async enableSystemProxy(): Promise<void> {
    const settings = this.getSettings();
    await this.systemProxyManager.enable("127.0.0.1", settings.localProxyPort);
  }

  async disableSystemProxy(): Promise<void> {
    await this.systemProxyManager.disable();
  }

  async isSystemProxyEnabled(): Promise<boolean> {
    return this.systemProxyManager.isEnabled();
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
