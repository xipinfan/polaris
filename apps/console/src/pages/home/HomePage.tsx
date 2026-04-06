import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Skeleton, Typography } from "antd";
import { useSetProxyForwardModeMutation } from "../../domains/proxy-forward/mutations";
import { useHomeOverviewQuery } from "../../domains/home/queries";
import { StatusState } from "../../features/common/StatusState";
import { useToast } from "../../features/feedback/ToastProvider";
import { toastQueryError } from "../../lib/query/queryOptions";
import { HomeContent } from "./components/HomeContent";
import { HomeHero } from "./components/HomeHero";
import type { HomeQuickEntry, HomeRecentMock } from "./types";
import { getProxyModeLabel } from "./utils";
import styles from "./HomePage.module.css";

const { Paragraph, Title } = Typography;

export function HomePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const overviewQuery = useHomeOverviewQuery();
  const setProxyModeMutation = useSetProxyForwardModeMutation();
  const snapshot = overviewQuery.data?.bootstrap ?? null;

  const setProxyMode = async (mode: "direct" | "rules") => {
    try {
      await setProxyModeMutation.mutateAsync(mode);
      showToast(
        mode === "direct"
          ? "已切换为直连模式"
          : "已切换为规则代理模式",
      );
      await overviewQuery.refetch();
    } catch (error) {
      toastQueryError(showToast, error, "切换模式失败");
    }
  };

  const primaryProxyAction =
    snapshot?.status.proxyMode === "rules" ? "direct" : "rules";
  const primaryProxyLabel =
    primaryProxyAction === "rules"
      ? "开启规则代理"
      : "切回直连";

  const recentMocks: HomeRecentMock[] = useMemo(
    () =>
      snapshot
        ? snapshot.mockRules.slice(0, 3).map((rule) => ({
            id: rule.id,
            title: rule.name,
            meta: `${rule.method} 路 ${rule.url}`,
          }))
        : [],
    [snapshot],
  );

  const enabledMockCount =
    snapshot?.mockRules.filter((rule) => rule.enabled).length ?? 0;

  const quickEntries: HomeQuickEntry[] = snapshot
    ? [
        {
          key: "traffic",
          index: "01",
          label: "查看实时流量",
          title: "查看实时请求",
          points: [
            "最近请求",
            `活跃请求 ${snapshot.status.activeRequestCount}`,
          ],
          action: "查看全部",
          primary: true,
          onClick: () => navigate("/traffic"),
        },
        {
          key: "debug",
          index: "02",
          label: "带入调试",
          title: "新建调试请求",
          points: ["当前工作台", "Adjust headers and body quickly"],
          action: "带入调试",
          primary: false,
          onClick: () => navigate("/debug"),
        },
        {
          key: "mock",
          index: "03",
          label: "转成模拟",
          title: "管理模拟",
          points: [
            "模拟方案",
            `当前模式 · ${getProxyModeLabel(snapshot.status.proxyMode)}`,
          ],
          action: "管理模拟",
          primary: false,
          onClick: () => navigate("/mock"),
        },
        {
          key: "settings",
          index: "04",
          label: "保存为资产",
          title: "打开设置",
          points: [
            "Manage local service and certificate",
            "Review proxy mode and port",
          ],
          action: "打开设置",
          primary: false,
          onClick: () => navigate("/settings"),
        },
      ]
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Title level={2}>{"首页"}</Title>
          <Paragraph>{"把服务状态、最近流量、沉淀资产和下一步操作集中在一个现代化入口里。"}</Paragraph>
        </div>
      </header>

      {overviewQuery.isLoading ? (
        <Card variant="borderless" className={styles.loadingCard}>
          <Skeleton active paragraph={{ rows: 4 }} title={{ width: "36%" }} />
        </Card>
      ) : overviewQuery.isError ? (
        <StatusState
          tone="error"
          title="首页加载失败"
          description="请检查本地服务状态后重试。"
          actionLabel="重新加载"
          onAction={() => {
            void overviewQuery.refetch();
          }}
        />
      ) : !snapshot ? (
        <StatusState
          title="暂无数据"
          description="当前没有可展示的服务快照。"
        />
      ) : (
        <>
          <HomeHero
            onGoDebug={() => navigate("/debug")}
            onGoMock={() => navigate("/mock")}
            onGoSettings={() => navigate("/settings")}
            onGoTraffic={() => navigate("/traffic")}
            onSetProxyMode={setProxyMode}
            primaryProxyAction={primaryProxyAction}
            primaryProxyLabel={primaryProxyLabel}
            snapshot={snapshot}
          />
          <HomeContent
            enabledMockCount={enabledMockCount}
            mockRuleCount={snapshot.mockRules.length}
            onGoMock={() => navigate("/mock")}
            onGoTraffic={() => navigate("/traffic")}
            quickEntries={quickEntries}
            recentMocks={recentMocks}
          />
        </>
      )}
    </div>
  );
}
