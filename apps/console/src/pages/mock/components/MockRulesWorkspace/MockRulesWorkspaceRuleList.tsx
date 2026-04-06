import { Popover } from "antd";
import type { MockRule } from "@polaris/shared-types";
import type { RuleUrlBlock } from "../../types";
import { classNames, getRuleScene } from "../../utils/mockHelpers";
import type { DuplicateUrlBlockDraft } from "./types";
import localStyles from "./index.module.less";

type MockRulesWorkspaceRuleListProps = {
  collapsedBlocks: Record<string, boolean>;
  defaultGroup: string;
  filteredRuleBlocks: RuleUrlBlock[];
  getMethodClass: (method: string) => string;
  groupMenuName: string | null;
  hasVisibleRules: boolean;
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

export function MockRulesWorkspaceRuleList({
  hasVisibleRules,
  filteredRuleBlocks,
  ...props
}: MockRulesWorkspaceRuleListProps) {
  if (!hasVisibleRules) {
    return (
      <div className={localStyles.emptyState}>
        <h3>未找到匹配规则</h3>
        <p>试试更换关键词或清空搜索条件。</p>
      </div>
    );
  }

  return (
    <div className={localStyles.ruleTableBody}>
      {filteredRuleBlocks.map((block) => (
        <RuleBlockSection block={block} key={block.key} {...props} />
      ))}
    </div>
  );
}

type RuleBlockSectionProps = Omit<
  MockRulesWorkspaceRuleListProps,
  "filteredRuleBlocks" | "hasVisibleRules"
> & {
  block: RuleUrlBlock;
};

function RuleBlockSection({
  block,
  collapsedBlocks,
  defaultGroup,
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
}: RuleBlockSectionProps) {
  return (
    <section className={localStyles.ruleBlock}>
      <button
        className={localStyles.ruleBlockHeader}
        onClick={() => onToggleBlock(block.key)}
        type="button"
      >
        <div className={localStyles.ruleBlockCopy}>
          <strong>{block.key}</strong>
        </div>
        <div className={localStyles.ruleBlockMeta}>
          <RuleBlockMenu
            block={block}
            groupMenuName={groupMenuName}
            onDeleteUrlBlock={onDeleteUrlBlock}
            onOpenCreateModalForUrl={onOpenCreateModalForUrl}
            onSetDuplicateDraft={onSetDuplicateDraft}
            setGroupMenuName={setGroupMenuName}
          />
          <span
            className={classNames(
              localStyles.statusBadge,
              localStyles.statusBadgeMuted,
            )}
          >
            {`${block.rules.length} 条规则`}
          </span>
          <span className={localStyles.collapseIndicator}>
            {collapsedBlocks[block.key]
              ? `+ ${"展开"}`
              : `− ${"收起"}`}
          </span>
        </div>
      </button>
      <div
        className={classNames(
          localStyles.ruleRows,
          collapsedBlocks[block.key] && localStyles.ruleRowsCollapsed,
        )}
      >
        {block.rules.map((rule) => (
          <RuleRowCard
            defaultGroup={defaultGroup}
            getMethodClass={getMethodClass}
            key={rule.id}
            onDeleteRule={onDeleteRule}
            onDuplicateRule={onDuplicateRule}
            onExportRule={onExportRule}
            onOpenEditModal={onOpenEditModal}
            onOpenMoveRule={onOpenMoveRule}
            onToggleRule={onToggleRule}
            rule={rule}
            ruleMenuId={ruleMenuId}
            selectedRuleId={selectedRuleId}
            setRuleMenuId={setRuleMenuId}
            setSelectedRuleId={setSelectedRuleId}
          />
        ))}
      </div>
    </section>
  );
}

type RuleBlockMenuProps = {
  block: RuleUrlBlock;
  groupMenuName: string | null;
  onDeleteUrlBlock: (block: RuleUrlBlock) => void;
  onOpenCreateModalForUrl: (url: string) => void;
  onSetDuplicateDraft: (draft: DuplicateUrlBlockDraft | null) => void;
  setGroupMenuName: (value: string | null) => void;
};

function RuleBlockMenu({
  block,
  groupMenuName,
  onDeleteUrlBlock,
  onOpenCreateModalForUrl,
  onSetDuplicateDraft,
  setGroupMenuName,
}: RuleBlockMenuProps) {
  const menuKey = `__url__:${block.key}`;

  return (
    <div
      className={localStyles.ruleBlockHeaderActions}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={localStyles.menuRoot}>
        <button
          className={classNames(
            localStyles.iconButton,
            localStyles.compactActionButton,
            localStyles.blockMenuButton,
          )}
          onClick={() =>
            setGroupMenuName(groupMenuName === menuKey ? null : menuKey)
          }
          type="button"
        >
          ...
        </button>
        {groupMenuName === menuKey ? (
          <div className={localStyles.actionMenu}>
            <button
              onClick={() => {
                onOpenCreateModalForUrl(block.key);
                setGroupMenuName(null);
              }}
              type="button"
            >
              同地址新建
            </button>
            <button
              onClick={() => {
                onSetDuplicateDraft({
                  sourceUrl: block.key,
                  rules: block.rules,
                  url: block.key,
                  requestBodyExactMatch: "",
                  requestBodyKeyMatch: "",
                });
                setGroupMenuName(null);
              }}
              type="button"
            >
              复制到新地址
            </button>
            <button
              className={localStyles.menuDanger}
              onClick={() => onDeleteUrlBlock(block)}
              type="button"
            >
              一键删除
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type RuleRowCardProps = {
  defaultGroup: string;
  getMethodClass: (method: string) => string;
  onDeleteRule: (rule: MockRule, label: string) => void;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onExportRule: (rule: MockRule) => void;
  onOpenEditModal: (rule: MockRule) => void;
  onOpenMoveRule: (rule: MockRule) => void;
  onToggleRule: (rule: MockRule) => Promise<void>;
  rule: MockRule;
  ruleMenuId: string | null;
  selectedRuleId: string | null;
  setRuleMenuId: (value: string | null) => void;
  setSelectedRuleId: (value: string | null) => void;
};

function RuleRowCard({
  defaultGroup,
  getMethodClass,
  onDeleteRule,
  onDuplicateRule,
  onExportRule,
  onOpenEditModal,
  onOpenMoveRule,
  onToggleRule,
  rule,
  ruleMenuId,
  selectedRuleId,
  setRuleMenuId,
  setSelectedRuleId,
}: RuleRowCardProps) {
  const scene = getRuleScene(rule, defaultGroup);

  return (
    <div
      className={classNames(
        localStyles.ruleRow,
        selectedRuleId === rule.id && localStyles.ruleRowActive,
      )}
      onClick={() => setSelectedRuleId(rule.id)}
      role="button"
      tabIndex={0}
    >
      <div className={localStyles.ruleStatus}>
        <label className={localStyles.switch}>
          <input
            checked={rule.enabled}
            onChange={() => void onToggleRule(rule)}
            type="checkbox"
          />
          <span className={localStyles.switchTrack} />
        </label>
      </div>
      <div className={localStyles.ruleRequest}>
        <div className={localStyles.ruleRequestTop}>
          <span
            className={classNames(
              localStyles.methodBadge,
              getMethodClass(rule.method),
            )}
          >
            {rule.method}
          </span>
          <strong>{scene.variant}</strong>
        </div>
        {rule.requestBodyExactMatch ? (
          <span className={localStyles.ruleMatchHint}>
            Body 精确: {rule.requestBodyExactMatch}
          </span>
        ) : null}
        {rule.requestBodyKeyMatch ? (
          <span className={localStyles.ruleMatchHint}>
            {`Body键: ${rule.requestBodyKeyMatch}`}
          </span>
        ) : null}
      </div>
      <div
        className={localStyles.ruleActions}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className={localStyles.secondaryButton}
          onClick={() => onOpenEditModal(rule)}
          type="button"
        >
          {"编辑"}
        </button>
        <RuleActionMenu
          label={scene.variant}
          onDeleteRule={onDeleteRule}
          onDuplicateRule={onDuplicateRule}
          onExportRule={onExportRule}
          onMoveRule={onOpenMoveRule}
          rule={rule}
          ruleMenuId={ruleMenuId}
          setRuleMenuId={setRuleMenuId}
        />
      </div>
    </div>
  );
}

type RuleActionMenuProps = {
  label: string;
  onDeleteRule: (rule: MockRule, label: string) => void;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onExportRule: (rule: MockRule) => void;
  onMoveRule: (rule: MockRule) => void;
  rule: MockRule;
  ruleMenuId: string | null;
  setRuleMenuId: (value: string | null) => void;
};

function RuleActionMenu({
  label,
  onDeleteRule,
  onDuplicateRule,
  onExportRule,
  onMoveRule,
  rule,
  ruleMenuId,
  setRuleMenuId,
}: RuleActionMenuProps) {
  return (
    <div className={localStyles.menuRoot}>
      <Popover
        content={
          <div className={localStyles.popoverMenu}>
            <button
              onClick={() => {
                onExportRule(rule);
                setRuleMenuId(null);
              }}
              type="button"
            >
              导出
            </button>
            <button
              onClick={() => {
                void onDuplicateRule(rule);
                setRuleMenuId(null);
              }}
              type="button"
            >
              {"复制"}
            </button>
            <button
              onClick={() => {
                onMoveRule(rule);
                setRuleMenuId(null);
              }}
              type="button"
            >
              移动到分组
            </button>
            <button
              className={localStyles.menuDanger}
              onClick={() => {
                setRuleMenuId(null);
                onDeleteRule(rule, label);
              }}
              type="button"
            >
              {"删除"}
            </button>
          </div>
        }
        getPopupContainer={() => document.body}
        onOpenChange={(open) => setRuleMenuId(open ? rule.id : null)}
        open={ruleMenuId === rule.id}
        overlayClassName={localStyles.rulePopover}
        placement="rightTop"
        trigger="click"
      >
        <button
          className={classNames(localStyles.iconButton, localStyles.moreButton)}
          type="button"
        >
          ...
        </button>
      </Popover>
    </div>
  );
}
