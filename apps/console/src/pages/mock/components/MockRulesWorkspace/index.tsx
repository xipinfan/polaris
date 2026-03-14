import type { MockRule } from "@polaris/shared-types";
import { workspaceSelectors } from "../../../../stores/selectors";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import type { RuleUrlBlock } from "../../types";
import { classNames, getMatchSummary, getQueryCount, getResponseKind, getRuleScene, getUrlSummary } from "../../utils/mockHelpers";
import localStyles from "./index.module.less";

type MockRulesWorkspaceProps = {
  currentGroup: string;
  currentGroupEnabledRules: MockRule[];
  currentGroupRules: MockRule[];
  defaultGroup: string;
  isCurrentGroupEnabled: boolean;
  ruleBlocks: RuleUrlBlock[];
  getMethodClass: (method: string) => string;
  t: (key: any, params?: Record<string, string | number>) => string;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onEditGroupDescription: () => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (rule: MockRule) => void;
  onRemoveRule: (rule: MockRule) => Promise<void>;
  onToggleCurrentGroup: () => Promise<void>;
  onToggleRule: (rule: MockRule) => Promise<void>;
};

export function MockRulesWorkspace(props: MockRulesWorkspaceProps) {
  const {
    currentGroup, currentGroupEnabledRules, currentGroupRules, defaultGroup,
    isCurrentGroupEnabled, ruleBlocks, getMethodClass, t, onCopyGroup, onDeleteGroup, onDuplicateRule,
    onEditGroupDescription, onOpenCreateModal, onOpenEditModal, onRemoveRule, onToggleCurrentGroup, onToggleRule,
  } = props;

  const collapsedBlocks = useWorkspaceStore(workspaceSelectors.mockCollapsedBlocks);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const ruleMenuId = useWorkspaceStore(workspaceSelectors.mockRuleMenuId);
  const selectedRuleId = useWorkspaceStore(workspaceSelectors.mockSelectedRuleId);
  const setCollapsedBlocks = useWorkspaceStore((state) => state.setMockCollapsedBlocks);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);
  const setRuleMenuId = useWorkspaceStore((state) => state.setMockRuleMenuId);
  const setSelectedRuleId = useWorkspaceStore((state) => state.setMockSelectedRuleId);

  return (
    <section className={classNames(localStyles.main, localStyles.root)}>
      <div className={localStyles.overview}>
        <div className={localStyles.overviewCopy}>
          <div className={localStyles.overviewTitleRow}>
            <h3>{currentGroup}</h3>
            <span className={classNames(localStyles.statusBadge, localStyles.statusBadgeSuccess)}>{t("mock.groupActive")}</span>
          </div>
          <p>{t("mock.currentGroupHint")}</p>
        </div>
        <div className={localStyles.metricRow}>
          <div className={localStyles.metricCard}><span>{t("mock.headerRequestCount")}</span><strong>{currentGroupRules.length}</strong></div>
          <div className={localStyles.metricCard}><span>{t("mock.headerEnabledRuleCount")}</span><strong>{currentGroupEnabledRules.length}</strong></div>
        </div>
        <div className={localStyles.overviewActions}>
          <button className={localStyles.primaryButton} onClick={onOpenCreateModal} type="button">{t("mock.newRequest")}</button>
          <button className={localStyles.secondaryButton} onClick={onEditGroupDescription} type="button">{t("mock.groupEdit")}</button>
          <div className={localStyles.menuRoot} onClick={(event) => event.stopPropagation()}>
            <button className={localStyles.iconButton} onClick={() => setGroupMenuName(groupMenuName === "__header__" ? null : "__header__")} type="button">...</button>
            {groupMenuName === "__header__" ? (
              <div className={localStyles.actionMenu}>
                <button onClick={() => void onCopyGroup(currentGroup)} type="button">{t("mock.groupCopy")}</button>
                <button onClick={() => void onToggleCurrentGroup()} type="button">{isCurrentGroupEnabled ? t("mock.groupDisableAll") : t("mock.groupEnableAll")}</button>
                {currentGroup !== defaultGroup ? (
                  <button className={localStyles.menuDanger} onClick={() => void onDeleteGroup(currentGroup)} type="button">{t("mock.groupDelete")}</button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={localStyles.ruleTable}>
        <div className={localStyles.ruleTableHead}>
          <span>{t("mock.ruleTable.status")}</span><span>{t("mock.ruleTable.request")}</span><span>{t("mock.ruleTable.match")}</span><span>{t("mock.ruleTable.response")}</span><span>{t("mock.ruleTable.actions")}</span>
        </div>
        {currentGroupRules.length === 0 ? (
          <div className={localStyles.emptyState}><h3>{t("mock.ruleNoRulesTitle")}</h3><p>{t("mock.ruleNoRulesBody")}</p></div>
        ) : (
          <div className={localStyles.ruleTableBody}>
            {ruleBlocks.map((block) => (
              <section className={localStyles.ruleBlock} key={block.key}>
                <button className={localStyles.ruleBlockHeader} onClick={() => setCollapsedBlocks((current) => ({ ...current, [block.key]: !current[block.key] }))} type="button">
                  <div className={localStyles.ruleBlockCopy}><strong>{block.key}</strong><span>{collapsedBlocks[block.key] ? t("mock.expand") : t("mock.collapse")}</span></div>
                  <div className={localStyles.ruleBlockMeta}><span className={classNames(localStyles.statusBadge, localStyles.statusBadgeMuted)}>{t("mock.groupRuleCount", { count: block.rules.length })}</span><span className={localStyles.collapseIndicator}>{collapsedBlocks[block.key] ? t("mock.expand") : t("mock.collapse")}</span></div>
                </button>
                <div className={classNames(localStyles.ruleRows, collapsedBlocks[block.key] && localStyles.ruleRowsCollapsed)}>
                  {block.rules.map((rule) => {
                    const scene = getRuleScene(rule, defaultGroup);
                    const matchSummary = getMatchSummary(getQueryCount(rule.url), t);
                    const responseKind = getResponseKind(rule, t);
                    const urlSummary = getUrlSummary(rule.url);
                    return (
                      <div className={classNames(localStyles.ruleRow, selectedRuleId === rule.id && localStyles.ruleRowActive)} key={rule.id} onClick={() => setSelectedRuleId(rule.id)} role="button" tabIndex={0}>
                        <div className={localStyles.ruleStatus}><label className={localStyles.switch}><input checked={rule.enabled} onChange={() => void onToggleRule(rule)} type="checkbox" /><span className={localStyles.switchTrack} /></label></div>
                        <div className={localStyles.ruleRequest}><div className={localStyles.ruleRequestTop}><span className={classNames(localStyles.methodBadge, getMethodClass(rule.method))}>{rule.method}</span><strong>{scene.variant}</strong></div><small>{urlSummary.full}</small></div>
                        <div className={localStyles.ruleMatch}><strong>{matchSummary}</strong></div>
                        <div className={localStyles.ruleResponse}><strong>{`${responseKind} 路 ${rule.responseStatus}`}</strong></div>
                        <div className={localStyles.ruleActions} onClick={(event) => event.stopPropagation()}>
                          <button className={localStyles.secondaryButton} onClick={() => onOpenEditModal(rule)} type="button">{t("mock.edit")}</button>
                          <div className={localStyles.menuRoot}>
                            <button className={classNames(localStyles.iconButton, localStyles.moreButton)} onClick={() => setRuleMenuId(ruleMenuId === rule.id ? null : rule.id)} type="button">...</button>
                            {ruleMenuId === rule.id ? (
                              <div className={localStyles.actionMenu}>
                                <button onClick={() => void onDuplicateRule(rule)} type="button">{t("mock.duplicate")}</button>
                                <button onClick={() => onOpenEditModal(rule)} type="button">{t("mock.ruleMove")}</button>
                                <button className={localStyles.menuDanger} onClick={() => void onRemoveRule(rule)} type="button">{t("mock.delete")}</button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
