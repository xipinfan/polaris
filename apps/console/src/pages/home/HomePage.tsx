import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ServiceSnapshot } from "@polaris/shared-contracts";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

export function HomePage() {
  const [snapshot, setSnapshot] = useState<ServiceSnapshot | null>(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { t } = useConsoleI18n();

  const load = () => apiClient.bootstrap().then(setSnapshot).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const quickActions = useMemo(
    () => [
      { label: t("home.quick.traffic"), onClick: () => navigate("/traffic") },
      { label: t("home.quick.debug"), onClick: () => navigate("/debug") },
      { label: t("home.quick.mock"), onClick: () => navigate("/mock") },
      { label: t("home.quick.settings"), onClick: () => navigate("/settings") }
    ],
    [navigate, t]
  );

  const setProxyMode = async (mode: "direct" | "rules") => {
    await apiClient.setProxyMode(mode);
    setMessage(mode === "direct" ? t("common.switchedDirect") : t("common.switchedRules"));
    load();
  };

  const saveRecentRequest = async (requestId: string) => {
    const name = window.prompt(t("common.savePrompt"), "recent-request");
    if (!name) {
      return;
    }
    await apiClient.saveCapturedRequest(requestId, { name });
    setMessage(t("common.savedRequest", { name }));
    load();
  };

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
          <div className="hero-grid">
            <section className="hero-card">
              <h3>{t("home.workspaceLabel")}</h3>
              <strong>{t("home.workspaceHeadline")}</strong>
              <p>
                {t("home.workspaceBody", {
                  status: snapshot.status.online ? t("home.online") : t("home.offline"),
                  mode: snapshot.status.proxyMode
                })}
              </p>
              <div className="metric-strip">
                <div className="metric-card">
                  <span>{t("home.metric.proxyPort")}</span>
                  <strong>{snapshot.status.proxyPort}</strong>
                </div>
                <div className="metric-card">
                  <span>{t("home.metric.recentRequests")}</span>
                  <strong>{snapshot.recentRequests.length}</strong>
                </div>
                <div className="metric-card">
                  <span>{t("home.metric.savedRequests")}</span>
                  <strong>{snapshot.savedRequests.length}</strong>
                </div>
              </div>
              <div className="inline-actions" style={{ marginTop: 18 }}>
                <button onClick={() => setProxyMode("rules")}>{t("home.enableRules")}</button>
                <button className="ghost-button" onClick={() => setProxyMode("direct")}>{t("home.backDirect")}</button>
              </div>
            </section>

            <section className="panel">
              <div className="feature-badge">{t("home.statusOverview")}</div>
              <div className="status-stack">
                <div className={snapshot.status.online ? "status-badge" : "status-badge warning"}>
                  <span className={`status-dot ${snapshot.status.online ? "online" : "offline"}`}></span>
                  {snapshot.status.online ? t("home.coreOnline") : t("home.coreOffline")}
                </div>
                <div className="status-badge muted">{snapshot.status.mcpEnabled ? t("home.mcpEnabled") : t("home.mcpDisabled")}</div>
                <div className="status-badge muted">{t("home.mockRules", { count: snapshot.mockRules.length })}</div>
                <div className="status-badge muted">{t("home.activeRequests", { count: snapshot.status.activeRequestCount })}</div>
              </div>
              <div className="button-grid">
                {quickActions.map((item) => (
                  <button key={item.label} className="ghost-button" onClick={item.onClick}>
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="card-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>{t("home.recentTitle")}</h3>
                  <p>{t("home.recentBody")}</p>
                </div>
                <button className="ghost-button" onClick={() => navigate("/traffic")}>{t("home.viewAll")}</button>
              </div>
              <div className="list">
                {snapshot.recentRequests.slice(0, 5).map((item) => (
                  <div key={item.id} className="list-item">
                    <div className="list-row">
                      <strong>{item.method} {item.path}</strong>
                      <span className={`status-badge ${item.statusCode >= 400 ? "warning" : ""}`}>{item.statusCode}</span>
                    </div>
                    <p>{item.host} - {new Date(item.createdAt).toLocaleString()}</p>
                    <div className="inline-actions" style={{ marginTop: 10 }}>
                      <button className="ghost-button" onClick={() => navigate("/traffic")}>{t("home.inspect")}</button>
                      <button
                        className="ghost-button"
                        onClick={() =>
                          navigate("/debug", {
                            state: {
                              draft: {
                                name: `${item.method} ${item.path}`,
                                method: item.method,
                                url: item.url,
                                body: item.requestBody
                              }
                            }
                          })
                        }
                      >
                        {t("home.openDebug")}
                      </button>
                      <button onClick={() => saveRecentRequest(item.id)}>{t("home.saveRequest")}</button>
                    </div>
                  </div>
                ))}
                {snapshot.recentRequests.length === 0 ? (
                  <div className="empty-card">
                    <h3>{t("home.noTrafficTitle")}</h3>
                    <p>{t("home.noTrafficBody")}</p>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>{t("home.assetsTitle")}</h3>
                  <p>{t("home.assetsBody")}</p>
                </div>
                <button className="ghost-button" onClick={() => navigate("/requests")}>{t("home.manageAssets")}</button>
              </div>
              <div className="stats-grid compact">
                <div className="stat-tile">
                  <span>{t("home.metric.savedRequests")}</span>
                  <strong>{snapshot.savedRequests.length}</strong>
                </div>
                <div className="stat-tile">
                  <span>{t("home.metric.mockVariants")}</span>
                  <strong>{snapshot.mockRules.length}</strong>
                </div>
              </div>
              <div className="list">
                {snapshot.savedRequests.slice(0, 4).map((item) => (
                  <div key={item.id} className="list-item">
                    <strong>{item.name}</strong>
                    <p>{item.method} - {new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                ))}
                {snapshot.savedRequests.length === 0 && snapshot.mockRules.length === 0 ? (
                  <div className="empty-card">
                    <h3>{t("home.noAssetsTitle")}</h3>
                    <p>{t("home.noAssetsBody")}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
