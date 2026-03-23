import type { MockRule } from "@polaris/shared-types";
import { Input, Modal, Popover, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { workspaceSelectors } from "../../../../stores/selectors";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import type { RuleUrlBlock } from "../../types";
import { classNames, getRuleScene } from "../../utils/mockHelpers";
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
  t: (key: any, params?: Record<string, string | number>) => string;
  onCopyGroup: (group: string) => Promise<void>;
  onDeleteGroup: (group: string) => Promise<void>;
  onDuplicateRule: (rule: MockRule) => Promise<void>;
  onEditGroupDescription: (nextDescription: string) => void;
  onMoveRule: (rule: MockRule, nextGroup: string) => Promise<void>;
  onOpenCreateModal: () => void;
  onOpenEditModal: (rule: MockRule) => void;
  onRemoveRule: (rule: MockRule) => Promise<void>;
  onExportRule: (rule: MockRule) => void;
  onExportSelectedRules: (rules: MockRule[]) => void;
  onImportRules: () => void;
  onToggleCurrentGroup: () => Promise<void>;
  onToggleRule: (rule: MockRule) => Promise<void>;
};

type ExportTableRecord = {
  key: string;
  method: string;
  name: string;
  url: string;
  rule: MockRule;
};

export function MockRulesWorkspace(props: MockRulesWorkspaceProps) {
  const {
    currentGroup,
    currentGroupDescription,
    currentGroupRules,
    defaultGroup,
    groups,
    isCurrentGroupEnabled,
    ruleBlocks,
    getMethodClass,
    t,
    onCopyGroup,
    onDeleteGroup,
    onDuplicateRule,
    onEditGroupDescription,
    onMoveRule,
    onOpenCreateModal,
    onOpenEditModal,
    onRemoveRule,
    onExportRule,
    onExportSelectedRules,
    onImportRules,
    onToggleCurrentGroup,
    onToggleRule,
  } = props;

  const collapsedBlocks = useWorkspaceStore(workspaceSelectors.mockCollapsedBlocks);
  const groupMenuName = useWorkspaceStore(workspaceSelectors.mockGroupMenuName);
  const ruleMenuId = useWorkspaceStore(workspaceSelectors.mockRuleMenuId);
  const selectedRuleId = useWorkspaceStore(workspaceSelectors.mockSelectedRuleId);
  const setCollapsedBlocks = useWorkspaceStore((state) => state.setMockCollapsedBlocks);
  const setGroupMenuName = useWorkspaceStore((state) => state.setMockGroupMenuName);
  const setRuleMenuId = useWorkspaceStore((state) => state.setMockRuleMenuId);
  const setSelectedRuleId = useWorkspaceStore((state) => state.setMockSelectedRuleId);

  const [modal, contextHolder] = Modal.useModal();
  const [moveRule, setMoveRule] = useState<MockRule | null>(null);
  const [movingGroup, setMovingGroup] = useState<string | null>(null);
  const [ruleSearch, setRuleSearch] = useState("");
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [groupDescriptionInput, setGroupDescriptionInput] = useState("");
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const [selectedExportKeys, setSelectedExportKeys] = useState<string[]>([]);

  const moveScene = useMemo(
    () => (moveRule ? getRuleScene(moveRule, defaultGroup) : null),
    [defaultGroup, moveRule],
  );
  const moveTargets = useMemo(() => {
    if (!moveScene) return [];
    return groups.filter((group) => group !== moveScene.group);
  }, [groups, moveScene]);

  const normalizedKeyword = ruleSearch.trim().toLowerCase();
  const filteredRuleBlocks = useMemo(() => {
    if (!normalizedKeyword) return ruleBlocks;
    return ruleBlocks
      .map((block) => {
        const nextRules = block.rules.filter((rule) => {
          const scene = getRuleScene(rule, defaultGroup);
          return (
            scene.variant.toLowerCase().includes(normalizedKeyword) ||
            rule.method.toLowerCase().includes(normalizedKeyword) ||
            rule.url.toLowerCase().includes(normalizedKeyword) ||
            block.key.toLowerCase().includes(normalizedKeyword)
          );
        });
        return { ...block, rules: nextRules };
      })
      .filter((block) => block.rules.length > 0);
  }, [defaultGroup, normalizedKeyword, ruleBlocks]);
  const hasVisibleRules = filteredRuleBlocks.some((block) => block.rules.length > 0);

  const exportRecords = useMemo<ExportTableRecord[]>(
    () =>
      currentGroupRules.map((rule) => {
        const scene = getRuleScene(rule, defaultGroup);
        return {
          key: rule.id,
          method: rule.method.toUpperCase(),
          name: scene.variant,
          rule,
          url: rule.url,
        };
      }),
    [currentGroupRules, defaultGroup],
  );

  const filteredExportRecords = useMemo(() => {
    const keyword = batchSearch.trim().toLowerCase();
    if (!keyword) {
      return exportRecords;
    }
    return exportRecords.filter((record) =>
      `${record.method} ${record.name} ${record.url}`.toLowerCase().includes(keyword),
    );
  }, [batchSearch, exportRecords]);

  const exportColumns = useMemo<ColumnsType<ExportTableRecord>>(
    () => [
      {
        dataIndex: "method",
        key: "method",
        title: "方法",
        width: 96,
      },
      {
        dataIndex: "name",
        key: "name",
        title: "规则名称",
      },
      {
        dataIndex: "url",
        key: "url",
        title: "URL",
      },
    ],
    [],
  );

  const selectedExportRules = useMemo(() => {
    const idSet = new Set(selectedExportKeys);
    return exportRecords.filter((record) => idSet.has(record.key)).map((record) => record.rule);
  }, [exportRecords, selectedExportKeys]);

  const openBatchExport = () => {
    setBatchSearch("");
    setSelectedExportKeys([]);
    setIsBatchExportOpen(true);
  };

  return (
    <section className={classNames(localStyles.main, localStyles.root)}>
      {contextHolder}

      <Modal
        cancelText={t("mock.form.cancel")}
        footer={null}
        mask={{ closable: false }}
        onCancel={() => {
          if (!movingGroup) {
            setMoveRule(null);
          }
        }}
        open={Boolean(moveRule)}
        title="移动到分组"
        width={360}
      >
        <div className={localStyles.movePicker}>
          <div className={localStyles.movePickerLabel}>
            {moveScene ? `规则：${moveScene.variant}` : "请选择目标分组"}
          </div>
          <div className={localStyles.movePickerList}>
            {moveTargets.length === 0 ? (
              <div className={localStyles.movePickerEmpty}>没有可移动的其他分组</div>
            ) : (
              moveTargets.map((group) => (
                <button
                  className={localStyles.movePickerItem}
                  disabled={Boolean(movingGroup)}
                  key={group}
                  onClick={() => {
                    if (!moveRule) return;
                    setMovingGroup(group);
                    void onMoveRule(moveRule, group)
                      .then(() => setMoveRule(null))
                      .finally(() => setMovingGroup(null));
                  }}
                  type="button"
                >
                  {group}
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal
        cancelText={t("mock.form.cancel")}
        mask={{ closable: false }}
        okButtonProps={{ disabled: selectedExportRules.length === 0 }}
        okText="导出"
        onCancel={() => setIsBatchExportOpen(false)}
        onOk={() => {
          onExportSelectedRules(selectedExportRules);
          setIsBatchExportOpen(false);
        }}
        open={isBatchExportOpen}
        title={`批量导出（当前分组：${currentGroup}）`}
        width={860}
      >
        <div className={localStyles.batchExportToolbar}>
          <Input.Search
            allowClear
            onChange={(event) => setBatchSearch(event.target.value)}
            placeholder="搜索方法 / 规则名 / URL"
            value={batchSearch}
          />
          <span className={localStyles.batchExportMeta}>
            已选 {selectedExportRules.length} 条 / 共 {currentGroupRules.length} 条
          </span>
        </div>
        <Table<ExportTableRecord>
          columns={exportColumns}
          dataSource={filteredExportRecords}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          rowSelection={{
            onChange: (keys) => setSelectedExportKeys(keys.map(String)),
            preserveSelectedRowKeys: true,
            selectedRowKeys: selectedExportKeys,
          }}
          size="small"
        />
      </Modal>

      <div className={localStyles.overview}>
        <div className={localStyles.overviewCopy}>
          <div className={localStyles.overviewTitleRow}>
            <h3>{currentGroup}</h3>
          </div>
          <Input
            className={localStyles.groupSearchInput}
            onChange={(event) => setRuleSearch(event.target.value)}
            placeholder="搜索当前分组规则"
            value={ruleSearch}
          />
        </div>
        <div className={localStyles.overviewActions}>
          <button className={localStyles.primaryButton} onClick={onOpenCreateModal} type="button">
            {t("mock.newRequest")}
          </button>
          <button className={localStyles.secondaryButton} onClick={onImportRules} type="button">
            导入规则
          </button>
          <button className={localStyles.secondaryButton} onClick={openBatchExport} type="button">
            批量导出
          </button>
          <button
            className={localStyles.secondaryButton}
            onClick={() => {
              setGroupDescriptionInput(currentGroupDescription ?? "");
              setIsEditGroupOpen(true);
            }}
            type="button"
          >
            {t("mock.groupEdit")}
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
                <button onClick={() => void onCopyGroup(currentGroup)} type="button">
                  {t("mock.groupCopy")}
                </button>
                <button onClick={() => void onToggleCurrentGroup()} type="button">
                  {isCurrentGroupEnabled ? t("mock.groupDisableAll") : t("mock.groupEnableAll")}
                </button>
                {currentGroup !== defaultGroup ? (
                  <button
                    className={localStyles.menuDanger}
                    onClick={() => {
                      void modal.confirm({
                        cancelText: t("mock.form.cancel"),
                        content: t("mock.groupDeleteConfirm", { name: currentGroup }),
                        icon: null,
                        mask: { closable: false },
                        okButtonProps: { danger: true },
                        okText: t("mock.groupDelete"),
                        onOk: async () => {
                          await onDeleteGroup(currentGroup);
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
      </div>

      <div className={localStyles.ruleTable}>
        <div className={localStyles.ruleTableHead}>
          <span>{t("mock.ruleTable.status")}</span>
          <span>{t("mock.ruleTable.request")}</span>
          <span>{t("mock.ruleTable.actions")}</span>
        </div>
        {currentGroupRules.length === 0 ? (
          <div className={localStyles.emptyState}>
            <h3>{t("mock.ruleNoRulesTitle")}</h3>
            <p>{t("mock.ruleNoRulesBody")}</p>
          </div>
        ) : !hasVisibleRules ? (
          <div className={localStyles.emptyState}>
            <h3>未找到匹配规则</h3>
            <p>试试更换关键词或清空搜索条件。</p>
          </div>
        ) : (
          <div className={localStyles.ruleTableBody}>
            {filteredRuleBlocks.map((block) => (
              <section className={localStyles.ruleBlock} key={block.key}>
                <button
                  className={localStyles.ruleBlockHeader}
                  onClick={() =>
                    setCollapsedBlocks((current) => ({
                      ...current,
                      [block.key]: !current[block.key],
                    }))
                  }
                  type="button"
                >
                  <div className={localStyles.ruleBlockCopy}>
                    <strong>{block.key}</strong>
                  </div>
                  <div className={localStyles.ruleBlockMeta}>
                    <span className={classNames(localStyles.statusBadge, localStyles.statusBadgeMuted)}>
                      {t("mock.groupRuleCount", { count: block.rules.length })}
                    </span>
                    <span className={localStyles.collapseIndicator}>
                      {collapsedBlocks[block.key] ? `> ${t("mock.expand")}` : `v ${t("mock.collapse")}`}
                    </span>
                  </div>
                </button>
                <div
                  className={classNames(
                    localStyles.ruleRows,
                    collapsedBlocks[block.key] && localStyles.ruleRowsCollapsed,
                  )}
                >
                  {block.rules.map((rule) => {
                    const scene = getRuleScene(rule, defaultGroup);
                    return (
                      <div
                        className={classNames(
                          localStyles.ruleRow,
                          selectedRuleId === rule.id && localStyles.ruleRowActive,
                        )}
                        key={rule.id}
                        onClick={() => setSelectedRuleId(rule.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={localStyles.ruleStatus}>
                          <label className={localStyles.switch}>
                            <input checked={rule.enabled} onChange={() => void onToggleRule(rule)} type="checkbox" />
                            <span className={localStyles.switchTrack} />
                          </label>
                        </div>
                        <div className={localStyles.ruleRequest}>
                          <div className={localStyles.ruleRequestTop}>
                            <span className={classNames(localStyles.methodBadge, getMethodClass(rule.method))}>
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
                              {t("mock.form.requestBodyKeyMatchShort", { key: rule.requestBodyKeyMatch })}
                            </span>
                          ) : null}
                        </div>
                        <div className={localStyles.ruleActions} onClick={(event) => event.stopPropagation()}>
                          <button className={localStyles.secondaryButton} onClick={() => onOpenEditModal(rule)} type="button">
                            {t("mock.edit")}
                          </button>
                          <button className={localStyles.secondaryButton} onClick={() => onExportRule(rule)} type="button">
                            导出
                          </button>
                          <button
                            className={classNames(localStyles.secondaryButton, localStyles.deleteButton)}
                            onClick={() => {
                              void modal.confirm({
                                cancelText: t("mock.form.cancel"),
                                content: `确认删除规则「${scene.variant}」吗？`,
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
                            }}
                            type="button"
                          >
                            {t("mock.delete")}
                          </button>
                          <div className={localStyles.menuRoot}>
                            <Popover
                              content={
                                <div className={localStyles.popoverMenu}>
                                  <button
                                    onClick={() => {
                                      void onDuplicateRule(rule);
                                      setRuleMenuId(null);
                                    }}
                                    type="button"
                                  >
                                    {t("mock.duplicate")}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRuleMenuId(null);
                                      setMoveRule(rule);
                                    }}
                                    type="button"
                                  >
                                    移动到分组
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
                              <button className={classNames(localStyles.iconButton, localStyles.moreButton)} type="button">
                                ...
                              </button>
                            </Popover>
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
      <Modal
        cancelText={t("mock.form.cancel")}
        mask={{ closable: false }}
        okText="确定"
        onCancel={() => {
          setIsEditGroupOpen(false);
          setGroupDescriptionInput("");
        }}
        onOk={() => {
          onEditGroupDescription(groupDescriptionInput);
          setIsEditGroupOpen(false);
          setGroupDescriptionInput("");
        }}
        open={isEditGroupOpen}
        title={t("mock.groupDescriptionPrompt")}
      >
        <Input.TextArea
          autoSize={{ minRows: 3, maxRows: 6 }}
          onChange={(event) => setGroupDescriptionInput(event.target.value)}
          placeholder={t("mock.groupDescriptionPrompt")}
          value={groupDescriptionInput}
        />
      </Modal>
    </section>
  );
}
