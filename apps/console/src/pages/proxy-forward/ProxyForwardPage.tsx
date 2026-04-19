import { useCallback, useEffect, useState } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import type { MenuProps } from "antd";
import { Button, Modal } from "antd";
import {
  useRemoveProxyForwardRuleByIdMutation,
  useSetActiveProxyForwardGroupMutation,
  useUpsertProxyForwardSiteRuleMutation,
} from "../../domains/proxy-forward/mutations";
import { useProxyForwardGroupsQuery } from "../../domains/proxy-forward/queries";
import { useTrafficRequestsQuery } from "../../domains/traffic/queries";
import { useToast } from "../../features/feedback/ToastProvider";
import { WhistleImportModal } from "../../features/common/whistleImport/WhistleImportModal";
import { toastQueryError } from "../../lib/query/queryOptions";
import { GroupEditorModal } from "./components/GroupEditorModal";
import { GroupSidebar } from "./components/GroupSidebar";
import { useProxyForwardActions } from "./hooks/useProxyForwardActions";
import { useProxyForwardDerivedState } from "./hooks/useProxyForwardDerivedState";
import { useProxyForwardWorkspace } from "./hooks/useProxyForwardWorkspace";
import { OverviewHeader } from "./components/OverviewHeader";
import { RuleBlocks } from "./components/RuleBlocks";
import { RuleEditorModal } from "./components/RuleEditorModal";
import { RuleToolbar } from "./components/RuleToolbar";
import type { StoredForwardRule, StoredGroup } from "./types";
import {
  buildEmptyRule,
  buildGroupFromRules,
  defaultGroupLabel,
} from "./utils/proxyForwardHelpers";
import styles from "./ProxyForwardPage.module.less";

const fallbackGroup = buildGroupFromRules(defaultGroupLabel, []);
const EMPTY_REQUESTS: RequestRecord[] = [];
const DEFAULT_GROUPS: StoredGroup[] = [fallbackGroup];

export function ProxyForwardPage() {
  const { showToast } = useToast();
  const [isWhistleImportOpen, setIsWhistleImportOpen] = useState(false);
  const groupsQuery = useProxyForwardGroupsQuery();
  const trafficQuery = useTrafficRequestsQuery({}, { autoRefresh: true });
  const setActiveGroupMutation = useSetActiveProxyForwardGroupMutation();
  const upsertRuleMutation = useUpsertProxyForwardSiteRuleMutation();
  const removeRuleMutation = useRemoveProxyForwardRuleByIdMutation();

  const requests = trafficQuery.data ?? EMPTY_REQUESTS;

  const {
    editingGroup,
    editingRule,
    filterMode,
    groupName,
    groupSearch,
    headerMenuOpen,
    isGroupModalOpen,
    isRuleModalOpen,
    proxyRuleForm,
    ruleSearch,
    setActiveGroupId,
    setEditingGroup,
    setEditingRule,
    setGroupName,
    setHeaderMenuOpen,
    setIsGroupModalOpen,
    setIsRuleModalOpen,
    setProxyRuleForm,
    setProxyRuleSearch,
    setSubmitting,
    setProxyFilterMode,
    sortMode,
    storeActiveGroupId,
    submitting,
  } = useProxyForwardWorkspace();

  const groups = groupsQuery.data?.groups ?? DEFAULT_GROUPS;
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

  const { activeGroup, filteredRules, overview, visibleGroups } =
    useProxyForwardDerivedState({
      activeGroupId,
      filterMode,
      groupSearch,
      groups,
      requests,
      ruleSearch,
      sortMode,
    });

  const {
    exportGroup,
    handleDeleteGroup,
    handleDeleteRule,
    handleSaveGroup,
    handleSaveRule,
    handleSelectGroup,
    handleToggleRule,
    importGroups,
    pendingRuleIds,
    refetchProxyData,
  } = useProxyForwardActions({
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
  });

  const openCreateRule = useCallback(() => {
    setEditingRule(null);
    setProxyRuleForm(buildEmptyRule(activeGroup?.name ?? defaultGroupLabel));
    setIsRuleModalOpen(true);
  }, [activeGroup?.name, setEditingRule, setIsRuleModalOpen, setProxyRuleForm]);

  const openEditRule = useCallback((rule: StoredForwardRule) => {
    setEditingRule(rule);
    setProxyRuleForm(rule);
    setIsRuleModalOpen(true);
  }, [setEditingRule, setIsRuleModalOpen, setProxyRuleForm]);

  const openEditGroup = useCallback(() => {
    const group = groups.find((item) => item.id === activeGroupId);
    if (!group) return;
    setEditingGroup(group);
    setGroupName(group.name);
    setIsGroupModalOpen(true);
  }, [activeGroupId, groups, setEditingGroup, setGroupName, setIsGroupModalOpen]);

  const handleImportGroups = useCallback(() => {
    void importGroups().catch((error) =>
      showToast(error instanceof Error ? error.message : "导入失败", "error"),
    );
  }, [importGroups, showToast]);

  const buildGroupMenu = useCallback((group: StoredGroup): MenuProps["items"] => [
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
          mask: { closable: false },
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
  ], [exportGroup, handleDeleteGroup, setEditingGroup, setGroupName, setIsGroupModalOpen]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h2>代理转发</h2>
          <p>管理站点级转发规则、运行状态和最近命中流量。</p>
        </div>
        <Button onClick={() => setIsWhistleImportOpen(true)} type="primary">
          从 Whistle 导入
        </Button>
      </header>
      <div className={styles.workspace}>
        <GroupSidebar
          buildGroupMenu={buildGroupMenu}
          onImportGroups={handleImportGroups}
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
            overview={overview}
          />
          <RuleToolbar
            canEditGroup={Boolean(activeGroup)}
            headerMenuOpen={headerMenuOpen}
            onLoad={() => void refetchProxyData()}
            onOpenCreateRule={openCreateRule}
            onOpenEditGroup={openEditGroup}
            setHeaderMenuOpen={setHeaderMenuOpen}
          />
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
      <WhistleImportModal
        defaultScope="proxy"
        onClose={() => setIsWhistleImportOpen(false)}
        open={isWhistleImportOpen}
      />
    </div>
  );
}
