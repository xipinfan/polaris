import type { MockRule } from "@polaris/shared-types";
import type { RuleUrlBlock } from "../../types";
import { MockRulesWorkspaceRuleList } from "./MockRulesWorkspaceRuleList";
import type { DuplicateUrlBlockDraft } from "./types";
import localStyles from "./index.module.less";

type MockRulesWorkspaceTableSectionProps = {
  collapsedBlocks: Record<string, boolean>;
  currentGroupRules: MockRule[];
  defaultGroup: string;
  filteredRuleBlocks: RuleUrlBlock[];
  getMethodClass: (method: string) => string;
  groupMenuName: string | null;
  onDeleteRule: (rule: MockRule, label: string) => void;
  onDeleteUrlBlock: (block: RuleUrlBlock) => void;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onExportRule: (rule: MockRule) => void;
  onOpenCreateModalForUrl: (url: string) => void;
  onOpenEditModal: (rule: MockRule) => void;
  onOpenMoveRule: (rule: MockRule) => void;
  onSetDuplicateDraft: (draft: DuplicateUrlBlockDraft | null) => void;
  onToggleBlock: (blockKey: string) => void;
  onToggleRule: (rule: MockRule) => Promise<void>;
  ruleMenuId: string | null;
  selectedRuleId: string | null;
  setGroupMenuName: (value: string | null) => void;
  setRuleMenuId: (value: string | null) => void;
  setSelectedRuleId: (value: string | null) => void;
};

export function MockRulesWorkspaceTableSection({
  collapsedBlocks,
  currentGroupRules,
  defaultGroup,
  filteredRuleBlocks,
  getMethodClass,
  groupMenuName,
  onDeleteRule,
  onDeleteUrlBlock,
  onDuplicateRule,
  onExportRule,
  onOpenCreateModalForUrl,
  onOpenEditModal,
  onOpenMoveRule,
  onSetDuplicateDraft,
  onToggleBlock,
  onToggleRule,
  ruleMenuId,
  selectedRuleId,
  setGroupMenuName,
  setRuleMenuId,
  setSelectedRuleId,
}: MockRulesWorkspaceTableSectionProps) {
  return (
    <div className={localStyles.ruleTable}>
      <div className={localStyles.ruleTableHead}>
        <span>状态</span>
        <span>请求</span>
        <span>操作</span>
      </div>
      {currentGroupRules.length === 0 ? (
        <div className={localStyles.emptyState}>
          <h3>当前分组暂无规则</h3>
          <p>可以直接新建请求，或从实时请求页快速导入。</p>
        </div>
      ) : (
        <MockRulesWorkspaceRuleList
          collapsedBlocks={collapsedBlocks}
          defaultGroup={defaultGroup}
          filteredRuleBlocks={filteredRuleBlocks}
          getMethodClass={getMethodClass}
          groupMenuName={groupMenuName}
          hasVisibleRules={filteredRuleBlocks.some((block) => block.rules.length > 0)}
          onDeleteRule={onDeleteRule}
          onDeleteUrlBlock={onDeleteUrlBlock}
          onDuplicateRule={onDuplicateRule}
          onExportRule={onExportRule}
          onOpenCreateModalForUrl={onOpenCreateModalForUrl}
          onOpenEditModal={onOpenEditModal}
          onOpenMoveRule={onOpenMoveRule}
          onSetDuplicateDraft={onSetDuplicateDraft}
          onToggleBlock={onToggleBlock}
          onToggleRule={onToggleRule}
          ruleMenuId={ruleMenuId}
          selectedRuleId={selectedRuleId}
          setGroupMenuName={setGroupMenuName}
          setRuleMenuId={setRuleMenuId}
          setSelectedRuleId={setSelectedRuleId}
        />
      )}
    </div>
  );
}
