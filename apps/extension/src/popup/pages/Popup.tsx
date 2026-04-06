import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProxyMode,
  ProxyRule,
  ServiceStatus,
} from "@polaris/shared-types";
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
  const statusRef = useRef(status);
  statusRef.current = status;

  const modes: ModeItem[] = [
    {
      mode: "direct",
      label: "直连",
      description: "浏览器请求不经过 Polaris。",
    },
    {
      mode: "global",
      label: "全局代理",
      description: "所有流量都进入本地代理。",
    },
    {
      mode: "rules",
      label: "规则代理",
      description: "只代理命中规则的 Host。",
    },
    {
      mode: "system",
      label: "跟随系统",
      description: "恢复系统代理配置。",
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
      setMessage("无法连接 Core 服务");
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
        error instanceof Error ? error.message : "切换失败",
      );
    }
  };

  const switchMode = async (mode: ProxyMode) => {
    if (!status) return;
    await coreBridge.setProxyMode(mode);
    await applyBrowserProxyMode(mode, status);
    await load();
    setMessage(
      `已切换为${modes.find((item) => item.mode === mode)?.label ?? mode}`,
    );
  };

  const toggleCurrentSite = async () => {
    if (!host || !status) return;
    if (activeForSite) {
      await Promise.all(sitePatterns.map((pattern) => coreBridge.removeSiteRule(pattern)));
      setMessage(`已移除站点规则：${host}`);
    } else {
      await Promise.all(sitePatterns.map((pattern) => coreBridge.addSiteRule(pattern)));
      setMessage(
        status.proxyMode === "rules"
          ? `已加入站点规则：${host}`
          : "已添加站点规则，切换到「规则代理」模式后生效",
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
          {online ? "在线" : "离线"}
        </span>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{"服务状态"}</h2>
          <span className={styles.modeChip}>{modeLabel}</span>
        </div>
        <div className={styles.metrics}>
          <article>
            <span>{"当前模式"}</span>
            <strong>{modeLabel}</strong>
          </article>
          <article>
            <span>{"代理端口"}</span>
            <strong>{status?.proxyPort ?? "-"}</strong>
          </article>
          <article>
            <span>{"规则数"}</span>
            <strong>{rules.length}</strong>
          </article>
        </div>
        {message ? <p className={styles.message} data-testid="popup-message">{message}</p> : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{"代理模式"}</h2>
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
                      : "切换失败",
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
          <h2>{"当前站点"}</h2>
          <span className={styles.hostChip}>{host || "无可识别 Host"}</span>
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
                  : "切换失败",
              ),
            )
          }
        >
          {activeForSite ? "移除当前站点规则" : "仅代理当前站点"}
        </button>
        <p className={styles.helpText}>{"规则模式会使用 Core 生成的 PAC 配置，只让命中站点的流量进入本地代理。"}</p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>{"快捷入口"}</h2>
        </div>
        <div className={styles.actionGrid}>
          <button
            type="button"
            data-testid="open-console"
            className={styles.secondaryButton}
            onClick={() => void openConsole("")}
          >
            {"打开控制台"}
          </button>
          <button
            type="button"
            data-testid="open-settings"
            className={styles.secondaryButton}
            onClick={() => void openConsole("/settings")}
          >
            {"打开设置"}
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
                    : "打开证书设置失败",
                ),
              )
            }
          >
            {"打开证书设置"}
          </button>
        </div>
      </section>
    </div>
  );
}
