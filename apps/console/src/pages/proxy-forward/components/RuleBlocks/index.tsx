import { Button, Card, Dropdown, Switch, Tag } from "antd";
import type { MenuProps } from "antd";
import { workspaceSelectors } from "../../../../stores/selectors";
import { useWorkspaceStore } from "../../../../stores/workspaceStore";
import localStyles from "./index.module.less";
import type { RuleView, StoredForwardRule } from "../../types";
import { classNames, formatTime } from "../../utils/proxyForwardHelpers";
import { getForwardModeLabel } from "../../utils/proxyForwardLabels";

type UrlBlock = {
  key: string;
  fullUrl: string;
  host: string;
  rules: RuleView[];
};

type RuleBlocksProps = {
  urlBlocks: UrlBlock[];
  buildRuleMenu: (rule: StoredForwardRule) => MenuProps["items"];
  getActionSummary: (rule: StoredForwardRule) => string;
  getMatchSummary: (rule: StoredForwardRule) => string;
  onOpenDrawer: (rule: RuleView) => void;
  onOpenEditRule: (rule: StoredForwardRule) => void;
  onToggleRule: (rule: RuleView, checked: boolean) => void;
};

export function RuleBlocks({
  urlBlocks,
  buildRuleMenu,
  getActionSummary,
  getMatchSummary,
  onOpenDrawer,
  onOpenEditRule,
  onToggleRule,
}: RuleBlocksProps) {
  const collapsedHosts = useWorkspaceStore(workspaceSelectors.proxyCollapsedHosts);
  const setCollapsedHosts = useWorkspaceStore((state) => state.setProxyCollapsedHosts);

  return (
    <div className={classNames(localStyles.rulePanel, localStyles.root)}>
      {urlBlocks.map((block) => {
        const collapsed = collapsedHosts[block.key] === true;
        return (
          <Card bordered={false} className={localStyles.urlBlock} key={block.key}>
            <button
              className={localStyles.urlBlockHeader}
              onClick={() => setCollapsedHosts((current) => ({ ...current, [block.key]: !collapsed }))}
              type="button"
            >
              <div className={localStyles.urlBlockCopy}>
                <strong>{block.fullUrl}</strong>
                <span>{block.host}</span>
              </div>
              <div className={localStyles.urlBlockMeta}>
                <Tag bordered={false} className={localStyles.sectionBadge}>
                  {`${block.rules.length} 条规则`}
                </Tag>
                <span className={localStyles.collapseLabel}>{collapsed ? "展开" : "收起"}</span>
              </div>
            </button>

            {!collapsed ? (
              <div className={localStyles.ruleList}>
                {block.rules.map((rule) => (
                  <div className={localStyles.ruleRow} key={rule.id}>
                    <div className={localStyles.ruleSwitch}>
                      <Switch checked={rule.enabled} onChange={(checked) => onToggleRule(rule, checked)} />
                    </div>

                    <div className={localStyles.ruleRequest}>
                      <div className={localStyles.ruleRequestTop}>
                        <Tag bordered={false} className={localStyles.methodTag}>
                          {rule.method}
                        </Tag>
                        <strong>{rule.name}</strong>
                      </div>
                      <span>{rule.url}</span>
                    </div>

                    <div className={localStyles.ruleColumn}>
                      <span className={localStyles.columnLabel}>匹配条件</span>
                      <strong>{getMatchSummary(rule)}</strong>
                    </div>

                    <div className={localStyles.ruleColumn}>
                      <span className={localStyles.columnLabel}>转发动作</span>
                      <strong>{`${getForwardModeLabel(rule.forwardMode)} · ${rule.action === "proxy" ? "经 Polaris" : "直连"}`}</strong>
                      <small>{getActionSummary(rule)}</small>
                    </div>

                    <div className={localStyles.ruleColumn}>
                      <span className={localStyles.columnLabel}>运行状态</span>
                      <strong>{`今日命中 ${rule.hitCountToday}`}</strong>
                      <small>{`最近错误 ${rule.recentErrorCount} · 最近命中 ${formatTime(rule.lastHitAt)}`}</small>
                    </div>

                    <div className={localStyles.ruleActions}>
                      <Button onClick={() => onOpenEditRule(rule)}>编辑</Button>
                      <Button onClick={() => onOpenDrawer(rule)}>查看流量</Button>
                      <Dropdown menu={{ items: buildRuleMenu(rule) }} trigger={["click"]}>
                        <Button className={localStyles.iconButton} onClick={(event) => event.stopPropagation()}>
                          ...
                        </Button>
                      </Dropdown>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}

      {urlBlocks.length === 0 ? (
        <Card bordered={false} className={localStyles.emptyCard}>
          <span className={localStyles.sectionLabel}>规则面板</span>
          <strong>当前分组还没有代理规则</strong>
          <p>先创建一条站点级规则，再回来查看命中、错误和最近流量。</p>
        </Card>
      ) : null}
    </div>
  );
}
