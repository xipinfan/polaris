import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import localStyles from "./index.module.less";
import {
  cx,
  formatRequestTime,
  getContentType,
  getProtocolLabel,
  getRequestResolutionLabelByMode,
  getRequestResolutionMode,
  getStatusTone,
} from "../../utils/trafficFormatters";

const statusBadgeToneClassMap = {
  success: localStyles.statusBadgeSuccess,
  warning: localStyles.statusBadgeWarning,
  danger: localStyles.statusBadgeDanger,
  muted: localStyles.statusBadgeMuted,
};

type TrafficTimelineTabProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  selected: RequestRecord;
};

export function TrafficTimelineTab({ inspectorBodyRef, selected }: TrafficTimelineTabProps) {
  const resolutionMode = getRequestResolutionMode(selected);
  const resolutionText = getRequestResolutionLabelByMode(resolutionMode);

  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <div className={localStyles.timeline}>
        <div className={cx(localStyles.timelineItem, localStyles.timelineItemActive)}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{"发起请求"}</strong>
              <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>
                {formatRequestTime(selected.createdAt)}
              </span>
            </div>
            <p>{"请求已被 Polaris 抓取并进入当前会话流。"}</p>
          </div>
        </div>

        <div className={localStyles.timelineItem}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{"网络往返"}</strong>
              <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>{selected.duration} ms</span>
            </div>
            <p>{`从发出到收到响应共用时 ${selected.duration} ms。`}</p>
          </div>
        </div>

        <div className={localStyles.timelineItem}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{"响应完成"}</strong>
              <span className={cx(localStyles.statusBadge, statusBadgeToneClassMap[getStatusTone(selected.statusCode)])}>
                {selected.statusCode}
              </span>
            </div>
            <p>{`返回内容类型为 ${getContentType(selected)}。`}</p>
          </div>
        </div>
      </div>

      <div className={localStyles.timelineStats}>
        <div className={localStyles.timelineStat}>
          <span>{"总耗时"}</span>
          <strong>{selected.duration} ms</strong>
        </div>
        <div className={localStyles.timelineStat}>
          <span>{"协议"}</span>
          <strong>{getProtocolLabel(selected)}</strong>
        </div>
        <div className={localStyles.timelineStat}>
          <span>{"处理结果"}</span>
          <strong>{resolutionText}</strong>
        </div>
        <div className={localStyles.timelineStat}>
          <span>{"来源"}</span>
          <strong>{selected.source.toUpperCase()}</strong>
        </div>
      </div>
    </div>
  );
}
