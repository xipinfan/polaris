import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Skeleton, Typography } from "antd";
import { useSetProxyForwardModeMutation } from "../../domains/proxy-forward/mutations";
import { useHomeOverviewQuery } from "../../domains/home/queries";
import { StatusState } from "../../features/common/StatusState";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { toastQueryError } from "../../lib/query/queryOptions";
import { HomeContent } from "./components/HomeContent";
import { HomeHero } from "./components/HomeHero";
import type { HomeQuickEntry, HomeRecentMock } from "./types";
import { getProxyModeLabel } from "./utils";
import styles from "./HomePage.module.css";

const { Paragraph, Title } = Typography;

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const overviewQuery = useHomeOverviewQuery();
  const setProxyModeMutation = useSetProxyForwardModeMutation();
  const snapshot = overviewQuery.data?.bootstrap ?? null;

  const setProxyMode = async (mode: "direct" | "rules") => {
    try {
      await setProxyModeMutation.mutateAsync(mode);
      showToast(mode === "direct" ? t("common.switchedDirect") : t("common.switchedRules"));
      await overviewQuery.refetch();
    } catch (error) {
      toastQueryError(showToast, error, "切换模式失败");
    }
  };

  const primaryProxyAction = snapshot?.status.proxyMode === "rules" ? "direct" : "rules";
  const primaryProxyLabel = primaryProxyAction === "rules" ? t("home.enableRules") : t("home.backDirect");

  const recentMocks: HomeRecentMock[] = useMemo(
    () =>
      snapshot
        ? snapshot.mockRules.slice(0, 5).map((rule) => ({
            id: rule.id,
            title: rule.name,
            meta: `${rule.method} 路 ${rule.url}`,
          }))
        : [],
    [snapshot],
  );

  const enabledMockCount = snapshot?.mockRules.filter((rule) => rule.enabled).length ?? 0;

  const quickEntries: HomeQuickEntry[] = snapshot
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
          points: [t("home.workspaceLabel"), "Adjust headers and body quickly"],
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
          points: ["Manage local service and certificate", "Review proxy mode and port"],
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
          <span className={styles.eyebrow}>{t("home.title")}</span>
          <Title level={2}>{t("home.title")}</Title>
          <Paragraph>{t("home.subtitle")}</Paragraph>
        </div>
      </header>

      {overviewQuery.isLoading ? (
        <Card bordered={false} className={styles.loadingCard}>
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
        <StatusState title="暂无数据" description="当前没有可展示的服务快照。" />
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
            t={t}
          />
          <HomeContent
            enabledMockCount={enabledMockCount}
            mockRuleCount={snapshot.mockRules.length}
            onGoMock={() => navigate("/mock")}
            onGoTraffic={() => navigate("/traffic")}
            quickEntries={quickEntries}
            recentMocks={recentMocks}
            t={t}
          />
        </>
      )}
    </div>
  );
}
