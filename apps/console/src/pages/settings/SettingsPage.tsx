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

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("settings.title")}</h2>
          <p>{t("settings.subtitle")}</p>
        </div>
      </section>

      <section className="card-grid">
        <div className="panel">
          <h3>{t("settings.languageTitle")}</h3>
          <p>{t("settings.languageBody")}</p>
          <div className="pill-row">
            <span className="feature-badge">{t("settings.language.current", { locale: t(localeLabelKey) })}</span>
          </div>
          <div className="button-grid">
            <button onClick={() => setLocale("zh-CN")}>{t("settings.language.zh")}</button>
            <button className="ghost-button" onClick={() => setLocale("en-US")}>{t("settings.language.en")}</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>{t("settings.servicesTitle")}</h3>
              <p>{t("settings.servicesBody")}</p>
            </div>
            <span className={status?.online ? "status-badge" : "status-badge warning"}>
              {status?.online ? t("settings.online") : t("settings.offline")}
            </span>
          </div>
          <div className="meta-list">
            <div>
              <span>{t("settings.proxyPort")}</span>
              <strong>{settings?.localProxyPort ?? "-"}</strong>
            </div>
            <div>
              <span>{t("settings.apiEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.localApiPort ?? "-"}</strong>
            </div>
            <div>
              <span>{t("settings.mcpEndpoint")}</span>
              <strong>http://127.0.0.1:{settings?.mcpPort ?? "-"}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
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
        </div>

        <div className="panel">
          <h3>{t("settings.httpsTitle")}</h3>
          <p>{t("settings.httpsBody")}</p>
          <div className="meta-list">
            <div>
              <span>{t("settings.certState")}</span>
              <strong>{settings?.certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}</strong>
            </div>
            <div>
              <span>{t("settings.macosNote")}</span>
              <strong>{t("settings.macosBody")}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>{t("settings.mcpTitle")}</h3>
          <p>{t("settings.mcpBody")}</p>
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
        </div>

        <div className="panel">
          <h3>{t("settings.extensionTitle")}</h3>
          <p>{t("settings.extensionBody")}</p>
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
        </div>
      </section>

      <UiSlotPlaceholder slot="settings-extension-panel" />
    </div>
  );
}
