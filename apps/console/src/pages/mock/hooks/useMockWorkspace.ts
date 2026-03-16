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
import type { TranslateFn } from "../../../i18n/I18nProvider";
import { readPersistence, writePersistence } from "../../../lib/persistence";
import { uiSelectors, workspaceSelectors } from "../../../stores/selectors";
import { useUiStore } from "../../../stores/uiStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import type { GroupMetaMap, MockFormState, MockPageLocationState, RuleUrlBlock } from "../types";
import {
  buildEmptyForm,
  buildFormFromRule,
  buildRuleName,
  buildUniqueGroupName,
  getMethodWeight,
  getQueryCount,
  getRuleScene,
  getUrlSummary,
  groupMetaStorageKey,
  groupsStorageKey,
} from "../utils/mockHelpers";

type UseMockWorkspaceArgs = {
  defaultGroup: string;
  locationState: MockPageLocationState | null;
  pathname: string;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  t: TranslateFn;
};

export function useMockWorkspace({ defaultGroup, locationState, pathname, showToast, t }: UseMockWorkspaceArgs) {
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

  const rules = rulesQuery.data ?? [];

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

  useEffect(() => {
    const active = activeGroupQuery.data?.group;
    if (active) {
      if (active !== selectedGroup) {
        setSelectedGroup(active);
      }
      return;
    }
    if (!selectedGroup) {
      setSelectedGroup(defaultGroup);
    }
  }, [activeGroupQuery.data?.group, defaultGroup, selectedGroup, setSelectedGroup]);

  const groupedRules = useMemo(
    () =>
      rules.reduce<Record<string, MockRule[]>>((acc, rule) => {
        const { group } = getRuleScene(rule, defaultGroup);
        acc[group] = [...(acc[group] ?? []), rule];
        return acc;
      }, {}),
    [defaultGroup, rules],
  );

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
    if (groups.length && (!selectedGroup || !groups.includes(selectedGroup))) {
      setSelectedGroup(groups[0]);
    }
  }, [groups, selectedGroup, setSelectedGroup]);

  const currentGroup = groups.includes(selectedGroup) ? selectedGroup : defaultGroup;

  const currentGroupRules = useMemo(
    () =>
      [...(groupedRules[currentGroup] ?? [])].sort((left, right) => {
        const leftUrl = getUrlSummary(left.url);
        const rightUrl = getUrlSummary(right.url);
        const urlDiff = leftUrl.blockKey.localeCompare(rightUrl.blockKey, "zh-CN");
        if (urlDiff !== 0) return urlDiff;
        const methodDiff = getMethodWeight(left.method) - getMethodWeight(right.method);
        if (methodDiff !== 0) return methodDiff;
        const leftScene = getRuleScene(left, defaultGroup);
        const rightScene = getRuleScene(right, defaultGroup);
        const variantDiff = leftScene.variant.localeCompare(rightScene.variant, "zh-CN");
        if (variantDiff !== 0) return variantDiff;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }),
    [currentGroup, defaultGroup, groupedRules],
  );

  const currentGroupRuleBlocks = useMemo(
    () =>
      currentGroupRules.reduce<RuleUrlBlock[]>((blocks, rule) => {
        const summary = getUrlSummary(rule.url);
        const latestBlock = blocks[blocks.length - 1];
        if (!latestBlock || latestBlock.key !== summary.blockKey) {
          blocks.push({ key: summary.blockKey, host: summary.host, label: summary.label, rules: [rule] });
          return blocks;
        }
        latestBlock.rules.push(rule);
        return blocks;
      }, []),
    [currentGroupRules],
  );

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
      responseStatus: seedRequest.statusCode,
      responseHeaders: JSON.stringify(seedRequest.responseHeaders, null, 2),
      responseBody: JSON.stringify(seedRequest.responseBody ?? {}, null, 2),
      enabled: true,
    });
    setIsModalOpen(true);
    showToast(t("mock.seeded", { host: seedRequest.host, group: currentGroup }));
    window.history.replaceState(window.history.state, document.title, pathname);
  }, [currentGroup, locationState?.seedRequest, pathname, setEditingId, setIsModalOpen, setMockForm, showToast, t]);

  useEffect(() => {
    const closeMenus = () => {
      setGroupMenuName(null);
      setRuleMenuId(null);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, [setGroupMenuName, setRuleMenuId]);

  const groupSummaries = useMemo(
    () =>
      groups.map((group) => {
        const rulesInGroup = groupedRules[group] ?? [];
        return {
          group,
          count: rulesInGroup.length,
          enabledCount: rulesInGroup.filter((rule) => rule.enabled).length,
          active: group === currentGroup,
        };
      }),
    [currentGroup, groupedRules, groups],
  );

  const load = async () => {
    await Promise.all([rulesQuery.refetch(), activeGroupQuery.refetch()]);
  };

  const activateGroup = async (group: string) => {
    await setActiveGroupMutation.mutateAsync(group);
    setSelectedGroup(group);
    setGroupMenuName(null);
    showToast(t("mock.groupSwitched", { name: group }));
  };

  const saveRule = async () => {
    const payload = {
      name: buildRuleName(form.group, form.variant),
      method: form.method,
      url: form.url,
      responseStatus: Number(form.responseStatus),
      responseHeaders: JSON.parse(form.responseHeaders || "{}"),
      responseBody: JSON.parse(form.responseBody || "{}"),
      enabled: form.enabled,
    };

    const persistedRule = editingId
      ? await updateRuleMutation.mutateAsync({ id: editingId, payload })
      : await createRuleMutation.mutateAsync(payload);

    if (!customGroups.includes(form.group) && form.group !== defaultGroup) {
      setCustomGroups((current) => [...current, form.group]);
    }

    await setActiveGroupMutation.mutateAsync(form.group);
    setSelectedGroup(form.group);
    setSelectedRuleId(persistedRule.id);
    await load();
    showToast(
      editingId
        ? t("common.mockUpdated", { name: form.variant })
        : t("common.mockCreatedInGroup", { name: form.variant, group: form.group }),
    );
    setIsModalOpen(false);
    setEditingId(null);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setMockForm(buildEmptyForm(currentGroup));
    setIsModalOpen(true);
  };

  const openEditModal = (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    setSelectedRuleId(rule.id);
    setEditingId(rule.id);
    setMockForm(buildFormFromRule(rule, scene.group, defaultGroup));
    setIsModalOpen(true);
  };

  const renameGroup = async (groupName: string) => {
    const nextName = window.prompt(t("mock.groupRenamePrompt"), groupName)?.trim();
    if (!nextName || nextName === groupName || groups.includes(nextName)) return;

    const groupRules = groupedRules[groupName] ?? [];
    await Promise.all(
      groupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return updateRuleMutation.mutateAsync({
          id: rule.id,
          payload: {
            name: buildRuleName(nextName, scene.variant),
            method: rule.method,
            url: rule.url,
            responseStatus: rule.responseStatus,
            responseHeaders: rule.responseHeaders,
            responseBody: rule.responseBody,
            enabled: rule.enabled,
          },
        });
      }),
    );

    setCustomGroups((current) => current.map((item) => (item === groupName ? nextName : item)));
    setGroupMeta((current) => {
      const next = { ...current };
      next[nextName] = next[groupName];
      delete next[groupName];
      return next;
    });

    await setActiveGroupMutation.mutateAsync(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupRenamed", { name: nextName }));
  };

  const copyGroup = async (groupName: string) => {
    const nextName = buildUniqueGroupName(`${groupName} 副本`, groups);
    const groupRules = groupedRules[groupName] ?? [];

    await Promise.all(
      groupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return createRuleMutation.mutateAsync({
          name: buildRuleName(nextName, scene.variant),
          method: rule.method,
          url: rule.url,
          responseStatus: rule.responseStatus,
          responseHeaders: rule.responseHeaders,
          responseBody: rule.responseBody,
          enabled: false,
        });
      }),
    );

    setCustomGroups((current) => [...current, nextName]);
    setGroupMeta((current) => ({ ...current, [nextName]: current[groupName] }));
    await setActiveGroupMutation.mutateAsync(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupCopied", { name: nextName }));
  };

  const deleteGroup = async (groupName: string) => {
    const confirmed = window.confirm(t("mock.groupDeleteConfirm", { name: groupName }));
    if (!confirmed) return;

    const groupRules = groupedRules[groupName] ?? [];
    await Promise.all(groupRules.map((rule) => deleteRuleMutation.mutateAsync(rule.id)));

    setCustomGroups((current) => current.filter((item) => item !== groupName));
    setGroupMeta((current) => {
      const next = { ...current };
      delete next[groupName];
      return next;
    });

    await setActiveGroupMutation.mutateAsync(defaultGroup);
    setSelectedGroup(defaultGroup);
    setGroupMenuName(null);
    await load();
    showToast(t("mock.groupDeleted", { name: groupName }));
  };

  const editGroupDescription = () => {
    const nextDescription = window.prompt(
      t("mock.groupDescriptionPrompt"),
      groupMeta[currentGroup]?.description ?? "",
    );
    if (nextDescription === null) return;

    setGroupMeta((current) => ({
      ...current,
      [currentGroup]: {
        description: nextDescription.trim(),
      },
    }));
    showToast(t("mock.groupDescriptionSaved"));
  };

  const toggleCurrentGroup = async () => {
    const nextEnabled = !isCurrentGroupEnabled;
    await Promise.all(
      currentGroupRules.map((rule) =>
        enableRuleMutation.mutateAsync({ id: rule.id, enabled: nextEnabled }),
      ),
    );
    await load();
    showToast(
      nextEnabled
        ? t("mock.groupEnabled", { name: currentGroup })
        : t("mock.groupDisabled", { name: currentGroup }),
    );
  };

  const duplicateRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await createRuleMutation.mutateAsync({
      name: buildRuleName(currentGroup, `${scene.variant} 副本`),
      method: rule.method,
      url: rule.url,
      responseStatus: rule.responseStatus,
      responseHeaders: rule.responseHeaders,
      responseBody: rule.responseBody,
      enabled: false,
    });
    await load();
    setRuleMenuId(null);
    showToast(t("common.mockDuplicated", { name: scene.variant }));
  };

  const toggleRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await enableRuleMutation.mutateAsync({ id: rule.id, enabled: !rule.enabled });
    await load();
    setRuleMenuId(null);
    showToast(
      rule.enabled
        ? t("common.mockDisabled", { name: scene.variant })
        : t("common.mockEnabled", { name: scene.variant }),
    );
  };

  const removeRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await deleteRuleMutation.mutateAsync(rule.id);
    await load();
    setRuleMenuId(null);
    showToast(t("common.mockDeleted", { name: scene.variant }));
  };

  return {
    activateGroup,
    collapsedBlocks,
    copyGroup,
    currentGroup,
    currentGroupDescription,
    currentGroupEnabledRules,
    currentGroupRuleBlocks,
    currentGroupRules,
    customGroups,
    defaultGroup,
    deleteGroup,
    duplicateRule,
    editGroupDescription,
    editingId,
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
    load,
    openCreateModal,
    openEditModal,
    removeRule,
    renameGroup,
    ruleMenuId,
    saveRule,
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
    toggleCurrentGroup,
    toggleRule,
  };
}
