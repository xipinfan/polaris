import type { MockRule } from "@polaris/shared-types";
import type { MockFormState } from "../types";
import {
  buildImportSummaryMessage,
  buildMockRulePayloadFromRule,
  exportMockGroupData,
  mergeImportedMockGroups,
  mergeImportedRulesIntoGroup,
  toExportableMockRule,
  type ExportableMockGroup,
  type ExportableMockRule,
  type MockRulePayload,
} from "../utils/mockImportExport";
import {
  copyMockGroup,
  deleteMockGroup,
  renameMockGroup,
  renameMockGroupMeta,
} from "../utils/mockGroupOperations";
import {
  buildMockPayloadFromForm,
  buildNextDuplicateVariant,
  validateExactBodyMatchExpression,
} from "../utils/mockWorkspaceHelpers";
import { buildEmptyForm, buildFormFromRule, buildUniqueVariantName, getRuleScene } from "../utils/mockHelpers";

type SetState<T> = (updater: (current: T) => T) => void;
type SetValue<T> = (value: T) => void;

type UseMockWorkspaceActionsArgs = {
  createRule: (payload: MockRulePayload) => Promise<MockRule>;
  currentGroup: string;
  currentGroupRules: MockRule[];
  customGroups: string[];
  defaultGroup: string;
  deleteRule: (id: string) => Promise<unknown>;
  enableRule: (id: string, enabled: boolean) => Promise<unknown>;
  editingId: string | null;
  existingRules: MockRule[];
  form: MockFormState;
  groupMeta: Record<string, { description?: string }>;
  groupedRules: Record<string, MockRule[]>;
  groups: string[];
  isCurrentGroupEnabled: boolean;
  load: () => Promise<void>;
  setActiveGroup: (group: string) => Promise<unknown>;
  setCustomGroups: SetState<string[]>;
  setEditingId: SetValue<string | null>;
  setGroupMenuName: SetValue<string | null>;
  setGroupMeta: SetState<Record<string, { description?: string }>>;
  setIsModalOpen: SetValue<boolean>;
  setMockForm: SetValue<MockFormState | ((current: MockFormState | null) => MockFormState)>;
  setRuleMenuId: SetValue<string | null>;
  setSelectedGroup: SetValue<string>;
  setSelectedRuleId: SetValue<string | null>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  updateRule: (id: string, payload: MockRulePayload) => Promise<MockRule | unknown>;
};

export function useMockWorkspaceActions({
  createRule,
  currentGroup,
  currentGroupRules,
  customGroups,
  defaultGroup,
  deleteRule,
  enableRule,
  editingId,
  existingRules,
  form,
  groupMeta,
  groupedRules,
  groups,
  isCurrentGroupEnabled,
  load,
  setActiveGroup,
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
  updateRule,
}: UseMockWorkspaceActionsArgs) {
  const activateGroup = async (group: string) => {
    await setActiveGroup(group);
    setSelectedGroup(group);
    setGroupMenuName(null);
    showToast(`已切换到场景分组：${group}`);
  };

  const saveRule = async () => {
    const exactMatchError = validateExactBodyMatchExpression(form.requestBodyExactMatch);
    if (exactMatchError) {
      throw new Error(exactMatchError);
    }

    const payload = buildMockPayloadFromForm(form);
    if (!payload) {
      throw new Error("请补全规则名称、请求方法和 URL");
    }

    const persistedRule = editingId
      ? ((await updateRule(editingId, payload)) as MockRule)
      : await createRule(payload);

    if (!customGroups.includes(form.group) && form.group !== defaultGroup) {
      setCustomGroups((current) => [...current, form.group]);
    }

    await setActiveGroup(form.group);
    setSelectedGroup(form.group);
    setSelectedRuleId(persistedRule.id);
    await load();
    showToast(
      editingId
        ? `已更新模拟：${form.variant}`
        : `已在 ${form.group} 中创建模拟：${form.variant}`,
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

  const openCreateModalForUrl = (url: string) => {
    setEditingId(null);
    setMockForm({
      ...buildEmptyForm(currentGroup),
      group: currentGroup,
      url,
    });
    setIsModalOpen(true);
  };

  const renameGroup = async (groupName: string, rawNextName: string) => {
    const nextName = rawNextName.trim();
    if (!nextName || nextName === groupName || groups.includes(nextName)) return;

    const groupRules = groupedRules[groupName] ?? [];
    await renameMockGroup({
      defaultGroup,
      groupName,
      groupRules,
      nextName,
      updateRule,
    });

    setCustomGroups((current) => current.map((item) => (item === groupName ? nextName : item)));
    setGroupMeta((current) => renameMockGroupMeta(current, groupName, nextName));

    await setActiveGroup(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(`分组已重命名：${nextName}`);
  };

  const copyGroupAction = async (groupName: string) => {
    const nextName = await copyMockGroup({
      createRule,
      defaultGroup,
      groupName,
      groupRules: groupedRules[groupName] ?? [],
      groups,
    });

    setCustomGroups((current) => [...current, nextName]);
    setGroupMeta((current) => ({ ...current, [nextName]: current[groupName] }));
    await setActiveGroup(nextName);
    setSelectedGroup(nextName);
    setGroupMenuName(null);
    await load();
    showToast(`分组已复制：${nextName}`);
  };

  const deleteGroupAction = async (groupName: string) => {
    await deleteMockGroup({
      deleteRule,
      groupRules: groupedRules[groupName] ?? [],
    });

    setCustomGroups((current) => current.filter((item) => item !== groupName));
    setGroupMeta((current) => {
      const next = { ...current };
      delete next[groupName];
      return next;
    });

    await setActiveGroup(defaultGroup);
    setSelectedGroup(defaultGroup);
    setGroupMenuName(null);
    await load();
    showToast(`分组已删除：${groupName}`);
  };

  const editGroupDescription = (rawDescription: string) => {
    const nextDescription = rawDescription.trim();
    setGroupMeta((current) => ({
      ...current,
      [currentGroup]: {
        description: nextDescription,
      },
    }));
    showToast("分组描述已更新");
  };

  const toggleCurrentGroup = async () => {
    const nextEnabled = !isCurrentGroupEnabled;
    await Promise.all(currentGroupRules.map((rule) => enableRule(rule.id, nextEnabled)));
    await load();
    showToast(
      nextEnabled
        ? `已启用场景：${currentGroup}`
        : `已停用场景：${currentGroup}`,
    );
  };

  const duplicateRule = async (rule: MockRule) => {
    const { nextVariant, scene } = buildNextDuplicateVariant(rule, currentGroupRules, defaultGroup);

    await createRule(
      buildMockRulePayloadFromRule(rule, currentGroup, defaultGroup, {
        enabled: false,
        variant: nextVariant,
      }),
    );
    await load();
    setRuleMenuId(null);
    showToast(`已复制模拟：${scene.variant}`);
  };

  const duplicateRulesForUrlBlock = async (
    rulesInBlock: MockRule[],
    nextMatch: { url: string; requestBodyExactMatch: string; requestBodyKeyMatch: string },
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

      await createRule(
        buildMockRulePayloadFromRule(rule, currentGroup, defaultGroup, {
          enabled: false,
          requestBodyExactMatch: nextMatch.requestBodyExactMatch.trim() || null,
          requestBodyKeyMatch: nextMatch.requestBodyKeyMatch.trim() || null,
          url: nextMatch.url.trim(),
          variant: nextVariant,
        }),
      );
      duplicatedCount += 1;
    }

    await load();
    showToast(`已复制 ${duplicatedCount} 条 Mock 到新匹配条件`);
  };

  const removeRulesForUrlBlock = async (rulesInBlock: MockRule[]) => {
    if (!rulesInBlock.length) {
      return;
    }

    await Promise.all(rulesInBlock.map((rule) => deleteRule(rule.id)));
    await load();
    showToast(`已删除 ${rulesInBlock.length} 条同地址 Mock`);
  };

  const moveRuleToGroup = async (rule: MockRule, nextGroup: string) => {
    const scene = getRuleScene(rule, defaultGroup);
    if (scene.group === nextGroup) {
      setRuleMenuId(null);
      return;
    }

    await updateRule(rule.id, buildMockRulePayloadFromRule(rule, nextGroup, defaultGroup));

    if (!customGroups.includes(nextGroup) && nextGroup !== defaultGroup) {
      setCustomGroups((current) => [...current, nextGroup]);
    }

    await load();
    setRuleMenuId(null);
    showToast(`已移动到分组「${nextGroup}」`);
  };

  const toggleRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await enableRule(rule.id, !rule.enabled);
    await load();
    setRuleMenuId(null);
    showToast(
      rule.enabled
        ? `已停用模拟：${scene.variant}`
        : `已启用模拟：${scene.variant}`,
    );
  };

  const removeRule = async (rule: MockRule) => {
    const scene = getRuleScene(rule, defaultGroup);
    await deleteRule(rule.id);
    await load();
    setRuleMenuId(null);
    showToast(`已删除模拟：${scene.variant}`);
  };

  const exportMockGroups = () =>
    groups.map((groupName) => exportMockGroupData(groupName, groupedRules, groupMeta, defaultGroup));

  const exportMockGroup = (groupName: string): ExportableMockGroup | null => {
    if (!groups.includes(groupName)) {
      return null;
    }
    return exportMockGroupData(groupName, groupedRules, groupMeta, defaultGroup);
  };

  const importMockGroups = async (importedGroups: ExportableMockGroup[]) => {
    const stats = await mergeImportedMockGroups({
      createRule,
      defaultGroup,
      existingCustomGroups: customGroups,
      existingRules,
      importedGroups,
      onEnsureGroup: (groupName) => {
        setCustomGroups((current) => (current.includes(groupName) ? current : [...current, groupName]));
      },
      onUpdateGroupDescription: (groupName, description) => {
        setGroupMeta((current) => ({
          ...current,
          [groupName]: {
            description,
          },
        }));
      },
      updateRule,
    });
    await load();
    showToast(buildImportSummaryMessage(stats));
  };

  const exportSelectedMockRules = (selectedRules: MockRule[], includeGroup: boolean) =>
    selectedRules.map((rule) => toExportableMockRule(rule, defaultGroup, includeGroup));

  const importRulesToCurrentGroup = async (importedRules: ExportableMockRule[]) => {
    const stats = await mergeImportedRulesIntoGroup({
      createRule,
      defaultGroup,
      existingRules: currentGroupRules,
      importedRules,
      targetGroup: currentGroup,
      updateRule,
    });
    await load();
    showToast(buildImportSummaryMessage(stats));
  };

  return {
    activateGroup,
    copyGroup: copyGroupAction,
    deleteGroup: deleteGroupAction,
    duplicateRule,
    duplicateRulesForUrlBlock,
    editGroupDescription,
    exportMockGroup,
    exportMockGroups,
    exportSelectedMockRules,
    importMockGroups,
    importRulesToCurrentGroup,
    moveRuleToGroup,
    openCreateModal,
    openCreateModalForUrl,
    openEditModal,
    removeRule,
    removeRulesForUrlBlock,
    renameGroup,
    saveRule,
    toggleCurrentGroup,
    toggleRule,
  };
}

