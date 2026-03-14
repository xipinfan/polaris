import { useMemo } from "react";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import type { ConsoleMessageKey } from "../../i18n/messages";
import { useSettingsOverviewQuery } from "../../domains/settings/queries";
import { StatusState } from "../../features/common/StatusState";
import { SettingsExtensionCard } from "./components/SettingsExtensionCard";
import { SettingsHttpsCard } from "./components/SettingsHttpsCard";
import { SettingsLanguageCard } from "./components/SettingsLanguageCard";
import { SettingsMcpCard } from "./components/SettingsMcpCard";
import { SettingsOverview } from "./components/SettingsOverview";
import { SettingsProxyModeCard } from "./components/SettingsProxyModeCard";
import styles from "./SettingsPage.module.less";

const proxyModeLabels: Record<string, string> = {
  direct: "鐩磋繛",
  global: "鍏ㄥ眬",
  rules: "瑙勫垯",
  system: "绯荤粺",
};

const proxyModeDescriptions = [
  { key: "direct", title: "鐩磋繛妯″紡", descriptionKey: "settings.proxy.direct" as ConsoleMessageKey },
  { key: "global", title: "鍏ㄥ眬浠ｇ悊", descriptionKey: "settings.proxy.global" as ConsoleMessageKey },
  { key: "rules", title: "瑙勫垯浠ｇ悊", descriptionKey: "settings.proxy.rules" as ConsoleMessageKey },
  { key: "system", title: "璺熼殢绯荤粺", descriptionKey: "settings.proxy.system" as ConsoleMessageKey },
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
];

export function SettingsPage() {
  const { locale, setLocale, t } = useConsoleI18n();
  const localeLabelKey = `locale.name.${locale}` as ConsoleMessageKey;
  const overviewQuery = useSettingsOverviewQuery();

  const status = overviewQuery.data?.health ?? null;
  const settings = overviewQuery.data?.settings ?? null;
  const rules = overviewQuery.data?.proxyRules ?? [];

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const rootCertificateUrl = settings ? `http://127.0.0.1:${settings.localApiPort}/api/certificates/root-ca` : "#";
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
          <span className={styles.pageEyebrow}>绯荤粺璁剧疆</span>
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

        <section className={styles.split}>
          <SettingsLanguageCard
            locale={locale}
            localeLabel={t(localeLabelKey)}
            setLocale={setLocale}
            t={t}
          />
          <SettingsProxyModeCard
            allRuleCount={rules.length}
            currentMode={settings.currentProxyMode ?? "system"}
            currentModeLabel={currentModeLabel}
            enabledRuleCount={activeRules.length}
            modeItems={proxyModeDescriptions}
            t={t}
          />
        </section>

        <section className={styles.split}>
          <SettingsHttpsCard
            certificateInstalled={Boolean(settings.certificateInstalled)}
            rootCertificateUrl={rootCertificateUrl}
            t={t}
          />
          <SettingsMcpCard enabled={Boolean(settings.mcpEnabled)} t={t} tools={mcpTools} />
        </section>

        <SettingsExtensionCard t={t} />
      </div>
    </div>
  );
}
