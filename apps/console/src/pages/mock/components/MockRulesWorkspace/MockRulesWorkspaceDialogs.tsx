import { Input, Modal, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MockRule } from "@polaris/shared-types";
import type { DuplicateUrlBlockDraft, ExportTableRecord } from "./types";
import localStyles from "./index.module.less";
import { getRuleScene } from "../../utils/mockHelpers";

type MockRulesWorkspaceDialogsProps = {
  batchSearch: string;
  currentGroup: string;
  currentGroupRules: MockRule[];
  defaultGroup: string;
  duplicateDraft: DuplicateUrlBlockDraft | null;
  exportColumns: ColumnsType<ExportTableRecord>;
  filteredExportRecords: ExportTableRecord[];
  groupDescriptionInput: string;
  isBatchExportOpen: boolean;
  isDuplicatingUrlBlock: boolean;
  isEditGroupOpen: boolean;
  moveRule: MockRule | null;
  moveTargets: string[];
  movingGroup: string | null;
  onCloseEditGroup: () => void;
  onConfirmBatchExport: () => void;
  onConfirmDuplicateUrlBlock: () => void;
  onConfirmEditGroup: () => void;
  onMoveRule: (rule: MockRule, group: string) => Promise<void>;
  selectedExportKeys: string[];
  selectedExportRules: MockRule[];
  setBatchSearch: (value: string) => void;
  setDuplicateDraft: (updater: (current: DuplicateUrlBlockDraft | null) => DuplicateUrlBlockDraft | null) => void;
  setGroupDescriptionInput: (value: string) => void;
  setIsBatchExportOpen: (value: boolean) => void;
  setIsDuplicatingUrlBlock: (value: boolean) => void;
  setMoveRule: (rule: MockRule | null) => void;
  setMovingGroup: (value: string | null) => void;
  setSelectedExportKeys: (keys: string[]) => void;
};

export function MockRulesWorkspaceDialogs(props: MockRulesWorkspaceDialogsProps) {
  return (
    <>
      <MoveRuleModal {...props} />
      <DuplicateUrlBlockModal {...props} />
      <BatchExportModal {...props} />
      <EditGroupDescriptionModal {...props} />
    </>
  );
}

function MoveRuleModal({
  defaultGroup,
  moveRule,
  moveTargets,
  movingGroup,
  onMoveRule,
  setMoveRule,
  setMovingGroup,
}: MockRulesWorkspaceDialogsProps) {
  const moveScene = moveRule ? getRuleScene(moveRule, defaultGroup) : null;

  return (
    <Modal
      cancelText={"取消"}
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
  );
}

function DuplicateUrlBlockModal({
  duplicateDraft,
  isDuplicatingUrlBlock,
  onConfirmDuplicateUrlBlock,
  setDuplicateDraft,
  setIsDuplicatingUrlBlock,
}: MockRulesWorkspaceDialogsProps) {
  return (
    <Modal
      cancelText={"取消"}
      mask={{ closable: false }}
      okButtonProps={{ disabled: !duplicateDraft?.url.trim(), loading: isDuplicatingUrlBlock }}
      okText="复制"
      onCancel={() => {
        if (!isDuplicatingUrlBlock) {
          setDuplicateDraft(() => null);
        }
      }}
      onOk={() => {
        setIsDuplicatingUrlBlock(true);
        void Promise.resolve(onConfirmDuplicateUrlBlock()).finally(() => setIsDuplicatingUrlBlock(false));
      }}
      open={Boolean(duplicateDraft)}
      title="复制到新地址"
    >
      <div className={localStyles.duplicateForm}>
        <div className={localStyles.duplicateFormHint}>当前地址：{duplicateDraft?.sourceUrl ?? "-"}</div>
        <label className={localStyles.duplicateField}>
          <span>新的完整地址</span>
          <Input
            onChange={(event) =>
              setDuplicateDraft((current) => (current ? { ...current, url: event.target.value } : current))
            }
            placeholder="请输入新的完整地址"
            value={duplicateDraft?.url ?? ""}
          />
        </label>
        <label className={localStyles.duplicateField}>
          <span>新的 Body 精确匹配</span>
          <Input
            onChange={(event) =>
              setDuplicateDraft((current) =>
                current ? { ...current, requestBodyExactMatch: event.target.value } : current,
              )
            }
            placeholder={'例如 name:"demo"'}
            value={duplicateDraft?.requestBodyExactMatch ?? ""}
          />
        </label>
        <label className={localStyles.duplicateField}>
          <span>新的 Body Key 匹配</span>
          <Input
            onChange={(event) =>
              setDuplicateDraft((current) =>
                current ? { ...current, requestBodyKeyMatch: event.target.value } : current,
              )
            }
            placeholder="例如 user.profile.id"
            value={duplicateDraft?.requestBodyKeyMatch ?? ""}
          />
        </label>
      </div>
    </Modal>
  );
}

function BatchExportModal({
  batchSearch,
  currentGroup,
  currentGroupRules,
  exportColumns,
  filteredExportRecords,
  isBatchExportOpen,
  onConfirmBatchExport,
  selectedExportKeys,
  selectedExportRules,
  setBatchSearch,
  setIsBatchExportOpen,
  setSelectedExportKeys,
}: MockRulesWorkspaceDialogsProps) {
  return (
    <Modal
      cancelText={"取消"}
      mask={{ closable: false }}
      okButtonProps={{ disabled: selectedExportRules.length === 0 }}
      okText="导出"
      onCancel={() => setIsBatchExportOpen(false)}
      onOk={onConfirmBatchExport}
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
  );
}

function EditGroupDescriptionModal({
  groupDescriptionInput,
  isEditGroupOpen,
  onCloseEditGroup,
  onConfirmEditGroup,
  setGroupDescriptionInput,
}: MockRulesWorkspaceDialogsProps) {
  return (
    <Modal
      cancelText={"取消"}
      mask={{ closable: false }}
      okText="确定"
      onCancel={onCloseEditGroup}
      onOk={onConfirmEditGroup}
      open={isEditGroupOpen}
      title={"编辑分组描述"}
    >
      <Input.TextArea
        autoSize={{ minRows: 3, maxRows: 6 }}
        onChange={(event) => setGroupDescriptionInput(event.target.value)}
        placeholder={"编辑分组描述"}
        value={groupDescriptionInput}
      />
    </Modal>
  );
}

