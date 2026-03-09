import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

export function HomePage() {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  const navigate = useNavigate();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();

  const load = () =>
    apiClient.bootstrap().then(setSnapshot).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const setProxyMode = async (mode: "direct" | "rules") => {
    await apiClient.setProxyMode(mode);
    showToast(
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
  const recentMocks = snapshot
    ? snapshot.mockRules.slice(0, 4).map((rule) => ({
        id: rule.id,
        title: rule.name,
        meta: `${rule.method} - ${rule.url}`,
        kind: t("nav.mock"),
        onClick: () => navigate("/mock"),
      }))
    : [];

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("home.title")}</h2>
        </div>
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
                  <span>{t("home.metric.mockVariants")}</span>
                  <strong>{snapshot.mockRules.length}</strong>
                  <small>
                    {snapshot.status.proxyMode}
                  </small>
                </div>
              </div>
            </div>

            <aside className="home-hero-side">
              <div className="home-focus-card">
                <span className="feature-badge">
                  {t("home.nextActionTitle")}
                </span>
                <div className="home-focus-links">
                  <button
                    className="ghost-button"
                    onClick={() => navigate("/mock")}
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
                  <ul className="home-workbench-points">
                    <li>
                      {t("home.metric.mockVariants")}{" "}
                      {snapshot.mockRules.length}
                    </li>
                    <li>{snapshot.status.proxyMode}</li>
                  </ul>
                  <button
                    className="home-workbench-button"
                    onClick={() => navigate("/mock")}
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
                  <strong>{t("home.quick.settings")}</strong>
                  <ul className="home-workbench-points">
                    <li>{t("home.module.control")}</li>
                    <li>{snapshot.status.proxyMode}</li>
                  </ul>
                  <button
                    className="home-workbench-button"
                    onClick={() => navigate("/settings")}
                  >
                    {t("home.quick.settings")}
                  </button>
                </article>
              </div>
            </section>

            <div className="home-side-stack home-side-stack-modern">
              <section className="panel panel-section home-module home-module-assets">
                <div className="home-module-titlebar">
                  <span className="feature-badge">
                    {t("mock.overview")}
                  </span>
                </div>
                <div className="panel-heading">
                  <div>
                    <h3>{t("home.quick.mock")}</h3>
                  </div>
                  <button
                    className="panel-link-button panel-link-button-assets"
                    onClick={() => navigate("/mock")}
                  >
                    <span>{t("home.quick.mock")}</span>
                  </button>
                </div>
                <div className="home-asset-stats">
                  <div className="stat-tile home-asset-stat">
                    <span>{t("home.metric.mockVariants")}</span>
                    <strong>{snapshot.mockRules.length}</strong>
                  </div>
                  <div className="stat-tile home-asset-stat">
                    <span>{t("mock.metric.enabled")}</span>
                    <strong>
                      {snapshot.mockRules.filter((rule) => rule.enabled).length}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="panel panel-section home-module home-module-resume">
                <div className="panel-heading">
                  <div>
                    <h3>{t("home.resumeTitle")}</h3>
                  </div>
                </div>
                <div className="home-timeline">
                  {recentMocks.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className="home-timeline-item"
                      onClick={item.onClick}
                    >
                      <span className="home-timeline-dot"></span>
                      <span
                        className="home-timeline-line"
                        aria-hidden={index === recentMocks.length - 1}
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
                  {recentMocks.length === 0 ? (
                    <div className="empty-card">
                      <h3>{t("mock.noneTitle")}</h3>
                      <p>{t("mock.noneBody")}</p>
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
