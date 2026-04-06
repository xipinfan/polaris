import {
  asRecord,
  buildExportEnvelope,
  downloadJson,
} from "../../../features/common/importExport";
import type { StoredForwardRule, StoredGroup } from "../types";
import {
  buildEmptyRule,
  createId,
  derivePath,
  parseSourceUrl,
  sanitizeText,
} from "./proxyForwardHelpers";

type ImportProxyRule = {
  name?: string;
  pattern?: string;
  method?: string;
  url?: string;
  path?: string;
  action?: "proxy" | "direct";
  enabled?: boolean;
  targetUrl?: string;
};

type ImportProxyGroup = {
  name?: string;
  rules?: ImportProxyRule[];
};

type MergeProxyGroupsInput = {
  activeGroupId: string;
  groups: StoredGroup[];
  raw: unknown;
};

type MergeProxyGroupsResult = {
  nextGroups: StoredGroup[];
  nextActiveGroupId: string;
  importedCurrentActiveGroup: boolean;
  summary: {
    groupCreated: number;
    groupUpdated: number;
    ruleCreated: number;
    ruleUpdated: number;
    skipped: number;
  };
};

type NormalizedImportedRule = Pick<
  StoredForwardRule,
  "name" | "pattern" | "method" | "path" | "url" | "targetUrl" | "action" | "enabled"
>;

function buildRuleCollisionKey(rule: {
  pattern: string;
  method: string;
  path: string;
}) {
  return `${sanitizeText(rule.method, "GET").toUpperCase()}__${sanitizeText(rule.pattern, "").toLowerCase()}__${derivePath(rule.path)}`;
}

function getImportedGroups(raw: unknown) {
  const record = asRecord(raw);
  if (!record || record.kind !== "proxy-groups") {
    throw new Error("文件类型不匹配，需要导入 proxy-groups");
  }

  const payload = asRecord(record.payload);
  const importedGroups = Array.isArray(payload?.groups) ? (payload.groups as ImportProxyGroup[]) : [];
  if (!importedGroups.length) {
    throw new Error("导入内容为空");
  }

  return importedGroups;
}

function normalizeImportedRule(
  importedRule: ImportProxyRule,
  fallbackRule: StoredForwardRule,
): NormalizedImportedRule | null {
  const pattern = sanitizeText(importedRule.pattern, "").toLowerCase();
  if (!pattern) {
    return null;
  }

  const method = sanitizeText(importedRule.method, "GET").toUpperCase();
  const path = derivePath(importedRule.path ?? parseSourceUrl(importedRule.url)?.path ?? "/");

  return {
    name: sanitizeText(importedRule.name, sanitizeText(importedRule.url, pattern)),
    pattern,
    method,
    path,
    url: sanitizeText(importedRule.url, `https://${pattern}${path}`),
    targetUrl: sanitizeText(importedRule.targetUrl, fallbackRule.targetUrl),
    action: importedRule.action === "direct" ? "direct" : "proxy",
    enabled: Boolean(importedRule.enabled),
  };
}

function createImportedRule(
  fallbackRule: StoredForwardRule,
  importedRule: NormalizedImportedRule,
): StoredForwardRule {
  const now = new Date().toISOString();
  return {
    ...fallbackRule,
    ...importedRule,
    id: createId("proxy-rule"),
    createdAt: now,
    updatedAt: now,
  };
}

function updateImportedRule(
  existingRule: StoredForwardRule,
  importedRule: NormalizedImportedRule,
): StoredForwardRule {
  return {
    ...existingRule,
    ...importedRule,
    updatedAt: new Date().toISOString(),
  };
}

function mergeRulesIntoExistingGroup(
  existingGroup: StoredGroup,
  importedRules: ImportProxyRule[],
  fallbackRule: StoredForwardRule,
) {
  const indexByKey = new Map(
    existingGroup.rules.map((rule) => [buildRuleCollisionKey(rule), rule] as const),
  );
  const mergedRules = [...existingGroup.rules];
  let ruleCreated = 0;
  let ruleUpdated = 0;
  let skipped = 0;

  for (const importedRule of importedRules) {
    const normalizedRule = normalizeImportedRule(importedRule, fallbackRule);
    if (!normalizedRule) {
      skipped += 1;
      continue;
    }

    const key = buildRuleCollisionKey(normalizedRule);
    const existingRule = indexByKey.get(key);
    if (existingRule) {
      const index = mergedRules.findIndex((rule) => rule.id === existingRule.id);
      if (index >= 0) {
        mergedRules[index] = updateImportedRule(existingRule, normalizedRule);
        ruleUpdated += 1;
      }
      continue;
    }

    mergedRules.unshift(createImportedRule(fallbackRule, normalizedRule));
    ruleCreated += 1;
  }

  return {
    rules: mergedRules,
    ruleCreated,
    ruleUpdated,
    skipped,
  };
}

function buildImportedGroupRules(importedRules: ImportProxyRule[], fallbackRule: StoredForwardRule) {
  const rules: StoredForwardRule[] = [];
  let skipped = 0;

  for (const importedRule of importedRules) {
    const normalizedRule = normalizeImportedRule(importedRule, fallbackRule);
    if (!normalizedRule) {
      skipped += 1;
      continue;
    }

    rules.push(createImportedRule(fallbackRule, normalizedRule));
  }

  return {
    rules,
    skipped,
    ruleCreated: rules.length,
  };
}

export function exportProxyGroup(group: StoredGroup) {
  const envelope = buildExportEnvelope("proxy-groups", {
    groups: [
      {
        name: group.name,
        rules: group.rules.map((rule) => ({
          name: rule.name,
          pattern: rule.pattern,
          method: rule.method,
          url: rule.url,
          path: rule.path,
          action: rule.action,
          enabled: rule.enabled,
          targetUrl: rule.targetUrl,
        })),
      },
    ],
  });

  downloadJson(`proxy-group-${group.name}-${Date.now()}.json`, envelope);
}

export function mergeImportedProxyGroups({
  activeGroupId,
  groups,
  raw,
}: MergeProxyGroupsInput): MergeProxyGroupsResult {
  const importedGroups = getImportedGroups(raw);

  let groupCreated = 0;
  let groupUpdated = 0;
  let ruleCreated = 0;
  let ruleUpdated = 0;
  let skipped = 0;

  const nextGroups = [...groups];
  const activeGroupName =
    groups.find((group) => group.id === activeGroupId)?.name ?? "";
  const importedGroupNames = new Set<string>();

  for (const importedGroup of importedGroups) {
    const groupName = sanitizeText(importedGroup?.name, "");
    if (!groupName) {
      skipped += 1;
      continue;
    }
    importedGroupNames.add(groupName);

    const existingGroupIndex = nextGroups.findIndex(
      (group) => sanitizeText(group.name, "").toLowerCase() === groupName.toLowerCase(),
    );
    const fallbackRule = buildEmptyRule(groupName);
    const importedRules = Array.isArray(importedGroup.rules) ? importedGroup.rules : [];

    if (existingGroupIndex < 0) {
      const newGroupRules = buildImportedGroupRules(importedRules, fallbackRule);
      ruleCreated += newGroupRules.ruleCreated;
      skipped += newGroupRules.skipped;

      nextGroups.push({
        id: createId("proxy-group"),
        name: groupName,
        rules: newGroupRules.rules,
      });
      groupCreated += 1;
      continue;
    }

    const existingGroup = nextGroups[existingGroupIndex];
    const mergedGroup = mergeRulesIntoExistingGroup(existingGroup, importedRules, fallbackRule);
    ruleCreated += mergedGroup.ruleCreated;
    ruleUpdated += mergedGroup.ruleUpdated;
    skipped += mergedGroup.skipped;

    nextGroups[existingGroupIndex] = { ...existingGroup, rules: mergedGroup.rules };
    groupUpdated += 1;
  }

  const nextActiveGroupId = nextGroups.some(
    (group) => group.id === activeGroupId,
  )
    ? activeGroupId
    : (nextGroups[0]?.id ?? activeGroupId);

  return {
    nextGroups,
    nextActiveGroupId,
    importedCurrentActiveGroup: importedGroupNames.has(activeGroupName),
    summary: {
      groupCreated,
      groupUpdated,
      ruleCreated,
      ruleUpdated,
      skipped,
    },
  };
}
