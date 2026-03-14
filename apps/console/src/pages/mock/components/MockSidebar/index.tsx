import { uiSelectors, workspaceSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import { classNames, buildUniqueGroupName } from "../../utils/mockHelpers";
import localStyles from "./index.module.less";

type GroupSummary = {
  group: string;
  count: number;
  enabledCount: number;
  active: boolean;
};

type MockSidebarProps = {
  currentGroup: string;
  defaultGroup: string;
  filteredGroups: string[];
  groupSummaries: GroupSummary[];
  groups: string[];
  setCustomGroups: (updater: (current: string[]) => string[]) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  t: (key: any, params?: Record<string, string | number>) => string;
  onActivateGroup: (group: string) => Promise<void>;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onRenameGroup: (group: string) => Promise<void>;
};

export function MockSidebar({
  currentGroup,
  defaultGroup,
  filteredGroups,
  groupSummaries,
  groups,
  setCustomGroups,
  showToast,
  t,
  onActivateGroup,
  onCopyGroup,
  onDeleteGroup,
  onRenameGroup,
}: MockSidebarProps) {
  const groupSearch = useUiStore(uiSelectors.mockGroupSearch);
  const setGroupSearch = useUiStore((state) => state.setMockGroupSearch);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);

  return (
    <aside className={classNames(localStyles.sidebar, localStyles.root)}>
      <div className={localStyles.sidebarHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{t("mock.groupsTitle")}</span>
          <strong>{t("mock.groupsTitle")}</strong>
        </div>
        <button
          className={localStyles.secondaryButton}
          onClick={() => {
            const nextName = window.prompt(t("mock.groupCreatePrompt"))?.trim();
            if (!nextName) return;
            const uniqueName = buildUniqueGroupName(nextName, groups);
            setCustomGroups((current) =>
              current.includes(uniqueName) ? current : [...current, uniqueName],
            );
            showToast(t("mock.groupCreated", { name: uniqueName }));
            void onActivateGroup(uniqueName);
          }}
          type="button"
        >
          {t("mock.groupNew")}
        </button>
      </div>

      <input
        className={localStyles.searchInput}
        onChange={(event) => setGroupSearch(event.target.value)}
        placeholder={t("mock.groupSearch")}
        value={groupSearch}
      />

      <div className={localStyles.groupList}>
        {filteredGroups.map((group) => {
          const summary = groupSummaries.find((item) => item.group === group) ?? {
            group,
            count: 0,
            enabledCount: 0,
            active: false,
          };
          return (
            <div
              className={classNames(
                localStyles.groupItem,
                group === currentGroup && localStyles.groupItemActive,
                groupMenuName === group && localStyles.groupItemOpen,
              )}
              key={group}
            >
              <button className={localStyles.groupSelect} onClick={() => void onActivateGroup(group)} type="button">
                <div className={localStyles.groupMain}>
                  <div className={localStyles.groupTitleRow}>
                    <span className={classNames(localStyles.groupStatusDot, summary.active && localStyles.groupStatusDotActive)} />
                    <strong>{group}</strong>
                  </div>
                  <span className={localStyles.groupMeta}>{t("mock.groupRuleCount", { count: summary.count })}</span>
                </div>
                <span className={classNames(localStyles.statusBadge, summary.active ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted)}>
                  {summary.active ? t("mock.groupActive") : t("mock.groupInactive")}
                </span>
              </button>

              <div className={localStyles.menuRoot} onClick={(event) => event.stopPropagation()}>
                <button
                  aria-label={t("mock.ruleMore")}
                  className={classNames(localStyles.iconButton, localStyles.moreButton)}
                  onClick={() => setGroupMenuName(groupMenuName === group ? null : group)}
                  type="button"
                >
                  ...
                </button>
                {groupMenuName === group ? (
                  <div className={classNames(localStyles.actionMenu, localStyles.groupActionMenu)}>
                    <button onClick={() => void onRenameGroup(group)} type="button">{t("mock.groupRename")}</button>
                    <button onClick={() => void onCopyGroup(group)} type="button">{t("mock.groupCopy")}</button>
                    {group !== defaultGroup ? (
                      <button className={localStyles.menuDanger} onClick={() => void onDeleteGroup(group)} type="button">
                        {t("mock.groupDelete")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
