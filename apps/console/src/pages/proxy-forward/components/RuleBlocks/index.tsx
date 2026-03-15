import { useState } from "react";
import { Button, Card, Drawer, Switch, Tag } from "antd";
import localStyles from "./index.module.less";
import type { RuleView, StoredForwardRule } from "../../types";
import { classNames, formatTime } from "../../utils/proxyForwardHelpers";

type RuleBlocksProps = {
  rules: RuleView[];
  isRulePending: (ruleId: string) => boolean;
  onOpenEditRule: (rule: StoredForwardRule) => void;
  onDeleteRule: (rule: StoredForwardRule) => void;
  onToggleRule: (rule: RuleView, checked: boolean) => void;
};

export function RuleBlocks({
  rules,
  isRulePending,
  onOpenEditRule,
  onDeleteRule,
  onToggleRule,
}: RuleBlocksProps) {
  const [statusRule, setStatusRule] = useState<RuleView | null>(null);

  return (
    <>
      <Card bordered={false} className={classNames(localStyles.rulePanel, localStyles.root)}>
        <div className={localStyles.ruleList}>
          {rules.map((rule) => (
            <div className={localStyles.ruleRow} key={rule.id}>
              <div className={localStyles.ruleSwitch}>
                <Switch
                  checked={rule.enabled}
                  disabled={isRulePending(rule.id)}
                  onChange={(checked) => onToggleRule(rule, checked)}
                />
              </div>

              <div className={localStyles.ruleColumn}>
                <span className={localStyles.columnLabel}>规则名称</span>
                <strong>{rule.name}</strong>
              </div>

              <div className={localStyles.ruleColumn}>
                <span className={localStyles.columnLabel}>来源地址</span>
                <strong>{rule.url}</strong>
              </div>

              <div className={localStyles.ruleColumn}>
                <span className={localStyles.columnLabel}>目标地址</span>
                <strong>{rule.targetUrl}</strong>
              </div>

              <div className={localStyles.ruleActions}>
                <Button onClick={() => setStatusRule(rule)}>运行状态</Button>
                <Button disabled={isRulePending(rule.id)} onClick={() => onOpenEditRule(rule)}>
                  编辑
                </Button>
                <Button danger disabled={isRulePending(rule.id)} onClick={() => onDeleteRule(rule)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>

        {rules.length === 0 ? (
          <div className={localStyles.emptyState}>
            <strong>当前分组还没有规则</strong>
            <p>新建一条规则后会显示在这里。</p>
          </div>
        ) : null}
      </Card>

      <Drawer
        open={statusRule !== null}
        onClose={() => setStatusRule(null)}
        title={statusRule ? `运行状态 · ${statusRule.name}` : "运行状态"}
        width={420}
      >
        {statusRule ? (
          <div className={localStyles.statusPanel}>
            <div className={localStyles.statusLine}>
              <span>当前状态</span>
              <Tag bordered={false} className={statusRule.enabled ? localStyles.statusOn : localStyles.statusOff}>
                {statusRule.enabled ? "运行中" : "已关闭"}
              </Tag>
            </div>
            <div className={localStyles.statusLine}>
              <span>今日命中</span>
              <strong>{statusRule.hitCountToday}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>最近错误</span>
              <strong>{statusRule.recentErrorCount}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>最近命中时间</span>
              <strong>{formatTime(statusRule.lastHitAt)}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>来源地址</span>
              <strong>{statusRule.url}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>目标地址</span>
              <strong>{statusRule.targetUrl}</strong>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
