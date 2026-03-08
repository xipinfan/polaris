import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

export function HomePage() {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { t } = useConsoleI18n();

  const load = () =>
    apiClient.bootstrap().then(setSnapshot).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const setProxyMode = async (mode: "direct" | "rules") => {
    await apiClient.setProxyMode(mode);
    setMessage(
      mode === "direct"
        ? t("common.switchedDirect")
        : t("common.switchedRules"),
    );
    load();
  };

  const primaryProxyAction =
    snapshot?.status.proxyMode === "rules" ? "direct" : "rules";
  const primaryProxyLabel =
    primaryProxyAction === "rules"
      ? t("home.enableRules")
      : t("home.backDirect");
  const currentModeLabel = snapshot?.status.proxyMode ?? "direct";
  const recentAssets = snapshot
    ? [
        ...snapshot.savedRequests.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.name,
          meta: `${item.method} - ${new Date(item.updatedAt).toLocaleString()}`,
          kind: t("home.savedAsset"),
          onClick: () =>
            navigate("/requests", { state: { selectedId: item.id } }),
        })),
        ...snapshot.mockRules.slice(0, 2).map((rule) => ({
          id: rule.id,
          title: rule.name,
          meta: `${rule.method} - ${rule.url}`,
          kind: t("nav.rules"),
          onClick: () => navigate("/rules"),
        })),
      ].slice(0, 3)
    : [];

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("home.title")}</h2>
          <p>{t("home.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      {!snapshot ? (
        <div className="empty-card">
          <h3>{t("home.connectingTitle")}</h3>
          <p>{t("home.connectingBody")}</p>
        </div>
      ) : (
        <>
          <section className="home-hero">
            <div className="home-hero-orbit home-hero-orbit-one"></div>
            <div className="home-hero-orbit home-hero-orbit-two"></div>
            <div className="home-hero-main">
              <div className="home-hero-copy">
                <div className="home-hero-kicker">
                  <span className="feature-badge">
                    {t("home.module.control")}
                  </span>
                  <span
                    className={`home-hero-mode ${snapshot.status.online ? "online" : "offline"}`}
                  >
                    <span
                      className={`status-dot ${snapshot.status.online ? "online" : "offline"}`}
                    ></span>
                    {snapshot.status.online
                      ? t("home.coreOnline")
                      : t("home.coreOffline")}
                  </span>
                </div>
                <div className="home-hero-headline">
                  <h3>{t("home.taskTitle")}</h3>
                  <p>
                    {t("home.workspaceBody", {
                      status: snapshot.status.online
                        ? t("home.online")
                        : t("home.offline"),
                      mode: currentModeLabel,
                    })}
                  </p>
                </div>
                <div className="home-hero-actions">
                  <button
                    className="primary-action home-hero-primary"
                    onClick={() => setProxyMode(primaryProxyAction)}
                  >
                    {primaryProxyLabel}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => navigate("/traffic")}
                  >
                    {t("home.quick.traffic")}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => navigate("/debug")}
                  >
                    {t("home.quick.debug")}
                  </button>
                </div>
              </div>

              <div className="home-hero-stats">
                <div className="home-signal-card">
                  <span>{t("home.metric.proxyPort")}</span>
                  <strong>{snapshot.status.proxyPort}</strong>
                  <small>{t("home.workspaceLabel")}</small>
                </div>
                <div className="home-signal-card">
                  <span>{t("home.metric.recentRequests")}</span>
                  <strong>{snapshot.recentRequests.length}</strong>
                  <small>
                    {t("home.activeRequests", {
                      count: snapshot.status.activeRequestCount,
                    })}
                  </small>
                </div>
                <div className="home-signal-card">
                  <span>{t("home.metric.savedRequests")}</span>
                  <strong>{snapshot.savedRequests.length}</strong>
                  <small>
                    {t("home.mockRules", { count: snapshot.mockRules.length })}
                  </small>
                </div>
              </div>
            </div>

            <aside className="home-hero-side">
              <div className="home-focus-card">
                <span className="feature-badge">
                  {t("home.nextActionTitle")}
                </span>
                <h4>{t("home.nextActionBody")}</h4>
                <div className="home-focus-links">
                  <button
                    className="ghost-button"
                    onClick={() => navigate("/rules")}
                  >
                    {t("home.quick.mock")}
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => navigate("/settings")}
                  >
                    {t("home.quick.settings")}
                  </button>
                </div>
              </div>
              <div className="home-status-cluster">
                <div className="status-badge muted">
                  {snapshot.status.mcpEnabled
                    ? t("home.mcpEnabled")
                    : t("home.mcpDisabled")}
                </div>
                <div className="status-badge muted">
                  {t("home.mockRules", { count: snapshot.mockRules.length })}
                </div>
                <div className="status-badge muted">
                  {t("home.activeRequests", {
                    count: snapshot.status.activeRequestCount,
                  })}
                </div>
              </div>
            </aside>
          </section>

          <div className="card-grid home-dashboard-grid home-dashboard-grid-modern">
            <section className="panel panel-section activity-panel home-module home-module-traffic home-workbench-panel">
              <div className="panel-heading">
                <div>
                  <h3>{t("home.module.traffic")}</h3>
                  <p>{t("home.nextActionBody")}</p>
                </div>
                <button
                  className="panel-link-button panel-link-button-traffic"
                  onClick={() => navigate("/traffic")}
                >
                  <span>{t("home.viewAll")}</span>
                </button>
              </div>
              <div className="home-workbench-grid">
                <article className="home-workbench-card home-workbench-card-primary">
                  <div className="home-workbench-head">
                    <span className="home-workbench-label">
                      {t("home.flow.capture")}
                    </span>
                    <span className="home-workbench-index">01</span>
                  </div>
                  <strong>{t("home.quick.traffic")}</strong>
                  <p>{t("home.noTrafficBody")}</p>
                  <ul className="home-workbench-points">
                    <li>
                      {t("traffic.metric.visible")}{" "}
                      {snapshot.recentRequests.length}
                    </li>
                    <li>
                      {t("home.activeRequests", {
                        count: snapshot.status.activeRequestCount,
                      })}
                    </li>
                  </ul>
                  <button
                    className="home-workbench-button home-workbench-button-primary"
                    onClick={() => navigate("/traffic")}
                  >
                    {t("home.viewAll")}
                  </button>
                </article>
                <article className="home-workbench-card">
                  <div className="home-workbench-head">
                    <span className="home-workbench-label">
                      {t("home.flow.debug")}
                    </span>
                    <span className="home-workbench-index">02</span>
                  </div>
                  <strong>{t("home.quick.debug")}</strong>
                  <p>{t("home.flow.debugBody")}</p>
                  <ul className="home-workbench-points">
                    <li>{t("home.workspaceLabel")}</li>
                    <li>{t("traffic.actionsTitle")}</li>
                  </ul>
                  <button
                    className="home-workbench-button"
                    onClick={() => navigate("/debug")}
                  >
                    {t("home.openDebug")}
                  </button>
                </article>
                <article className="home-workbench-card">
                  <div className="home-workbench-head">
                    <span className="home-workbench-label">
                      {t("home.flow.mock")}
                    </span>
                    <span className="home-workbench-index">03</span>
                  </div>
                  <strong>{t("home.quick.mock")}</strong>
                  <p>{t("home.flow.mockBody")}</p>
                  <ul className="home-workbench-points">
                    <li>
                      {t("home.metric.mockVariants")}{" "}
                      {snapshot.mockRules.length}
                    </li>
                    <li>{snapshot.status.proxyMode}</li>
                  </ul>
                  <button
                    className="home-workbench-button"
                    onClick={() => navigate("/rules")}
                  >
                    {t("home.quick.mock")}
                  </button>
                </article>
                <article className="home-workbench-card">
                  <div className="home-workbench-head">
                    <span className="home-workbench-label">
                      {t("home.flow.save")}
                    </span>
                    <span className="home-workbench-index">04</span>
                  </div>
                  <strong>{t("home.assetsTitle")}</strong>
                  <p>{t("home.assetsBody")}</p>
                  <ul className="home-workbench-points">
                    <li>
                      {t("home.metric.savedRequests")}{" "}
                      {snapshot.savedRequests.length}
                    </li>
                    <li>
                      {t("home.metric.mockVariants")}{" "}
                      {snapshot.mockRules.length}
                    </li>
                  </ul>
                  <button
                    className="home-workbench-button"
                    onClick={() => navigate("/requests")}
                  >
                    {t("home.manageAssets")}
                  </button>
                </article>
              </div>
            </section>

            <div className="home-side-stack home-side-stack-modern">
              <section className="panel panel-section home-module home-module-assets">
                <div className="home-module-titlebar">
                  <span className="feature-badge">
                    {t("home.module.assets")}
                  </span>
                </div>
                <div className="panel-heading">
                  <div>
                    <h3>{t("home.assetsTitle")}</h3>
                    <p>{t("home.assetsBody")}</p>
                  </div>
                  <button
                    className="panel-link-button panel-link-button-assets"
                    onClick={() => navigate("/requests")}
                  >
                    <span>{t("home.manageAssets")}</span>
                  </button>
                </div>
                <div className="home-asset-stats">
                  <div className="stat-tile home-asset-stat">
                    <span>{t("home.metric.savedRequests")}</span>
                    <strong>{snapshot.savedRequests.length}</strong>
                  </div>
                  <div className="stat-tile home-asset-stat">
                    <span>{t("home.metric.mockVariants")}</span>
                    <strong>{snapshot.mockRules.length}</strong>
                  </div>
                </div>
              </section>

              <section className="panel panel-section home-module home-module-resume">
                <div className="panel-heading">
                  <div>
                    <h3>{t("home.resumeTitle")}</h3>
                    <p>{t("home.resumeBody")}</p>
                  </div>
                </div>
                <div className="home-timeline">
                  {recentAssets.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className="home-timeline-item"
                      onClick={item.onClick}
                    >
                      <span className="home-timeline-dot"></span>
                      <span
                        className="home-timeline-line"
                        aria-hidden={index === recentAssets.length - 1}
                      ></span>
                      <div className="home-timeline-content">
                        <div className="home-timeline-top">
                          <strong>{item.title}</strong>
                          <span className="status-badge muted">
                            {item.kind}
                          </span>
                        </div>
                        <p>{item.meta}</p>
                      </div>
                    </button>
                  ))}
                  {recentAssets.length === 0 ? (
                    <div className="empty-card">
                      <h3>{t("home.noAssetsTitle")}</h3>
                      <p>{t("home.noAssetsBody")}</p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
