import { randomUUID } from "node:crypto";
import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule } from "@polaris/shared-types";
import { ExtensionHost } from "../extensions/extensionHost";
import { StorageAdapter } from "../storage/storageAdapter";
import { normalizeBody } from "../../shared/normalizeBody";

const groupNamePattern = /^\[(.+?)\]\s*(.+)$/;
type GroupAwareInput = { group?: string | null };

function getRuleGroup(rule: MockRule): string | null {
  const match = rule.name.match(groupNamePattern);
  return match?.[1]?.trim() || null;
}

function normalizeRuleNameForGroup(name: string, group?: string | null): string {
  const trimmedName = name.trim();
  const match = trimmedName.match(groupNamePattern);
  const variantName = (match?.[2] ?? trimmedName).trim();
  const normalizedGroup = typeof group === "string" ? group.trim() : "";

  if (!normalizedGroup) {
    return trimmedName;
  }
  return `[${normalizedGroup}] ${variantName}`;
}

function normalizeBodyKeyMatch(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const next = value.trim();
  return next ? next : null;
}

function hasBodyKeyPath(value: unknown, keyPath: string): boolean {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const segments = keyPath
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object") {
      return false;
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

export class MockService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly extensionHost: ExtensionHost
  ) {}

  list(): MockRule[] {
    return this.storage.getMockRules();
  }

  getActiveGroup(): string | null {
    return this.storage.getSettings().activeMockGroup;
  }

  async setActiveGroup(group: string | null): Promise<string | null> {
    await this.storage.setSettings({
      ...this.storage.getSettings(),
      activeMockGroup: group
    });
    return group;
  }

  async create(input: CreateMockRuleInput): Promise<MockRule> {
    const now = new Date().toISOString();
    const groupFromInput = (input as CreateMockRuleInput & GroupAwareInput).group;
    const nextName = normalizeRuleNameForGroup(input.name, groupFromInput ?? this.getActiveGroup());
    const rule: MockRule = {
      id: randomUUID(),
      name: nextName,
      method: input.method.toUpperCase(),
      url: input.url,
      requestBodyKeyMatch: normalizeBodyKeyMatch(input.requestBodyKeyMatch),
      responseStatus: input.responseStatus,
      responseHeaders: input.responseHeaders ?? {},
      responseBody: normalizeBody(input.responseBody),
      enabled: input.enabled,
      hitCount: 0,
      createdAt: now,
      updatedAt: now
    };

    await this.extensionHost.emit("beforeMockCreate", rule);
    await this.storage.setMockRules([rule, ...this.list()]);
    await this.extensionHost.emit("afterMockCreate", rule);
    return rule;
  }

  async update(id: string, input: UpdateMockRuleInput): Promise<MockRule> {
    const target = this.list().find((item) => item.id === id);
    if (!target) {
      throw new Error("Mock rule not found");
    }

    const groupFromInput = (input as UpdateMockRuleInput & GroupAwareInput).group;
    const nextRule: MockRule = {
      ...target,
      ...input,
      name: normalizeRuleNameForGroup(
        input.name,
        groupFromInput ?? getRuleGroup(target),
      ),
      method: input.method.toUpperCase(),
      requestBodyKeyMatch: normalizeBodyKeyMatch(input.requestBodyKeyMatch),
      responseBody: normalizeBody(input.responseBody),
      updatedAt: new Date().toISOString()
    };

    await this.storage.setMockRules(this.list().map((item) => (item.id === id ? nextRule : item)));
    return nextRule;
  }

  async remove(id: string): Promise<void> {
    await this.storage.setMockRules(this.list().filter((item) => item.id !== id));
  }

  async toggle(id: string, enabled: boolean): Promise<MockRule> {
    const rules = this.list();
    const target = rules.find((item) => item.id === id);
    if (!target) {
      throw new Error("Mock rule not found");
    }

    const now = new Date().toISOString();
    const nextRules = rules.map((rule) => {
      if (rule.id === id) {
        return {
          ...rule,
          enabled,
          updatedAt: now
        };
      }

      if (
        enabled &&
        rule.enabled &&
        rule.method === target.method &&
        rule.url === target.url
      ) {
        return {
          ...rule,
          enabled: false,
          updatedAt: now
        };
      }

      return rule;
    });

    await this.storage.setMockRules(nextRules);
    return nextRules.find((rule) => rule.id === id)!;
  }

  async match(method: string, url: string, requestBody?: unknown): Promise<MockRule | undefined> {
    await this.extensionHost.emit("beforeMockMatch", { method, url, requestBody });
    const activeGroup = this.getActiveGroup();
    return this.list().find((rule) => {
      if (!rule.enabled || rule.method !== method.toUpperCase() || !url.includes(rule.url)) {
        return false;
      }

      if (rule.requestBodyKeyMatch && !hasBodyKeyPath(requestBody, rule.requestBodyKeyMatch)) {
        return false;
      }

      if (!activeGroup) {
        return true;
      }

      return getRuleGroup(rule) === activeGroup;
    });
  }

  async registerHit(ruleId: string): Promise<void> {
    const target = this.list().find((item) => item.id === ruleId);
    if (!target) {
      return;
    }

    const nextRule = {
      ...target,
      hitCount: target.hitCount + 1,
      lastHitAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.storage.setMockRules(this.list().map((item) => (item.id === ruleId ? nextRule : item)));
    await this.extensionHost.emit("afterMockHit", nextRule);
  }
}
