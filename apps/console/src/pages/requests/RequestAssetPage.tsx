import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SavedRequest } from "@polaris/shared-types";
import { buildCurl } from "../../features/common/curl";
import { JsonBlock } from "../../features/common/JsonBlock";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

export function RequestAssetPage() {
  const [items, setItems] = useState<SavedRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useConsoleI18n();

  const load = () => apiClient.listSavedRequests().then(setItems).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (!selectedId || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    const requestedId = (location.state as { selectedId?: string } | null)?.selectedId;
    if (requestedId && items.some((item) => item.id === requestedId)) {
      setSelectedId(requestedId);
    }
  }, [items, location.state]);

  const metrics = useMemo(() => {
    const capturedCount = items.filter((item) => item.sourceType === "captured").length;
    const manualCount = items.filter((item) => item.sourceType === "manual").length;
    const tagCount = new Set(items.flatMap((item) => item.tags)).size;

    return {
      total: items.length,
      capturedCount,
      manualCount,
      tagCount
    };
  }, [items]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0],
    [items, selectedId]
  );

  const replay = async (id: string) => {
    const result = await apiClient.replaySavedRequest(id);
    setMessage(t("common.replayedRequest", { status: result.statusCode }));
  };

  const remove = async (id: string) => {
    const confirmed = window.confirm(t("common.deleteConfirm"));
    if (!confirmed) {
      return;
    }
    await apiClient.deleteSavedRequest(id);
    setMessage(t("common.requestDeleted"));
    load();
  };

  const edit = async (item: SavedRequest) => {
    const name = window.prompt(t("common.renamePrompt"), item.name);
    if (!name) {
      return;
    }
    await apiClient.updateSavedRequest(item.id, { ...item, name });
    setMessage(t("common.requestUpdated", { name }));
    load();
  };

  const createMock = (item: SavedRequest) => {
    navigate("/rules", {
      state: {
        seedRequest: {
          id: item.id,
          method: item.method,
          url: item.url,
          host: new URL(item.url).host,
          path: new URL(item.url).pathname,
          statusCode: 200,
          duration: 0,
          requestHeaders: item.headers ?? {},
          requestQuery: item.query ?? {},
          requestBody: item.body,
          responseHeaders: {
            "content-type": "application/json"
          },
          responseBody: item.body,
          createdAt: item.updatedAt,
          source: "debug",
          secure: item.url.startsWith("https://")
        },
        mode: "mock"
      }
    });
  };

  const openInDebug = (item: SavedRequest) => {
    navigate("/debug", {
      state: {
        draft: {
          name: item.name,
          method: item.method,
          url: item.url,
          body: item.body
        }
      }
    });
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("requests.title")}</h2>
          <p>{t("requests.subtitle")}</p>
        </div>
        {message ? <div className="panel banner-panel">{message}</div> : null}
      </section>

      <section className="request-summary-bar panel">
        <div className="traffic-summary-strip">
          <span>{t("requests.metric.total")} {metrics.total}</span>
          <span>{t("requests.metric.captured")} {metrics.capturedCount}</span>
          <span>{t("requests.metric.manual")} {metrics.manualCount}</span>
          <span>{t("requests.metric.tags")} {metrics.tagCount}</span>
        </div>
      </section>

      {items.length === 0 ? (
        <div className="empty-card">
          <h3>{t("requests.noneTitle")}</h3>
          <p>{t("requests.noneBody")}</p>
        </div>
      ) : (
        <section className="workspace-shell">
          <aside className="workspace-sidebar panel">
            <div className="panel-heading">
              <div>
                <h3>{t("requests.libraryTitle")}</h3>
                <p>{t("requests.libraryBody")}</p>
              </div>
            </div>
            <div className="workspace-list">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`workspace-list-item ${selected?.id === item.id ? "active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="workspace-list-topline">
                    <strong>{item.name}</strong>
                    <span className="status-badge muted">
                      {item.sourceType === "captured" ? t("requests.source.captured") : t("requests.source.manual")}
                    </span>
                  </div>
                  <p>{item.method} - {item.url}</p>
                  <small>{new Date(item.updatedAt).toLocaleString()}</small>
                </button>
              ))}
            </div>
          </aside>

          <section className="workspace-detail">
            {selected ? (
              <div className="detail-panel">
                <section className="panel detail-summary-panel">
                  <div className="panel-heading">
                    <div className="detail-heading-copy">
                      <div className="detail-title-row">
                        <span className={`method-badge method-${selected.method.toLowerCase()}`}>{selected.method}</span>
                        <h3>{selected.name}</h3>
                      </div>
                      <p>{selected.url}</p>
                    </div>
                    <span className="status-badge muted">
                      {selected.sourceType === "captured" ? t("requests.source.captured") : t("requests.source.manual")}
                    </span>
                  </div>

                  <div className="detail-kpi-grid">
                    <div className="detail-kpi">
                      <span>{t("requests.updatedAt")}</span>
                      <strong>{new Date(selected.updatedAt).toLocaleString()}</strong>
                    </div>
                    <div className="detail-kpi">
                      <span>{t("requests.metric.tags")}</span>
                      <strong>{selected.tags.length}</strong>
                    </div>
                    <div className="detail-kpi">
                      <span>{t("detail.source")}</span>
                      <strong>{selected.sourceType === "captured" ? t("requests.source.captured") : t("requests.source.manual")}</strong>
                    </div>
                    <div className="detail-kpi">
                      <span>{t("traffic.column.method")}</span>
                      <strong>{selected.method}</strong>
                    </div>
                  </div>

                  <div className="pill-row">
                    {(selected.tags.length > 0 ? selected.tags : [t("requests.untagged")]).map((tag) => (
                      <span key={`${selected.id}-${tag}`} className="feature-badge">{tag}</span>
                    ))}
                  </div>
                  <div className="mock-context-card">
                    <span>{t("requests.libraryTitle")}</span>
                    <strong>{selected.name}</strong>
                    <small>{t("requests.flowBody")}</small>
                  </div>
                </section>

                <section className="panel detail-tab-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{t("requests.assetDetailTitle")}</h3>
                      <p>{t("requests.assetDetailBody")}</p>
                    </div>
                  </div>
                  <div className="detail-meta-grid">
                    <div>
                      <span>{t("detail.fullUrl")}</span>
                      <strong>{selected.url}</strong>
                    </div>
                    <div>
                      <span>{t("requests.bodyState")}</span>
                      <strong>{selected.body ? t("requests.bodyAvailable") : t("requests.bodyEmpty")}</strong>
                    </div>
                  </div>
                  <div className="flow-path compact">
                    <div className="flow-step compact">
                      <span>1</span>
                      <strong>{t("requests.flow.saved")}</strong>
                      <small>{t("requests.flow.savedBody")}</small>
                    </div>
                    <div className="flow-step compact">
                      <span>2</span>
                      <strong>{t("requests.flow.debug")}</strong>
                      <small>{t("requests.flow.debugBody")}</small>
                    </div>
                    <div className="flow-step compact">
                      <span>3</span>
                      <strong>{t("requests.flow.mock")}</strong>
                      <small>{t("requests.flow.mockBody")}</small>
                    </div>
                  </div>
                  <div className="detail-tab-grid">
                    <JsonBlock title={t("requests.assetBody")} value={selected.body} />
                  </div>
                </section>

                <section className="panel detail-action-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{t("traffic.actionsTitle")}</h3>
                      <p>{t("requests.flowBody")}</p>
                    </div>
                  </div>
                  <div className="button-grid compact-actions">
                    <button className="primary-action" onClick={() => openInDebug(selected)}>{t("requests.openDebug")}</button>
                    <button className="ghost-button" onClick={() => edit(selected)}>{t("requests.edit")}</button>
                    <button className="ghost-button" onClick={() => replay(selected.id)}>{t("requests.replay")}</button>
                    <button className="ghost-button" onClick={() => createMock(selected)}>{t("requests.createMock")}</button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        navigator.clipboard.writeText(buildCurl(selected)).then(() => setMessage(t("common.curlCopied")))
                      }
                    >
                      {t("requests.copyCurl")}
                    </button>
                    <button className="danger-button" onClick={() => remove(selected.id)}>{t("requests.delete")}</button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </section>
      )}
    </div>
  );
}
