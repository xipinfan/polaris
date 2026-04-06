import { useState, type ReactNode } from "react";
import type { RequestRecord } from "@polaris/shared-types";
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

type RequestDetailPanelProps = {
  request?: RequestRecord;
  actions?: ReactNode;
};

function RequestDetailPanelContent({
  request,
  actions,
}: {
  request: RequestRecord;
  actions?: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.heading}>
          <div className={styles.headingCopy}>
            <div className={styles.titleRow}>
              <span className={`${styles.methodBadge} ${getMethodClassName(request.method)}`}>{request.method}</span>
              <h3>{"请求详情"}</h3>
            </div>
            <p>{request.path}</p>
          </div>
          <span className={`${styles.statusBadge} ${request.statusCode >= 400 ? styles.statusWarning : ""}`}>{request.statusCode}</span>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpi}>
            <span>{"协议"}</span>
            <strong>{getSchemeLabel(request)}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{"耗时"}</span>
            <strong>{request.duration} ms</strong>
          </div>
          <div className={styles.kpi}>
            <span>{"来源"}</span>
            <strong>{request.source === "proxy" ? "代理" : "调试"}</strong>
          </div>
          <div className={styles.kpi}>
            <span>{"捕获时间"}</span>
            <strong>{new Date(request.createdAt).toLocaleString()}</strong>
          </div>
        </div>

        <div className={styles.metaGrid}>
          <div>
            <span>{"完整 URL"}</span>
            <strong>{request.url}</strong>
          </div>
          <div>
            <span>{"主机"}</span>
            <strong>{request.host}</strong>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.tabHeader}>
          <div className={styles.segmented}>
            {(
              [
                ["overview", "总览"],
                ["request", "请求"],
                ["response", "响应"]
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
            <KeyValueBlock title={"请求头"} value={request.requestHeaders} />
            <KeyValueBlock title={"响应头"} value={request.responseHeaders} />
            <KeyValueBlock title={"查询参数"} value={request.requestQuery} />
            <JsonBlock title={"响应体"} value={request.responseBody} />
          </div>
        ) : null}

        {activeTab === "request" ? (
          <div className={styles.tabGrid}>
            <KeyValueBlock title={"请求头"} value={request.requestHeaders} />
            <KeyValueBlock title={"查询参数"} value={request.requestQuery} />
            <JsonBlock title={"请求体"} value={request.requestBody} />
          </div>
        ) : null}

        {activeTab === "response" ? (
          <div className={styles.tabGrid}>
            <KeyValueBlock title={"响应头"} value={request.responseHeaders} />
            <JsonBlock title={"响应体"} value={request.responseBody} />
          </div>
        ) : null}
      </section>

      {actions ? <section className={`${styles.section} ${styles.actionSection}`}>{actions}</section> : null}
      <UiSlotPlaceholder slot="request-detail-actions" />
    </div>
  );
}

export function RequestDetailPanel({ request, actions }: RequestDetailPanelProps) {
  if (!request) {
    return (
      <div className={styles.empty}>
        <h3>{"等待选择请求"}</h3>
        <p>{"从左侧列表选择一条请求，这里会显示请求头、查询参数、请求体和响应内容。"}</p>
      </div>
    );
  }

  return <RequestDetailPanelContent key={request.id} actions={actions} request={request} />;
}

