import { randomUUID } from "node:crypto";
import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule } from "@polaris/shared-types";
import { ExtensionHost } from "../extensions/extensionHost";
import { StorageAdapter } from "../storage/storageAdapter";
import { normalizeBody } from "../../shared/normalizeBody";
import { getRuleGroupName, hasBodyKeyPath, matchesExactBodyExpression } from "./mockMatchers";

const groupNamePattern = /^\[(.+?)\]\s*(.+)$/;
type GroupAwareInput = { group?: string | null };

function getRuleGroup(rule: MockRule): string | null {
  return getRuleGroupName(rule.name);
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

function normalizeBodyExactMatch(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const next = value.trim();
  return next ? next : null;
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
    const nextName = normalizeRuleNameForGroup(
      input.name,
      groupFromInput === undefined ? this.getActiveGroup() : groupFromInput
    );
    const rule: MockRule = {
      id: randomUUID(),
      name: nextName,
      method: input.method.toUpperCase(),
      url: input.url,
      requestBodyExactMatch: normalizeBodyExactMatch(input.requestBodyExactMatch),
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
        groupFromInput === undefined ? getRuleGroup(target) : groupFromInput
      ),
      method: input.method.toUpperCase(),
      requestBodyExactMatch: normalizeBodyExactMatch(input.requestBodyExactMatch),
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
    if (!rules.find((item) => item.id === id)) {
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

      if (!matchesExactBodyExpression(requestBody, rule.requestBodyExactMatch)) {
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
