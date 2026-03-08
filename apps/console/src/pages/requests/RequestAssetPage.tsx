import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SavedRequest } from "@polaris/shared-types";
import { buildCurl } from "../../features/common/curl";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

export function RequestAssetPage() {
  const [items, setItems] = useState<SavedRequest[]>([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { t } = useConsoleI18n();

  const load = () => apiClient.listSavedRequests().then(setItems).catch(console.error);

  useEffect(() => {
    load();
  }, []);

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

  const createMock = async (item: SavedRequest) => {
    const name = window.prompt(t("common.mockPrompt"), `${item.name} mock`);
    if (!name) {
      return;
    }
    await apiClient.createMockRule({
      name,
      method: item.method,
      url: item.url,
      responseStatus: 200,
      responseHeaders: {
        "content-type": "application/json"
      },
      responseBody: item.body,
      enabled: true
    });
    setMessage(t("common.mockCreatedFromRequest", { name }));
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

      <section className="card-grid">
        <div className="panel">
          <span className="feature-badge">{t("requests.overview")}</span>
          <div className="stats-grid compact">
            <div className="stat-tile">
              <span>{t("requests.metric.total")}</span>
              <strong>{metrics.total}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("requests.metric.captured")}</span>
              <strong>{metrics.capturedCount}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("requests.metric.manual")}</span>
              <strong>{metrics.manualCount}</strong>
            </div>
            <div className="stat-tile">
              <span>{t("requests.metric.tags")}</span>
              <strong>{metrics.tagCount}</strong>
            </div>
          </div>
        </div>
        <div className="panel">
          <h3>{t("requests.flowTitle")}</h3>
          <p>{t("requests.flowBody")}</p>
        </div>
      </section>

      <section className="table-card">
        <div className="panel-heading">
          <div>
            <h3>{t("requests.libraryTitle")}</h3>
            <p>{t("requests.libraryBody")}</p>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty-card">
            <h3>{t("requests.noneTitle")}</h3>
            <p>{t("requests.noneBody")}</p>
          </div>
        ) : (
          <div className="asset-grid">
            {items.map((item) => (
              <article key={item.id} className="panel asset-card">
                <div className="panel-heading">
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.method} - {item.url}</p>
                  </div>
                  <span className="status-badge muted">
                    {item.sourceType === "captured" ? t("requests.source.captured") : t("requests.source.manual")}
                  </span>
                </div>
                <div className="pill-row">
                  {(item.tags.length > 0 ? item.tags : [t("requests.untagged")]).map((tag) => (
                    <span key={`${item.id}-${tag}`} className="feature-badge">{tag}</span>
                  ))}
                </div>
                <div className="meta-list compact">
                  <div>
                    <span>{t("requests.updatedAt")}</span>
                    <strong>{new Date(item.updatedAt).toLocaleString()}</strong>
                  </div>
                </div>
                <div className="button-grid">
                  <button onClick={() => edit(item)}>{t("requests.edit")}</button>
                  <button onClick={() => replay(item.id)}>{t("requests.replay")}</button>
                  <button onClick={() => openInDebug(item)}>{t("requests.openDebug")}</button>
                  <button onClick={() => createMock(item)}>{t("requests.createMock")}</button>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      navigator.clipboard.writeText(buildCurl(item)).then(() => setMessage(t("common.curlCopied")))
                    }
                  >
                    {t("requests.copyCurl")}
                  </button>
                  <button className="danger-button" onClick={() => remove(item.id)}>{t("requests.delete")}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
