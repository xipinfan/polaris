import { useEffect, useMemo, useState } from "react";
import type { ProxyMode, ProxyRule, ServiceStatus } from "@polaris/shared-types";
import { useExtensionI18n } from "../i18n/I18nProvider";
import { applyBrowserProxyMode, openBrowserCertificateSettings } from "../../bridge/browserProxyBridge";
import { coreBridge } from "../../bridge/coreBridge";

export function Popup() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [host, setHost] = useState<string>("");
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const [message, setMessage] = useState("");
  const { t } = useExtensionI18n();

  const modes: { mode: ProxyMode; label: string; description: string }[] = [
    { mode: "direct", label: t("popup.mode.direct.label"), description: t("popup.mode.direct.desc") },
    { mode: "global", label: t("popup.mode.global.label"), description: t("popup.mode.global.desc") },
    { mode: "rules", label: t("popup.mode.rules.label"), description: t("popup.mode.rules.desc") },
    { mode: "system", label: t("popup.mode.system.label"), description: t("popup.mode.system.desc") }
  ];

  const load = async () => {
    try {
      const [nextStatus, nextRules] = await Promise.all([coreBridge.health(), coreBridge.listRules()]);
      setStatus(nextStatus);
      setRules(nextRules);
    } catch (error) {
      console.error(error);
      setMessage(t("popup.error.core"));
    }
  };

  useEffect(() => {
    load();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabUrl = tabs[0]?.url;
      if (!tabUrl) {
        return;
      }
      try {
        setHost(new URL(tabUrl).host);
      } catch {
        setHost("");
      }
    });
  }, []);

  const activeForSite = useMemo(
    () => rules.some((rule) => rule.pattern === host && rule.enabled && rule.action === "proxy"),
    [host, rules]
  );
  const online = Boolean(status?.online);

  const switchMode = async (mode: ProxyMode) => {
    if (!status) {
      return;
    }
    await coreBridge.setProxyMode(mode);
    await applyBrowserProxyMode(mode, status);
    await load();
    setMessage(t("popup.message.switch", { mode: modes.find((item) => item.mode === mode)?.label ?? mode }));
  };

  const toggleCurrentSite = async () => {
    if (!host || !status) {
      return;
    }
    if (activeForSite) {
      await coreBridge.removeSiteRule(host);
      setMessage(t("popup.message.removeRule", { host }));
    } else {
      await coreBridge.addSiteRule(host);
      setMessage(t("popup.message.addRule", { host }));
    }
    await coreBridge.setProxyMode("rules");
    await applyBrowserProxyMode("rules", status);
    await load();
  };

  return (
    <div className="popup-shell">
      <section className="popup-hero">
        <h1>Polaris</h1>
        <p>{t("popup.hero")}</p>
      </section>

      <div className="popup-stack">
        <section className="popup-card">
          <div className="popup-card-head">
            <h2>{t("popup.status")}</h2>
            <span className={`popup-status ${online ? "" : "offline"}`}>
              <span className="popup-dot"></span>
              {online ? t("popup.online") : t("popup.offline")}
            </span>
          </div>
          <div className="popup-metrics">
            <div>
              <span>{t("popup.mode")}</span>
              <strong>{status?.proxyMode ?? "-"}</strong>
            </div>
            <div>
              <span>{t("popup.proxyPort")}</span>
              <strong>{status?.proxyPort ?? "-"}</strong>
            </div>
            <div>
              <span>{t("popup.rules")}</span>
              <strong>{rules.length}</strong>
            </div>
          </div>
          {message ? <p className="popup-hint">{message}</p> : null}
        </section>

        <section className="popup-card">
          <div className="popup-card-head">
            <h2>{t("popup.proxyModes")}</h2>
          </div>
          <div className="popup-mode-grid">
            {modes.map((item) => (
              <button
                key={item.mode}
                disabled={!online}
                className={`popup-mode-card ${status?.proxyMode === item.mode ? "active" : ""}`}
                onClick={() => switchMode(item.mode).catch((error) => setMessage(error instanceof Error ? error.message : t("popup.error.switch")))}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="popup-card">
          <div className="popup-card-head">
            <h2>{t("popup.currentSite")}</h2>
            <span className="popup-chip">{host || t("popup.noHost")}</span>
          </div>
          <button
            className="popup-primary"
            disabled={!online || !host}
            onClick={() => toggleCurrentSite().catch((error) => setMessage(error instanceof Error ? error.message : t("popup.error.switch")))}
          >
            {activeForSite ? t("popup.removeSiteRule") : t("popup.proxyThisSite")}
          </button>
          <p className="popup-hint">{t("popup.siteHint")}</p>
        </section>

        <section className="popup-card">
          <div className="popup-card-head">
            <h2>{t("popup.quickLinks")}</h2>
          </div>
          <div className="popup-actions">
            <button className="popup-secondary" onClick={() => chrome.tabs.create({ url: "http://127.0.0.1:5173" })}>
              {t("popup.openConsole")}
            </button>
            <button className="popup-secondary" onClick={() => chrome.tabs.create({ url: "http://127.0.0.1:5173/settings" })}>
              {t("popup.openSettings")}
            </button>
            <button
              className="popup-secondary"
              onClick={() =>
                openBrowserCertificateSettings().catch((error) =>
                  setMessage(error instanceof Error ? error.message : t("popup.error.openCertSettings"))
                )
              }
            >
              {t("popup.openCertSettings")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
