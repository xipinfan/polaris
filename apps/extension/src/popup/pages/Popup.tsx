import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProxyMode,
  ProxyRule,
  ServiceStatus,
} from "@polaris/shared-types";
import { useExtensionI18n } from "../i18n/I18nProvider";
import {
  applyBrowserProxyMode,
  openBrowserCertificateSettings,
} from "../../bridge/browserProxyBridge";
import { getConsoleBaseUrl, invalidateApiCache } from "../../bridge/coreDiscovery";
import { coreBridge } from "../../bridge/coreBridge";
import { buildSitePatterns, matchesPattern } from "../utils/sitePatterns";
import styles from "./Popup.module.less";

type ModeItem = { mode: ProxyMode; label: string; description: string };

export function Popup() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [host, setHost] = useState("");
  const [rules, setRules] = useState<ProxyRule[]>([]);
  const [message, setMessage] = useState("");
  const { t } = useExtensionI18n();
  const statusRef = useRef(status);
  statusRef.current = status;

  const modes: ModeItem[] = [
    {
      mode: "direct",
      label: t("popup.mode.direct.label"),
      description: t("popup.mode.direct.desc"),
    },
    {
      mode: "global",
      label: t("popup.mode.global.label"),
      description: t("popup.mode.global.desc"),
    },
    {
      mode: "rules",
      label: t("popup.mode.rules.label"),
      description: t("popup.mode.rules.desc"),
    },
    {
      mode: "system",
      label: t("popup.mode.system.label"),
      description: t("popup.mode.system.desc"),
    },
  ];

  const modeLabel = useMemo(
    () =>
      modes.find((item) => item.mode === status?.proxyMode)?.label ??
      status?.proxyMode ??
      "-",
    [modes, status?.proxyMode],
  );

  const load = async () => {
    try {
      const [nextStatus, nextRules] = await Promise.all([
        coreBridge.health(),
        coreBridge.listRules(),
      ]);
      setMessage("");
      setStatus(nextStatus);
      setRules(nextRules);
    } catch (error) {
      console.error(error);
      invalidateApiCache();
      setMessage(t("popup.error.core"));
    }
  };

  useEffect(() => {
    void load();
    const retryTimer = setInterval(() => {
      if (!statusRef.current?.online) {
        invalidateApiCache();
        void load();
      }
    }, 3000);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabUrl = tabs[0]?.url;
      if (!tabUrl) return;
      try {
        setHost(new URL(tabUrl).hostname.toLowerCase());
      } catch {
        setHost("");
      }
    });

    return () => clearInterval(retryTimer);
  }, []);

  const sitePatterns = useMemo(() => buildSitePatterns(host), [host]);

  const activeForSite = useMemo(
    () =>
      rules.some(
        (rule) =>
          rule.enabled &&
          rule.action === "proxy" &&
          (sitePatterns.includes(rule.pattern.toLowerCase()) || matchesPattern(host, rule.pattern)),
      ),
    [host, rules, sitePatterns],
  );
  const online = Boolean(status?.online);

  const openConsole = async (pathname = "") => {
    try {
      const baseUrl = await getConsoleBaseUrl();
      await chrome.tabs.create({ url: `${baseUrl}${pathname}` });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("popup.error.switch"),
      );
    }
  };

  const switchMode = async (mode: ProxyMode) => {
    if (!status) return;
    await coreBridge.setProxyMode(mode);
    await applyBrowserProxyMode(mode, status);
    await load();
    setMessage(
      t("popup.message.switch", {
        mode: modes.find((item) => item.mode === mode)?.label ?? mode,
      }),
    );
  };

  const toggleCurrentSite = async () => {
    if (!host || !status) return;
    if (activeForSite) {
      await Promise.all(sitePatterns.map((pattern) => coreBridge.removeSiteRule(pattern)));
      setMessage(t("popup.message.removeRule", { host }));
    } else {
      await Promise.all(sitePatterns.map((pattern) => coreBridge.addSiteRule(pattern)));
      setMessage(
        status.proxyMode === "rules"
          ? t("popup.message.addRule", { host })
          : t("popup.message.addRulePending"),
      );
    }
    await load();
  };

  return (
    <div className={styles.shell} data-testid="popup-root">
      <header className={styles.hero}>
        <div className={styles.heroBrand}>
          <img alt="" className={styles.heroMark} src="/polaris-mark.svg" />
          <div>
            <span className={styles.brandLabel}>Polaris Extension</span>
            <h1>Polaris</h1>
          </div>
        </div>
        <span
          data-testid="popup-online-badge"
          className={`${styles.statusBadge} ${online ? styles.statusOnline : styles.statusOffline}`}
        >
          <span className={styles.statusDot} />
          {online ? t("popup.online") : t("popup.offline")}
        </span>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("popup.status")}</h2>
          <span className={styles.modeChip}>{modeLabel}</span>
        </div>
        <div className={styles.metrics}>
          <article>
            <span>{t("popup.mode")}</span>
            <strong>{modeLabel}</strong>
          </article>
          <article>
            <span>{t("popup.proxyPort")}</span>
            <strong>{status?.proxyPort ?? "-"}</strong>
          </article>
          <article>
            <span>{t("popup.rules")}</span>
            <strong>{rules.length}</strong>
          </article>
        </div>
        {message ? <p className={styles.message} data-testid="popup-message">{message}</p> : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("popup.proxyModes")}</h2>
        </div>
        <div className={styles.modeGrid}>
          {modes.map((item) => (
            <button
              key={item.mode}
              type="button"
              data-testid={`mode-${item.mode}`}
              disabled={!online}
              className={`${styles.modeButton} ${status?.proxyMode === item.mode ? styles.modeButtonActive : ""}`}
              onClick={() =>
                switchMode(item.mode).catch((error) =>
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : t("popup.error.switch"),
                  ),
                )
              }
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("popup.currentSite")}</h2>
          <span className={styles.hostChip}>{host || t("popup.noHost")}</span>
        </div>
        <button
          type="button"
          data-testid="toggle-site-rule"
          className={styles.primaryButton}
          disabled={!online || !host}
          onClick={() =>
            toggleCurrentSite().catch((error) =>
              setMessage(
                error instanceof Error
                  ? error.message
                  : t("popup.error.switch"),
              ),
            )
          }
        >
          {activeForSite ? t("popup.removeSiteRule") : t("popup.proxyThisSite")}
        </button>
        <p className={styles.helpText}>{t("popup.siteHint")}</p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{t("popup.quickLinks")}</h2>
        </div>
        <div className={styles.actionGrid}>
          <button
            type="button"
            data-testid="open-console"
            className={styles.secondaryButton}
            onClick={() => void openConsole("")}
          >
            {t("popup.openConsole")}
          </button>
          <button
            type="button"
            data-testid="open-settings"
            className={styles.secondaryButton}
            onClick={() => void openConsole("/settings")}
          >
            {t("popup.openSettings")}
          </button>
          <button
            type="button"
            data-testid="open-cert-settings"
            className={styles.secondaryButton}
            onClick={() =>
              openBrowserCertificateSettings().catch((error) =>
                setMessage(
                  error instanceof Error
                    ? error.message
                    : t("popup.error.openCertSettings"),
                ),
              )
            }
          >
            {t("popup.openCertSettings")}
          </button>
        </div>
      </section>
    </div>
  );
}
