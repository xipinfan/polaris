import { Button, Card, Statistic, Tag, Typography } from "antd";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import localStyles from "./index.module.less";
import { getProxyModeLabel } from "../../utils";

const { Paragraph, Text, Title } = Typography;

type HomeHeroProps = {
  snapshot: ServiceSnapshot;
  primaryProxyLabel: string;
  primaryProxyAction: "direct" | "rules";
  onGoDebug: () => void;
  onGoMock: () => void;
  onGoSettings: () => void;
  onGoTraffic: () => void;
  onSetProxyMode: (mode: "direct" | "rules") => void;
};

export function HomeHero({
  snapshot,
  primaryProxyLabel,
  primaryProxyAction,
  onGoDebug,
  onGoMock,
  onGoSettings,
  onGoTraffic,
  onSetProxyMode,
}: HomeHeroProps) {
  return (
    <section className={`${localStyles.hero} ${localStyles.root}`}>
      <Card variant="borderless" className={localStyles.heroMain}>
        <div aria-hidden="true" className={localStyles.heroHalo} />
        <div className={localStyles.heroBody}>
          <div className={localStyles.heroIntro}>
            <div className={localStyles.heroTags}>
              <Tag bordered={false} className={localStyles.darkTag}>
                {"代理控制台"}
              </Tag>
              <Tag bordered={false} color={snapshot.status.online ? "success" : "default"}>
                {snapshot.status.online ? "核心服务在线" : "核心服务离线"}
              </Tag>
              <Tag bordered={false} className={localStyles.modeTag}>
                {getProxyModeLabel(snapshot.status.proxyMode)}
              </Tag>
            </div>
            <div className={localStyles.heroText}>
              <Title level={1}>{"从拉起代理到保存请求，在同一个工作台继续联调。"}</Title>
              <Paragraph>
                Core 当前在线，当前工作链路为
                {getProxyModeLabel(snapshot.status.proxyMode)}
                。首页只保留关键状态、快捷入口和最近可继续处理的 Mock 规则。
              </Paragraph>
            </div>
            <div className={localStyles.heroActions}>
              <Button onClick={() => onSetProxyMode(primaryProxyAction)} size="large" type="primary">
                {primaryProxyLabel}
              </Button>
              <Button onClick={onGoTraffic} size="large">
                {"查看实时请求"}
              </Button>
              <Button onClick={onGoDebug} size="large">
                {"新建调试请求"}
              </Button>
            </div>
          </div>

          <div className={localStyles.metricGrid}>
            <Card variant="borderless" className={localStyles.metricCard}>
              <Statistic title={"代理端口"} value={snapshot.status.proxyPort} />
              <Text type="secondary">{"当前工作台"}</Text>
            </Card>
            <Card variant="borderless" className={localStyles.metricCard}>
              <Statistic title={"最近请求"} value={snapshot.recentRequests.length} />
              <Text type="secondary">{`活跃请求 ${snapshot.status.activeRequestCount}`}</Text>
            </Card>
            <Card variant="borderless" className={localStyles.metricCard}>
              <Statistic title={"模拟方案"} value={snapshot.mockRules.length} />
              <Text type="secondary">{getProxyModeLabel(snapshot.status.proxyMode)}</Text>
            </Card>
          </div>
        </div>
      </Card>

      <Card variant="borderless" className={localStyles.sideCard}>
        <div className={localStyles.sideSection}>
          <Title level={4}>{"下一步"}</Title>
          <Paragraph>{"直接进入抓包、调试、模拟或设置，首页只负责把你带到下一步。"}</Paragraph>
        </div>
        <div className={localStyles.sideActions}>
          <Button block onClick={onGoMock}>
            {"管理模拟"}
          </Button>
          <Button block onClick={onGoSettings}>
            {"打开设置"}
          </Button>
        </div>
        <div className={localStyles.tagCluster}>
          <Tag bordered={false} color={snapshot.status.mcpEnabled ? "success" : "default"}>
            {snapshot.status.mcpEnabled ? "MCP 已启用" : "MCP 未启用"}
          </Tag>
          <Tag bordered={false}>{`模拟规则 ${snapshot.mockRules.length} 条`}</Tag>
          <Tag bordered={false}>{`活跃请求 ${snapshot.status.activeRequestCount}`}</Tag>
        </div>
      </Card>
    </section>
  );
}
