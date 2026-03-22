import { Button, Dropdown, Input, Tag } from "antd";
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
          <span className={localStyles.sectionLabel}>分组</span>
          <strong>分组</strong>
        </div>
        <div className={localStyles.headerActions}>
          <Button onClick={onImportGroups}>导入</Button>
          <Button
            onClick={() => {
              setEditingGroup(null);
              setGroupName("");
              setIsGroupModalOpen(true);
            }}
          >
            新建分组
          </Button>
        </div>
      </div>

      <Input
        className={localStyles.searchInput}
        onChange={(event) => setGroupSearch(event.target.value)}
        placeholder="搜索分组"
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
                  <div className={localStyles.groupMeta}>{`${group.rules.length} 条规则`}</div>
                </div>
                <Tag
                  bordered={false}
                  className={classNames(
                    localStyles.statusBadge,
                    isActive ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
                  )}
                >
                  {isActive ? "生效中" : enabledCount > 0 ? "待生效" : "未生效"}
                </Tag>
              </button>

              <Dropdown
                menu={{ items: buildGroupMenu(group) }}
                onOpenChange={(open) => setMenuGroupId(open ? group.id : null)}
                trigger={["click"]}
              >
                <Button
                  className={classNames(localStyles.iconButton, localStyles.moreButton)}
                  onClick={(event) => event.stopPropagation()}
                >
                  ...
                </Button>
              </Dropdown>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
