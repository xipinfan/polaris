import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
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
};

const buildFacts = (selected: RequestRecord) => {
  const facts: Array<[string, string]> = [
    ["URL", selected.url],
    ["方法", selected.method],
    ["协议", getProtocolLabel(selected)],
    ["状态", String(selected.statusCode)],
    ["主机", selected.host],
    ["请求路径", selected.path],
    ["类型", getContentType(selected)],
    ["来源", selected.source.toUpperCase()],
    ["耗时", `${selected.duration} ms`],
    ["捕获时间", new Date(selected.createdAt).toLocaleString()],
  ];

  const resolutionTarget = selected.resolution?.target;
  if (selected.resolution?.mode === "proxy_forward" && resolutionTarget) {
    const originalAddress = `${selected.host}${selected.path}`;
    const targetAddress = resolutionTarget.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    if (targetAddress !== originalAddress) {
      facts.splice(1, 0, ["转发目标", resolutionTarget]);
    }
  }

  return facts;
};

const decisionCardClassMap = {
  mock: localStyles.decisionCardMock,
  proxy_forward: localStyles.decisionCardProxyForward,
  direct: localStyles.decisionCardDirect,
  block: localStyles.decisionCardBlock,
  error: localStyles.decisionCardError,
  unknown: localStyles.decisionCardUnknown,
};

export function TrafficOverviewTab({ inspectorBodyRef, onCopyText, selected }: TrafficOverviewTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <section className={localStyles.detailSummary}>
        <div className={localStyles.detailSummaryHead}>
          <strong>{"请求详情"}</strong>
          <span>{selected.method} {selected.path}</span>
        </div>
        <div className={localStyles.detailFacts}>
          {buildFacts(selected).map(([label, value]) => (
            <div className={localStyles.detailFactRow} key={label}>
              <span>{label}</span>
              <div className={localStyles.detailFactValue}>
                <strong>{value}</strong>
                <button className={localStyles.inlineCopyButton} onClick={() => void onCopyText(value)} type="button">
                  {"复制"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cx(localStyles.decisionCard, decisionCardClassMap[getRequestResolutionMode(selected)])}>
        <strong>{"处理决策"}</strong>
        <div className={localStyles.decisionRows}>
          <div className={localStyles.decisionRow}>
            <span>{"处理模式"}</span>
            <strong>{getRequestResolutionLabel(selected)}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{"决策来源"}</span>
            <strong>{getRequestResolutionSourceLabel(selected)}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{"命中规则"}</span>
            <strong>{selected.resolution?.matchedRuleName ?? selected.resolution?.matchedRuleId ?? "-"}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{"转发目标"}</span>
            <strong>{selected.resolution?.target ?? "-"}</strong>
          </div>
          <div className={localStyles.decisionRow}>
            <span>{"命中说明"}</span>
            <strong>{selected.resolution?.reason ?? "无规则命中"}</strong>
          </div>
        </div>
      </section>

      <section className={localStyles.detailSection}>
        <KeyValueBlock title={"查询参数"} value={selected.requestQuery} />
      </section>
      <section className={localStyles.detailSection}>
        <KeyValueBlock title={"请求头"} value={selected.requestHeaders} />
      </section>
      <section className={localStyles.detailSection}>
        <KeyValueBlock copyMode="row" title={"响应头"} value={selected.responseHeaders} />
      </section>
      <div className={localStyles.detailBodyGrid}>
        <section className={localStyles.detailSection}>
          <JsonBlock title={"请求体"} value={selected.requestBody} />
        </section>
        <section className={localStyles.detailSection}>
          <JsonBlock title={"响应体"} value={selected.responseBody} />
        </section>
      </div>
    </div>
  );
}
