import { useMemo } from "react";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import type { ConsoleMessageKey } from "../../i18n/messages";
import { useSettingsOverviewQuery } from "../../domains/settings/queries";
import { StatusState } from "../../features/common/StatusState";
import { SettingsExtensionCard } from "./components/SettingsExtensionCard";
import { SettingsHttpsCard } from "./components/SettingsHttpsCard";
import { SettingsLanProxyCard } from "./components/SettingsLanProxyCard";
import { SettingsMcpCard } from "./components/SettingsMcpCard";
import { SettingsOverview } from "./components/SettingsOverview";
import { SettingsProxyModeCard } from "./components/SettingsProxyModeCard";
import styles from "./SettingsPage.module.less";

const proxyModeLabels: Record<string, string> = {
  direct: "直连",
  global: "全局",
  rules: "规则",
  system: "系统",
};

const proxyModeDescriptions = [
  { key: "direct", title: "直连模式", descriptionKey: "settings.proxy.direct" as ConsoleMessageKey },
  { key: "global", title: "全局代理", descriptionKey: "settings.proxy.global" as ConsoleMessageKey },
  { key: "rules", title: "规则代理", descriptionKey: "settings.proxy.rules" as ConsoleMessageKey },
  { key: "system", title: "跟随系统", descriptionKey: "settings.proxy.system" as ConsoleMessageKey },
];

const mcpTools = [
  "list_requests",
  "get_request_detail",
  "save_request",
  "replay_request",
  "create_mock_rule",
  "enable_mock_rule",
  "run_request",
  "list_proxy_rules",
  "get_proxy_rule_detail",
];

export function SettingsPage() {
  const { t } = useConsoleI18n();
  const overviewQuery = useSettingsOverviewQuery();

  const status = overviewQuery.data?.health ?? null;
  const settings = overviewQuery.data?.settings ?? null;
  const rules = overviewQuery.data?.proxyRules ?? [];

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const browserHostname = window.location.hostname || "127.0.0.1";
  const rootCertificateUrl = settings ? `http://${browserHostname}:${settings.localApiPort}/api/certificates/root-ca` : "#";
  const currentModeLabel = proxyModeLabels[settings?.currentProxyMode ?? "system"] ?? "-";

  if (overviewQuery.isError) {
    return (
      <div className={styles.page}>
        <StatusState
          tone="error"
          title="设置加载失败"
          description="请检查服务状态并重试。"
          actionLabel="重新加载"
          onAction={() => {
            void overviewQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!settings || !status) {
    return (
      <div className={styles.page}>
        <StatusState title="加载中" description="正在读取配置与健康状态。" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>管理与基础配置</span>
          <h2>{t("settings.title")}</h2>
          <p>{t("settings.subtitle")}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <SettingsOverview
          apiPort={settings.localApiPort}
          isOnline={Boolean(status.online)}
          mcpPort={settings.mcpPort}
          proxyPort={settings.localProxyPort}
          t={t}
        />
        <SettingsLanProxyCard settings={settings} />

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <SettingsProxyModeCard
              allRuleCount={rules.length}
              currentMode={settings.currentProxyMode ?? "system"}
              currentModeLabel={currentModeLabel}
              enabledRuleCount={activeRules.length}
              modeItems={proxyModeDescriptions}
              t={t}
            />
            <SettingsHttpsCard
              certificateInstalled={Boolean(settings.certificateInstalled)}
              rootCertificateUrl={rootCertificateUrl}
              t={t}
            />
            <SettingsExtensionCard t={t} />
          </div>

          <div className={styles.sideColumn}>
            <SettingsMcpCard enabled={Boolean(settings.mcpEnabled)} t={t} tools={mcpTools} />
          </div>
        </section>
      </div>
    </div>
  );
}
