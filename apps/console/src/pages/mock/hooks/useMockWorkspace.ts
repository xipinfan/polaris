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
  buildUniqueVariantName,
  getMethodWeight,
  getQueryCount,
  getRuleScene,
  getUrlSummary,
  groupMetaStorageKey,
  groupsStorageKey,
} from "../utils/mockHelpers";

type ExportableMockRule = {
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

type ExportableMockGroup = {
  name: string;
  description?: string;
  rules: ExportableMockRule[];
};

type UseMockWorkspaceArgs = {
  defaultGroup: string;
  locationState: MockPageLocationState | null;
  pathname: string;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  t: TranslateFn;
};

function validateExactBodyMatchExpression(expression: string): string | null {
  const text = expression.trim();
  if (!text) {
    return null;
  }

  const entries = text
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      return "Body 精确匹配格式错误，请使用 path:\"value\"";
    }
    const path = entry.slice(0, separatorIndex).trim();
    const valueLiteral = entry.slice(separatorIndex + 1).trim();
    if (!path || !(valueLiteral.startsWith("\"") && valueLiteral.endsWith("\""))) {
      return "Body 精确匹配格式错误，请使用 path:\"value\"";
    }
    try {
      const parsed = JSON.parse(valueLiteral);
      if (typeof parsed !== "string") {
        return "Body 精确匹配的值必须为字符串";
      }
    } catch {
      return "Body 精确匹配字符串格式非法";
    }
  }

  return null;
}

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

  const toExportableRule = (rule: MockRule, includeGroup: boolean): ExportableMockRule => {
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
  };

  const buildRuleCollisionKey = (group: string, method: string, url: string, variant: string) =>
    `${group}__${method.toUpperCase()}__${url}__${variant}`;

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
      requestBodyExactMatch: "",
      requestBodyKeyMatch: "",
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
    const exactMatchError = validateExactBodyMatchExpression(form.requestBodyExactMatch);
    if (exactMatchError) {
      throw new Error(exactMatchError);
    }

    const payload = {
      name: buildRuleName(form.group, form.variant),
      group: form.group,
      method: form.method,
      url: form.url,
      requestBodyExactMatch: form.requestBodyExactMatch.trim() || null,
      requestBodyKeyMatch: form.requestBodyKeyMatch.trim() || null,
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

  const renameGroup = async (groupName: string, rawNextName: string) => {
    const nextName = rawNextName.trim();
    if (!nextName || nextName === groupName || groups.includes(nextName)) return;

    const groupRules = groupedRules[groupName] ?? [];
    await Promise.all(
      groupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return updateRuleMutation.mutateAsync({
          id: rule.id,
          payload: {
            name: buildRuleName(nextName, scene.variant),
            group: nextName,
            method: rule.method,
            url: rule.url,
            requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
            requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
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
          group: nextName,
          method: rule.method,
          url: rule.url,
          requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
          requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
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

  const editGroupDescription = (rawDescription: string) => {
    const nextDescription = rawDescription.trim();
    setGroupMeta((current) => ({
      ...current,
      [currentGroup]: {
        description: nextDescription,
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
    const existingVariants = currentGroupRules.map((item) => getRuleScene(item, defaultGroup).variant);
    const nextVariant = buildUniqueVariantName(`${scene.variant} 副本`, existingVariants);
    await createRuleMutation.mutateAsync({
      name: buildRuleName(currentGroup, nextVariant),
      group: currentGroup,
      method: rule.method,
      url: rule.url,
      requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
      requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
      responseStatus: rule.responseStatus,
      responseHeaders: rule.responseHeaders,
      responseBody: rule.responseBody,
      enabled: false,
    });
    await load();
    setRuleMenuId(null);
    showToast(t("common.mockDuplicated", { name: scene.variant }));
  };

  const openCreateModalForUrl = (url: string) => {
    setEditingId(null);
    setMockForm({
      ...buildEmptyForm(currentGroup),
      group: currentGroup,
      url,
    });
    setIsModalOpen(true);
  };

  const duplicateRulesForUrlBlock = async (
    rulesInBlock: MockRule[],
    nextMatch: { url: string; requestBodyExactMatch: string; requestBodyKeyMatch: string }
  ) => {
    if (!rulesInBlock.length) {
      return;
    }

    const existingVariants = new Set(currentGroupRules.map((rule) => getRuleScene(rule, defaultGroup).variant));
    let duplicatedCount = 0;

    for (const rule of rulesInBlock) {
      const scene = getRuleScene(rule, defaultGroup);
      const nextVariant = buildUniqueVariantName(`${scene.variant} 副本`, existingVariants);
      existingVariants.add(nextVariant);

      await createRuleMutation.mutateAsync({
        name: buildRuleName(currentGroup, nextVariant),
        group: currentGroup,
        method: rule.method,
        url: nextMatch.url.trim(),
        requestBodyExactMatch: nextMatch.requestBodyExactMatch.trim() || null,
        requestBodyKeyMatch: nextMatch.requestBodyKeyMatch.trim() || null,
        responseStatus: rule.responseStatus,
        responseHeaders: rule.responseHeaders,
        responseBody: rule.responseBody,
        enabled: false,
      });
      duplicatedCount += 1;
    }

    await load();
    showToast(`已复制 ${duplicatedCount} 条 Mock 到新匹配条件`);
  };

  const removeRulesForUrlBlock = async (rulesInBlock: MockRule[]) => {
    if (!rulesInBlock.length) {
      return;
    }

    await Promise.all(rulesInBlock.map((rule) => deleteRuleMutation.mutateAsync(rule.id)));
    await load();
    showToast(`已删除 ${rulesInBlock.length} 条同地址 Mock`);
  };

  const moveRuleToGroup = async (rule: MockRule, nextGroup: string) => {
    const scene = getRuleScene(rule, defaultGroup);
    if (scene.group === nextGroup) {
      setRuleMenuId(null);
      return;
    }

    await updateRuleMutation.mutateAsync({
      id: rule.id,
      payload: {
        name: buildRuleName(nextGroup, scene.variant),
        group: nextGroup,
        method: rule.method,
        url: rule.url,
        requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
        requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
        responseStatus: rule.responseStatus,
        responseHeaders: rule.responseHeaders,
        responseBody: rule.responseBody,
        enabled: rule.enabled,
      },
    });

    if (!customGroups.includes(nextGroup) && nextGroup !== defaultGroup) {
      setCustomGroups((current) => [...current, nextGroup]);
    }

    await load();
    setRuleMenuId(null);
    showToast(`已移动到分组「${nextGroup}」`);
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

  const exportMockGroups = () => {
    const payload: ExportableMockGroup[] = groups.map((groupName) => ({
      name: groupName,
      description: groupMeta[groupName]?.description?.trim() || undefined,
      rules: (groupedRules[groupName] ?? []).map((rule) => toExportableRule(rule, false)),
    }));
    return payload;
  };

  const exportMockGroup = (groupName: string): ExportableMockGroup | null => {
    if (!groups.includes(groupName)) {
      return null;
    }
    return {
      name: groupName,
      description: groupMeta[groupName]?.description?.trim() || undefined,
      rules: (groupedRules[groupName] ?? []).map((rule) => toExportableRule(rule, false)),
    };
  };

  const importMockGroups = async (importedGroups: ExportableMockGroup[]) => {
    if (!Array.isArray(importedGroups) || importedGroups.length === 0) {
      throw new Error("导入内容为空");
    }

    const collisionMap = new Map<string, MockRule>();
    for (const rule of rules) {
      const scene = getRuleScene(rule, defaultGroup);
      collisionMap.set(buildRuleCollisionKey(scene.group, rule.method, rule.url, scene.variant), rule);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const groupEntry of importedGroups) {
      const groupName = String(groupEntry?.name ?? "").trim();
      if (!groupName) {
        skipped += 1;
        continue;
      }

      if (!customGroups.includes(groupName) && groupName !== defaultGroup) {
        setCustomGroups((current) => (current.includes(groupName) ? current : [...current, groupName]));
      }

      if (groupEntry.description !== undefined) {
        setGroupMeta((current) => ({
          ...current,
          [groupName]: {
            description: String(groupEntry.description ?? "").trim(),
          },
        }));
      }

      for (const ruleEntry of groupEntry.rules ?? []) {
        const variant = String(ruleEntry?.variant ?? "").trim();
        const method = String(ruleEntry?.method ?? "").toUpperCase();
        const url = String(ruleEntry?.url ?? "").trim();
        if (!variant || !method || !url) {
          skipped += 1;
          continue;
        }

        const key = buildRuleCollisionKey(groupName, method, url, variant);
        const existing = collisionMap.get(key);
        const payload = {
          name: buildRuleName(groupName, variant),
          group: groupName,
          method,
          url,
          requestBodyExactMatch: String(ruleEntry.requestBodyExactMatch ?? "").trim() || null,
          requestBodyKeyMatch: String(ruleEntry.requestBodyKeyMatch ?? "").trim() || null,
          responseStatus: Number(ruleEntry.responseStatus) || 200,
          responseHeaders: (ruleEntry.responseHeaders ?? {}) as Record<string, string>,
          responseBody: ruleEntry.responseBody ?? {},
          enabled: Boolean(ruleEntry.enabled),
        };

        if (existing) {
          await updateRuleMutation.mutateAsync({ id: existing.id, payload });
          updated += 1;
        } else {
          const createdRule = await createRuleMutation.mutateAsync(payload);
          collisionMap.set(key, createdRule);
          created += 1;
        }
      }
    }

    await load();
    showToast(`导入完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}`);
  };

  const exportSelectedMockRules = (selectedRules: MockRule[], includeGroup: boolean) =>
    selectedRules.map((rule) => toExportableRule(rule, includeGroup));

  const importRulesToCurrentGroup = async (importedRules: ExportableMockRule[]) => {
    if (!Array.isArray(importedRules) || importedRules.length === 0) {
      throw new Error("导入内容为空");
    }

    const collisionMap = new Map<string, MockRule>();
    for (const rule of currentGroupRules) {
      const scene = getRuleScene(rule, defaultGroup);
      collisionMap.set(buildRuleCollisionKey(currentGroup, rule.method, rule.url, scene.variant), rule);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const ruleEntry of importedRules) {
      const variant = String(ruleEntry?.variant ?? "").trim();
      const method = String(ruleEntry?.method ?? "").toUpperCase();
      const url = String(ruleEntry?.url ?? "").trim();
      if (!variant || !method || !url) {
        skipped += 1;
        continue;
      }

      const key = buildRuleCollisionKey(currentGroup, method, url, variant);
      const existing = collisionMap.get(key);
      const payload = {
        name: buildRuleName(currentGroup, variant),
        group: currentGroup,
        method,
        url,
        requestBodyExactMatch: String(ruleEntry.requestBodyExactMatch ?? "").trim() || null,
        requestBodyKeyMatch: String(ruleEntry.requestBodyKeyMatch ?? "").trim() || null,
        responseStatus: Number(ruleEntry.responseStatus) || 200,
        responseHeaders: (ruleEntry.responseHeaders ?? {}) as Record<string, string>,
        responseBody: ruleEntry.responseBody ?? {},
        enabled: Boolean(ruleEntry.enabled),
      };

      if (existing) {
        await updateRuleMutation.mutateAsync({ id: existing.id, payload });
        updated += 1;
      } else {
        const createdRule = await createRuleMutation.mutateAsync(payload);
        collisionMap.set(key, createdRule);
        created += 1;
      }
    }

    await load();
    showToast(`导入完成：新增 ${created}，更新 ${updated}，跳过 ${skipped}`);
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
    duplicateRulesForUrlBlock,
    editGroupDescription,
    editingId,
    exportMockGroup,
    exportMockGroups,
    exportSelectedMockRules,
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
    importMockGroups,
    importRulesToCurrentGroup,
    load,
    moveRuleToGroup,
    openCreateModalForUrl,
    openCreateModal,
    openEditModal,
    removeRule,
    removeRulesForUrlBlock,
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
