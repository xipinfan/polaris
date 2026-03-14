import { Input, Modal, Segmented, Select, Switch, Tag } from "antd";
import localStyles from "./index.module.less";
import type { ForwardMode, StoredForwardRule, StoredGroup } from "../../types";
import { classNames } from "../../utils/proxyForwardHelpers";
import {
  getFallbackPolicyLabel,
  getForwardModeLabel,
  getHeaderStrategyLabel,
} from "../../utils/proxyForwardLabels";

type RuleEditorModalProps = {
  activeGroup: StoredGroup | null;
  activeGroupId: string;
  editingRule: StoredForwardRule | null;
  groups: StoredGroup[];
  isOpen: boolean;
  requestHeaderCount: number;
  resolvedTargetUrl: string;
  responseHeaderCount: number;
  rewriteSummary: string;
  ruleForm: StoredForwardRule;
  submitting: boolean;
  onCancel: () => void;
  onSave: () => void;
  setRuleForm: (updater: (current: StoredForwardRule) => StoredForwardRule) => void;
};

export function RuleEditorModal({
  activeGroup,
  activeGroupId,
  editingRule,
  groups,
  isOpen,
  requestHeaderCount,
  resolvedTargetUrl,
  responseHeaderCount,
  rewriteSummary,
  ruleForm,
  submitting,
  onCancel,
  onSave,
  setRuleForm,
}: RuleEditorModalProps) {
  return (
    <Modal
      cancelText="取消"
      className={classNames(localStyles.ruleModal, localStyles.root)}
      confirmLoading={submitting}
      okText={editingRule ? "保存修改" : "创建规则"}
      onCancel={onCancel}
      onOk={onSave}
      open={isOpen}
      title={null}
      width={920}
      wrapClassName={localStyles.ruleModalWrap}
    >
      <div className={localStyles.modalForm}>
        <div className={localStyles.modalHero}>
          <div className={localStyles.modalHeroCopy}>
            <span className={localStyles.pageEyebrow}>代理规则</span>
            <h3>{editingRule ? "编辑代理规则" : "新建代理规则"}</h3>
            <p>配置请求匹配方式、转发行为和保存前预览。</p>
          </div>
          <div className={localStyles.modalHeroMeta}>
            <Tag bordered={false} className={localStyles.sectionBadge}>
              {activeGroup?.name ?? "默认组"}
            </Tag>
            <Tag bordered={false} className={localStyles.methodTag}>
              {ruleForm.method}
            </Tag>
          </div>
        </div>

        <div className={localStyles.modalSwitchRow}>
          <div className={localStyles.stateCardCopy}>
            <strong>规则状态</strong>
            <p>{ruleForm.enabled ? "当前规则已参与组内匹配" : "当前规则暂不参与命中"}</p>
          </div>
          <Switch
            checked={ruleForm.enabled}
            onChange={(checked) => setRuleForm((current) => ({ ...current, enabled: checked }))}
          />
        </div>

        <section className={localStyles.formSection}>
          <div className={localStyles.formSectionHeader}>
            <span className={localStyles.sectionLabel}>基本信息</span>
            <strong>规则基础配置</strong>
          </div>
          <div className={localStyles.formGrid}>
            <label className={localStyles.modalField}>
              <span>规则名称</span>
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
              <small className={localStyles.helperText}>仅当前选中分组会真正生效。</small>
            </label>
            <label className={localStyles.modalField}>
              <span>请求方法</span>
              <Select
                onChange={(value) => setRuleForm((current) => ({ ...current, method: value }))}
                options={["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({ label: value, value }))}
                value={ruleForm.method}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>优先级</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, priority: Number(event.target.value || 0) }))
                }
                value={String(ruleForm.priority)}
              />
            </label>
          </div>
        </section>

        <section className={localStyles.formSection}>
          <div className={localStyles.formSectionHeader}>
            <span className={localStyles.sectionLabel}>转发配置</span>
            <strong>核心转发行为</strong>
          </div>
          <div className={localStyles.configOverview}>
            <div className={localStyles.previewCard}>
              <span>转发模式</span>
              <strong>{getForwardModeLabel(ruleForm.forwardMode)}</strong>
            </div>
            <div className={localStyles.previewCard}>
              <span>目标去向</span>
              <strong>{resolvedTargetUrl}</strong>
            </div>
            <div className={localStyles.previewCard}>
              <span>改写摘要</span>
              <strong>{rewriteSummary || "保持原始地址结构"}</strong>
            </div>
            <div className={localStyles.previewCard}>
              <span>请求头策略</span>
              <strong>{`${getHeaderStrategyLabel(ruleForm.headerStrategy)} · ${requestHeaderCount} 项`}</strong>
            </div>
          </div>
          <div className={localStyles.formGrid}>
            <label className={localStyles.modalField}>
              <span>转发模式</span>
              <Segmented
                block
                onChange={(value) =>
                  setRuleForm((current) => ({ ...current, forwardMode: value as ForwardMode }))
                }
                options={[
                  { label: "直连转发", value: "direct" },
                  { label: "改写目标地址", value: "rewriteTarget" },
                  { label: "仅改写 Host", value: "rewriteHost" },
                  { label: "仅改写 Path", value: "rewritePath" },
                ]}
                value={ruleForm.forwardMode}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>目标地址</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, targetUrl: event.target.value }))
                }
                value={ruleForm.targetUrl}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>Host 改写</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, rewriteHost: event.target.value }))
                }
                value={ruleForm.rewriteHost}
              />
            </label>
            <label className={localStyles.modalField}>
              <span>Path 改写</span>
              <Input
                onChange={(event) =>
                  setRuleForm((current) => ({ ...current, rewritePath: event.target.value }))
                }
                value={ruleForm.rewritePath}
              />
            </label>
          </div>
        </section>

        <section className={localStyles.formSection}>
          <div className={localStyles.summaryStrip}>
            <div className={localStyles.summaryChip}>
              <span>响应延迟</span>
              <strong>{`${ruleForm.responseDelay} ms`}</strong>
            </div>
            <div className={localStyles.summaryChip}>
              <span>回退策略</span>
              <strong>{getFallbackPolicyLabel(ruleForm.fallbackPolicy)}</strong>
            </div>
            <div className={localStyles.summaryChip}>
              <span>响应头处理</span>
              <strong>{`${responseHeaderCount} 项`}</strong>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
