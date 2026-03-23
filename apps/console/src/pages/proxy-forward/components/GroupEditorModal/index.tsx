import { Input, Modal } from "antd";
import localStyles from "./index.module.less";
import type { StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type GroupEditorModalProps = {
  editingGroup: StoredGroup | null;
  groupName: string;
  isOpen: boolean;
  onCancel: () => void;
  onSave: () => void;
  setGroupName: (value: string) => void;
};

export function GroupEditorModal({
  editingGroup,
  groupName,
  isOpen,
  onCancel,
  onSave,
  setGroupName,
}: GroupEditorModalProps) {
  return (
    <Modal
      cancelText="取消"
      okText={editingGroup ? "保存修改" : "创建分组"}
      mask={{ closable: false }}
      onCancel={onCancel}
      onOk={onSave}
      open={isOpen}
      title={editingGroup ? "编辑分组" : "新建分组"}
      className={classNames(localStyles.root)}
    >
      <label className={localStyles.modalField}>
        <span>分组名称</span>
        <Input onChange={(event) => setGroupName(event.target.value)} value={groupName} />
      </label>
    </Modal>
  );
}


