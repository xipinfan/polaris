import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import localStyles from "./index.module.less";
import {
  cx,
  formatRequestTime,
  getContentType,
  getProtocolLabel,
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
  t: TranslateFn;
};

export function TrafficTimelineTab({
  inspectorBodyRef,
  selected,
  t,
}: TrafficTimelineTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <div className={localStyles.timeline}>
        <div className={cx(localStyles.timelineItem, localStyles.timelineItemActive)}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{t("traffic.timeline.request")}</strong>
              <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>
                {formatRequestTime(selected.createdAt)}
              </span>
            </div>
            <p>{t("traffic.timeline.requestBody")}</p>
          </div>
        </div>

        <div className={localStyles.timelineItem}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{t("traffic.timeline.transfer")}</strong>
              <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>
                {selected.duration} ms
              </span>
            </div>
            <p>{t("traffic.timeline.transferBody", { duration: selected.duration })}</p>
          </div>
        </div>

        <div className={localStyles.timelineItem}>
          <span className={localStyles.timelineDot} />
          <div className={localStyles.timelineContent}>
            <div className={localStyles.listRow}>
              <strong>{t("traffic.timeline.response")}</strong>
              <span
                className={cx(
                  localStyles.statusBadge,
                  statusBadgeToneClassMap[getStatusTone(selected.statusCode)],
                )}
              >
                {selected.statusCode}
              </span>
            </div>
            <p>{t("traffic.timeline.responseBody", { type: getContentType(selected) })}</p>
          </div>
        </div>
      </div>

      <div className={localStyles.timelineStats}>
        <div className={localStyles.timelineStat}>
          <span>{t("traffic.timeline.metric.total")}</span>
          <strong>{selected.duration} ms</strong>
        </div>
        <div className={localStyles.timelineStat}>
          <span>{t("traffic.timeline.metric.protocol")}</span>
          <strong>{getProtocolLabel(selected)}</strong>
        </div>
        <div className={localStyles.timelineStat}>
          <span>{t("traffic.timeline.metric.source")}</span>
          <strong>{selected.source.toUpperCase()}</strong>
        </div>
      </div>
    </div>
  );
}


