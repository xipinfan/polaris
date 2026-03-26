import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { uiSelectors, workspaceSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import localStyles from "./index.module.less";
import type { StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type GroupSidebarProps = {
  submitting: boolean;
  visibleGroups: StoredGroup[];
  setGroupName: (value: string) => void;
  setEditingGroup: (value: StoredGroup | null) => void;
  setIsGroupModalOpen: (value: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  buildGroupMenu: (group: StoredGroup) => MenuProps["items"];
  onImportGroups: () => void;
};

export function GroupSidebar({
  submitting,
  visibleGroups,
  setGroupName,
  setEditingGroup,
  setIsGroupModalOpen,
  onSelectGroup,
  buildGroupMenu,
  onImportGroups,
}: GroupSidebarProps) {
  const activeGroupId = useWorkspaceStore(workspaceSelectors.proxyActiveGroupId);
  const menuGroupId = useWorkspaceStore(workspaceSelectors.proxyMenuGroupId);
  const setMenuGroupId = useWorkspaceStore((state) => state.setProxyMenuGroupId);
  const groupSearch = useUiStore(uiSelectors.proxyGroupSearch);
  const setGroupSearch = useUiStore((state) => state.setProxyGroupSearch);

  return (
    <aside className={classNames(localStyles.sidebar, localStyles.root)}>
      <div className={localStyles.sidebarHeader}>
        <div>
          <strong>{"\u5206\u7ec4"}</strong>
        </div>
        <div className={localStyles.headerActions}>
          <button
            className={classNames(localStyles.secondaryButton, localStyles.compactButton)}
            onClick={onImportGroups}
            type="button"
          >
            {"\u5bfc\u5165"}
          </button>
          <button
            className={classNames(localStyles.secondaryButton, localStyles.compactButton)}
            onClick={() => {
              setEditingGroup(null);
              setGroupName("");
              setIsGroupModalOpen(true);
            }}
            type="button"
          >
            {"\u65b0\u5efa\u5206\u7ec4"}
          </button>
        </div>
      </div>

      <input
        className={localStyles.searchInput}
        onChange={(event) => setGroupSearch(event.target.value)}
        placeholder={"\u641c\u7d22\u5206\u7ec4"}
        value={groupSearch}
      />

      <div className={localStyles.groupList}>
        {visibleGroups.map((group) => {
          const isActive = group.id === activeGroupId;
          const enabledCount = group.rules.filter((rule) => rule.enabled).length;

          return (
            <div
              key={group.id}
              className={classNames(
                localStyles.groupItem,
                isActive && localStyles.groupItemActive,
                menuGroupId === group.id && localStyles.groupItemOpen,
              )}
            >
              <button
                className={localStyles.groupSelect}
                disabled={submitting}
                onClick={() => onSelectGroup(group.id)}
                type="button"
              >
                <div className={localStyles.groupMain}>
                  <div className={localStyles.groupTitleRow}>
                    <span
                      className={classNames(
                        localStyles.groupStatusDot,
                        isActive && localStyles.groupStatusDotActive,
                      )}
                    />
                    <strong>{group.name}</strong>
                  </div>
                  <div className={localStyles.groupMetaRow}>
                    <span className={localStyles.groupMeta}>{`${group.rules.length} \u6761\u89c4\u5219`}</span>
                  </div>
                </div>
                <span
                  className={classNames(
                    localStyles.statusBadge,
                    isActive ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
                  )}
                >
                  {isActive
                    ? "\u751f\u6548\u4e2d"
                    : enabledCount > 0
                      ? "\u5f85\u751f\u6548"
                      : "\u672a\u751f\u6548"}
                </span>
              </button>

              <Dropdown
                menu={{ items: buildGroupMenu(group) }}
                onOpenChange={(open) => setMenuGroupId(open ? group.id : null)}
                trigger={["click"]}
              >
                <button
                  className={classNames(localStyles.iconButton, localStyles.moreButton)}
                  onClick={(event) => event.stopPropagation()}
                  type="button"
                >
                  ...
                </button>
              </Dropdown>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
