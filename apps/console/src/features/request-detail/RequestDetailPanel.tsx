import { useEffect, useState, type ReactNode } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { JsonBlock } from "../common/JsonBlock";
import { KeyValueBlock } from "../common/KeyValueBlock";
import { UiSlotPlaceholder } from "../slots/UiSlotPlaceholder";

function getSchemeLabel(request: RequestRecord) {
  return request.secure ? "HTTPS" : "HTTP";
}

type DetailTab = "overview" | "request" | "response";

export function RequestDetailPanel({ request, actions }: { request?: RequestRecord; actions?: ReactNode }) {
  const { t } = useConsoleI18n();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [request?.id]);

  if (!request) {
    return (
      <div className="empty-card">
        <h3>{t("detail.noneTitle")}</h3>
        <p>{t("detail.noneBody")}</p>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <section className="panel detail-summary-panel">
        <div className="panel-heading">
          <div className="detail-heading-copy">
            <div className="detail-title-row">
              <span className={`method-badge method-${request.method.toLowerCase()}`}>{request.method}</span>
              <h3>{t("detail.title")}</h3>
            </div>
            <p>{request.path}</p>
          </div>
          <span className={`status-badge ${request.statusCode >= 400 ? "warning" : "success"}`}>{request.statusCode}</span>
        </div>

        <div className="detail-kpi-grid">
          <div className="detail-kpi">
            <span>{t("detail.scheme")}</span>
            <strong>{getSchemeLabel(request)}</strong>
          </div>
          <div className="detail-kpi">
            <span>{t("detail.duration")}</span>
            <strong>{request.duration} ms</strong>
          </div>
          <div className="detail-kpi">
            <span>{t("detail.source")}</span>
            <strong>{request.source === "proxy" ? t("detail.source.proxy") : t("detail.source.debug")}</strong>
          </div>
          <div className="detail-kpi">
            <span>{t("detail.capturedAt")}</span>
            <strong>{new Date(request.createdAt).toLocaleString()}</strong>
          </div>
        </div>

        <div className="detail-meta-grid">
          <div>
            <span>{t("detail.fullUrl")}</span>
            <strong>{request.url}</strong>
          </div>
          <div>
            <span>{t("detail.host")}</span>
            <strong>{request.host}</strong>
          </div>
        </div>
      </section>

      <section className="panel detail-tab-panel">
        <div className="detail-tab-header">
          <div className="segmented-control">
            {(
              [
                ["overview", t("detail.tab.overview")],
                ["request", t("detail.tab.request")],
                ["response", t("detail.tab.response")]
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="detail-tab-grid">
            <KeyValueBlock title={t("detail.requestHeaders")} value={request.requestHeaders} />
            <KeyValueBlock title={t("detail.responseHeaders")} value={request.responseHeaders} />
            <KeyValueBlock title={t("detail.queryParams")} value={request.requestQuery} />
            <JsonBlock title={t("detail.responseBody")} value={request.responseBody} />
          </div>
        ) : null}

        {activeTab === "request" ? (
          <div className="detail-tab-grid">
            <KeyValueBlock title={t("detail.requestHeaders")} value={request.requestHeaders} />
            <KeyValueBlock title={t("detail.queryParams")} value={request.requestQuery} />
            <JsonBlock title={t("detail.requestBody")} value={request.requestBody} />
          </div>
        ) : null}

        {activeTab === "response" ? (
          <div className="detail-tab-grid">
            <KeyValueBlock title={t("detail.responseHeaders")} value={request.responseHeaders} />
            <JsonBlock title={t("detail.responseBody")} value={request.responseBody} />
          </div>
        ) : null}
      </section>

      {actions ? <section className="panel detail-action-panel">{actions}</section> : null}
      <UiSlotPlaceholder slot="request-detail-actions" />
    </div>
  );
}
