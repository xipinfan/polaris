import { useEffect, useState, type ReactNode } from "react";
import type { RequestRecord } from "@polaris/shared-types";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { JsonBlock } from "../common/JsonBlock";
import { KeyValueBlock } from "../common/KeyValueBlock";
import { UiSlotPlaceholder } from "../slots/UiSlotPlaceholder";
import styles from "./RequestDetailPanel.module.css";

function getSchemeLabel(request: RequestRecord) {
  return request.secure ? "HTTPS" : "HTTP";
}

type DetailTab = "overview" | "request" | "response";

function getMethodClassName(method: string) {
  switch (method.toUpperCase()) {
    case "GET":
      return styles.methodGet;
    case "POST":
      return styles.methodPost;
    case "PUT":
      return styles.methodPut;
    case "PATCH":
      return styles.methodPatch;
    case "DELETE":
      return styles.methodDelete;
    default:
      return "";
  }
}

export function RequestDetailPanel({ request, actions }: { request?: RequestRecord; actions?: ReactNode }) {
  const { t } = useConsoleI18n();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [request?.id]);

  if (!request) {
    return (
      <div className={styles.empty}>
        <h3>{t("detail.noneTitle")}</h3>
        <p>{t("detail.noneBody")}</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.heading}>
          <div className={styles.headingCopy}>
            <div className={styles.titleRow}>
              <span className={`${styles.methodBadge} ${getMethodClassName(request.method)}`}>{request.method}</span>
              <h3>{t("detail.title")}</h3>
            </div>
            <p>{request.path}</p>
          </div>
          <span className={`${styles.statusBadge} ${request.statusCode >= 400 ? styles.statusWarning : ""}`}>{request.statusCode}</span>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpi}>
            <span>{t("detail.scheme")}</span>
            <strong>{getSchemeLabel(request)}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("detail.duration")}</span>
            <strong>{request.duration} ms</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("detail.source")}</span>
            <strong>{request.source === "proxy" ? t("detail.source.proxy") : t("detail.source.debug")}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{t("detail.capturedAt")}</span>
            <strong>{new Date(request.createdAt).toLocaleString()}</strong>
          </div>
        </div>

        <div className={styles.metaGrid}>
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

      <section className={styles.section}>
        <div className={styles.tabHeader}>
          <div className={styles.segmented}>
            {(
              [
                ["overview", t("detail.tab.overview")],
                ["request", t("detail.tab.request")],
                ["response", t("detail.tab.response")]
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                className={activeTab === tab ? styles.activeTab : undefined}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className={styles.tabGrid}>
            <KeyValueBlock title={t("detail.requestHeaders")} value={request.requestHeaders} />
            <KeyValueBlock title={t("detail.responseHeaders")} value={request.responseHeaders} />
            <KeyValueBlock title={t("detail.queryParams")} value={request.requestQuery} />
            <JsonBlock title={t("detail.responseBody")} value={request.responseBody} />
          </div>
        ) : null}

        {activeTab === "request" ? (
          <div className={styles.tabGrid}>
            <KeyValueBlock title={t("detail.requestHeaders")} value={request.requestHeaders} />
            <KeyValueBlock title={t("detail.queryParams")} value={request.requestQuery} />
            <JsonBlock title={t("detail.requestBody")} value={request.requestBody} />
          </div>
        ) : null}

        {activeTab === "response" ? (
          <div className={styles.tabGrid}>
            <KeyValueBlock title={t("detail.responseHeaders")} value={request.responseHeaders} />
            <JsonBlock title={t("detail.responseBody")} value={request.responseBody} />
          </div>
        ) : null}
      </section>

      {actions ? <section className={`${styles.section} ${styles.actionSection}`}>{actions}</section> : null}
      <UiSlotPlaceholder slot="request-detail-actions" />
    </div>
  );
}
