import { useMemo } from "react";
import { useSettingsOverviewQuery } from "../../domains/settings/queries";
import { StatusState } from "../../features/common/StatusState";
import { getBrowserHostname } from "../../lib/browser/runtime";
import { SettingsExtensionCard } from "./components/SettingsExtensionCard";
import { SettingsHttpsCard } from "./components/SettingsHttpsCard";
import { SettingsLanProxyCard } from "./components/SettingsLanProxyCard";
import { SettingsMcpCard } from "./components/SettingsMcpCard";
import { SettingsOverview } from "./components/SettingsOverview";
import { SettingsProxyModeCard } from "./components/SettingsProxyModeCard";
import { SettingsSystemProxyCard } from "./components/SettingsSystemProxyCard";
import styles from "./SettingsPage.module.less";

const proxyModeLabels: Record<string, string> = {
  direct: "直连",
  global: "全局",
  rules: "规则",
  system: "系统",
};

const proxyModeDescriptions = [
  { key: "direct", title: "直连模式", description: "浏览器请求不会经过 Polaris，本地代理完全旁路。" },
  { key: "global", title: "全局代理", description: "所有浏览器流量都进入 Polaris，适合统一抓包和调试。" },
  { key: "rules", title: "规则代理", description: "只有命中规则的请求会进入代理，适合按域名精确控制。" },
  { key: "system", title: "跟随系统", description: "恢复或沿用系统代理设置，由系统环境决定最终流量走向。" },
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

const EMPTY_RULES: Array<{ enabled: boolean }> = [];

export function SettingsPage() {
  const overviewQuery = useSettingsOverviewQuery();

  const status = overviewQuery.data?.health ?? null;
  const settings = overviewQuery.data?.settings ?? null;
  const rules = overviewQuery.data?.proxyRules ?? EMPTY_RULES;

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const browserHostname = getBrowserHostname();
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
          <h2>{"设置"}</h2>
          <p>{"集中查看本地服务、代理模式、HTTPS 说明、MCP 接入和扩展预留能力。"}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <SettingsOverview
          apiPort={settings.localApiPort}
          isOnline={Boolean(status.online)}
          mcpPort={settings.mcpPort}
          proxyPort={settings.localProxyPort}
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
            />
            <SettingsSystemProxyCard
              enabled={Boolean(status.systemProxyEnabled)}
              proxyPort={settings.localProxyPort}
            />
            <SettingsHttpsCard
              certificateInstalled={Boolean(settings.certificateInstalled)}
              rootCertificateUrl={rootCertificateUrl}
            />
            <SettingsExtensionCard />
          </div>

          <div className={styles.sideColumn}>
            <SettingsMcpCard enabled={Boolean(settings.mcpEnabled)} tools={mcpTools} />
          </div>
        </section>
      </div>
    </div>
  );
}
