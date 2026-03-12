import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Empty, List, Skeleton, Statistic, Tag, Typography } from "antd";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";
import { readCachedBootstrap, writeCachedBootstrap } from "../../services/consoleCache";
import styles from "./HomePage.module.css";

const { Paragraph, Text, Title } = Typography;

function getProxyModeLabel(mode: ServiceSnapshot["status"]["proxyMode"]) {
  if (mode === "rules") {
    return "规则代理";
  }

  if (mode === "direct") {
    return "直连模式";
  }

  if (mode === "global") {
    return "全局代理";
  }

  return "跟随系统";
}

export function HomePage() {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(() => readCachedBootstrap());
  const navigate = useNavigate();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();

  const load = () =>
    apiClient
      .bootstrap()
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        writeCachedBootstrap(nextSnapshot);
      })
      .catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const setProxyMode = async (mode: "direct" | "rules") => {
    await apiClient.setProxyMode(mode);
    showToast(mode === "direct" ? t("common.switchedDirect") : t("common.switchedRules"));
    load();
  };

  const primaryProxyAction = snapshot?.status.proxyMode === "rules" ? "direct" : "rules";
  const primaryProxyLabel = primaryProxyAction === "rules" ? t("home.enableRules") : t("home.backDirect");

  const recentMocks = snapshot
    ? snapshot.mockRules.slice(0, 5).map((rule) => ({
        id: rule.id,
        title: rule.name,
        meta: `${rule.method} · ${rule.url}`,
      }))
    : [];

  const enabledMockCount = snapshot?.mockRules.filter((rule) => rule.enabled).length ?? 0;

  const quickEntries = snapshot
    ? [
        {
          key: "traffic",
          index: "01",
          label: t("home.flow.capture"),
          title: t("home.quick.traffic"),
          points: [
            t("home.metric.recentRequests"),
            t("home.activeRequests", { count: snapshot.status.activeRequestCount }),
          ],
          action: t("home.viewAll"),
          primary: true,
          onClick: () => navigate("/traffic"),
        },
        {
          key: "debug",
          index: "02",
          label: t("home.flow.debug"),
          title: t("home.quick.debug"),
          points: [t("home.workspaceLabel"), "调整请求头与请求体"],
          action: t("home.openDebug"),
          primary: false,
          onClick: () => navigate("/debug"),
        },
        {
          key: "mock",
          index: "03",
          label: t("home.flow.mock"),
          title: t("home.quick.mock"),
          points: [
            t("home.metric.mockVariants"),
            `当前模式 · ${getProxyModeLabel(snapshot.status.proxyMode)}`,
          ],
          action: t("home.quick.mock"),
          primary: false,
          onClick: () => navigate("/mock"),
        },
        {
          key: "settings",
          index: "04",
          label: t("home.flow.save"),
          title: t("home.quick.settings"),
          points: ["管理本地服务与证书", "查看代理模式与端口"],
          action: t("home.quick.settings"),
          primary: false,
          onClick: () => navigate("/settings"),
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>控制台首页</span>
          <Title level={2}>{t("home.title")}</Title>
          <Paragraph>{t("home.subtitle")}</Paragraph>
        </div>
      </header>

      {!snapshot ? (
        <Card className={styles.loadingCard} bordered={false}>
          <Skeleton active paragraph={{ rows: 4 }} title={{ width: "36%" }} />
        </Card>
      ) : (
        <>
          <section className={styles.hero}>
            <Card className={styles.heroMain} bordered={false}>
              <div className={styles.heroHalo} aria-hidden="true" />
              <div className={styles.heroBody}>
                <div className={styles.heroIntro}>
                  <div className={styles.heroTags}>
                    <Tag className={styles.darkTag} bordered={false}>
                      {t("home.module.control")}
                    </Tag>
                    <Tag color={snapshot.status.online ? "success" : "default"} bordered={false}>
                      {snapshot.status.online ? t("home.coreOnline") : t("home.coreOffline")}
                    </Tag>
                    <Tag className={styles.modeTag} bordered={false}>
                      {getProxyModeLabel(snapshot.status.proxyMode)}
                    </Tag>
                  </div>

                  <div className={styles.heroText}>
                    <Title level={1}>{t("home.taskTitle")}</Title>
                    <Paragraph>
                      Core 当前{snapshot.status.online ? "在线" : "离线"}，当前工作链路为
                      {getProxyModeLabel(snapshot.status.proxyMode)}。首页只保留关键状态、快捷入口和最近可继续处理的 Mock 规则。
                    </Paragraph>
                  </div>

                  <div className={styles.heroActions}>
                    <Button type="primary" size="large" onClick={() => setProxyMode(primaryProxyAction)}>
                      {primaryProxyLabel}
                    </Button>
                    <Button size="large" onClick={() => navigate("/traffic")}>
                      {t("home.quick.traffic")}
                    </Button>
                    <Button size="large" onClick={() => navigate("/debug")}>
                      {t("home.quick.debug")}
                    </Button>
                  </div>
                </div>

                <div className={styles.metricGrid}>
                  <Card className={styles.metricCard} bordered={false}>
                    <Statistic title={t("home.metric.proxyPort")} value={snapshot.status.proxyPort} />
                    <Text type="secondary">{t("home.workspaceLabel")}</Text>
                  </Card>
                  <Card className={styles.metricCard} bordered={false}>
                    <Statistic title={t("home.metric.recentRequests")} value={snapshot.recentRequests.length} />
                    <Text type="secondary">
                      {t("home.activeRequests", { count: snapshot.status.activeRequestCount })}
                    </Text>
                  </Card>
                  <Card className={styles.metricCard} bordered={false}>
                    <Statistic title={t("home.metric.mockVariants")} value={snapshot.mockRules.length} />
                    <Text type="secondary">{getProxyModeLabel(snapshot.status.proxyMode)}</Text>
                  </Card>
                </div>
              </div>
            </Card>

            <Card className={styles.sideCard} bordered={false}>
              <div className={styles.sideSection}>
                <span className={styles.eyebrow}>下一步</span>
                <Title level={4}>{t("home.nextActionTitle")}</Title>
                <Paragraph>{t("home.nextActionBody")}</Paragraph>
              </div>

              <div className={styles.sideActions}>
                <Button block onClick={() => navigate("/mock")}>
                  {t("home.quick.mock")}
                </Button>
                <Button block onClick={() => navigate("/settings")}>
                  {t("home.quick.settings")}
                </Button>
              </div>

              <div className={styles.tagCluster}>
                <Tag color={snapshot.status.mcpEnabled ? "success" : "default"} bordered={false}>
                  {snapshot.status.mcpEnabled ? t("home.mcpEnabled") : t("home.mcpDisabled")}
                </Tag>
                <Tag bordered={false}>{t("home.mockRules", { count: snapshot.mockRules.length })}</Tag>
                <Tag bordered={false}>
                  {t("home.activeRequests", { count: snapshot.status.activeRequestCount })}
                </Tag>
              </div>
            </Card>
          </section>

          <section className={styles.contentGrid}>
            <Card
              className={styles.workbenchCard}
              bordered={false}
              title={
                <div className={styles.cardTitleBlock}>
                  <span className={styles.eyebrow}>工作流入口</span>
                  <Title level={4}>{t("home.module.traffic")}</Title>
                </div>
              }
              extra={
                <Button type="link" onClick={() => navigate("/traffic")}>
                  {t("home.viewAll")}
                </Button>
              }
            >
              <div className={styles.workbenchGrid}>
                {quickEntries.map((item) => (
                  <Card
                    key={item.key}
                    className={item.primary ? styles.actionCardPrimary : styles.actionCard}
                    bordered={false}
                  >
                    <div className={styles.actionCardHead}>
                      <Tag bordered={false}>{item.label}</Tag>
                      <span className={styles.actionIndex}>{item.index}</span>
                    </div>
                    <Title level={5}>{item.title}</Title>
                    <ul className={styles.actionList}>
                      {item.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                    <Button type={item.primary ? "primary" : "default"} onClick={item.onClick}>
                      {item.action}
                    </Button>
                  </Card>
                ))}
              </div>
            </Card>

            <div className={styles.sideStack}>
              <Card
                className={styles.summaryCard}
                bordered={false}
                title={
                  <div className={styles.cardTitleBlock}>
                    <span className={styles.eyebrow}>Mock 概览</span>
                    <Title level={4}>{t("home.quick.mock")}</Title>
                  </div>
                }
                extra={
                  <Button type="link" onClick={() => navigate("/mock")}>
                    {t("home.quick.mock")}
                  </Button>
                }
              >
                <div className={styles.summaryStats}>
                  <Card className={styles.summaryStatCard} bordered={false}>
                    <Statistic title={t("home.metric.mockVariants")} value={snapshot.mockRules.length} />
                  </Card>
                  <Card className={styles.summaryStatCard} bordered={false}>
                    <Statistic title="启用规则" value={enabledMockCount} />
                  </Card>
                </div>
              </Card>

              <Card
                className={styles.resumeCard}
                bordered={false}
                title={
                  <div className={styles.cardTitleBlock}>
                    <span className={styles.eyebrow}>继续处理</span>
                    <Title level={4}>{t("home.resumeTitle")}</Title>
                  </div>
                }
              >
                {recentMocks.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div className={styles.emptyCopy}>
                        <strong>{t("mock.noneTitle")}</strong>
                        <span>{t("mock.noneBody")}</span>
                      </div>
                    }
                  />
                ) : (
                  <List
                    className={styles.resumeList}
                    dataSource={recentMocks}
                    renderItem={(item) => (
                      <List.Item className={styles.resumeItem}>
                        <button
                          type="button"
                          className={styles.resumeButton}
                          onClick={() => navigate("/mock")}
                        >
                          <div className={styles.resumeMarker} />
                          <div className={styles.resumeContent}>
                            <div className={styles.resumeTop}>
                              <strong>{item.title}</strong>
                              <Tag bordered={false}>{t("nav.mock")}</Tag>
                            </div>
                            <span>{item.meta}</span>
                          </div>
                        </button>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
