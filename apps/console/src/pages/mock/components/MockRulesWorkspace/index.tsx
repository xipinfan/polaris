import { Modal } from "antd";
import type { MockRule } from "@polaris/shared-types";
import { workspaceSelectors } from "../../../../stores/selectors";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import type { RuleUrlBlock } from "../../types";
import { classNames } from "../../utils/mockHelpers";
import { MockRulesWorkspaceDialogs } from "./MockRulesWorkspaceDialogs";
import { MockRulesWorkspaceHeader } from "./MockRulesWorkspaceHeader";
import { MockRulesWorkspaceTableSection } from "./MockRulesWorkspaceTableSection";
import { useMockRulesWorkspaceState } from "./useMockRulesWorkspaceState";
import localStyles from "./index.module.less";

type MockRulesWorkspaceProps = {
  currentGroup: string;
  currentGroupDescription?: string;
  currentGroupRules: MockRule[];
  defaultGroup: string;
  groups: string[];
  isCurrentGroupEnabled: boolean;
  ruleBlocks: RuleUrlBlock[];
  getMethodClass: (method: string) => string;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onDuplicateUrlBlock: (
    rules: MockRule[],
    nextMatch: { url: string; requestBodyExactMatch: string; requestBodyKeyMatch: string }
  ) => Promise<void>;
  onEditGroupDescription: (nextDescription: string) => void;
  onMoveRule: (rule: MockRule, nextGroup: string) => Promise<void>;
  onOpenCreateModalForUrl: (url: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (rule: MockRule) => void;
  onRemoveRule: (rule: MockRule) => Promise<void>;
  onRemoveUrlBlock: (rules: MockRule[]) => Promise<void>;
  onExportRule: (rule: MockRule) => void;
  onExportSelectedRules: (rules: MockRule[]) => void;
  onImportRules: () => void;
  onToggleCurrentGroup: () => Promise<void>;
  onToggleRule: (rule: MockRule) => Promise<void>;
};

export function MockRulesWorkspace({
  currentGroup,
  currentGroupDescription,
  currentGroupRules,
  defaultGroup,
  groups,
  isCurrentGroupEnabled,
  ruleBlocks,
  getMethodClass,
  onCopyGroup,
  onDeleteGroup,
  onDuplicateRule,
  onDuplicateUrlBlock,
  onEditGroupDescription,
  onMoveRule,
  onOpenCreateModalForUrl,
  onOpenCreateModal,
  onOpenEditModal,
  onRemoveRule,
  onRemoveUrlBlock,
  onExportRule,
  onExportSelectedRules,
  onImportRules,
  onToggleCurrentGroup,
  onToggleRule,
}: MockRulesWorkspaceProps) {
  const collapsedBlocks = useWorkspaceStore(workspaceSelectors.mockCollapsedBlocks);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const ruleMenuId = useWorkspaceStore(workspaceSelectors.mockRuleMenuId);
  const selectedRuleId = useWorkspaceStore(workspaceSelectors.mockSelectedRuleId);
  const setCollapsedBlocks = useWorkspaceStore((state) => state.setMockCollapsedBlocks);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);
  const setRuleMenuId = useWorkspaceStore((state) => state.setMockRuleMenuId);
  const setSelectedRuleId = useWorkspaceStore((state) => state.setMockSelectedRuleId);

  const [modal, contextHolder] = Modal.useModal();
  const {
    batchSearch,
    duplicateDraft,
    exportColumns,
    filteredExportRecords,
    filteredRuleBlocks,
    groupDescriptionInput,
    isBatchExportOpen,
    isDuplicatingUrlBlock,
    isEditGroupOpen,
    moveRule,
    moveTargets,
    movingGroup,
    ruleSearch,
    selectedExportKeys,
    selectedExportRules,
    setBatchSearch,
    setDuplicateDraft,
    setGroupDescriptionInput,
    setIsBatchExportOpen,
    setIsDuplicatingUrlBlock,
    setIsEditGroupOpen,
    setMoveRule,
    setMovingGroup,
    setRuleSearch,
    setSelectedExportKeys,
  } = useMockRulesWorkspaceState({
    currentGroupRules,
    defaultGroup,
    groups,
    ruleBlocks,
  });

  const openDeleteGroupConfirm = (group: string) => {
    void modal.confirm({
      cancelText: "取消",
      content: `确认删除分组 ${group} 及其下所有规则？`,
      icon: null,
      mask: { closable: false },
      okButtonProps: { danger: true },
      okText: "删除分组",
      onOk: async () => {
        await onDeleteGroup(group);
        return undefined;
      },
      title: "删除分组",
    });
  };

  const openDeleteRuleConfirm = (rule: MockRule, label: string) => {
    void modal.confirm({
      cancelText: "取消",
      content: `确认删除规则「${label}」吗？`,
      icon: null,
      mask: { closable: false },
      okButtonProps: { danger: true },
      okText: "删除",
      onOk: async () => {
        await onRemoveRule(rule);
        return undefined;
      },
      title: "删除规则",
    });
  };

  const openDeleteUrlBlockConfirm = (block: RuleUrlBlock) => {
    void modal.confirm({
      cancelText: "取消",
      content: `确认删除地址「${block.key}」下的 ${block.rules.length} 条 Mock 吗？`,
      icon: null,
      mask: { closable: false },
      okButtonProps: { danger: true },
      okText: "删除",
      onOk: async () => {
        await onRemoveUrlBlock(block.rules);
        setGroupMenuName(null);
        return undefined;
      },
      title: "删除该地址 Mock",
    });
  };

  return (
    <section className={classNames(localStyles.main, localStyles.root)}>
      {contextHolder}
      <MockRulesWorkspaceDialogs
        batchSearch={batchSearch}
        currentGroup={currentGroup}
        currentGroupRules={currentGroupRules}
        defaultGroup={defaultGroup}
        duplicateDraft={duplicateDraft}
        exportColumns={exportColumns}
        filteredExportRecords={filteredExportRecords}
        groupDescriptionInput={groupDescriptionInput}
        isBatchExportOpen={isBatchExportOpen}
        isDuplicatingUrlBlock={isDuplicatingUrlBlock}
        isEditGroupOpen={isEditGroupOpen}
        moveRule={moveRule}
        moveTargets={moveTargets}
        movingGroup={movingGroup}
        onCloseEditGroup={() => {
          setIsEditGroupOpen(false);
          setGroupDescriptionInput("");
        }}
        onConfirmBatchExport={() => {
          onExportSelectedRules(selectedExportRules);
          setIsBatchExportOpen(false);
        }}
        onConfirmDuplicateUrlBlock={() => {
          if (!duplicateDraft) {
            return;
          }
          void onDuplicateUrlBlock(duplicateDraft.rules, {
            url: duplicateDraft.url,
            requestBodyExactMatch: duplicateDraft.requestBodyExactMatch,
            requestBodyKeyMatch: duplicateDraft.requestBodyKeyMatch,
          }).then(() => setDuplicateDraft(null));
        }}
        onConfirmEditGroup={() => {
          onEditGroupDescription(groupDescriptionInput);
          setIsEditGroupOpen(false);
          setGroupDescriptionInput("");
        }}
        onMoveRule={onMoveRule}
        selectedExportKeys={selectedExportKeys}
        selectedExportRules={selectedExportRules}
        setBatchSearch={setBatchSearch}
        setDuplicateDraft={(updater) => setDuplicateDraft((current) => updater(current))}
        setGroupDescriptionInput={setGroupDescriptionInput}
        setIsBatchExportOpen={setIsBatchExportOpen}
        setIsDuplicatingUrlBlock={setIsDuplicatingUrlBlock}
        setMoveRule={setMoveRule}
        setMovingGroup={setMovingGroup}
        setSelectedExportKeys={setSelectedExportKeys}
      />
      <MockRulesWorkspaceHeader
        currentGroup={currentGroup}
        currentGroupDescription={currentGroupDescription}
        defaultGroup={defaultGroup}
        groupMenuName={groupMenuName}
        isCurrentGroupEnabled={isCurrentGroupEnabled}
        onCopyGroup={onCopyGroup}
        onDeleteGroup={openDeleteGroupConfirm}
        onEditGroupDescription={(value) => {
          setGroupDescriptionInput(value);
          setIsEditGroupOpen(true);
        }}
        onImportRules={onImportRules}
        onOpenBatchExport={() => {
          setBatchSearch("");
          setSelectedExportKeys([]);
          setIsBatchExportOpen(true);
        }}
        onOpenCreateModal={onOpenCreateModal}
        onToggleCurrentGroup={onToggleCurrentGroup}
        ruleSearch={ruleSearch}
        setGroupMenuName={setGroupMenuName}
        setRuleSearch={setRuleSearch}
      />
      <MockRulesWorkspaceTableSection
        collapsedBlocks={collapsedBlocks}
        currentGroupRules={currentGroupRules}
        defaultGroup={defaultGroup}
        filteredRuleBlocks={filteredRuleBlocks}
        getMethodClass={getMethodClass}
        groupMenuName={groupMenuName}
        onDeleteRule={openDeleteRuleConfirm}
        onDeleteUrlBlock={openDeleteUrlBlockConfirm}
        onDuplicateRule={onDuplicateRule}
        onExportRule={onExportRule}
        onOpenCreateModalForUrl={onOpenCreateModalForUrl}
        onOpenEditModal={onOpenEditModal}
        onOpenMoveRule={setMoveRule}
        onSetDuplicateDraft={setDuplicateDraft}
        onToggleBlock={(blockKey) =>
          setCollapsedBlocks((current) => ({
            ...current,
            [blockKey]: !current[blockKey],
          }))
        }
        onToggleRule={onToggleRule}
        ruleMenuId={ruleMenuId}
        selectedRuleId={selectedRuleId}
        setGroupMenuName={setGroupMenuName}
        setRuleMenuId={setRuleMenuId}
        setSelectedRuleId={setSelectedRuleId}
      />
    </section>
  );
}

