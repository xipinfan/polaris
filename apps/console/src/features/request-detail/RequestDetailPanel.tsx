import type { ReactNode } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { JsonBlock } from "../common/JsonBlock";
import { UiSlotPlaceholder } from "../slots/UiSlotPlaceholder";

function getSchemeLabel(request: RequestRecord) {
  return request.secure ? "HTTPS" : "HTTP";
}

export function RequestDetailPanel({ request, actions }: { request?: RequestRecord; actions?: ReactNode }) {
  const { t } = useConsoleI18n();

  if (!request) {
    return (
      <div className="empty-card">
        <h3>{t("detail.noneTitle")}</h3>
        <p>{t("detail.noneBody")}</p>
      </div>
    );
  }

  return (
    <div className="detail-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>{t("detail.title")}</h3>
            <p>{request.method} {request.path}</p>
          </div>
          <span className={`status-badge ${request.statusCode >= 400 ? "warning" : ""}`}>{request.statusCode}</span>
        </div>
        <div className="stats-grid compact">
          <div className="stat-tile">
            <span>{t("detail.scheme")}</span>
            <strong>{getSchemeLabel(request)}</strong>
          </div>
          <div className="stat-tile">
            <span>{t("detail.duration")}</span>
            <strong>{request.duration} ms</strong>
          </div>
          <div className="stat-tile">
            <span>{t("detail.source")}</span>
            <strong>{request.source === "proxy" ? t("detail.source.proxy") : t("detail.source.debug")}</strong>
          </div>
          <div className="stat-tile">
            <span>{t("detail.capturedAt")}</span>
            <strong>{new Date(request.createdAt).toLocaleString()}</strong>
          </div>
        </div>
        <div className="meta-list">
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
      {actions ? <section className="panel">{actions}</section> : null}
      <UiSlotPlaceholder slot="request-detail-actions" />
      <JsonBlock title={t("detail.requestHeaders")} value={request.requestHeaders} />
      <JsonBlock title={t("detail.queryParams")} value={request.requestQuery} />
      <JsonBlock title={t("detail.requestBody")} value={request.requestBody} />
      <JsonBlock title={t("detail.responseHeaders")} value={request.responseHeaders} />
      <JsonBlock title={t("detail.responseBody")} value={request.responseBody} />
    </div>
  );
}
