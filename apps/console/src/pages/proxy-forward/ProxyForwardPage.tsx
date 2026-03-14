import { useEffect, useMemo, useState } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import type { MenuProps } from "antd";
import { useSetActiveProxyForwardGroupMutation, useRemoveProxyForwardSiteRuleMutation, useUpsertProxyForwardSiteRuleMutation } from "../../domains/proxy-forward/mutations";
import { useProxyForwardGroupsQuery } from "../../domains/proxy-forward/queries";
import { useTrafficRequestsQuery } from "../../domains/traffic/queries";
import { useToast } from "../../features/feedback/ToastProvider";
import { writePersistence } from "../../lib/persistence";
import { toastQueryError } from "../../lib/query/queryOptions";
import { uiSelectors, workspaceSelectors } from "../../stores/selectors";
import { useUiStore } from "../../stores/uiStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { GroupEditorModal } from "./components/GroupEditorModal";
import { GroupSidebar } from "./components/GroupSidebar";
import { OverviewHeader } from "./components/OverviewHeader";
import { RuleBlocks } from "./components/RuleBlocks";
import { RuleEditorModal } from "./components/RuleEditorModal";
import { RuleToolbar } from "./components/RuleToolbar";
import { TrafficDetailDrawer } from "./components/TrafficDetailDrawer";
import type {
  RuleView,
  StoredForwardRule,
  StoredGroup,
} from "./types";
import {
  activeGroupStorageKey,
  buildEmptyRule,
  buildGroupFromRules,
  buildRuleStats,
  buildRuleUrl,
  createId,
  defaultGroupLabel,
  defaultMatchMode,
  defaultMatchValue,
  groupsStorageKey,
  sanitizeText,
} from "./utils/proxyForwardHelpers";
import { countPreviewEntries } from "./utils/proxyForwardLabels";
import styles from "./ProxyForwardPage.module.less";

const fallbackGroup = buildGroupFromRules(defaultGroupLabel, []);

export function ProxyForwardPage() {
  const { showToast } = useToast();
  const groupsQuery = useProxyForwardGroupsQuery();
  const trafficQuery = useTrafficRequestsQuery({}, { autoRefresh: true });
  const setActiveGroupMutation = useSetActiveProxyForwardGroupMutation();
  const upsertRuleMutation = useUpsertProxyForwardSiteRuleMutation();
  const removeRuleMutation = useRemoveProxyForwardSiteRuleMutation();

  const [groups, setGroups] = useState<StoredGroup[]>([fallbackGroup]);
  const requests = trafficQuery.data ?? ([] as RequestRecord[]);

  const groupSearch = useUiStore(uiSelectors.proxyGroupSearch);
  const ruleSearch = useUiStore(uiSelectors.proxyRuleSearch);
  const filterMode = useUiStore(uiSelectors.proxyFilterMode);
  const sortMode = useUiStore(uiSelectors.proxySortMode);
  const activeGroupId = useWorkspaceStore(workspaceSelectors.proxyActiveGroupId);
  const headerMenuOpen = useWorkspaceStore(workspaceSelectors.proxyHeaderMenuOpen);
  const drawerRule = useWorkspaceStore(workspaceSelectors.proxyDrawerRule);
  const editingRule = useWorkspaceStore(workspaceSelectors.proxyEditingRule);
  const editingGroup = useWorkspaceStore(workspaceSelectors.proxyEditingGroup);
  const proxyRuleForm = useWorkspaceStore(workspaceSelectors.proxyRuleForm);
  const isRuleModalOpen = useWorkspaceStore(workspaceSelectors.proxyRuleModalOpen);
  const isGroupModalOpen = useWorkspaceStore(workspaceSelectors.proxyGroupModalOpen);
  const submitting = useWorkspaceStore((state) => state.proxySubmitting);
  const groupName = useWorkspaceStore((state) => state.proxyGroupName);

  const setActiveGroupId = useWorkspaceStore((state) => state.setProxyActiveGroupId);
  const setHeaderMenuOpen = useWorkspaceStore((state) => state.setProxyHeaderMenuOpen);
  const setDrawerRule = useWorkspaceStore((state) => state.setProxyDrawerRule);
  const setEditingRule = useWorkspaceStore((state) => state.setProxyEditingRule);
  const setEditingGroup = useWorkspaceStore((state) => state.setProxyEditingGroup);
  const setProxyRuleForm = useWorkspaceStore((state) => state.setProxyRuleForm);
  const setIsRuleModalOpen = useWorkspaceStore((state) => state.setProxyRuleModalOpen);
  const setIsGroupModalOpen = useWorkspaceStore((state) => state.setProxyGroupModalOpen);
  const setSubmitting = useWorkspaceStore((state) => state.setProxySubmitting);
  const setGroupName = useWorkspaceStore((state) => state.setProxyGroupName);

  const ruleForm = proxyRuleForm ?? buildEmptyRule(defaultGroupLabel);

  const setRuleForm = (updater: (current: StoredForwardRule) => StoredForwardRule) => {
    const next = updater(ruleForm);
    setProxyRuleForm(next);
  };

  const persistGroups = (nextGroups: StoredGroup[], nextActiveGroupId: string) => {
    setGroups(nextGroups);
    setActiveGroupId(nextActiveGroupId);
    writePersistence(groupsStorageKey, nextGroups);
    writePersistence(activeGroupStorageKey, nextActiveGroupId);
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
    if (!groupsQuery.data) {
      return;
    }
    persistGroups(groupsQuery.data.groups, groupsQuery.data.activeGroupId);
  }, [groupsQuery.data]);

  useEffect(() => {
    if (!activeGroupId) {
      setActiveGroupId(fallbackGroup.id);
    }
  }, [activeGroupId, setActiveGroupId]);

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
    const keyword = groupSearch.trim().toLowerCase();
    return groups.filter((group) => !keyword || group.name.toLowerCase().includes(keyword));
  }, [groupSearch, groups]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0] ?? null;
  const rules = useMemo(() => (activeGroup ? activeGroup.rules.map((rule) => buildRuleStats(rule, requests)) : []), [activeGroup, requests]);

  const filteredRules = useMemo(() => {
    const keyword = ruleSearch.trim().toLowerCase();
    const next = rules.filter((rule) => {
      if (keyword && !`${rule.name} ${rule.pattern}`.toLowerCase().includes(keyword)) {
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
      if (sortMode === "created") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    return next;
  }, [filterMode, ruleSearch, rules, sortMode]);

  const urlBlocks = useMemo(
    () =>
      filteredRules.map((rule) => ({
        key: `${rule.pattern}${rule.path}`,
        fullUrl: rule.url || buildRuleUrl(rule.pattern, rule.path),
        host: rule.pattern || "未设置 Host",
        rules: [rule],
      })),
    [filteredRules],
  );

  const overview = useMemo(() => {
    const total = activeGroup?.rules.length ?? 0;
    const enabled = activeGroup?.rules.filter((rule) => rule.enabled).length ?? 0;
    const hits = rules.reduce((sum, rule) => sum + rule.hitCountToday, 0);
    const errors = rules.reduce((sum, rule) => sum + rule.recentErrorCount, 0);
    return { total, enabled, hits, errors };
  }, [activeGroup, rules]);

  const handleSelectGroup = async (groupId: string) => {
    if (groupId === activeGroupId) return;
    const nextGroup = groups.find((group) => group.id === groupId);
    if (!nextGroup) return;

    setSubmitting(true);
    try {
      await setActiveGroupMutation.mutateAsync({ group: nextGroup });
      await refetchProxyData();
      showToast("分组已切换", "success");
    } catch (error) {
      toastQueryError(showToast, error, "分组切换失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule: RuleView, checked: boolean) => {
    try {
      if (checked) {
        await upsertRuleMutation.mutateAsync({ host: rule.pattern, action: rule.action });
      } else {
        await removeRuleMutation.mutateAsync({ host: rule.pattern });
      }
      await refetchProxyData();
    } catch (error) {
      toastQueryError(showToast, error, "规则状态更新失败");
    }
  };

  const handleDeleteRule = async (rule: StoredForwardRule) => {
    const nextGroups = groups.map((group) =>
      group.id === activeGroupId ? { ...group, rules: group.rules.filter((item) => item.id !== rule.id) } : group,
    );
    persistGroups(nextGroups, activeGroupId);

    try {
      if (rule.enabled) {
        await removeRuleMutation.mutateAsync({ host: rule.pattern });
      }
      await refetchProxyData();
      showToast("规则已删除", "success");
    } catch (error) {
      toastQueryError(showToast, error, "规则删除失败");
    }
  };

  const openCreateRule = () => {
    setEditingRule(null);
    setProxyRuleForm(buildEmptyRule(defaultGroupLabel));
    setIsRuleModalOpen(true);
  };

  const openEditRule = (rule: StoredForwardRule) => {
    setEditingRule(rule);
    setProxyRuleForm(rule);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async () => {
    const pattern = ruleForm.pattern.trim().toLowerCase();
    if (!pattern) {
      showToast("请填写站点，例如 api.example.com", "error");
      return;
    }

    const nextRule: StoredForwardRule = {
      ...ruleForm,
      id: editingRule?.id ?? createId("proxy-rule"),
      name: ruleForm.name.trim() || pattern,
      pattern,
      url: ruleForm.url.trim() || `https://${pattern}${ruleForm.path || "/"}`,
      path: ruleForm.path.trim() || "/",
      createdAt: editingRule?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextGroups = groups.map((group) => {
      if (group.id !== activeGroupId) return group;
      const exists = group.rules.some((rule) => rule.id === nextRule.id);
      return {
        ...group,
        rules: exists ? group.rules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)) : [nextRule, ...group.rules],
      };
    });
    persistGroups(nextGroups, activeGroupId);

    try {
      if (nextRule.enabled) {
        await upsertRuleMutation.mutateAsync({ host: nextRule.pattern, action: nextRule.action });
      } else if (editingRule?.enabled) {
        await removeRuleMutation.mutateAsync({ host: editingRule.pattern });
      }
      await refetchProxyData();
      setIsRuleModalOpen(false);
      showToast(editingRule ? "规则已更新" : "规则已创建", "success");
    } catch (error) {
      toastQueryError(showToast, error, "规则保存失败");
    }
  };

  const handleSaveGroup = () => {
    const nextName = groupName.trim();
    if (!nextName) {
      showToast("请填写分组名称", "error");
      return;
    }
    if (editingGroup) {
      persistGroups(groups.map((group) => (group.id === editingGroup.id ? { ...group, name: nextName } : group)), activeGroupId);
    } else {
      persistGroups([...groups, { id: createId("proxy-group"), name: nextName, rules: [] }], activeGroupId);
    }
    setIsGroupModalOpen(false);
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
  ];

  const buildRuleMenu = (rule: StoredForwardRule): MenuProps["items"] => [
    {
      key: "remove",
      label: "删除规则",
      danger: true,
      onClick: () => {
        void handleDeleteRule(rule);
      },
    },
  ];

  const requestHeaderCount = useMemo(() => countPreviewEntries(ruleForm.requestHeaderPreview), [ruleForm.requestHeaderPreview]);
  const responseHeaderCount = useMemo(() => countPreviewEntries(ruleForm.responseHeaderPreview), [ruleForm.responseHeaderPreview]);
  const resolvedTargetUrl = ruleForm.forwardMode === "direct" ? ruleForm.url : ruleForm.targetUrl;
  const rewriteSummary = [
    ruleForm.rewriteHost ? `Host ${ruleForm.rewriteHost}` : "",
    ruleForm.rewritePath ? `Path ${ruleForm.rewritePath}` : "",
    ruleForm.rewriteQuery ? `Query ${ruleForm.rewriteQuery}` : "",
  ].filter(Boolean).join(" · ");

  const getMatchSummary = (rule: StoredForwardRule) =>
    `${sanitizeText(rule.matchMode, defaultMatchMode)} · Query ${sanitizeText(rule.queryMatch, defaultMatchValue)} · Header ${sanitizeText(rule.headerMatch, defaultMatchValue)} · Body ${sanitizeText(rule.bodyMatch, defaultMatchValue)}`;

  const getActionSummary = (rule: StoredForwardRule) =>
    `转发到 ${sanitizeText(rule.targetUrl, buildRuleUrl(rule.pattern, rule.path))}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>代理转发</span>
          <h2>代理转发</h2>
          <p>管理站点级转发规则、运行状态和最近命中流量。</p>
        </div>
      </header>
      <div className={styles.workspace}>
        <GroupSidebar buildGroupMenu={buildGroupMenu} onSelectGroup={(id) => void handleSelectGroup(id)} setEditingGroup={setEditingGroup} setGroupName={setGroupName} setIsGroupModalOpen={setIsGroupModalOpen} submitting={submitting} visibleGroups={visibleGroups} />
        <section className={styles.main}>
          <OverviewHeader activeGroup={activeGroup} activeGroupId={activeGroupId} groups={groups} headerMenuOpen={headerMenuOpen} onLoad={() => void refetchProxyData()} onOpenCreateRule={openCreateRule} overview={overview} setEditingGroup={setEditingGroup} setGroupName={setGroupName} setHeaderMenuOpen={setHeaderMenuOpen} setIsGroupModalOpen={setIsGroupModalOpen} />
          <RuleToolbar filteredCount={filteredRules.length} />
          <RuleBlocks buildRuleMenu={buildRuleMenu} getActionSummary={getActionSummary} getMatchSummary={getMatchSummary} onOpenDrawer={setDrawerRule} onOpenEditRule={openEditRule} onToggleRule={(rule, checked) => void handleToggleRule(rule, checked)} urlBlocks={urlBlocks} />
        </section>
      </div>
      <TrafficDetailDrawer onClose={() => setDrawerRule(null)} rule={drawerRule} />
      <RuleEditorModal activeGroup={activeGroup} activeGroupId={activeGroupId} editingRule={editingRule} groups={groups} isOpen={isRuleModalOpen} onCancel={() => setIsRuleModalOpen(false)} onSave={() => void handleSaveRule()} requestHeaderCount={requestHeaderCount} resolvedTargetUrl={resolvedTargetUrl} responseHeaderCount={responseHeaderCount} rewriteSummary={rewriteSummary} ruleForm={ruleForm} setRuleForm={setRuleForm} submitting={submitting} />
      <GroupEditorModal editingGroup={editingGroup} groupName={groupName} isOpen={isGroupModalOpen} onCancel={() => setIsGroupModalOpen(false)} onSave={handleSaveGroup} setGroupName={setGroupName} />
    </div>
  );
}
