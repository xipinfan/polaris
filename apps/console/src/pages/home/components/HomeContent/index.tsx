import { Button, Card, Empty, List, Statistic, Tag, Typography } from "antd";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import localStyles from "./index.module.less";
import type { HomeQuickEntry, HomeRecentMock } from "../../types";

const { Paragraph, Title } = Typography;

type HomeContentProps = {
  enabledMockCount: number;
  quickEntries: HomeQuickEntry[];
  recentMocks: HomeRecentMock[];
  mcpEnabled: boolean;
  mockRuleCount: number;
  activeRequestCount: number;
  onGoMock: () => void;
  onGoSettings: () => void;
  onGoTraffic: () => void;
  t: TranslateFn;
};

export function HomeContent({
  enabledMockCount,
  quickEntries,
  recentMocks,
  mcpEnabled,
  mockRuleCount,
  activeRequestCount,
  onGoMock,
  onGoSettings,
  onGoTraffic,
  t,
}: HomeContentProps) {
  return (
    <>
      <section className={`${localStyles.hero} ${localStyles.root}`}>
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
            <Tag bordered={false} color={mcpEnabled ? "success" : "default"}>
              {mcpEnabled ? t("home.mcpEnabled") : t("home.mcpDisabled")}
            </Tag>
            <Tag bordered={false}>{t("home.mockRules", { count: mockRuleCount })}</Tag>
            <Tag bordered={false}>{t("home.activeRequests", { count: activeRequestCount })}</Tag>
          </div>
        </Card>
      </section>

      <section className={localStyles.contentGrid}>
        <Card
          bordered={false}
          className={localStyles.workbenchCard}
          extra={<Button onClick={onGoTraffic} type="link">{t("home.viewAll")}</Button>}
          title={
            <div className={localStyles.cardTitleBlock}>
              <span className={localStyles.eyebrow}>工作流入口</span>
              <Title level={4}>{t("home.module.traffic")}</Title>
            </div>
          }
        >
          <div className={localStyles.workbenchGrid}>
            {quickEntries.map((item) => (
              <Card
                bordered={false}
                className={item.primary ? localStyles.actionCardPrimary : localStyles.actionCard}
                key={item.key}
              >
                <div className={localStyles.actionCardHead}>
                  <Tag bordered={false}>{item.label}</Tag>
                  <span className={localStyles.actionIndex}>{item.index}</span>
                </div>
                <Title level={5}>{item.title}</Title>
                <ul className={localStyles.actionList}>
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <Button onClick={item.onClick} type={item.primary ? "primary" : "default"}>
                  {item.action}
                </Button>
              </Card>
            ))}
          </div>
        </Card>

        <div className={localStyles.sideStack}>
          <Card
            bordered={false}
            className={localStyles.summaryCard}
            extra={<Button onClick={onGoMock} type="link">{t("home.quick.mock")}</Button>}
            title={
              <div className={localStyles.cardTitleBlock}>
                <span className={localStyles.eyebrow}>Mock 概览</span>
                <Title level={4}>{t("home.quick.mock")}</Title>
              </div>
            }
          >
            <div className={localStyles.summaryStats}>
              <Card bordered={false} className={localStyles.summaryStatCard}>
                <Statistic title={t("home.metric.mockVariants")} value={mockRuleCount} />
              </Card>
              <Card bordered={false} className={localStyles.summaryStatCard}>
                <Statistic title="启用规则" value={enabledMockCount} />
              </Card>
            </div>
          </Card>

          <Card
            bordered={false}
            className={localStyles.resumeCard}
            title={
              <div className={localStyles.cardTitleBlock}>
                <span className={localStyles.eyebrow}>继续处理</span>
                <Title level={4}>{t("home.resumeTitle")}</Title>
              </div>
            }
          >
            {recentMocks.length === 0 ? (
              <Empty
                description={
                  <div className={localStyles.emptyCopy}>
                    <strong>{t("mock.noneTitle")}</strong>
                    <span>{t("mock.noneBody")}</span>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                className={localStyles.resumeList}
                dataSource={recentMocks}
                renderItem={(item) => (
                  <List.Item className={localStyles.resumeItem}>
                    <button className={localStyles.resumeButton} onClick={onGoMock} type="button">
                      <div className={localStyles.resumeMarker} />
                      <div className={localStyles.resumeContent}>
                        <div className={localStyles.resumeTop}>
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
  );
}

