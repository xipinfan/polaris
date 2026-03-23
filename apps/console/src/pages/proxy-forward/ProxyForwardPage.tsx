import { useEffect, useMemo, useState } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import type { MenuProps } from "antd";
import { Modal } from "antd";
import {
  asRecord,
  buildExportEnvelope,
  downloadJson,
  pickJsonFile,
} from "../../features/common/importExport";
import {
  useRemoveProxyForwardSiteRuleMutation,
  useSetActiveProxyForwardGroupMutation,
  useUpsertProxyForwardSiteRuleMutation,
} from "../../domains/proxy-forward/mutations";
import { useProxyForwardGroupsQuery } from "../../domains/proxy-forward/queries";
import { useTrafficRequestsQuery } from "../../domains/traffic/queries";
import { useToast } from "../../features/feedback/ToastProvider";
import { writePersistence } from "../../lib/persistence";
import { queryKeys } from "../../lib/query/queryKeys";
import { toastQueryError } from "../../lib/query/queryOptions";
import { toUserMessage } from "../../services/apiErrors";
import { uiSelectors, workspaceSelectors } from "../../stores/selectors";
import { useUiStore } from "../../stores/uiStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { GroupEditorModal } from "./components/GroupEditorModal";
import { GroupSidebar } from "./components/GroupSidebar";
import { OverviewHeader } from "./components/OverviewHeader";
import { RuleBlocks } from "./components/RuleBlocks";
import { RuleEditorModal } from "./components/RuleEditorModal";
import { RuleToolbar } from "./components/RuleToolbar";
import type { RuleView, StoredForwardRule, StoredGroup } from "./types";
import {
  activeGroupStorageKey,
  buildEmptyRule,
  buildGroupFromRules,
  buildRuleStats,
  createId,
  defaultGroupLabel,
  derivePath,
  parseSourceUrl,
  groupsStorageKey,
  sanitizeText,
} from "./utils/proxyForwardHelpers";
import styles from "./ProxyForwardPage.module.less";

const fallbackGroup = buildGroupFromRules(defaultGroupLabel, []);

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

export function ProxyForwardPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const groupsQuery = useProxyForwardGroupsQuery();
  const trafficQuery = useTrafficRequestsQuery({}, { autoRefresh: true });
  const setActiveGroupMutation = useSetActiveProxyForwardGroupMutation();
  const upsertRuleMutation = useUpsertProxyForwardSiteRuleMutation();
  const removeRuleMutation = useRemoveProxyForwardSiteRuleMutation();
  const [pendingRuleIds, setPendingRuleIds] = useState<Record<string, boolean>>(
    {},
  );

  const requests = trafficQuery.data ?? ([] as RequestRecord[]);

  const groupSearch = useUiStore(uiSelectors.proxyGroupSearch);
  const ruleSearch = useUiStore(uiSelectors.proxyRuleSearch);
  const filterMode = useUiStore(uiSelectors.proxyFilterMode);
  const sortMode = useUiStore(uiSelectors.proxySortMode);
  const setProxyRuleSearch = useUiStore((state) => state.setProxyRuleSearch);
  const setProxyFilterMode = useUiStore((state) => state.setProxyFilterMode);
  const storeActiveGroupId = useWorkspaceStore(
    workspaceSelectors.proxyActiveGroupId,
  );
  const headerMenuOpen = useWorkspaceStore(
    workspaceSelectors.proxyHeaderMenuOpen,
  );
  const editingRule = useWorkspaceStore(workspaceSelectors.proxyEditingRule);
  const editingGroup = useWorkspaceStore(workspaceSelectors.proxyEditingGroup);
  const proxyRuleForm = useWorkspaceStore(workspaceSelectors.proxyRuleForm);
  const isRuleModalOpen = useWorkspaceStore(
    workspaceSelectors.proxyRuleModalOpen,
  );
  const isGroupModalOpen = useWorkspaceStore(
    workspaceSelectors.proxyGroupModalOpen,
  );
  const submitting = useWorkspaceStore(workspaceSelectors.proxySubmitting);
  const groupName = useWorkspaceStore(workspaceSelectors.proxyGroupName);

  const setActiveGroupId = useWorkspaceStore(
    (state) => state.setProxyActiveGroupId,
  );
  const setHeaderMenuOpen = useWorkspaceStore(
    (state) => state.setProxyHeaderMenuOpen,
  );
  const setEditingRule = useWorkspaceStore(
    (state) => state.setProxyEditingRule,
  );
  const setEditingGroup = useWorkspaceStore(
    (state) => state.setProxyEditingGroup,
  );
  const setProxyRuleForm = useWorkspaceStore((state) => state.setProxyRuleForm);
  const setIsRuleModalOpen = useWorkspaceStore(
    (state) => state.setProxyRuleModalOpen,
  );
  const setIsGroupModalOpen = useWorkspaceStore(
    (state) => state.setProxyGroupModalOpen,
  );
  const setSubmitting = useWorkspaceStore((state) => state.setProxySubmitting);
  const setGroupName = useWorkspaceStore((state) => state.setProxyGroupName);

  const groups = groupsQuery.data?.groups ?? [fallbackGroup];
  const queryActiveGroupId =
    groupsQuery.data?.activeGroupId ?? groups[0]?.id ?? fallbackGroup.id;
  const activeGroupId =
    storeActiveGroupId &&
    groups.some((group) => group.id === storeActiveGroupId)
      ? storeActiveGroupId
      : queryActiveGroupId;

  const ruleForm = proxyRuleForm ?? buildEmptyRule(defaultGroupLabel);

  const setRuleForm = (
    updater: (current: StoredForwardRule) => StoredForwardRule,
  ) => {
    const next = updater(ruleForm);
    setProxyRuleForm(next);
  };

  const commitGroups = (
    nextGroups: StoredGroup[],
    nextActiveGroupId: string,
  ) => {
    writePersistence(groupsStorageKey, nextGroups);
    writePersistence(activeGroupStorageKey, nextActiveGroupId);
    setActiveGroupId(nextActiveGroupId);
    queryClient.setQueryData(queryKeys.proxyForward.groups, {
      groups: nextGroups,
      activeGroupId: nextActiveGroupId,
    });
  };

  const buildRuleCollisionKey = (rule: {
    pattern: string;
    method: string;
    path: string;
  }) =>
    `${sanitizeText(rule.method, "GET").toUpperCase()}__${sanitizeText(rule.pattern, "").toLowerCase()}__${derivePath(rule.path)}`;

  const toExportableGroup = (group: StoredGroup) => ({
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
  });

  const exportGroup = (group: StoredGroup) => {
    const envelope = buildExportEnvelope("proxy-groups", {
      groups: [toExportableGroup(group)],
    });
    downloadJson(`proxy-group-${group.name}-${Date.now()}.json`, envelope);
    showToast(`分组「${group.name}」已导出`, "success");
  };

  const importGroups = async () => {
    const raw = await pickJsonFile();
    const record = asRecord(raw);
    if (!record || record.kind !== "proxy-groups") {
      throw new Error("文件类型不匹配，需要导入 proxy-groups");
    }

    const payload = asRecord(record.payload);
    const importedGroups = Array.isArray(payload?.groups)
      ? (payload.groups as ImportProxyGroup[])
      : [];
    if (!importedGroups.length) {
      throw new Error("导入内容为空");
    }

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
        (group) =>
          sanitizeText(group.name, "").toLowerCase() ===
          groupName.toLowerCase(),
      );
      const fallbackRule = buildEmptyRule(groupName);
      const importedRules = Array.isArray(importedGroup.rules)
        ? importedGroup.rules
        : [];

      if (existingGroupIndex < 0) {
        const newRules: StoredForwardRule[] = [];
        for (const importedRule of importedRules) {
          const pattern = sanitizeText(importedRule.pattern, "").toLowerCase();
          const method = sanitizeText(importedRule.method, "GET").toUpperCase();
          const path = derivePath(
            importedRule.path ?? parseSourceUrl(importedRule.url)?.path ?? "/",
          );
          if (!pattern) {
            skipped += 1;
            continue;
          }
          newRules.push({
            ...fallbackRule,
            id: createId("proxy-rule"),
            name: sanitizeText(
              importedRule.name,
              sanitizeText(importedRule.url, pattern),
            ),
            pattern,
            method,
            path,
            url: sanitizeText(importedRule.url, `https://${pattern}${path}`),
            targetUrl: sanitizeText(
              importedRule.targetUrl,
              fallbackRule.targetUrl,
            ),
            action: importedRule.action === "direct" ? "direct" : "proxy",
            enabled: Boolean(importedRule.enabled),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          ruleCreated += 1;
        }
        nextGroups.push({
          id: createId("proxy-group"),
          name: groupName,
          rules: newRules,
        });
        groupCreated += 1;
        continue;
      }

      const existingGroup = nextGroups[existingGroupIndex];
      const indexByKey = new Map(
        existingGroup.rules.map(
          (rule) => [buildRuleCollisionKey(rule), rule] as const,
        ),
      );
      const mergedRules = [...existingGroup.rules];

      for (const importedRule of importedRules) {
        const pattern = sanitizeText(importedRule.pattern, "").toLowerCase();
        const method = sanitizeText(importedRule.method, "GET").toUpperCase();
        const path = derivePath(
          importedRule.path ?? parseSourceUrl(importedRule.url)?.path ?? "/",
        );
        if (!pattern) {
          skipped += 1;
          continue;
        }
        const key = `${method}__${pattern}__${path}`;
        const existing = indexByKey.get(key);
        if (existing) {
          const updatedRule: StoredForwardRule = {
            ...existing,
            name: sanitizeText(importedRule.name, existing.name),
            pattern,
            method,
            path,
            url: sanitizeText(importedRule.url, `https://${pattern}${path}`),
            targetUrl: sanitizeText(importedRule.targetUrl, existing.targetUrl),
            action: importedRule.action === "direct" ? "direct" : "proxy",
            enabled: Boolean(importedRule.enabled),
            updatedAt: new Date().toISOString(),
          };
          const idx = mergedRules.findIndex((rule) => rule.id === existing.id);
          if (idx >= 0) {
            mergedRules[idx] = updatedRule;
            ruleUpdated += 1;
          }
          continue;
        }

        mergedRules.unshift({
          ...fallbackRule,
          id: createId("proxy-rule"),
          name: sanitizeText(
            importedRule.name,
            sanitizeText(importedRule.url, pattern),
          ),
          pattern,
          method,
          path,
          url: sanitizeText(importedRule.url, `https://${pattern}${path}`),
          targetUrl: sanitizeText(
            importedRule.targetUrl,
            fallbackRule.targetUrl,
          ),
          action: importedRule.action === "direct" ? "direct" : "proxy",
          enabled: Boolean(importedRule.enabled),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        ruleCreated += 1;
      }
      nextGroups[existingGroupIndex] = { ...existingGroup, rules: mergedRules };
      groupUpdated += 1;
    }

    const nextActiveGroupId = nextGroups.some(
      (group) => group.id === activeGroupId,
    )
      ? activeGroupId
      : (nextGroups[0]?.id ?? activeGroupId);
    commitGroups(nextGroups, nextActiveGroupId);

    const importedCurrentActiveGroup = importedGroupNames.has(activeGroupName);
    if (importedCurrentActiveGroup) {
      const currentActiveGroup = nextGroups.find(
        (group) => group.id === nextActiveGroupId,
      );
      if (currentActiveGroup) {
        await setActiveGroupMutation.mutateAsync({ group: currentActiveGroup });
      }
    }

    showToast(
      `导入完成：新增分组 ${groupCreated}，更新分组 ${groupUpdated}，新增规则 ${ruleCreated}，更新规则 ${ruleUpdated}，跳过 ${skipped}`,
      "success",
    );
  };

  const refetchProxyData = async () => {
    const [groupsResult, trafficResult] = await Promise.allSettled([
      groupsQuery.refetch(),
      trafficQuery.refetch(),
    ]);
    if (
      groupsResult.status === "rejected" ||
      (groupsResult.status === "fulfilled" && groupsResult.value.error) ||
      trafficResult.status === "rejected" ||
      (trafficResult.status === "fulfilled" && trafficResult.value.error)
    ) {
      showToast("部分数据加载失败", "error");
    }
  };

  useEffect(() => {
    if (!activeGroupId || storeActiveGroupId === activeGroupId) {
      return;
    }
    setActiveGroupId(activeGroupId);
  }, [activeGroupId, setActiveGroupId, storeActiveGroupId]);

  useEffect(() => {
    if (groupsQuery.error) {
      toastQueryError(showToast, groupsQuery.error, "分组加载失败");
    }
  }, [groupsQuery.error, showToast]);

  useEffect(() => {
    if (trafficQuery.error) {
      toastQueryError(showToast, trafficQuery.error, "流量加载失败");
    }
  }, [trafficQuery.error, showToast]);

  const visibleGroups = useMemo(() => {
    const keyword = sanitizeText(groupSearch, "").toLowerCase();
    return groups.filter(
      (group) => !keyword || group.name.toLowerCase().includes(keyword),
    );
  }, [groupSearch, groups]);

  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
  const rules = useMemo(
    () =>
      activeGroup
        ? activeGroup.rules.map((rule) => buildRuleStats(rule, requests))
        : [],
    [activeGroup, requests],
  );

  const filteredRules = useMemo(() => {
    const keyword = sanitizeText(ruleSearch, "").toLowerCase();
    const next = rules.filter((rule) => {
      if (
        keyword &&
        !`${rule.name} ${rule.pattern}`.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (filterMode === "enabled" && !rule.enabled) {
        return false;
      }
      if (filterMode === "hits" && rule.hitCountToday === 0) {
        return false;
      }
      if (filterMode === "errors" && rule.recentErrorCount === 0) {
        return false;
      }
      return true;
    });

    next.sort((left, right) => {
      if (sortMode === "hits") {
        return right.hitCountToday - left.hitCountToday;
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

    return next;
  }, [filterMode, ruleSearch, rules, sortMode]);

  const overview = useMemo(() => {
    const total = activeGroup?.rules.length ?? 0;
    const enabled =
      activeGroup?.rules.filter((rule) => rule.enabled).length ?? 0;
    const hits = rules.reduce((sum, rule) => sum + rule.hitCountToday, 0);
    const errors = rules.reduce((sum, rule) => sum + rule.recentErrorCount, 0);
    return { total, enabled, hits, errors };
  }, [activeGroup, rules]);

  const updateActiveGroupRules = (
    currentGroups: StoredGroup[],
    updater: (rules: StoredForwardRule[]) => StoredForwardRule[],
  ) =>
    currentGroups.map((group) =>
      group.id === activeGroupId
        ? { ...group, rules: updater(group.rules) }
        : group,
    );

  const hasOtherEnabledRuleWithPattern = (
    pattern: string,
    excludeRuleId: string,
    candidateRules: StoredForwardRule[],
  ) =>
    candidateRules.some(
      (item) =>
        item.id !== excludeRuleId &&
        item.enabled &&
        sanitizeText(item.pattern, "").toLowerCase() ===
          sanitizeText(pattern, "").toLowerCase(),
    );

  const normalizeHost = (host: unknown) => sanitizeText(host, "").toLowerCase();

  const setRulePending = (ruleId: string, pending: boolean) => {
    setPendingRuleIds((current) => {
      if (pending) {
        return { ...current, [ruleId]: true };
      }
      const { [ruleId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const handleSelectGroup = async (groupId: string) => {
    if (groupId === activeGroupId) return;
    const nextGroup = groups.find((group) => group.id === groupId);
    if (!nextGroup) return;

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

  const handleToggleRule = async (rule: RuleView, checked: boolean) => {
    if (pendingRuleIds[rule.id]) {
      return;
    }
    setRulePending(rule.id, true);
    const previousGroups = groups;
    const nextGroups = updateActiveGroupRules(previousGroups, (activeRules) =>
      activeRules.map((item) =>
        item.id === rule.id ? { ...item, enabled: checked } : item,
      ),
    );
    commitGroups(nextGroups, activeGroupId);

    try {
      if (checked) {
        await upsertRuleMutation.mutateAsync({
          host: normalizeHost(rule.pattern),
          action: rule.action,
        });
      } else {
        const activeRules =
          nextGroups.find((group) => group.id === activeGroupId)?.rules ?? [];
        const shouldRemoveHost = !hasOtherEnabledRuleWithPattern(
          rule.pattern,
          rule.id,
          activeRules,
        );
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeHost(rule.pattern),
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
    const nextGroups = updateActiveGroupRules(previousGroups, (activeRules) =>
      activeRules.filter((item) => item.id !== rule.id),
    );
    commitGroups(nextGroups, activeGroupId);

    try {
      if (rule.enabled) {
        const activeRules =
          nextGroups.find((group) => group.id === activeGroupId)?.rules ?? [];
        const shouldRemoveHost = !hasOtherEnabledRuleWithPattern(
          rule.pattern,
          rule.id,
          activeRules,
        );
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeHost(rule.pattern),
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

  const openCreateRule = () => {
    setEditingRule(null);
    setProxyRuleForm(buildEmptyRule(activeGroup?.name ?? defaultGroupLabel));
    setIsRuleModalOpen(true);
  };

  const openEditRule = (rule: StoredForwardRule) => {
    setEditingRule(rule);
    setProxyRuleForm(rule);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (submitting) {
      return;
    }
    const sourceUrlInput = sanitizeText(ruleForm.url, "");
    const parsedSource = parseSourceUrl(sourceUrlInput);
    const normalizedPath = parsedSource?.path ?? derivePath(ruleForm.path);
    const pattern =
      parsedSource?.host ?? sanitizeText(ruleForm.pattern, "").toLowerCase();
    if (!pattern) {
      showToast(
        "请填写有效的来源 URL，例如 https://api.example.com/v1/resource",
        "error",
      );
      return;
    }

    setSubmitting(true);

    const collidedRule = activeGroup?.rules.find(
      (rule) =>
        rule.id !== editingRule?.id &&
        sanitizeText(rule.pattern, "").toLowerCase() === pattern &&
        derivePath(rule.path) === normalizedPath &&
        sanitizeText(rule.method, "GET").toUpperCase() ===
          sanitizeText(ruleForm.method, "GET").toUpperCase(),
    );

    const nextRule: StoredForwardRule = {
      ...ruleForm,
      id: editingRule?.id ?? collidedRule?.id ?? createId("proxy-rule"),
      name:
        sanitizeText(ruleForm.name, "") ||
        parsedSource?.normalizedUrl ||
        sourceUrlInput ||
        pattern,
      pattern,
      url:
        parsedSource?.normalizedUrl ??
        (sourceUrlInput || `https://${pattern}${normalizedPath}`),
      path: normalizedPath,
      createdAt: editingRule?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const previousGroups = groups;
    const nextGroups = updateActiveGroupRules(previousGroups, (activeRules) => {
      const exists = activeRules.some((rule) => rule.id === nextRule.id);
      return exists
        ? activeRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
        : [nextRule, ...activeRules];
    });
    commitGroups(nextGroups, activeGroupId);

    const previousPattern = editingRule?.pattern;
    const patternChanged =
      !!editingRule && previousPattern !== nextRule.pattern;

    try {
      if (editingRule?.enabled && patternChanged && previousPattern) {
        const nextActiveRules =
          nextGroups.find((group) => group.id === activeGroupId)?.rules ?? [];
        const shouldRemovePreviousHost = !hasOtherEnabledRuleWithPattern(
          previousPattern,
          editingRule.id,
          nextActiveRules,
        );
        if (shouldRemovePreviousHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeHost(previousPattern),
          });
        }
      }
      if (nextRule.enabled) {
        await upsertRuleMutation.mutateAsync({
          host: normalizeHost(nextRule.pattern),
          action: nextRule.action,
        });
      } else if (editingRule?.enabled && !patternChanged) {
        const nextActiveRules =
          nextGroups.find((group) => group.id === activeGroupId)?.rules ?? [];
        const shouldRemoveHost = !hasOtherEnabledRuleWithPattern(
          editingRule.pattern,
          editingRule.id,
          nextActiveRules,
        );
        if (shouldRemoveHost) {
          await removeRuleMutation.mutateAsync({
            host: normalizeHost(editingRule.pattern),
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
        `${editingRule ? "规则已更新" : "规则已创建"}，但导入失败：${toUserMessage(
          error,
          "请稍后重试",
        )}`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveGroup = () => {
    const nextName = sanitizeText(groupName, "");
    if (!nextName) {
      showToast("请填写分组名称", "error");
      return;
    }
    if (editingGroup) {
      commitGroups(
        groups.map((group) =>
          group.id === editingGroup.id ? { ...group, name: nextName } : group,
        ),
        activeGroupId,
      );
    } else {
      commitGroups(
        [...groups, { id: createId("proxy-group"), name: nextName, rules: [] }],
        activeGroupId,
      );
    }
    setIsGroupModalOpen(false);
  };

  const handleDeleteGroup = async (group: StoredGroup) => {
    if (submitting) {
      return;
    }
    if (groups.length <= 1) {
      showToast("至少保留一个分组，无法删除", "error");
      return;
    }

    const previousGroups = groups;
    const previousActiveGroupId = activeGroupId;
    const nextGroups = groups.filter((item) => item.id !== group.id);
    const isDeletingActive = group.id === activeGroupId;
    const nextActiveGroupId = isDeletingActive
      ? (nextGroups[0]?.id ?? activeGroupId)
      : activeGroupId;
    const nextActiveGroup = nextGroups.find(
      (item) => item.id === nextActiveGroupId,
    );

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
  const buildGroupMenu = (group: StoredGroup): MenuProps["items"] => [
    {
      key: "rename",
      label: "重命名分组",
      onClick: () => {
        setEditingGroup(group);
        setGroupName(group.name);
        setIsGroupModalOpen(true);
      },
    },
    {
      key: "delete",
      label: "删除分组",
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: `删除分组「${group.name}」？`,
          content: "分组内规则会一并删除，且不可恢复。",
          okText: "删除",
          maskClosable: false,
          okButtonProps: { danger: true },
          cancelText: "取消",
          onOk: () => handleDeleteGroup(group),
        });
      },
    },
    {
      key: "export",
      label: "导出分组",
      onClick: () => exportGroup(group),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h2>代理转发</h2>
          <p>管理站点级转发规则、运行状态和最近命中流量。</p>
        </div>
      </header>
      <div className={styles.workspace}>
        <GroupSidebar
          buildGroupMenu={buildGroupMenu}
          onImportGroups={() => {
            void importGroups().catch((error) =>
              showToast(
                error instanceof Error ? error.message : "导入失败",
                "error",
              ),
            );
          }}
          onSelectGroup={(id) => void handleSelectGroup(id)}
          setEditingGroup={setEditingGroup}
          setGroupName={setGroupName}
          setIsGroupModalOpen={setIsGroupModalOpen}
          submitting={submitting}
          visibleGroups={visibleGroups}
        />
        <section className={styles.main}>
          <OverviewHeader
            activeGroup={activeGroup}
            activeGroupId={activeGroupId}
            groups={groups}
            headerMenuOpen={headerMenuOpen}
            onLoad={() => void refetchProxyData()}
            onOpenCreateRule={openCreateRule}
            overview={overview}
            setEditingGroup={setEditingGroup}
            setGroupName={setGroupName}
            setHeaderMenuOpen={setHeaderMenuOpen}
            setIsGroupModalOpen={setIsGroupModalOpen}
          />
          <RuleToolbar filteredCount={filteredRules.length} />
          <RuleBlocks
            rules={filteredRules}
            isRulePending={(ruleId) => pendingRuleIds[ruleId] === true}
            onDeleteRule={(rule) => void handleDeleteRule(rule)}
            onOpenEditRule={openEditRule}
            onToggleRule={(rule, checked) =>
              void handleToggleRule(rule, checked)
            }
          />
        </section>
      </div>
      <RuleEditorModal
        activeGroup={activeGroup}
        activeGroupId={activeGroupId}
        editingRule={editingRule}
        groups={groups}
        isOpen={isRuleModalOpen}
        onCancel={() => setIsRuleModalOpen(false)}
        onSave={() => void handleSaveRule()}
        ruleForm={ruleForm}
        setRuleForm={setRuleForm}
        submitting={submitting}
      />
      <GroupEditorModal
        editingGroup={editingGroup}
        groupName={groupName}
        isOpen={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onSave={handleSaveGroup}
        setGroupName={setGroupName}
      />
    </div>
  );
}
