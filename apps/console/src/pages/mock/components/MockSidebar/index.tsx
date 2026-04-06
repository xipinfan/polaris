import { Input, Modal } from "antd";
import { useMemo, useState } from "react";
import { uiSelectors, workspaceSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import { buildUniqueGroupName, classNames } from "../../utils/mockHelpers";
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
  onActivateGroup: (group: string) => Promise<void>;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onExportGroup: (group: string) => void;
  onImportGroups: () => void;
  onRenameGroup: (group: string, nextName: string) => Promise<void>;
};

export function MockSidebar({
  currentGroup,
  defaultGroup,
  filteredGroups,
  groupSummaries,
  groups,
  setCustomGroups,
  showToast,
  onActivateGroup,
  onCopyGroup,
  onDeleteGroup,
  onExportGroup,
  onImportGroups,
  onRenameGroup,
}: MockSidebarProps) {
  const groupSearch = useUiStore(uiSelectors.mockGroupSearch);
  const setGroupSearch = useUiStore((state) => state.setMockGroupSearch);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);
  const [modal, contextHolder] = Modal.useModal();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const nextCreateName = useMemo(() => createName.trim(), [createName]);
  const nextRenameName = useMemo(() => renameName.trim(), [renameName]);
  const summaryByGroup = useMemo(
    () =>
      new Map(
        groupSummaries.map((summary) => [
          summary.group,
          summary,
        ]),
      ),
    [groupSummaries],
  );

  const submitCreateGroup = async () => {
    if (!nextCreateName) return;
    const uniqueName = buildUniqueGroupName(nextCreateName, groups);
    setCustomGroups((current) => (current.includes(uniqueName) ? current : [...current, uniqueName]));
    showToast(`已创建分组：${uniqueName}`);
    await onActivateGroup(uniqueName);
    setCreateName("");
    setIsCreateOpen(false);
  };

  const submitRenameGroup = async () => {
    if (!renamingGroup || !nextRenameName) return;
    if (groups.includes(nextRenameName) && nextRenameName !== renamingGroup) {
      showToast("分组名称已存在", "error");
      return;
    }
    await onRenameGroup(renamingGroup, nextRenameName);
    setRenamingGroup(null);
    setRenameName("");
  };

  const openCreateModal = () => {
    setCreateName("");
    setIsCreateOpen(true);
  };

  const openRenameModal = (group: string) => {
    setRenamingGroup(group);
    setRenameName(group);
  };

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

  return (
    <aside className={classNames(localStyles.sidebar, localStyles.root)}>
      {contextHolder}
      <Modal
        cancelText={"取消"}
        mask={{ closable: false }}
        okButtonProps={{ disabled: !nextCreateName }}
        okText="确定"
        onCancel={() => {
          setCreateName("");
          setIsCreateOpen(false);
        }}
        onOk={() => void submitCreateGroup()}
        open={isCreateOpen}
        title={"新建分组"}
      >
        <Input
          autoFocus
          onChange={(event) => setCreateName(event.target.value)}
          onPressEnter={() => void submitCreateGroup()}
          placeholder={"输入分组名称"}
          value={createName}
        />
      </Modal>
      <Modal
        cancelText={"取消"}
        mask={{ closable: false }}
        okButtonProps={{ disabled: !nextRenameName }}
        okText="确定"
        onCancel={() => {
          setRenamingGroup(null);
          setRenameName("");
        }}
        onOk={() => void submitRenameGroup()}
        open={Boolean(renamingGroup)}
        title={"重命名"}
      >
        <Input
          autoFocus
          onChange={(event) => setRenameName(event.target.value)}
          onPressEnter={() => void submitRenameGroup()}
          placeholder={"输入新的分组名称"}
          value={renameName}
        />
      </Modal>
      <div className={localStyles.sidebarHeader}>
        <div className={localStyles.sidebarTitle}>
          <strong>{"分组"}</strong>
        </div>
        <div className={localStyles.headerActions}>
          <button className={classNames(localStyles.secondaryButton, localStyles.compactButton)} onClick={onImportGroups} type="button">
            导入
          </button>
          <button
            className={classNames(localStyles.secondaryButton, localStyles.compactButton)}
            onClick={openCreateModal}
            type="button"
          >
            {"新建分组"}
          </button>
        </div>
      </div>

      <input
        className={localStyles.searchInput}
        onChange={(event) => setGroupSearch(event.target.value)}
        placeholder={"搜索分组"}
        value={groupSearch}
      />

      <div className={localStyles.groupList}>
        {filteredGroups.map((group) => {
          const summary = summaryByGroup.get(group) ?? {
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
                    <span
                      className={classNames(
                        localStyles.groupStatusDot,
                        summary.active && localStyles.groupStatusDotActive,
                      )}
                    />
                    <strong>{group}</strong>
                  </div>
                  <div className={localStyles.groupMetaRow}>
                    <span className={localStyles.groupMeta}>{`${summary.count} 条规则`}</span>
                    {summary.enabledCount > 0 ? (
                      <span className={localStyles.groupMetaAccent}>{summary.enabledCount} 启用</span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={classNames(
                    localStyles.statusBadge,
                    summary.active ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
                  )}
                >
                  {summary.active ? "当前" : "待命"}
                </span>
              </button>

              <div className={localStyles.menuRoot} onClick={(event) => event.stopPropagation()}>
                <button
                  aria-label={"更多"}
                  className={classNames(localStyles.iconButton, localStyles.moreButton)}
                  onClick={() => setGroupMenuName(groupMenuName === group ? null : group)}
                  type="button"
                >
                  ...
                </button>
                {groupMenuName === group ? (
                  <div className={classNames(localStyles.actionMenu, localStyles.groupActionMenu)}>
                    <button onClick={() => onExportGroup(group)} type="button">
                      导出分组
                    </button>
                    <button
                      onClick={() => openRenameModal(group)}
                      type="button"
                    >
                      {"重命名"}
                    </button>
                    <button onClick={() => void onCopyGroup(group)} type="button">
                      {"复制分组"}
                    </button>
                    {group !== defaultGroup ? (
                      <button
                        className={localStyles.menuDanger}
                        onClick={() => openDeleteGroupConfirm(group)}
                        type="button"
                      >
                        {"删除分组"}
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

