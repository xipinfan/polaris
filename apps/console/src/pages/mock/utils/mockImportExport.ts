import type { MockRule } from "@polaris/shared-types";
import type { GroupMetaMap } from "../types";
import { buildRuleName, getRuleScene } from "./mockHelpers";

export type ExportableMockRule = {
  group?: string;
  variant: string;
  method: string;
  url: string;
  requestBodyExactMatch?: string | null;
  requestBodyKeyMatch?: string | null;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  enabled: boolean;
};

export type ExportableMockGroup = {
  name: string;
  description?: string;
  rules: ExportableMockRule[];
};

export type MockRulePayload = {
  name: string;
  group: string;
  method: string;
  url: string;
  requestBodyExactMatch: string | null;
  requestBodyKeyMatch: string | null;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  enabled: boolean;
};

type MergeImportedRulesArgs = {
  createRule: (payload: MockRulePayload) => Promise<MockRule>;
  defaultGroup: string;
  existingRules: MockRule[];
  importedRules: ExportableMockRule[];
  targetGroup: string;
  updateRule: (id: string, payload: MockRulePayload) => Promise<unknown>;
};

type MergeImportedMockGroupsArgs = {
  createRule: (payload: MockRulePayload) => Promise<MockRule>;
  defaultGroup: string;
  existingCustomGroups: string[];
  existingRules: MockRule[];
  importedGroups: ExportableMockGroup[];
  onEnsureGroup: (groupName: string) => void;
  onUpdateGroupDescription: (groupName: string, description: string) => void;
  updateRule: (id: string, payload: MockRulePayload) => Promise<unknown>;
};

type ImportStats = {
  created: number;
  skipped: number;
  updated: number;
};

type MockRulePayloadOverrides = Partial<
  Omit<MockRulePayload, "group" | "name"> & {
    variant: string;
  }
>;

function createImportStats(): ImportStats {
  return { created: 0, skipped: 0, updated: 0 };
}

function isValidImportedRule(ruleEntry: ExportableMockRule) {
  const variant = String(ruleEntry?.variant ?? "").trim();
  const method = String(ruleEntry?.method ?? "").toUpperCase();
  const url = String(ruleEntry?.url ?? "").trim();

  if (!variant || !method || !url) {
    return null;
  }

  return { method, url, variant };
}

export function buildRuleCollisionKey(group: string, method: string, url: string, variant: string) {
  return `${group}__${method.toUpperCase()}__${url}__${variant}`;
}

export function buildMockRuleCollisionMap(rules: MockRule[], defaultGroup: string) {
  const collisionMap = new Map<string, MockRule>();

  for (const rule of rules) {
    const scene = getRuleScene(rule, defaultGroup);
    collisionMap.set(buildRuleCollisionKey(scene.group, rule.method, rule.url, scene.variant), rule);
  }

  return collisionMap;
}

export function buildMockRulePayload(group: string, ruleEntry: ExportableMockRule): MockRulePayload | null {
  const normalized = isValidImportedRule(ruleEntry);
  if (!normalized) {
    return null;
  }

  return {
    name: buildRuleName(group, normalized.variant),
    group,
    method: normalized.method,
    url: normalized.url,
    requestBodyExactMatch: String(ruleEntry.requestBodyExactMatch ?? "").trim() || null,
    requestBodyKeyMatch: String(ruleEntry.requestBodyKeyMatch ?? "").trim() || null,
    responseStatus: Number(ruleEntry.responseStatus) || 200,
    responseHeaders: (ruleEntry.responseHeaders ?? {}) as Record<string, string>,
    responseBody: ruleEntry.responseBody ?? {},
    enabled: Boolean(ruleEntry.enabled),
  };
}

export function buildMockRulePayloadFromRule(
  rule: MockRule,
  group: string,
  defaultGroup: string,
  overrides: MockRulePayloadOverrides = {},
): MockRulePayload {
  const scene = getRuleScene(rule, defaultGroup);
  const variant = overrides.variant ?? scene.variant;

  return {
    name: buildRuleName(group, variant),
    group,
    method: overrides.method ?? rule.method,
    url: overrides.url ?? rule.url,
    requestBodyExactMatch: overrides.requestBodyExactMatch ?? rule.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: overrides.requestBodyKeyMatch ?? rule.requestBodyKeyMatch ?? null,
    responseStatus: overrides.responseStatus ?? rule.responseStatus,
    responseHeaders: overrides.responseHeaders ?? rule.responseHeaders,
    responseBody: overrides.responseBody ?? rule.responseBody,
    enabled: overrides.enabled ?? rule.enabled,
  };
}

export function buildImportSummaryMessage(stats: ImportStats) {
  return `导入完成：新增 ${stats.created}，更新 ${stats.updated}，跳过 ${stats.skipped}`;
}

export function toExportableMockRule(
  rule: MockRule,
  defaultGroup: string,
  includeGroup: boolean,
): ExportableMockRule {
  const scene = getRuleScene(rule, defaultGroup);
  return {
    ...(includeGroup ? { group: scene.group } : {}),
    variant: scene.variant,
    method: rule.method,
    url: rule.url,
    requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
    responseStatus: rule.responseStatus,
    responseHeaders: rule.responseHeaders ?? {},
    responseBody: rule.responseBody ?? {},
    enabled: rule.enabled,
  };
}

export function exportMockGroupData(
  groupName: string,
  groupedRules: Record<string, MockRule[]>,
  groupMeta: GroupMetaMap,
  defaultGroup: string,
): ExportableMockGroup {
  return {
    name: groupName,
    description: groupMeta[groupName]?.description?.trim() || undefined,
    rules: (groupedRules[groupName] ?? []).map((rule) => toExportableMockRule(rule, defaultGroup, false)),
  };
}

export async function mergeImportedRulesIntoGroup({
  createRule,
  defaultGroup,
  existingRules,
  importedRules,
  targetGroup,
  updateRule,
}: MergeImportedRulesArgs) {
  if (!Array.isArray(importedRules) || importedRules.length === 0) {
    throw new Error("导入内容为空");
  }

  const collisionMap = buildMockRuleCollisionMap(existingRules, defaultGroup);
  const stats = createImportStats();

  for (const ruleEntry of importedRules) {
    const payload = buildMockRulePayload(targetGroup, ruleEntry);
    if (!payload) {
      stats.skipped += 1;
      continue;
    }

    const key = buildRuleCollisionKey(targetGroup, payload.method, payload.url, String(ruleEntry.variant).trim());
    const existing = collisionMap.get(key);

    if (existing) {
      await updateRule(existing.id, payload);
      stats.updated += 1;
      continue;
    }

    const createdRule = await createRule(payload);
    collisionMap.set(key, createdRule);
    stats.created += 1;
  }

  return stats;
}

export async function mergeImportedMockGroups({
  createRule,
  defaultGroup,
  existingCustomGroups,
  existingRules,
  importedGroups,
  onEnsureGroup,
  onUpdateGroupDescription,
  updateRule,
}: MergeImportedMockGroupsArgs) {
  if (!Array.isArray(importedGroups) || importedGroups.length === 0) {
    throw new Error("导入内容为空");
  }

  const knownGroups = new Set(existingCustomGroups);
  const collisionMap = buildMockRuleCollisionMap(existingRules, defaultGroup);
  const stats = createImportStats();

  for (const groupEntry of importedGroups) {
    const groupName = String(groupEntry?.name ?? "").trim();
    if (!groupName) {
      stats.skipped += 1;
      continue;
    }

    if (!knownGroups.has(groupName) && groupName !== defaultGroup) {
      knownGroups.add(groupName);
      onEnsureGroup(groupName);
    }

    if (groupEntry.description !== undefined) {
      onUpdateGroupDescription(groupName, String(groupEntry.description ?? "").trim());
    }

    for (const ruleEntry of groupEntry.rules ?? []) {
      const payload = buildMockRulePayload(groupName, ruleEntry);
      if (!payload) {
        stats.skipped += 1;
        continue;
      }

      const key = buildRuleCollisionKey(groupName, payload.method, payload.url, String(ruleEntry.variant).trim());
      const existing = collisionMap.get(key);

      if (existing) {
        await updateRule(existing.id, payload);
        stats.updated += 1;
        continue;
      }

      const createdRule = await createRule(payload);
      collisionMap.set(key, createdRule);
      stats.created += 1;
    }
  }

  return stats;
}
