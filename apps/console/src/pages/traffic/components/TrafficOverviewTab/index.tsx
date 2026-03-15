import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import { JsonBlock } from "../../../../features/common/JsonBlock";
import { KeyValueBlock } from "../../../../features/common/KeyValueBlock";
import localStyles from "./index.module.less";
import {
  cx,
  getContentType,
  getProtocolLabel,
  getRequestResolutionLabel,
  getRequestResolutionMode,
  getRequestResolutionSourceLabel,
} from "../../utils/trafficFormatters";

type TrafficOverviewTabProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  onCopyText: (value: string) => Promise<void>;
  selected: RequestRecord;
  t: TranslateFn;
};

const buildFacts = (selected: RequestRecord, t: TranslateFn) => [
  ["URL", selected.url],
  [t("traffic.column.method"), selected.method],
  [t("traffic.column.protocol"), getProtocolLabel(selected)],
  [t("traffic.column.status"), String(selected.statusCode)],
  [t("traffic.column.host"), selected.host],
  [t("traffic.column.path"), selected.path],
  [t("traffic.column.type"), getContentType(selected)],
  [t("detail.source"), selected.source.toUpperCase()],
  [t("detail.duration"), `${selected.duration} ms`],
  [t("detail.capturedAt"), new Date(selected.createdAt).toLocaleString()],
];

const decisionCardClassMap = {
  mock: localStyles.decisionCardMock,
  proxy_forward: localStyles.decisionCardProxyForward,
  direct: localStyles.decisionCardDirect,
  block: localStyles.decisionCardBlock,
  error: localStyles.decisionCardError,
  unknown: localStyles.decisionCardUnknown,
};

export function TrafficOverviewTab({
  inspectorBodyRef,
  onCopyText,
  selected,
  t,
}: TrafficOverviewTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <section className={localStyles.detailSummary}>
        <div className={localStyles.detailSummaryHead}>
          <strong>{t("detail.title")}</strong>
          <span>{selected.method} {selected.path}</span>
        </div>
        <div className={localStyles.detailFacts}>
          {buildFacts(selected, t).map(([label, value]) => (
            <div className={localStyles.detailFactRow} key={label}>
              <span>{label}</span>
              <div className={localStyles.detailFactValue}>
                <strong>{value}</strong>
                <button
                  className={localStyles.inlineCopyButton}
                  onClick={() => void onCopyText(value)}
                  type="button"
                >
                  {t("json.copy")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cx(localStyles.decisionCard, decisionCardClassMap[getRequestResolutionMode(selected)])}>
        <strong>{t("detail.resolution.title")}</strong>
        <div className={localStyles.decisionRows}>
          <div className={localStyles.decisionRow}>
            <span>{t("detail.resolution.mode")}</span>
            <strong>{getRequestResolutionLabel(selected, t)}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{t("detail.resolution.source")}</span>
            <strong>{getRequestResolutionSourceLabel(selected, t)}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{t("detail.resolution.rule")}</span>
            <strong>{selected.resolution?.matchedRuleName ?? selected.resolution?.matchedRuleId ?? "-"}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{t("detail.resolution.target")}</span>
            <strong>{selected.resolution?.target ?? "-"}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{t("detail.resolution.reason")}</span>
            <strong>{selected.resolution?.reason ?? t("detail.resolution.none")}</strong>
          </div>
        </div>
      </section>

      <section className={localStyles.detailSection}>
        <KeyValueBlock title={t("detail.queryParams")} value={selected.requestQuery} />
      </section>
      <section className={localStyles.detailSection}>
        <KeyValueBlock title={t("detail.requestHeaders")} value={selected.requestHeaders} />
      </section>
      <section className={localStyles.detailSection}>
        <KeyValueBlock
          copyMode="row"
          title={t("detail.responseHeaders")}
          value={selected.responseHeaders}
        />
      </section>
      <div className={localStyles.detailBodyGrid}>
        <section className={localStyles.detailSection}>
          <JsonBlock title={t("detail.requestBody")} value={selected.requestBody} />
        </section>
        <section className={localStyles.detailSection}>
          <JsonBlock title={t("detail.responseBody")} value={selected.responseBody} />
        </section>
      </div>
    </div>
  );
}


