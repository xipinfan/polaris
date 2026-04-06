import localStyles from "./index.module.less";
import { classNames } from "../../utils/mockHelpers";

type MockRulesWorkspaceHeaderProps = {
  currentGroup: string;
  currentGroupDescription?: string;
  defaultGroup: string;
  groupMenuName: string | null;
  isCurrentGroupEnabled: boolean;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => void;
  onEditGroupDescription: (value: string) => void;
  onImportRules: () => void;
  onOpenBatchExport: () => void;
  onOpenCreateModal: () => void;
  onToggleCurrentGroup: () => Promise<void>;
  ruleSearch: string;
  setGroupMenuName: (value: string | null) => void;
  setRuleSearch: (value: string) => void;
};

export function MockRulesWorkspaceHeader({
  currentGroup,
  currentGroupDescription,
  defaultGroup,
  groupMenuName,
  isCurrentGroupEnabled,
  onCopyGroup,
  onDeleteGroup,
  onEditGroupDescription,
  onImportRules,
  onOpenBatchExport,
  onOpenCreateModal,
  onToggleCurrentGroup,
  ruleSearch,
  setGroupMenuName,
  setRuleSearch,
}: MockRulesWorkspaceHeaderProps) {
  return (
    <div className={localStyles.overview}>
      <div className={localStyles.overviewCopy}>
        <div className={localStyles.overviewTitleRow}>
          <h3>{currentGroup}</h3>
          <span
            className={classNames(
              localStyles.statusBadge,
              isCurrentGroupEnabled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
            )}
          >
            {isCurrentGroupEnabled ? "已启用" : "未启用"}
          </span>
        </div>
        <InputOrDescription
          currentGroupDescription={currentGroupDescription}
          ruleSearch={ruleSearch}
          setRuleSearch={setRuleSearch}
        />
      </div>
      <div className={localStyles.overviewActions}>
        <button className={localStyles.primaryButton} onClick={onOpenCreateModal} type="button">
          {"新建请求"}
        </button>
        <button
          className={localStyles.secondaryButton}
          onClick={() => onEditGroupDescription(currentGroupDescription ?? "")}
          type="button"
        >
          {"编辑分组"}
        </button>
        <div className={localStyles.menuRoot} onClick={(event) => event.stopPropagation()}>
          <button
            className={localStyles.iconButton}
            onClick={() => setGroupMenuName(groupMenuName === "__header__" ? null : "__header__")}
            type="button"
          >
            ...
          </button>
          {groupMenuName === "__header__" ? (
            <div className={localStyles.actionMenu}>
              <button onClick={onImportRules} type="button">
                导入规则
              </button>
              <button onClick={onOpenBatchExport} type="button">
                批量导出
              </button>
              <button onClick={() => void onCopyGroup(currentGroup)} type="button">
                {"复制分组"}
              </button>
              <button onClick={() => void onToggleCurrentGroup()} type="button">
                {isCurrentGroupEnabled ? "全部停用" : "全部启用"}
              </button>
              {currentGroup !== defaultGroup ? (
                <button
                  className={localStyles.menuDanger}
                  onClick={() => onDeleteGroup(currentGroup)}
                  type="button"
                >
                  {"删除分组"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type InputOrDescriptionProps = {
  currentGroupDescription?: string;
  ruleSearch: string;
  setRuleSearch: (value: string) => void;
};

function InputOrDescription({ currentGroupDescription, ruleSearch, setRuleSearch }: InputOrDescriptionProps) {
  return (
    <>
      {currentGroupDescription ? <p>{currentGroupDescription}</p> : null}
      <input
        className={localStyles.groupSearchInput}
        onChange={(event) => setRuleSearch(event.target.value)}
        placeholder="搜索当前分组规则"
        value={ruleSearch}
      />
    </>
  );
}

