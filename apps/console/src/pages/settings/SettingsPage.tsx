import { useEffect, useMemo, useState } from "react";
import type { AppSetting, ProxyRule, ServiceStatus } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import type { ConsoleMessageKey } from "../../i18n/messages";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { apiClient } from "../../services/apiClient";

export function SettingsPage() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [settings, setSettings] = useState<AppSetting | null>(null);
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const { locale, setLocale, t } = useConsoleI18n();
  const localeLabelKey = (`locale.name.${locale}` as ConsoleMessageKey);

  useEffect(() => {
    apiClient.health().then(setStatus).catch(console.error);
    apiClient.settings().then(setSettings).catch(console.error);
    apiClient.listProxyRules().then(setRules).catch(console.error);
  }, []);

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const rootCertificateUrl = settings ? `http://127.0.0.1:${settings.localApiPort}/api/certificates/root-ca` : "#";

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("settings.title")}</h2>
        </div>
      </section>

      <div className="settings-layout">
        <section className="panel settings-section">
          <div className="panel-heading">
            <div>
              <h3>{t("settings.servicesTitle")}</h3>
            </div>
            <span className={status?.online ? "status-badge" : "status-badge warning"}>
              {status?.online ? t("settings.online") : t("settings.offline")}
            </span>
          </div>
          <div className="settings-metric-grid">
            <div className="detail-kpi">
              <span>{t("settings.proxyPort")}</span>
              <strong>{settings?.localProxyPort ?? "-"}</strong>
            </div>
            <div className="detail-kpi">
              <span>{t("settings.apiEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.localApiPort ?? "-"}</strong>
            </div>
            <div className="detail-kpi">
              <span>{t("settings.mcpEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.mcpPort ?? "-"}</strong>
            </div>
          </div>
        </section>

        <section className="settings-layout-split">
          <section className="panel settings-section">
            <h3>{t("settings.languageTitle")}</h3>
            <div className="settings-language-card">
              <span className="feature-badge">{t("settings.language.current", { locale: t(localeLabelKey) })}</span>
              <div className="settings-segmented">
                <button className={locale === "zh-CN" ? "primary-action" : "ghost-button"} onClick={() => setLocale("zh-CN")}>{t("settings.language.zh")}</button>
                <button className={locale === "en-US" ? "primary-action" : "ghost-button"} onClick={() => setLocale("en-US")}>{t("settings.language.en")}</button>
              </div>
            </div>
          </section>

          <section className="panel settings-section">
            <h3>{t("settings.proxyModesTitle")}</h3>
            <div className="meta-list">
              <div>
                <span>direct</span>
                <strong>{t("settings.proxy.direct")}</strong>
              </div>
              <div>
                <span>global</span>
                <strong>{t("settings.proxy.global")}</strong>
              </div>
              <div>
                <span>rules</span>
                <strong>{t("settings.proxy.rules")}</strong>
              </div>
              <div>
                <span>system</span>
                <strong>{t("settings.proxy.system")}</strong>
              </div>
            </div>
            <div className="pill-row">
              <span className="feature-badge">{t("settings.currentMode", { mode: settings?.currentProxyMode ?? "-" })}</span>
              <span className="feature-badge">{t("settings.allRules", { count: rules.length })}</span>
              <span className="feature-badge">{t("settings.enabledRules", { count: activeRules.length })}</span>
            </div>
          </section>
        </section>

        <section className="settings-layout-split">
          <section className="panel settings-section">
            <h3>{t("settings.httpsTitle")}</h3>
            <div className="meta-list">
              <div>
                <span>{t("settings.httpsMode")}</span>
                <strong>{t("settings.httpsBody")}</strong>
              </div>
              <div>
                <span>{t("settings.certState")}</span>
                <strong>{settings?.certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}</strong>
              </div>
              <div>
                <span>{t("settings.certDownload")}</span>
                <strong>
                  <a href={rootCertificateUrl} target="_blank" rel="noreferrer">
                    {t("settings.certDownloadAction")}
                  </a>
                </strong>
              </div>
              <div>
                <span>{t("settings.macosNote")}</span>
                <strong>{t("settings.macosBody")}</strong>
              </div>
            </div>
          </section>

          <section className="panel settings-section">
            <h3>{t("settings.mcpTitle")}</h3>
            <div className="meta-list">
              <div>
                <span>{t("settings.mcpStatus")}</span>
                <strong>{settings?.mcpEnabled ? t("settings.mcpEnabledState") : t("settings.mcpDisabledState")}</strong>
              </div>
              <div>
                <span>{t("settings.baseTools")}</span>
                <strong>list_requests, get_request_detail, save_request, replay_request, create_mock_rule, enable_mock_rule, run_request, list_proxy_rules</strong>
              </div>
            </div>
          </section>
        </section>

        <section className="panel settings-section">
          <h3>{t("settings.extensionTitle")}</h3>
          <div className="meta-list">
            <div>
              <span>{t("settings.uiSlots")}</span>
              <strong>{t("settings.uiSlotsBody")}</strong>
            </div>
            <div>
              <span>{t("settings.roleSplit")}</span>
              <strong>{t("settings.roleSplitBody")}</strong>
            </div>
          </div>
        </section>
      </div>

      <UiSlotPlaceholder slot="settings-extension-panel" />
    </div>
  );
}
