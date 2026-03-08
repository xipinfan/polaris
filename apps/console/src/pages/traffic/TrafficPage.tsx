import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RequestRecord } from "@polaris/shared-types";
import { buildCurl } from "../../features/common/curl";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { RequestDetailPanel } from "../../features/request-detail/RequestDetailPanel";
import { apiClient } from "../../services/apiClient";

const refreshIntervalMs = 3000;

export function TrafficPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [method, setMethod] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [hostOnly, setHostOnly] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { t } = useConsoleI18n();

  const load = () => {
    const params = new URLSearchParams();
    if (keyword) {
      params.set("keyword", keyword);
    }
    if (method) {
      params.set("method", method);
    }
    if (statusCode) {
      params.set("statusCode", statusCode);
    }
    if (hostOnly) {
      params.set("host", hostOnly);
    }
    apiClient.listRequests(params).then(setRequests).catch(console.error);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [keyword, method, statusCode, hostOnly]);

  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) ?? requests[0],
    [requests, selectedId]
  );

  const summary = useMemo(() => {
    const errorCount = requests.filter((item) => item.statusCode >= 400).length;
    const secureCount = requests.filter((item) => item.secure).length;
    const hostCount = new Set(requests.map((item) => item.host)).size;

    return {
      total: requests.length,
      errorCount,
      secureCount,
      hostCount
    };
  }, [requests]);

  const saveSelected = async () => {
    if (!selected) {
      return;
    }
    const name = window.prompt(t("common.savePrompt"), `${selected.method} ${selected.path}`);
    if (!name) {
      return;
    }
    await apiClient.saveCapturedRequest(selected.id, { name });
    setMessage(t("common.savedRequest", { name }));
  };

  const replaySelected = async () => {
    if (!selected) {
      return;
    }
    const replayed = await apiClient.replayCapturedRequest(selected.id);
    setMessage(t("common.replayedRequest", { status: replayed.statusCode }));
    load();
  };

  const createMockFromSelected = async () => {
    if (!selected) {
      return;
    }
    const name = window.prompt(t("common.mockPrompt"), `${selected.method} ${selected.path} mock`);
    if (!name) {
      return;
    }
    await apiClient.createMockRule({
      name,
      method: selected.method,
      url: selected.url,
      responseStatus: selected.statusCode,
      responseHeaders: selected.responseHeaders,
      responseBody: selected.responseBody,
      enabled: true
    });
    setMessage(t("common.mockCreated", { name }));
  };

  const copyCurl = async () => {
    if (!selected) {
      return;
    }
    await navigator.clipboard.writeText(buildCurl(selected));
    setMessage(t("common.curlCopied"));
  };

  const openInDebug = () => {
    if (!selected) {
      return;
    }
    navigate("/debug", {
      state: {
        draft: {
          name: `${selected.method} ${selected.path}`,
          method: selected.method,
          url: selected.url,
          body: selected.requestBody
        }
      }
    });
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("traffic.title")}</h2>
          <p>{t("traffic.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      <section className="card-grid">
        <div className="panel">
          <span className="feature-badge">{t("traffic.overview")}</span>
          <div className="stats-grid compact">
            <div className="stat-tile">
              <span>{t("traffic.metric.visible")}</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("traffic.metric.errors")}</span>
              <strong>{summary.errorCount}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("traffic.metric.https")}</span>
              <strong>{summary.secureCount}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("traffic.metric.hosts")}</span>
              <strong>{summary.hostCount}</strong>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>{t("traffic.filtersTitle")}</h3>
              <p>{t("traffic.filtersBody")}</p>
            </div>
            <button onClick={load}>{t("traffic.refresh")}</button>
          </div>
          <div className="toolbar toolbar-grid">
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={t("traffic.searchPlaceholder")} />
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="">{t("traffic.allMethods")}</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <input value={statusCode} onChange={(event) => setStatusCode(event.target.value)} placeholder={t("traffic.statusPlaceholder")} />
            <input value={hostOnly} onChange={(event) => setHostOnly(event.target.value)} placeholder={t("traffic.hostPlaceholder")} />
          </div>
        </div>
      </section>

      <div className="two-column traffic-layout">
        <section className="table-card">
          <div className="panel-heading">
            <div>
              <h3>{t("traffic.feedTitle")}</h3>
              <p>{t("traffic.feedBody")}</p>
            </div>
          </div>
          <div className="list">
            {requests.map((item) => (
              <button
                key={item.id}
                className={`list-item interactive ${selected?.id === item.id ? "active" : ""}`}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="list-row">
                  <strong>{item.method} {item.path}</strong>
                  <span className={`status-badge ${item.statusCode >= 400 ? "warning" : ""}`}>{item.statusCode}</span>
                </div>
                <p>{item.host}</p>
                <small>{item.duration} ms - {new Date(item.createdAt).toLocaleTimeString()}</small>
              </button>
            ))}
            {requests.length === 0 && (
              <div className="empty-card">
                <h3>{t("traffic.noTrafficTitle")}</h3>
                <p>{t("traffic.noTrafficBody")}</p>
              </div>
            )}
          </div>
        </section>

        <RequestDetailPanel
          request={selected}
          actions={
            <div className="action-stack">
              <div className="panel-heading">
                <div>
                  <h3>{t("traffic.actionsTitle")}</h3>
                  <p>{t("traffic.actionsBody")}</p>
                </div>
              </div>
              <div className="button-grid">
                <button onClick={saveSelected} disabled={!selected}>{t("traffic.action.save")}</button>
                <button onClick={replaySelected} disabled={!selected}>{t("traffic.action.replay")}</button>
                <button onClick={createMockFromSelected} disabled={!selected}>{t("traffic.action.mock")}</button>
                <button onClick={openInDebug} disabled={!selected}>{t("traffic.action.debug")}</button>
                <button onClick={copyCurl} disabled={!selected}>{t("traffic.action.curl")}</button>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
