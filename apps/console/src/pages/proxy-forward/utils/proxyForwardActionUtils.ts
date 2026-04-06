import type { StoredForwardRule, StoredGroup } from "../types";
import { createId, sanitizeText } from "./proxyForwardHelpers";
import {
  hasOtherEnabledRuleWithPattern,
  updateGroupRules,
} from "./proxyForwardPageHelpers";

type ImportSummary = {
  groupCreated: number;
  groupUpdated: number;
  ruleCreated: number;
  ruleUpdated: number;
  skipped: number;
};

type GroupSaveError = {
  error: string;
};

type GroupSaveSuccess = {
  nextActiveGroupId?: string;
  nextGroups: StoredGroup[];
  nextName: string;
};

type GroupDeleteError = {
  error: string;
};

type GroupDeleteSuccess = {
  isDeletingActive: boolean;
  nextActiveGroup: StoredGroup | null;
  nextActiveGroupId: string;
  nextGroups: StoredGroup[];
};

export function getGroupRules(groups: StoredGroup[], activeGroupId: string) {
  return groups.find((group) => group.id === activeGroupId)?.rules ?? [];
}

export function buildRuleToggleGroups(params: {
  activeGroupId: string;
  checked: boolean;
  groups: StoredGroup[];
  rule: StoredForwardRule;
}) {
  const { activeGroupId, checked, groups, rule } = params;
  return updateGroupRules(groups, activeGroupId, (activeRules) =>
    activeRules.map((item) => (item.id === rule.id ? { ...item, enabled: checked } : item)),
  );
}

export function buildRuleDeleteGroups(params: {
  activeGroupId: string;
  groups: StoredGroup[];
  ruleId: string;
}) {
  const { activeGroupId, groups, ruleId } = params;
  return updateGroupRules(groups, activeGroupId, (activeRules) =>
    activeRules.filter((item) => item.id !== ruleId),
  );
}

export function buildRuleSaveGroups(params: {
  activeGroupId: string;
  groups: StoredGroup[];
  nextRule: StoredForwardRule;
}) {
  const { activeGroupId, groups, nextRule } = params;
  return updateGroupRules(groups, activeGroupId, (activeRules) => {
    const exists = activeRules.some((rule) => rule.id === nextRule.id);
    return exists
      ? activeRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
      : [nextRule, ...activeRules];
  });
}

export function shouldRemoveRuleHost(params: {
  activeGroupId: string;
  excludeRuleId: string;
  groups: StoredGroup[];
  pattern: string;
}) {
  const { activeGroupId, excludeRuleId, groups, pattern } = params;
  return !hasOtherEnabledRuleWithPattern(pattern, excludeRuleId, getGroupRules(groups, activeGroupId));
}

export function buildGroupSaveGroups(params: {
  activeGroupId: string;
  editingGroup: StoredGroup | null;
  groupName: string;
  groups: StoredGroup[];
}): GroupSaveError | GroupSaveSuccess {
  const { activeGroupId, editingGroup, groupName, groups } = params;
  const nextName = sanitizeText(groupName, "");
  if (!nextName) {
    return {
      error: "请填写分组名称",
    };
  }

  if (editingGroup) {
    return {
      nextGroups: groups.map((group) =>
        group.id === editingGroup.id ? { ...group, name: nextName } : group,
      ),
      nextName,
    };
  }

  return {
    nextGroups: [...groups, { id: createId("proxy-group"), name: nextName, rules: [] }],
    nextName,
    nextActiveGroupId: activeGroupId,
  };
}

export function buildGroupDeletePlan(params: {
  activeGroupId: string;
  group: StoredGroup;
  groups: StoredGroup[];
}): GroupDeleteError | GroupDeleteSuccess {
  const { activeGroupId, group, groups } = params;
  if (groups.length <= 1) {
    return {
      error: "至少保留一个分组，无法删除",
    };
  }

  const nextGroups = groups.filter((item) => item.id !== group.id);
  const isDeletingActive = group.id === activeGroupId;
  const nextActiveGroupId = isDeletingActive ? (nextGroups[0]?.id ?? activeGroupId) : activeGroupId;
  const nextActiveGroup = nextGroups.find((item) => item.id === nextActiveGroupId) ?? null;

  return {
    isDeletingActive,
    nextActiveGroup,
    nextActiveGroupId,
    nextGroups,
  };
}

export function formatProxyImportSummary(summary: ImportSummary) {
  return `导入完成：新增分组 ${summary.groupCreated}，更新分组 ${summary.groupUpdated}，新增规则 ${summary.ruleCreated}，更新规则 ${summary.ruleUpdated}，跳过 ${summary.skipped}`;
}
