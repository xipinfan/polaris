import { Button, Card, Empty, List, Statistic, Tag, Typography } from "antd";
import localStyles from "./index.module.less";
import type { HomeQuickEntry, HomeRecentMock } from "../../types";

const { Title } = Typography;

type HomeContentProps = {
  enabledMockCount: number;
  quickEntries: HomeQuickEntry[];
  recentMocks: HomeRecentMock[];
  mockRuleCount: number;
  onGoMock: () => void;
  onGoTraffic: () => void;
};

export function HomeContent({
  enabledMockCount,
  quickEntries,
  recentMocks,
  mockRuleCount,
  onGoMock,
  onGoTraffic,
}: HomeContentProps) {
  return (
    <section className={localStyles.contentGrid}>
      <Card
        variant="borderless"
        className={localStyles.workbenchCard}
        extra={
          <Button onClick={onGoTraffic} type="link">
            {"查看全部"}
          </Button>
        }
        title={
          <div className={localStyles.cardTitleBlock}>
            <Title level={4}>{"请求工作台"}</Title>
          </div>
        }
      >
        <div className={localStyles.workbenchGrid}>
          {quickEntries.map((item) => (
            <Card
              variant="borderless"
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
          variant="borderless"
          className={localStyles.summaryCard}
          extra={
            <Button onClick={onGoMock} type="link">
              {"管理模拟"}
            </Button>
          }
          title={
            <div className={localStyles.cardTitleBlock}>
              <Title level={4}>{"管理模拟"}</Title>
            </div>
          }
        >
          <div className={localStyles.summaryStats}>
            <Card variant="borderless" className={localStyles.summaryStatCard}>
              <Statistic title={"模拟方案"} value={mockRuleCount} />
            </Card>
            <Card variant="borderless" className={localStyles.summaryStatCard}>
              <Statistic title="启用规则" value={enabledMockCount} />
            </Card>
          </div>
        </Card>

        <Card
          variant="borderless"
          className={localStyles.resumeCard}
          title={
            <div className={localStyles.cardTitleBlock}>
              <Title level={4}>{"继续工作"}</Title>
            </div>
          }
        >
          {recentMocks.length === 0 ? (
            <Empty
              description={
                <div className={localStyles.emptyCopy}>
                  <strong>{"还没有模拟规则"}</strong>
                  <span>{"可以从实时请求一键创建，也可以在右侧手动录入固定响应。"}</span>
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
                        <Tag bordered={false}>{"模拟"}</Tag>
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
  );
}

