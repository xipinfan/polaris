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
  t: (key: any, params?: Record<string, string | number>) => string;
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
  t,
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

  const submitCreateGroup = async () => {
    if (!nextCreateName) return;
    const uniqueName = buildUniqueGroupName(nextCreateName, groups);
    setCustomGroups((current) => (current.includes(uniqueName) ? current : [...current, uniqueName]));
    showToast(t("mock.groupCreated", { name: uniqueName }));
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

  return (
    <aside className={classNames(localStyles.sidebar, localStyles.root)}>
      {contextHolder}
      <Modal
        cancelText={t("mock.form.cancel")}
        mask={{ closable: false }}
        okButtonProps={{ disabled: !nextCreateName }}
        okText="确定"
        onCancel={() => {
          setCreateName("");
          setIsCreateOpen(false);
        }}
        onOk={() => void submitCreateGroup()}
        open={isCreateOpen}
        title={t("mock.groupNew")}
      >
        <Input
          autoFocus
          onChange={(event) => setCreateName(event.target.value)}
          onPressEnter={() => void submitCreateGroup()}
          placeholder={t("mock.groupCreatePrompt")}
          value={createName}
        />
      </Modal>
      <Modal
        cancelText={t("mock.form.cancel")}
        mask={{ closable: false }}
        okButtonProps={{ disabled: !nextRenameName }}
        okText="确定"
        onCancel={() => {
          setRenamingGroup(null);
          setRenameName("");
        }}
        onOk={() => void submitRenameGroup()}
        open={Boolean(renamingGroup)}
        title={t("mock.groupRename")}
      >
        <Input
          autoFocus
          onChange={(event) => setRenameName(event.target.value)}
          onPressEnter={() => void submitRenameGroup()}
          placeholder={t("mock.groupRenamePrompt")}
          value={renameName}
        />
      </Modal>
      <div className={localStyles.sidebarHeader}>
        <div>
          <strong>{t("mock.groupsTitle")}</strong>
        </div>
        <div className={localStyles.headerActions}>
          <button className={localStyles.secondaryButton} onClick={onImportGroups} type="button">
            导入
          </button>
          <button
            className={localStyles.secondaryButton}
            onClick={() => {
              setCreateName("");
              setIsCreateOpen(true);
            }}
            type="button"
          >
            {t("mock.groupNew")}
          </button>
        </div>
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
                    <span
                      className={classNames(
                        localStyles.groupStatusDot,
                        summary.active && localStyles.groupStatusDotActive,
                      )}
                    />
                    <strong>{group}</strong>
                  </div>
                  <span className={localStyles.groupMeta}>{t("mock.groupRuleCount", { count: summary.count })}</span>
                </div>
                <span
                  className={classNames(
                    localStyles.statusBadge,
                    summary.active ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted,
                  )}
                >
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
                    <button onClick={() => onExportGroup(group)} type="button">
                      导出分组
                    </button>
                    <button
                      onClick={() => {
                        setRenamingGroup(group);
                        setRenameName(group);
                      }}
                      type="button"
                    >
                      {t("mock.groupRename")}
                    </button>
                    <button onClick={() => void onCopyGroup(group)} type="button">
                      {t("mock.groupCopy")}
                    </button>
                    {group !== defaultGroup ? (
                      <button
                        className={localStyles.menuDanger}
                        onClick={() => {
                          void modal.confirm({
                            cancelText: t("mock.form.cancel"),
                            content: t("mock.groupDeleteConfirm", { name: group }),
                            icon: null,
                            mask: { closable: false },
                            okButtonProps: { danger: true },
                            okText: t("mock.groupDelete"),
                            onOk: async () => {
                              await onDeleteGroup(group);
                              return undefined;
                            },
                            title: t("mock.groupDelete"),
                          });
                        }}
                        type="button"
                      >
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
