import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { RequestRecord } from "@polaris/shared-types";
import { buildCurl } from "../../features/common/curl";
import { useToast } from "../../features/feedback/ToastProvider";
import { JsonBlock } from "../../features/common/JsonBlock";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { UiSlotPlaceholder } from "../../features/slots/UiSlotPlaceholder";
import { apiClient } from "../../services/apiClient";

type DebugDraftState = {
  draft?: {
    name?: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
};

export function DebugPage() {
  const location = useLocation();
  const routeState = location.state as DebugDraftState | null;
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [response, setResponse] = useState<RequestRecord | null>(null);
  const { t } = useConsoleI18n();
  const { showToast } = useToast();

  useEffect(() => {
    if (!routeState?.draft) {
      return;
    }

    const draft = routeState.draft;
    setName(draft.name ?? "");
    setMethod(draft.method);
    setUrl(draft.url);
    setBody(JSON.stringify(draft.body ?? {}, null, 2));
    showToast(t("common.draftLoaded"));
  }, [routeState, showToast, t]);

  const parsedBody = () => {
    if (method === "GET") {
      return undefined;
    }
    return JSON.parse(body || "{}");
  };

  const currentDraft = useMemo(
    () => ({
      name: name || "debug-request",
      method,
      url,
      headers: {},
      query: {},
      body: method === "GET" ? null : parsedBody(),
      tags: ["debug"]
    }),
    [body, method, name, url]
  );

  const runRequest = async () => {
    const result = await apiClient.runRequest({
      method,
      url,
      body: parsedBody()
    });
    setResponse(result);
    showToast(t("common.requestSent", { status: result.statusCode }));
  };

  const saveDraft = async () => {
    await apiClient.saveManualRequest(currentDraft);
    showToast(t("common.savedRequest", { name: currentDraft.name }));
  };

  const resetDraft = () => {
    setName("");
    setMethod("GET");
    setUrl("");
    setBody("");
    setResponse(null);
    showToast(t("common.debugCleared"));
  };

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <h2>{t("debug.title")}</h2>
        </div>
      </section>

      <UiSlotPlaceholder slot="debug-header" />

      <div className="debug-layout">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            runRequest().catch(console.error);
          }}
        >
          <div className="panel-heading">
            <div><h3>{t("debug.formTitle")}</h3></div>
          </div>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("debug.namePlaceholder")} />
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t("debug.urlPlaceholder")} />
          <textarea rows={12} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("debug.bodyPlaceholder")} />
          <div className="button-grid">
            <button className="primary-action" type="submit">{t("debug.send")}</button>
            <button type="button" className="ghost-button" onClick={() => saveDraft().catch(console.error)}>{t("debug.save")}</button>
            <button type="button" className="ghost-button" onClick={resetDraft}>{t("debug.clear")}</button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(buildCurl(currentDraft))
                  .then(() => showToast(t("common.curlCopied")));
              }}
            >
              {t("debug.copyCurl")}
            </button>
          </div>
        </form>

        {response ? (
          <div className="detail-grid">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>{t("debug.responseTitle")}</h3>
                  <p>{response.method} {response.path}</p>
                </div>
                <span className={`status-badge ${response.statusCode >= 400 ? "warning" : ""}`}>{response.statusCode}</span>
              </div>
              <div className="stats-grid compact">
                <div className="stat-tile">
                  <span>{t("debug.metric.duration")}</span>
                  <strong>{response.duration} ms</strong>
                </div>
                <div className="stat-tile">
                  <span>{t("debug.metric.source")}</span>
                  <strong>{response.source === "debug" ? t("debug.source.debug") : t("debug.source.proxy")}</strong>
                </div>
              </div>
            </div>
            <JsonBlock title={t("debug.responseHeaders")} value={response.responseHeaders} />
            <JsonBlock title={t("debug.responseBody")} value={response.responseBody} />
          </div>
        ) : (
          <div className="empty-card">
            <h3>{t("debug.waitTitle")}</h3>
            <p>{t("debug.waitBody")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
