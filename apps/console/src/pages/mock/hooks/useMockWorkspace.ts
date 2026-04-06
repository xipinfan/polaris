import { useEffect, useMemo } from "react";
import type { MockRule } from "@polaris/shared-types";
import * as React from "react";
import {
  useCreateMockRuleMutation,
  useDeleteMockRuleMutation,
  useEnableMockRuleMutation,
  useSetActiveMockGroupMutation,
  useUpdateMockRuleMutation,
} from "../../../domains/mock/mutations";
import { useMockActiveGroupQuery, useMockRulesQuery } from "../../../domains/mock/queries";
import { readPersistence, writePersistence } from "../../../lib/persistence";
import { uiSelectors, workspaceSelectors } from "../../../stores/selectors";
import { useUiStore } from "../../../stores/uiStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import type { GroupMetaMap, MockFormState, MockPageLocationState } from "../types";
import { useMockWorkspaceActions } from "./useMockWorkspaceActions";
import { buildCurrentGroupRules, buildGroupedMockRules, buildGroupSummaries, buildRuleBlocks } from "./mockWorkspaceDerivedState";
import {
  buildEmptyForm,
  getQueryCount,
  groupMetaStorageKey,
  groupsStorageKey,
} from "../utils/mockHelpers";

const EMPTY_RULES: MockRule[] = [];

type UseMockWorkspaceArgs = {
  defaultGroup: string;
  locationState: MockPageLocationState | null;
  pathname: string;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
};

export function useMockWorkspace({ defaultGroup, locationState, pathname, showToast }: UseMockWorkspaceArgs) {
  const isInitializedRef = React.useRef(false);
  const rulesQuery = useMockRulesQuery();
  const activeGroupQuery = useMockActiveGroupQuery();

  const setActiveGroupMutation = useSetActiveMockGroupMutation();
  const createRuleMutation = useCreateMockRuleMutation();
  const updateRuleMutation = useUpdateMockRuleMutation();
  const enableRuleMutation = useEnableMockRuleMutation();
  const deleteRuleMutation = useDeleteMockRuleMutation();

  const groupSearch = useUiStore(uiSelectors.mockGroupSearch);
  const setGroupSearch = useUiStore((state) => state.setMockGroupSearch);

  const selectedGroup = useWorkspaceStore(workspaceSelectors.mockSelectedGroup);
  const selectedRuleId = useWorkspaceStore(workspaceSelectors.mockSelectedRuleId);
  const editingId = useWorkspaceStore(workspaceSelectors.mockEditingId);
  const isModalOpen = useWorkspaceStore(workspaceSelectors.mockModalOpen);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const ruleMenuId = useWorkspaceStore(workspaceSelectors.mockRuleMenuId);
  const collapsedBlocks = useWorkspaceStore(workspaceSelectors.mockCollapsedBlocks);
  const customGroups = useWorkspaceStore(workspaceSelectors.mockCustomGroups);
  const groupMeta = useWorkspaceStore(workspaceSelectors.mockGroupMeta);
  const storedForm = useWorkspaceStore(workspaceSelectors.mockForm);

  const setSelectedGroup = useWorkspaceStore((state) => state.setMockSelectedGroup);
  const setSelectedRuleId = useWorkspaceStore((state) => state.setMockSelectedRuleId);
  const setEditingId = useWorkspaceStore((state) => state.setMockEditingId);
  const setIsModalOpen = useWorkspaceStore((state) => state.setMockModalOpen);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);
  const setRuleMenuId = useWorkspaceStore((state) => state.setMockRuleMenuId);
  const setCollapsedBlocks = useWorkspaceStore((state) => state.setMockCollapsedBlocks);
  const setCustomGroups = useWorkspaceStore((state) => state.setMockCustomGroups);
  const setGroupMeta = useWorkspaceStore((state) => state.setMockGroupMeta);
  const setMockForm = useWorkspaceStore((state) => state.setMockForm);

  const form = storedForm ?? buildEmptyForm(defaultGroup);

  const setForm = (updater: (current: MockFormState) => MockFormState) => {
    setMockForm((current) => updater(current ?? buildEmptyForm(defaultGroup)));
  };

  const rules = rulesQuery.data ?? EMPTY_RULES;

  useEffect(() => {
    if (isInitializedRef.current) {
      return;
    }
    setCustomGroups(() => readPersistence<string[]>(groupsStorageKey, []));
    setGroupMeta(() => readPersistence<GroupMetaMap>(groupMetaStorageKey, {}));
    isInitializedRef.current = true;
  }, [setCustomGroups, setGroupMeta]);

  useEffect(() => {
    writePersistence(groupsStorageKey, customGroups);
  }, [customGroups]);

  useEffect(() => {
    writePersistence(groupMetaStorageKey, groupMeta);
  }, [groupMeta]);

  const groupedRules = useMemo(() => buildGroupedMockRules(rules, defaultGroup), [defaultGroup, rules]);

  const groups = useMemo(
    () => Array.from(new Set([defaultGroup, ...customGroups, ...Object.keys(groupedRules)])),
    [customGroups, defaultGroup, groupedRules],
  );

  const filteredGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => group.toLowerCase().includes(keyword));
  }, [groupSearch, groups]);

  useEffect(() => {
    const activeGroup = activeGroupQuery.data?.group;
    const nextGroup =
      (activeGroup && groups.includes(activeGroup) ? activeGroup : undefined) ??
      groups[0] ??
      defaultGroup;

    if (nextGroup !== selectedGroup) {
      setSelectedGroup(nextGroup);
    }
  }, [activeGroupQuery.data?.group, defaultGroup, groups, selectedGroup, setSelectedGroup]);

  const currentGroup = groups.includes(selectedGroup) ? selectedGroup : defaultGroup;

  const currentGroupRules = useMemo(
    () => buildCurrentGroupRules(groupedRules, currentGroup, defaultGroup),
    [currentGroup, defaultGroup, groupedRules],
  );

  const currentGroupRuleBlocks = useMemo(() => buildRuleBlocks(currentGroupRules), [currentGroupRules]);

  const currentGroupEnabledRules = useMemo(
    () => currentGroupRules.filter((rule) => rule.enabled),
    [currentGroupRules],
  );
  const currentGroupDescription = groupMeta[currentGroup]?.description?.trim();
  const isCurrentGroupEnabled = currentGroupRules.some((rule) => rule.enabled);

  useEffect(() => {
    const seedRequest = locationState?.seedRequest;
    if (!seedRequest) return;
    setEditingId(null);
    setMockForm({
      ...buildEmptyForm(currentGroup),
      group: currentGroup,
      variant: `${seedRequest.method} ${seedRequest.path}`,
      method: seedRequest.method,
      url: seedRequest.url,
      requestBodyExactMatch: "",
      requestBodyKeyMatch: "",
      responseStatus: seedRequest.statusCode,
      responseHeaders: JSON.stringify(seedRequest.responseHeaders, null, 2),
      responseBody: JSON.stringify(seedRequest.responseBody ?? {}, null, 2),
      enabled: true,
    });
    setIsModalOpen(true);
    showToast(`已根据 ${seedRequest.host} 的请求预填充模拟草稿，归入 ${currentGroup}`);
    window.history.replaceState(window.history.state, document.title, pathname);
  }, [currentGroup, locationState?.seedRequest, pathname, setEditingId, setIsModalOpen, setMockForm, showToast]);

  useEffect(() => {
    const closeMenus = () => {
      setGroupMenuName(null);
      setRuleMenuId(null);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, [setGroupMenuName, setRuleMenuId]);

  const groupSummaries = useMemo(
    () => buildGroupSummaries(groups, groupedRules, currentGroup),
    [currentGroup, groupedRules, groups],
  );

  const load = async () => {
    await Promise.all([rulesQuery.refetch(), activeGroupQuery.refetch()]);
  };

  const actions = useMockWorkspaceActions({
    createRule: (payload) => createRuleMutation.mutateAsync(payload),
    currentGroup,
    currentGroupRules,
    customGroups,
    defaultGroup,
    deleteRule: (id) => deleteRuleMutation.mutateAsync(id),
    enableRule: (id, enabled) => enableRuleMutation.mutateAsync({ id, enabled }),
    editingId,
    existingRules: rules,
    form,
    groupMeta,
    groupedRules,
    groups,
    isCurrentGroupEnabled,
    load,
    setActiveGroup: (group) => setActiveGroupMutation.mutateAsync(group),
    setCustomGroups,
    setEditingId,
    setGroupMenuName,
    setGroupMeta,
    setIsModalOpen,
    setMockForm,
    setRuleMenuId,
    setSelectedGroup,
    setSelectedRuleId,
    showToast,
    updateRule: (id, payload) => updateRuleMutation.mutateAsync({ id, payload }),
  });

  return {
    activateGroup: actions.activateGroup,
    collapsedBlocks,
    copyGroup: actions.copyGroup,
    currentGroup,
    currentGroupDescription,
    currentGroupEnabledRules,
    currentGroupRuleBlocks,
    currentGroupRules,
    customGroups,
    defaultGroup,
    deleteGroup: actions.deleteGroup,
    duplicateRule: actions.duplicateRule,
    duplicateRulesForUrlBlock: actions.duplicateRulesForUrlBlock,
    editGroupDescription: actions.editGroupDescription,
    editingId,
    exportMockGroup: actions.exportMockGroup,
    exportMockGroups: actions.exportMockGroups,
    exportSelectedMockRules: actions.exportSelectedMockRules,
    filteredGroups,
    form,
    getQueryCount,
    groupMenuName,
    groupMeta,
    groupSearch,
    groupSummaries,
    groups,
    isCurrentGroupEnabled,
    isModalOpen,
    importMockGroups: actions.importMockGroups,
    importRulesToCurrentGroup: actions.importRulesToCurrentGroup,
    load,
    moveRuleToGroup: actions.moveRuleToGroup,
    openCreateModalForUrl: actions.openCreateModalForUrl,
    openCreateModal: actions.openCreateModal,
    openEditModal: actions.openEditModal,
    removeRule: actions.removeRule,
    removeRulesForUrlBlock: actions.removeRulesForUrlBlock,
    renameGroup: actions.renameGroup,
    ruleMenuId,
    saveRule: actions.saveRule,
    selectedGroup,
    selectedRuleId,
    setCollapsedBlocks,
    setCustomGroups,
    setEditingId,
    setForm,
    setGroupMenuName,
    setGroupMeta,
    setGroupName: setSelectedGroup,
    setGroupSearch,
    setIsModalOpen,
    setRuleMenuId,
    setSelectedGroup,
    setSelectedRuleId,
    showToast,
    toggleCurrentGroup: actions.toggleCurrentGroup,
    toggleRule: actions.toggleRule,
  };
}


