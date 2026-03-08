import { randomUUID } from "node:crypto";
import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule } from "@polaris/shared-types";
import { ExtensionHost } from "../extensions/extensionHost";
import { StorageAdapter } from "../storage/storageAdapter";
import { normalizeBody } from "../../shared/normalizeBody";

export class MockService {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly extensionHost: ExtensionHost
  ) {}

  list(): MockRule[] {
    return this.storage.getMockRules();
  }

  private async ensureSingleEnabledVariant(rule: MockRule): Promise<void> {
    if (!rule.enabled) {
      return;
    }

    const nextRules = this.list().map((item) => {
      if (item.id === rule.id) {
        return item;
      }

      if (item.method === rule.method && item.url === rule.url) {
        return { ...item, enabled: false, updatedAt: new Date().toISOString() };
      }

      return item;
    });

    await this.storage.setMockRules(nextRules);
  }

  async create(input: CreateMockRuleInput): Promise<MockRule> {
    const now = new Date().toISOString();
    const rule: MockRule = {
      id: randomUUID(),
      name: input.name,
      method: input.method.toUpperCase(),
      url: input.url,
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
    await this.ensureSingleEnabledVariant(rule);
    await this.extensionHost.emit("afterMockCreate", rule);
    return rule;
  }

  async update(id: string, input: UpdateMockRuleInput): Promise<MockRule> {
    const target = this.list().find((item) => item.id === id);
    if (!target) {
      throw new Error("Mock rule not found");
    }

    const nextRule: MockRule = {
      ...target,
      ...input,
      method: input.method.toUpperCase(),
      responseBody: normalizeBody(input.responseBody),
      updatedAt: new Date().toISOString()
    };

    await this.storage.setMockRules(this.list().map((item) => (item.id === id ? nextRule : item)));
    await this.ensureSingleEnabledVariant(nextRule);
    return nextRule;
  }

  async remove(id: string): Promise<void> {
    await this.storage.setMockRules(this.list().filter((item) => item.id !== id));
  }

  async toggle(id: string, enabled: boolean): Promise<MockRule> {
    const target = this.list().find((item) => item.id === id);
    if (!target) {
      throw new Error("Mock rule not found");
    }

    return this.update(id, {
      ...target,
      enabled
    });
  }

  async match(method: string, url: string): Promise<MockRule | undefined> {
    await this.extensionHost.emit("beforeMockMatch", { method, url });
    return this.list().find((rule) => rule.enabled && rule.method === method.toUpperCase() && rule.url === url);
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
