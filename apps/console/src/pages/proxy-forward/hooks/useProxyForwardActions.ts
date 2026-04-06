import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { pickJsonFile } from "../../../features/common/importExport";
import type { useToast } from "../../../features/feedback/ToastProvider";
import { toUserMessage } from "../../../lib/errors/userMessage";
import { writePersistence } from "../../../lib/persistence";
import { queryKeys } from "../../../lib/query/queryKeys";
import { toastQueryError } from "../../../lib/query/queryOptions";
import type {
  useRemoveProxyForwardSiteRuleMutation,
  useSetActiveProxyForwardGroupMutation,
  useUpsertProxyForwardSiteRuleMutation,
} from "../../../domains/proxy-forward/mutations";
import type { useProxyForwardGroupsQuery } from "../../../domains/proxy-forward/queries";
import type { useTrafficRequestsQuery } from "../../../domains/traffic/queries";
import type { StoredForwardRule, StoredGroup } from "../types";
import {
  activeGroupStorageKey,
  groupsStorageKey,
} from "../utils/proxyForwardHelpers";
import {
  buildGroupDeletePlan,
  buildGroupSaveGroups,
  buildRuleDeleteGroups,
  buildRuleSaveGroups,
  buildRuleToggleGroups,
  formatProxyImportSummary,
  shouldRemoveRuleHost,
} from "../utils/proxyForwardActionUtils";
import {
  exportProxyGroup,
  mergeImportedProxyGroups,
} from "../utils/proxyForwardImportExport";
import {
  buildSavedRule,
  hasRefetchFailure,
  normalizeRuleHost,
} from "../utils/proxyForwardPageHelpers";

type ShowToast = ReturnType<typeof useToast>["showToast"];

type UseProxyForwardActionsParams = {
  activeGroup: StoredGroup | undefined;
  activeGroupId: string;
  editingGroup: StoredGroup | null;
  editingRule: StoredForwardRule | null;
  groupName: string;
  groups: StoredGroup[];
  groupsQuery: ReturnType<typeof useProxyForwardGroupsQuery>;
  removeRuleMutation: ReturnType<typeof useRemoveProxyForwardSiteRuleMutation>;
  ruleForm: StoredForwardRule;
  setActiveGroupId: (groupId: string) => void;
  setActiveGroupMutation: ReturnType<typeof useSetActiveProxyForwardGroupMutation>;
  setIsGroupModalOpen: (open: boolean) => void;
  setIsRuleModalOpen: (open: boolean) => void;
  setProxyFilterMode: (mode: "all" | "enabled" | "hits" | "errors") => void;
  setProxyRuleSearch: (value: string) => void;
  setSubmitting: (submitting: boolean) => void;
  showToast: ShowToast;
  submitting: boolean;
  trafficQuery: ReturnType<typeof useTrafficRequestsQuery>;
  upsertRuleMutation: ReturnType<typeof useUpsertProxyForwardSiteRuleMutation>;
};

export function useProxyForwardActions({
  activeGroup,
  activeGroupId,
  editingGroup,
  editingRule,
  groupName,
  groups,
  groupsQuery,
  removeRuleMutation,
  ruleForm,
  setActiveGroupId,
  setActiveGroupMutation,
  setIsGroupModalOpen,
  setIsRuleModalOpen,
  setProxyFilterMode,
  setProxyRuleSearch,
  setSubmitting,
  showToast,
  submitting,
  trafficQuery,
  upsertRuleMutation,
}: UseProxyForwardActionsParams) {
  const queryClient = useQueryClient();
  const [pendingRuleIds, setPendingRuleIds] = useState<Record<string, boolean>>({});

  const commitGroups = (nextGroups: StoredGroup[], nextActiveGroupId: string) => {
    writePersistence(groupsStorageKey, nextGroups);
    writePersistence(activeGroupStorageKey, nextActiveGroupId);
    setActiveGroupId(nextActiveGroupId);
    queryClient.setQueryData(queryKeys.proxyForward.groups, {
      groups: nextGroups,
      activeGroupId: nextActiveGroupId,
    });
  };

  const setRulePending = (ruleId: string, pending: boolean) => {
    setPendingRuleIds((current) => {
      if (pending) {
        return { ...current, [ruleId]: true };
      }
      const { [ruleId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const exportGroupAction = (group: StoredGroup) => {
    exportProxyGroup(group);
    showToast(`分组「${group.name}」已导出`, "success");
  };

  const importGroups = async () => {
    const raw = await pickJsonFile();
    const result = mergeImportedProxyGroups({
      raw,
      groups,
      activeGroupId,
    });
  const {
      nextGroups,
      nextActiveGroupId,
      importedCurrentActiveGroup,
      summary: { groupCreated, groupUpdated, ruleCreated, ruleUpdated, skipped },
    } = result;

    commitGroups(nextGroups, nextActiveGroupId);

    if (importedCurrentActiveGroup) {
      const currentActiveGroup = nextGroups.find((group) => group.id === nextActiveGroupId);
      if (currentActiveGroup) {
        await setActiveGroupMutation.mutateAsync({ group: currentActiveGroup });
      }
    }

    showToast(
      formatProxyImportSummary({
        groupCreated,
        groupUpdated,
        ruleCreated,
        ruleUpdated,
        skipped,
      }),
      "success",
    );
  };

  const refetchProxyData = async () => {
    const results = await Promise.allSettled([groupsQuery.refetch(), trafficQuery.refetch()]);
    if (hasRefetchFailure(results)) {
      showToast("部分数据加载失败", "error");
    }
  };

  const handleSelectGroup = async (groupId: string) => {
    if (groupId === activeGroupId) {
      return;
    }
    const nextGroup = groups.find((group) => group.id === groupId);
    if (!nextGroup) {
      return;
    }

    const previousGroupId = activeGroupId;
    commitGroups(groups, groupId);

    setSubmitting(true);
    try {
      await setActiveGroupMutation.mutateAsync({ group: nextGroup });
      showToast("分组已切换", "success");
    } catch (error) {
      commitGroups(groups, previousGroupId);
      toastQueryError(showToast, error, "分组切换失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: StoredForwardRule, checked: boolean) => {
    if (pendingRuleIds[rule.id]) {
      return;
    }
    setRulePending(rule.id, true);
    const previousGroups = groups;
    const nextGroups = buildRuleToggleGroups({
      activeGroupId,
      checked,
      groups: previousGroups,
      rule,
    });
    commitGroups(nextGroups, activeGroupId);

    try {
      if (checked) {
        await upsertRuleMutation.mutateAsync({
          host: normalizeRuleHost(rule.pattern),
          action: rule.action,
          forwardMode: rule.forwardMode,
          targetUrl: rule.targetUrl,
          rewriteHost: rule.rewriteHost,
          rewritePath: rule.rewritePath,
        });
      } else {
        const shouldRemoveHost = shouldRemoveRuleHost({
          activeGroupId,
          excludeRuleId: rule.id,
          groups: nextGroups,
          pattern: rule.pattern,
        });
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeRuleHost(rule.pattern),
          });
        }
      }
    } catch (error) {
      commitGroups(previousGroups, activeGroupId);
      toastQueryError(showToast, error, "规则状态更新失败");
    } finally {
      setRulePending(rule.id, false);
    }
  };

  const handleDeleteRule = async (rule: StoredForwardRule) => {
    if (pendingRuleIds[rule.id]) {
      return;
    }
    setRulePending(rule.id, true);
    const previousGroups = groups;
    const nextGroups = buildRuleDeleteGroups({
      activeGroupId,
      groups: previousGroups,
      ruleId: rule.id,
    });
    commitGroups(nextGroups, activeGroupId);

    try {
      if (rule.enabled) {
        const shouldRemoveHost = shouldRemoveRuleHost({
          activeGroupId,
          excludeRuleId: rule.id,
          groups: nextGroups,
          pattern: rule.pattern,
        });
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeRuleHost(rule.pattern),
          });
        }
      }
      showToast("规则已删除", "success");
    } catch (error) {
      commitGroups(previousGroups, activeGroupId);
      toastQueryError(showToast, error, "规则删除失败");
    } finally {
      setRulePending(rule.id, false);
    }
  };

  const handleSaveRule = async () => {
    if (submitting) {
      return;
    }
    const saveRuleResult = buildSavedRule({
      ruleForm,
      editingRule,
      activeRules: activeGroup?.rules ?? [],
    });
    if ("error" in saveRuleResult) {
      showToast(saveRuleResult.error, "error");
      return;
    }

    setSubmitting(true);
    const { nextRule, patternChanged, previousPattern } = saveRuleResult;

    const previousGroups = groups;
    const nextGroups = buildRuleSaveGroups({
      activeGroupId,
      groups: previousGroups,
      nextRule,
    });
    commitGroups(nextGroups, activeGroupId);

    try {
      if (editingRule?.enabled && patternChanged && previousPattern) {
        const shouldRemovePreviousHost = shouldRemoveRuleHost({
          activeGroupId,
          excludeRuleId: editingRule.id,
          groups: nextGroups,
          pattern: previousPattern,
        });
        if (shouldRemovePreviousHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeRuleHost(previousPattern),
          });
        }
      }

      if (nextRule.enabled) {
        await upsertRuleMutation.mutateAsync({
          host: normalizeRuleHost(nextRule.pattern),
          action: nextRule.action,
          forwardMode: nextRule.forwardMode,
          targetUrl: nextRule.targetUrl,
          rewriteHost: nextRule.rewriteHost,
          rewritePath: nextRule.rewritePath,
        });
      } else if (editingRule?.enabled && !patternChanged) {
        const shouldRemoveHost = shouldRemoveRuleHost({
          activeGroupId,
          excludeRuleId: editingRule.id,
          groups: nextGroups,
          pattern: editingRule.pattern,
        });
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeRuleHost(editingRule.pattern),
          });
        }
      }

      setProxyFilterMode("all");
      setProxyRuleSearch("");
      setIsRuleModalOpen(false);
      showToast(editingRule ? "规则已更新" : "规则已创建", "success");
    } catch (error) {
      await groupsQuery.refetch();
      setProxyFilterMode("all");
      setProxyRuleSearch("");
      setIsRuleModalOpen(false);
      showToast(
        `${editingRule ? "规则已更新" : "规则已创建"}，但导入失败：${toUserMessage(error, "请稍后重试")}`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGroup = () => {
    const saveGroupResult = buildGroupSaveGroups({
      activeGroupId,
      editingGroup,
      groupName,
      groups,
    });
    if ("error" in saveGroupResult) {
      showToast(saveGroupResult.error, "error");
      return;
    }
    commitGroups(saveGroupResult.nextGroups, saveGroupResult.nextActiveGroupId ?? activeGroupId);

    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = async (group: StoredGroup) => {
    if (submitting) {
      return;
    }
    const deletePlan = buildGroupDeletePlan({
      activeGroupId,
      group,
      groups,
    });
    if ("error" in deletePlan) {
      showToast(deletePlan.error, "error");
      return;
    }

    const previousGroups = groups;
    const previousActiveGroupId = activeGroupId;
    const { isDeletingActive, nextActiveGroup, nextActiveGroupId, nextGroups } = deletePlan;

    commitGroups(nextGroups, nextActiveGroupId);

    if (!isDeletingActive || !nextActiveGroup) {
      showToast("分组已删除", "success");
      return;
    }

    setSubmitting(true);
    try {
      await setActiveGroupMutation.mutateAsync({ group: nextActiveGroup });
      showToast("分组已删除，并切换到新分组", "success");
    } catch (error) {
      commitGroups(previousGroups, previousActiveGroupId);
      toastQueryError(showToast, error, "分组删除失败");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    exportGroup: exportGroupAction,
    handleDeleteGroup,
    handleDeleteRule,
    handleSaveGroup,
    handleSaveRule,
    handleSelectGroup,
    handleToggleRule,
    importGroups,
    pendingRuleIds,
    refetchProxyData,
  };
}
