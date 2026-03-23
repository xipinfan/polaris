import { Badge, Card, Drawer, Tag } from "antd";
import localStyles from "./index.module.less";
import type { RuleView } from "../../types";
import { classNames, formatTime } from "../../utils/proxyForwardHelpers";
import { getFallbackPolicyLabel } from "../../utils/proxyForwardLabels";

type TrafficDetailDrawerProps = {
  rule: RuleView | null;
  onClose: () => void;
};

export function TrafficDetailDrawer({ rule, onClose }: TrafficDetailDrawerProps) {
  return (
    <Drawer className={localStyles.trafficDrawer} onClose={onClose} open={!!rule} title={null} width={540}>
      {rule ? (
        <div className={classNames(localStyles.drawerBody, localStyles.root)}>
          <div className={localStyles.drawerHero}>
            <div className={localStyles.drawerHeroTop}>
              <div>
                <span className={localStyles.pageEyebrow}>流量详情</span>
                <h3>{rule.name}</h3>
              </div>
              <Tag
                bordered={false}
                className={classNames(
                  localStyles.statusBadge,
                  rule.recentErrorCount > 0 ? localStyles.statusBadgeDanger : localStyles.statusBadgeSuccess,
                )}
              >
                {rule.recentErrorCount > 0 ? "失败" : "已命中"}
              </Tag>
            </div>
            <div className={localStyles.drawerHeroMeta}>
              <span>{`命中规则：${rule.name}`}</span>
              <span>{`时间：${formatTime(rule.lastHitAt)}`}</span>
            </div>
          </div>

          <Card variant="borderless" className={localStyles.drawerSection}>
            <div className={localStyles.drawerSectionHeader}>
              <span>请求信息</span>
              <Badge
                status={rule.latestRecord?.secure ? "processing" : "default"}
                text={rule.latestRecord?.secure ? "HTTPS" : "HTTP"}
              />
            </div>
            <div className={localStyles.drawerGrid}>
              <div><span>原始地址</span><strong>{rule.latestRecord?.url ?? rule.url}</strong></div>
              <div><span>请求方法</span><strong>{rule.latestRecord?.method ?? rule.method}</strong></div>
              <div><span>Host</span><strong>{rule.latestRecord?.host ?? rule.pattern}</strong></div>
              <div><span>Path</span><strong>{rule.latestRecord?.path ?? rule.path}</strong></div>
            </div>
            <div className={localStyles.codePanel}>
              <div className={localStyles.codePanelHeader}>请求头</div>
              <pre>{JSON.stringify(rule.latestRecord?.requestHeaders ?? {}, null, 2)}</pre>
            </div>
          </Card>

          <Card variant="borderless" className={localStyles.drawerSection}>
            <div className={localStyles.drawerSectionHeader}><span>转发结果</span></div>
            <div className={localStyles.drawerGrid}>
              <div><span>命中规则</span><strong>{rule.name}</strong></div>
              <div><span>目标地址</span><strong>{rule.targetUrl}</strong></div>
              <div><span>改写结果</span><strong>{`${rule.rewriteHost || "保留 Host"} · ${rule.rewritePath || "保留 Path"}`}</strong></div>
              <div><span>回退策略</span><strong>{getFallbackPolicyLabel(rule.fallbackPolicy)}</strong></div>
            </div>
            <div className={localStyles.codePanel}>
              <div className={localStyles.codePanelHeader}>最终请求头</div>
              <pre>{rule.requestHeaderPreview}</pre>
            </div>
          </Card>
        </div>
      ) : null}
    </Drawer>
  );
}
