import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import { uiSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import localStyles from "./index.module.less";
import {
  cx,
  getContentType,
  getProtocolLabel,
  getRequestResolutionLabel,
  getRequestResolutionMode,
  getRequestResolutionTooltip,
  getStatusTone,
} from "../../utils/trafficFormatters";

const statusCellToneClassMap = {
  success: localStyles.statusCellSuccess,
  warning: localStyles.statusCellWarning,
  danger: localStyles.statusCellDanger,
  muted: localStyles.statusCellMuted,
};

const resolutionBadgeToneClassMap = {
  mock: localStyles.resolutionBadgeMock,
  proxy_forward: localStyles.resolutionBadgeProxyForward,
  direct: localStyles.resolutionBadgeDirect,
  block: localStyles.resolutionBadgeBlock,
  error: localStyles.resolutionBadgeError,
  unknown: localStyles.resolutionBadgeUnknown,
};

const requestRowResolutionClassMap = {
  mock: localStyles.requestRowMock,
  proxy_forward: localStyles.requestRowProxyForward,
  direct: localStyles.requestRowDirect,
  block: localStyles.requestRowBlock,
  error: localStyles.requestRowError,
  unknown: "",
};

type TrafficRequestPaneProps = {
  requests: RequestRecord[];
  selected?: RequestRecord;
  visibleRequests: RequestRecord[];
  recordBodyRef: RefObject<HTMLDivElement | null>;
  onSelectRequest: (id: string) => void;
  t: TranslateFn;
};

export function TrafficRequestPane({
  requests,
  selected,
  visibleRequests,
  recordBodyRef,
  onSelectRequest,
  t,
}: TrafficRequestPaneProps) {
  const keyword = useUiStore(uiSelectors.trafficKeyword);
  const hostOnly = useUiStore(uiSelectors.trafficHostOnly);
  const statusCode = useUiStore(uiSelectors.trafficStatusCode);
  const method = useUiStore(uiSelectors.trafficMethod);
  const focusMode = useUiStore(uiSelectors.trafficFocusMode);

  const setKeyword = useUiStore((state) => state.setTrafficKeyword);
  const setHostOnly = useUiStore((state) => state.setTrafficHostOnly);
  const setStatusCode = useUiStore((state) => state.setTrafficStatusCode);
  const setMethod = useUiStore((state) => state.setTrafficMethod);
  const setFocusMode = useUiStore((state) => state.setTrafficFocusMode);

  return (
    <section className={cx(localStyles.surface, localStyles.requestPane, localStyles.root)}>
      <div className={localStyles.filters}>
        <div className={localStyles.filterGrid}>
          <input
            className={localStyles.filterInput}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t("traffic.searchPlaceholder")}
            value={keyword}
          />
          <input
            className={localStyles.filterInput}
            onChange={(event) => setHostOnly(event.target.value)}
            placeholder={t("traffic.hostPlaceholder")}
            value={hostOnly}
          />
          <input
            className={localStyles.filterInput}
            onChange={(event) => setStatusCode(event.target.value)}
            placeholder={t("traffic.statusPlaceholder")}
            value={statusCode}
          />
          <select
            className={localStyles.filterInput}
            onChange={(event) => setMethod(event.target.value)}
            value={method}
          >
            <option value="">{t("traffic.allMethods")}</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div className={cx(localStyles.filterGrid, localStyles.filterGridSecondary)}>
          <div className={localStyles.segmentedControl}>
            {(
              [
                ["all", t("traffic.focus.all")],
                ["errors", t("traffic.focus.errors")],
                ["https", t("traffic.focus.https")],
                ["debug", t("traffic.focus.debug")],
                ["mock", t("traffic.focus.mock")],
                ["proxyForward", t("traffic.focus.proxyForward")],
                ["direct", t("traffic.focus.direct")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={cx(
                  localStyles.segmentedButton,
                  focusMode === value && localStyles.segmentedButtonActive,
                )}
                onClick={() => setFocusMode(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={localStyles.requestTable}>
        <div className={localStyles.requestScroll} ref={recordBodyRef}>
          <div className={localStyles.requestHeader}>
            <span>#</span>
            <span>{t("traffic.column.status")}</span>
            <span>{t("traffic.column.method")}</span>
            <span>{t("traffic.column.protocol")}</span>
            <span>{t("traffic.column.route")}</span>
            <span>{t("traffic.column.host")}</span>
            <span>{t("traffic.column.path")}</span>
            <span>{t("traffic.column.type")}</span>
            <span>{t("traffic.column.time")}</span>
          </div>
          <div className={localStyles.requestList}>
            {visibleRequests.map((item, index) => (
              <button
                key={item.id}
                className={cx(
                  localStyles.requestRow,
                  selected?.id === item.id && localStyles.requestRowActive,
                  item.statusCode >= 400 && localStyles.requestRowWarning,
                  requestRowResolutionClassMap[getRequestResolutionMode(item)],
                )}
                onClick={() => onSelectRequest(item.id)}
                type="button"
              >
                <span>{index + 1}</span>
                <span className={statusCellToneClassMap[getStatusTone(item.statusCode)]}>
                  {item.statusCode}
                </span>
                <span>{item.method}</span>
                <span>{getProtocolLabel(item)}</span>
                <span
                  className={cx(
                    localStyles.resolutionBadge,
                    resolutionBadgeToneClassMap[getRequestResolutionMode(item)],
                  )}
                  title={getRequestResolutionTooltip(item, t)}
                >
                  <span className={localStyles.resolutionGlyph} aria-hidden="true" />
                  {getRequestResolutionLabel(item, t)}
                </span>
                <span title={item.host}>{item.host}</span>
                <strong title={item.path}>{item.path}</strong>
                <span title={getContentType(item)}>{getContentType(item)}</span>
                <span>{item.duration} ms</span>
              </button>
            ))}

            {visibleRequests.length === 0 && requests.length > 0 ? (
              <div className={cx(localStyles.emptyCard, localStyles.compactEmpty)}>
                <h3>{t("traffic.emptyFilteredTitle")}</h3>
                <p>{t("traffic.emptyFilteredBody")}</p>
              </div>
            ) : null}

            {requests.length === 0 ? (
              <div className={localStyles.emptyCard}>
                <h3>{t("traffic.noTrafficTitle")}</h3>
                <p>{t("traffic.noTrafficBody")}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
