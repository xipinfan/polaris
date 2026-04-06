import type { RequestRecord } from "@polaris/shared-types";
import { JsonBlock } from "../../../../features/common/JsonBlock";
import localStyles from "./index.module.css";

type DebugResponsePanelProps = {
  response: RequestRecord | null;
};

export function DebugResponsePanel({ response }: DebugResponsePanelProps) {
  if (!response) {
    return (
      <div className={localStyles.empty} data-testid="debug-response-empty">
        <h3>{"等待响应结果"}</h3>
        <p>{"发送请求后，这里会显示状态码、响应头和响应体。"}</p>
      </div>
    );
  }

  return (
    <div className={localStyles.detailGrid}>
      <div className={localStyles.responseCard}>
        <div className={localStyles.responseHeading}>
          <div>
            <h3>{"响应概览"}</h3>
            <p>{response.method} {response.path}</p>
          </div>
          <span
            className={`${localStyles.statusBadge} ${response.statusCode >= 400 ? localStyles.statusWarning : ""}`}
            data-testid="debug-response-status"
          >
            {response.statusCode}
          </span>
        </div>
        <div className={localStyles.statsGrid}>
          <div className={localStyles.statTile}>
            <span>{"耗时"}</span>
            <strong>{response.duration} ms</strong>
          </div>
          <div className={localStyles.statTile}>
            <span>{"来源"}</span>
            <strong>{response.source === "debug" ? "调试台" : "代理"}</strong>
          </div>
        </div>
      </div>
      <JsonBlock title={"响应头"} value={response.responseHeaders} />
      <JsonBlock title={"响应体"} value={response.responseBody} />
    </div>
  );
}
