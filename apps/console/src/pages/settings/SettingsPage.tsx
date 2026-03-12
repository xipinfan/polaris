import { useEffect, useMemo, useState } from "react";
import type { AppSetting, ProxyRule, ServiceStatus } from "@polaris/shared-types";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import type { ConsoleMessageKey } from "../../i18n/messages";
import { apiClient } from "../../services/apiClient";
import {
  readCachedHealth,
  readCachedSettings,
  writeCachedHealth,
  writeCachedSettings,
} from "../../services/consoleCache";
import styles from "./SettingsPage.module.less";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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
];

export function SettingsPage() {
  const [status, setStatus] = useState<ServiceStatus | null>(() => readCachedHealth());
  const [settings, setSettings] = useState<AppSetting | null>(() => readCachedSettings());
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const { locale, setLocale, t } = useConsoleI18n();
  const localeLabelKey = `locale.name.${locale}` as ConsoleMessageKey;

  useEffect(() => {
    apiClient
      .health()
      .then((nextStatus) => {
        setStatus(nextStatus);
        writeCachedHealth(nextStatus);
      })
      .catch(console.error);

    apiClient
      .settings()
      .then((nextSettings) => {
        setSettings(nextSettings);
        writeCachedSettings(nextSettings);
      })
      .catch(console.error);

    apiClient.listProxyRules().then(setRules).catch(console.error);
  }, []);

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const rootCertificateUrl = settings ? `http://127.0.0.1:${settings.localApiPort}/api/certificates/root-ca` : "#";
  const currentModeLabel = proxyModeLabels[settings?.currentProxyMode ?? "system"] ?? "-";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.pageEyebrow}>系统设置</span>
          <h2>{t("settings.title")}</h2>
          <p>{t("settings.subtitle")}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.overview}>
          <div className={styles.overviewHeader}>
            <div className={styles.overviewCopy}>
              <span className={styles.sectionLabel}>本地服务</span>
              <h3>{t("settings.servicesTitle")}</h3>
              <p>查看本地代理、接口和 MCP 端口，确认当前运行状态。</p>
            </div>
            <span
              className={classNames(
                styles.statusBadge,
                status?.online ? styles.statusBadgeSuccess : styles.statusBadgeWarning,
              )}
            >
              {status?.online ? t("settings.online") : t("settings.offline")}
            </span>
          </div>

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span>{t("settings.proxyPort")}</span>
              <strong>{settings?.localProxyPort ?? "-"}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{t("settings.apiEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.localApiPort ?? "-"}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{t("settings.mcpEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.mcpPort ?? "-"}</strong>
            </article>
          </div>
        </section>

        <section className={styles.split}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>{t("settings.languageTitle")}</span>
                <h3>{t("settings.languageTitle")}</h3>
              </div>
              <span className={styles.sectionBadge}>
                {t("settings.language.current", { locale: t(localeLabelKey) })}
              </span>
            </div>

            <div className={styles.segmented}>
              <button
                className={classNames(styles.segmentButton, locale === "zh-CN" && styles.segmentButtonActive)}
                onClick={() => setLocale("zh-CN")}
                type="button"
              >
                {t("settings.language.zh")}
              </button>
              <button
                className={classNames(styles.segmentButton, locale === "en-US" && styles.segmentButtonActive)}
                onClick={() => setLocale("en-US")}
                type="button"
              >
                {t("settings.language.en")}
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>{t("settings.proxyModesTitle")}</span>
                <h3>{t("settings.proxyModesTitle")}</h3>
              </div>
              <span className={styles.sectionBadge}>{currentModeLabel}</span>
            </div>

            <div className={styles.modeList}>
              {proxyModeDescriptions.map((mode) => (
                <article
                  key={mode.key}
                  className={classNames(
                    styles.modeCard,
                    settings?.currentProxyMode === mode.key && styles.modeCardActive,
                  )}
                >
                  <strong>{mode.title}</strong>
                  <p>{t(mode.descriptionKey)}</p>
                </article>
              ))}
            </div>

            <div className={styles.badgeRow}>
              <span className={styles.statusBadge}>{t("settings.currentMode", { mode: currentModeLabel })}</span>
              <span className={styles.statusBadge}>{t("settings.allRules", { count: rules.length })}</span>
              <span className={styles.statusBadge}>{t("settings.enabledRules", { count: activeRules.length })}</span>
            </div>
          </section>
        </section>

        <section className={styles.split}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>{t("settings.httpsTitle")}</span>
                <h3>{t("settings.httpsTitle")}</h3>
              </div>
              <span
                className={classNames(
                  styles.statusBadge,
                  settings?.certificateInstalled ? styles.statusBadgeSuccess : styles.statusBadgeMuted,
                )}
              >
                {settings?.certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}
              </span>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span>{t("settings.httpsMode")}</span>
                <strong>{t("settings.httpsBody")}</strong>
              </div>
              <div className={styles.infoItem}>
                <span>{t("settings.certState")}</span>
                <strong>{settings?.certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}</strong>
              </div>
              <div className={styles.infoItem}>
                <span>{t("settings.certDownload")}</span>
                <strong>
                  <a href={rootCertificateUrl} rel="noreferrer" target="_blank">
                    {t("settings.certDownloadAction")}
                  </a>
                </strong>
              </div>
              <div className={styles.infoItem}>
                <span>{t("settings.macosNote")}</span>
                <strong>{t("settings.macosBody")}</strong>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.sectionLabel}>{t("settings.mcpTitle")}</span>
                <h3>{t("settings.mcpTitle")}</h3>
              </div>
              <span
                className={classNames(
                  styles.statusBadge,
                  settings?.mcpEnabled ? styles.statusBadgeSuccess : styles.statusBadgeMuted,
                )}
              >
                {settings?.mcpEnabled ? t("settings.mcpEnabledState") : t("settings.mcpDisabledState")}
              </span>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span>{t("settings.mcpStatus")}</span>
                <strong>{settings?.mcpEnabled ? t("settings.mcpEnabledState") : t("settings.mcpDisabledState")}</strong>
              </div>
              <div className={classNames(styles.infoItem, styles.infoItemFull)}>
                <span>{t("settings.baseTools")}</span>
                <div className={styles.toolList}>
                  {mcpTools.map((tool) => (
                    <code key={tool} className={styles.toolChip}>
                      {tool}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.sectionLabel}>{t("settings.extensionTitle")}</span>
              <h3>{t("settings.extensionTitle")}</h3>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span>{t("settings.uiSlots")}</span>
              <strong>{t("settings.uiSlotsBody")}</strong>
            </div>
            <div className={styles.infoItem}>
              <span>{t("settings.roleSplit")}</span>
              <strong>{t("settings.roleSplitBody")}</strong>
            </div>
          </div>
        </section>

        <div className={styles.slotWrap}>
          <UiSlotPlaceholder slot="settings-extension-panel" />
        </div>
      </div>
    </div>
  );
}
