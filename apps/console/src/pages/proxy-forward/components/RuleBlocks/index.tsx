import { useState } from "react";
import { Drawer, Popover, Switch, Tag } from "antd";
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
      <section className={classNames(localStyles.rulePanel, localStyles.root)}>
        <div className={localStyles.ruleTableHead}>
          <span>{"\u72b6\u6001"}</span>
          <span>{"\u89c4\u5219\u4fe1\u606f"}</span>
          <span>{"\u6765\u6e90\u5730\u5740"}</span>
          <span>{"\u76ee\u6807\u5730\u5740"}</span>
          <span>{"\u64cd\u4f5c"}</span>
        </div>

        <div className={localStyles.ruleList}>
          {rules.map((rule) => {
            return (
              <div className={localStyles.ruleRow} key={rule.id}>
                <div className={localStyles.ruleSwitch}>
                  <Switch
                    checked={rule.enabled}
                    disabled={isRulePending(rule.id)}
                    onChange={(checked) => onToggleRule(rule, checked)}
                  />
                </div>

                <div className={localStyles.ruleColumn}>
                  <span className={localStyles.columnLabel}>{"\u89c4\u5219\u540d\u79f0"}</span>
                  <strong>{rule.name}</strong>
                </div>

                <div className={localStyles.ruleColumn}>
                  <span className={localStyles.columnLabel}>{"\u6765\u6e90\u5730\u5740"}</span>
                  <strong>{rule.url}</strong>
                </div>

                <div className={localStyles.ruleColumn}>
                  <span className={localStyles.columnLabel}>{"\u76ee\u6807\u5730\u5740"}</span>
                  <strong>{rule.targetUrl}</strong>
                </div>

                <div className={localStyles.ruleActions}>
                  <button className={localStyles.tertiaryButton} onClick={() => setStatusRule(rule)} type="button">
                    {"\u72b6\u6001"}
                  </button>
                  <button
                    className={localStyles.primaryButton}
                    disabled={isRulePending(rule.id)}
                    onClick={() => onOpenEditRule(rule)}
                    type="button"
                  >
                    {"\u7f16\u8f91"}
                  </button>
                  <Popover
                    content={
                      <div className={localStyles.popoverMenu}>
                        <button
                          className={localStyles.menuDanger}
                          disabled={isRulePending(rule.id)}
                          onClick={() => onDeleteRule(rule)}
                          type="button"
                        >
                          {"\u5220\u9664"}
                        </button>
                      </div>
                    }
                    getPopupContainer={() => document.body}
                    overlayClassName={localStyles.rulePopover}
                    placement="rightTop"
                    trigger="click"
                  >
                    <button className={localStyles.iconButton} type="button">
                      ...
                    </button>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>

        {rules.length === 0 ? (
          <div className={localStyles.emptyState}>
            <strong>{"\u5f53\u524d\u5206\u7ec4\u8fd8\u6ca1\u6709\u89c4\u5219"}</strong>
            <p>
              {
                "\u521b\u5efa\u4e00\u6761\u8f6c\u53d1\u89c4\u5219\u540e\uff0c\u8fd9\u91cc\u4f1a\u5f00\u59cb\u627f\u63a5\u5f53\u524d\u5206\u7ec4\u7684\u5206\u6d41\u914d\u7f6e\u4e0e\u547d\u4e2d\u72b6\u6001\u3002"
              }
            </p>
          </div>
        ) : null}
      </section>

      <Drawer
        open={statusRule !== null}
        onClose={() => setStatusRule(null)}
        title={
          statusRule
            ? `\u8fd0\u884c\u72b6\u6001 \u00b7 ${statusRule.name}`
            : "\u8fd0\u884c\u72b6\u6001"
        }
        width={420}
      >
        {statusRule ? (
          <div className={localStyles.statusPanel}>
            <div className={localStyles.statusLine}>
              <span>{"\u5f53\u524d\u72b6\u6001"}</span>
              <Tag bordered={false} className={statusRule.enabled ? localStyles.statusOn : localStyles.statusOff}>
                {statusRule.enabled ? "\u8fd0\u884c\u4e2d" : "\u5df2\u5173\u95ed"}
              </Tag>
            </div>
            <div className={localStyles.statusLine}>
              <span>{"\u4eca\u65e5\u547d\u4e2d"}</span>
              <strong>{statusRule.hitCountToday}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>{"\u6700\u8fd1\u9519\u8bef"}</span>
              <strong>{statusRule.recentErrorCount}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>{"\u6700\u8fd1\u547d\u4e2d\u65f6\u95f4"}</span>
              <strong>{formatTime(statusRule.lastHitAt)}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>{"\u6765\u6e90\u5730\u5740"}</span>
              <strong>{statusRule.url}</strong>
            </div>
            <div className={localStyles.statusLine}>
              <span>{"\u76ee\u6807\u5730\u5740"}</span>
              <strong>{statusRule.targetUrl}</strong>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
