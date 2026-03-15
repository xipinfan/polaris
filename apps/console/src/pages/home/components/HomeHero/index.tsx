import { Button, Card, Statistic, Tag, Typography } from "antd";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
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
  t: TranslateFn;
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
  t,
}: HomeHeroProps) {
  return (
    <section className={`${localStyles.hero} ${localStyles.root}`}>
      <Card bordered={false} className={localStyles.heroMain}>
        <div aria-hidden="true" className={localStyles.heroHalo} />
        <div className={localStyles.heroBody}>
          <div className={localStyles.heroIntro}>
            <div className={localStyles.heroTags}>
              <Tag bordered={false} className={localStyles.darkTag}>{t("home.module.control")}</Tag>
              <Tag bordered={false} color={snapshot.status.online ? "success" : "default"}>
                {snapshot.status.online ? t("home.coreOnline") : t("home.coreOffline")}
              </Tag>
              <Tag bordered={false} className={localStyles.modeTag}>{getProxyModeLabel(snapshot.status.proxyMode)}</Tag>
            </div>
            <div className={localStyles.heroText}>
              <Title level={1}>{t("home.taskTitle")}</Title>
              <Paragraph>
                Core 当前在线，当前工作链路为
                {getProxyModeLabel(snapshot.status.proxyMode)}。首页只保留关键状态、快捷入口和最近可继续处理的 Mock 规则。
              </Paragraph>
            </div>
            <div className={localStyles.heroActions}>
              <Button onClick={() => onSetProxyMode(primaryProxyAction)} size="large" type="primary">
                {primaryProxyLabel}
              </Button>
              <Button onClick={onGoTraffic} size="large">{t("home.quick.traffic")}</Button>
              <Button onClick={onGoDebug} size="large">{t("home.quick.debug")}</Button>
            </div>
          </div>

          <div className={localStyles.metricGrid}>
            <Card bordered={false} className={localStyles.metricCard}>
              <Statistic title={t("home.metric.proxyPort")} value={snapshot.status.proxyPort} />
              <Text type="secondary">{t("home.workspaceLabel")}</Text>
            </Card>
            <Card bordered={false} className={localStyles.metricCard}>
              <Statistic title={t("home.metric.recentRequests")} value={snapshot.recentRequests.length} />
              <Text type="secondary">{t("home.activeRequests", { count: snapshot.status.activeRequestCount })}</Text>
            </Card>
            <Card bordered={false} className={localStyles.metricCard}>
              <Statistic title={t("home.metric.mockVariants")} value={snapshot.mockRules.length} />
              <Text type="secondary">{getProxyModeLabel(snapshot.status.proxyMode)}</Text>
            </Card>
          </div>
        </div>
      </Card>

      <Card bordered={false} className={localStyles.sideCard}>
        <div className={localStyles.sideSection}>
          <span className={localStyles.eyebrow}>下一步</span>
          <Title level={4}>{t("home.nextActionTitle")}</Title>
          <Paragraph>{t("home.nextActionBody")}</Paragraph>
        </div>
        <div className={localStyles.sideActions}>
          <Button block onClick={onGoMock}>{t("home.quick.mock")}</Button>
          <Button block onClick={onGoSettings}>{t("home.quick.settings")}</Button>
        </div>
        <div className={localStyles.tagCluster}>
          <Tag bordered={false} color={snapshot.status.mcpEnabled ? "success" : "default"}>
            {snapshot.status.mcpEnabled ? t("home.mcpEnabled") : t("home.mcpDisabled")}
          </Tag>
          <Tag bordered={false}>{t("home.mockRules", { count: snapshot.mockRules.length })}</Tag>
          <Tag bordered={false}>
            {t("home.activeRequests", { count: snapshot.status.activeRequestCount })}
          </Tag>
        </div>
      </Card>
    </section>
  );
}

