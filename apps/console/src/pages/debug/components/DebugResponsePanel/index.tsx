import type { RequestRecord } from "@polaris/shared-types";
import { JsonBlock } from "../../../../features/common/JsonBlock";
import localStyles from "./index.module.css";

type DebugResponsePanelProps = {
  response: RequestRecord | null;
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function DebugResponsePanel({ response, t }: DebugResponsePanelProps) {
  if (!response) {
    return (
      <div className={localStyles.empty} data-testid="debug-response-empty">
        <h3>{t("debug.waitTitle")}</h3>
        <p>{t("debug.waitBody")}</p>
      </div>
    );
  }

  return (
    <div className={localStyles.detailGrid}>
      <div className={localStyles.responseCard}>
        <div className={localStyles.responseHeading}>
          <div>
            <h3>{t("debug.responseTitle")}</h3>
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
            <span>{t("debug.metric.duration")}</span>
            <strong>{response.duration} ms</strong>
          </div>
          <div className={localStyles.statTile}>
            <span>{t("debug.metric.source")}</span>
            <strong>{response.source === "debug" ? t("debug.source.debug") : t("debug.source.proxy")}</strong>
          </div>
        </div>
      </div>
      <JsonBlock title={t("debug.responseHeaders")} value={response.responseHeaders} />
      <JsonBlock title={t("debug.responseBody")} value={response.responseBody} />
    </div>
  );
}
