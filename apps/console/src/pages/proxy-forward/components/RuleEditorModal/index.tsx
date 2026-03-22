import { Input, Modal, Select, Switch, Tag } from "antd";
import localStyles from "./index.module.less";
import type { StoredForwardRule, StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";

type RuleEditorModalProps = {
  activeGroup: StoredGroup | null;
  activeGroupId: string;
  editingRule: StoredForwardRule | null;
  groups: StoredGroup[];
  isOpen: boolean;
  ruleForm: StoredForwardRule;
  submitting: boolean;
  onCancel: () => void;
  onSave: () => void;
  setRuleForm: (updater: (current: StoredForwardRule) => StoredForwardRule) => void;
};

const RuleEditorModal = ({
  activeGroup,
  activeGroupId,
  editingRule,
  groups,
  isOpen,
  ruleForm,
  submitting,
  onCancel,
  onSave,
  setRuleForm,
}: RuleEditorModalProps) => {
  return (
    <Modal
      cancelText="取消"
      className={classNames(localStyles.ruleModal, localStyles.root)}
      confirmLoading={submitting}
      maskClosable={false}
      okText={editingRule ? "保存修改" : "创建规则"}
      onCancel={onCancel}
      onOk={onSave}
      open={isOpen}
      title={null}
      width={760}
      wrapClassName={localStyles.ruleModalWrap}
    >
      <div className={localStyles.modalForm}>
        <div className={localStyles.modalHero}>
          <div className={localStyles.modalHeroCopy}>
            <span className={localStyles.pageEyebrow}>代理规则</span>
            <h3>{editingRule ? "编辑代理规则" : "新建代理规则"}</h3>
            <p>只需要配置来源 URL 和目标 URL 即可完成映射。</p>
          </div>
          <div className={localStyles.modalHeroMeta}>
            <Tag bordered={false} className={localStyles.sectionBadge}>
              {activeGroup?.name ?? "默认组"}
            </Tag>
          </div>
        </div>

        <div className={localStyles.modalSwitchRow}>
          <div className={localStyles.stateCardCopy}>
            <strong>规则状态</strong>
            <p>{ruleForm.enabled ? "当前规则已启用" : "当前规则已关闭"}</p>
          </div>
          <Switch
            checked={ruleForm.enabled}
            onChange={(checked) => setRuleForm((current) => ({ ...current, enabled: checked }))}
          />
        </div>

        <section className={localStyles.formSection}>
          <div className={localStyles.formSectionHeader}>
            <span className={localStyles.sectionLabel}>基础配置</span>
            <strong>URL 映射</strong>
          </div>
          <div className={localStyles.formGrid}>
            <label className={localStyles.modalField}>
              <span>来源 URL</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, url: event.target.value }))
                }
                placeholder="https://api.example.com/v1/resource"
                value={ruleForm.url}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>目标 URL</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, targetUrl: event.target.value }))
                }
                placeholder="http://127.0.0.1:9001/v1/resource"
                value={ruleForm.targetUrl}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>请求方法</span>
              <Select
                onChange={(value) => setRuleForm((current) => ({ ...current, method: value }))}
                options={[
                  "GET",
                  "POST",
                  "PUT",
                  "PATCH",
                  "DELETE",
                ].map((value) => ({ label: value, value }))}
                value={ruleForm.method}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>规则名称（可选）</span>
              <Input
                value={ruleForm.name}
                onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>所属分组</span>
              <Select
                disabled
                options={groups.map((group) => ({ label: group.name, value: group.id }))}
                value={activeGroupId}
              />
            </label>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export { RuleEditorModal };
export default RuleEditorModal;
