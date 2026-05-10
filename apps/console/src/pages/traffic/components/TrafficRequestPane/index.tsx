import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
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
};

export function TrafficRequestPane({
  requests,
  selected,
  visibleRequests,
  recordBodyRef,
  onSelectRequest,
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
            placeholder={"搜索 URL、Host、Header、Body、处理结果"}
            value={keyword}
          />
          <input
            className={localStyles.filterInput}
            onChange={(event) => setHostOnly(event.target.value)}
            placeholder={"Host 过滤，支持片段"}
            value={hostOnly}
          />
          <input
            className={localStyles.filterInput}
            onChange={(event) => setStatusCode(event.target.value)}
            placeholder={"状态码"}
            value={statusCode}
          />
          <select
            className={localStyles.filterInput}
            onChange={(event) => setMethod(event.target.value)}
            value={method}
          >
            <option value="">{"全部方法"}</option>
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
                ["all", "全部"],
                ["errors", "仅错误"],
                ["https", "仅 HTTPS"],
                ["debug", "调试来源"],
                ["mock", "仅模拟"],
                ["proxyForward", "仅转发"],
                ["direct", "仅直连"],
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
            <span>{"状态"}</span>
            <span>{"方法"}</span>
            <span>{"协议"}</span>
            <span>{"处理结果"}</span>
            <span>{"主机"}</span>
            <span>{"请求路径"}</span>
            <span>{"类型"}</span>
            <span>{"时间"}</span>
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
                  title={getRequestResolutionTooltip(item)}
                >
                  <span className={localStyles.resolutionGlyph} aria-hidden="true" />
                  {getRequestResolutionLabel(item)}
                </span>
                <span title={item.host}>{item.host}</span>
                <strong title={item.path}>{item.path}</strong>
                <span title={getContentType(item)}>{getContentType(item)}</span>
                <span>{item.duration} ms</span>
              </button>
            ))}

            {visibleRequests.length === 0 && requests.length > 0 ? (
              <div className={cx(localStyles.emptyCard, localStyles.compactEmpty)}>
                <h3>{"当前筛选条件下暂无结果"}</h3>
                <p>{"当前搜索覆盖 URL、Host、Path、Header、Query、请求体、响应体、处理结果；试试清空关键词或切换查看范围。"}</p>
              </div>
            ) : null}

            {requests.length === 0 ? (
              <div className={localStyles.emptyCard}>
                <h3>{"还没有抓到请求"}</h3>
                <p>{"先打开代理，再刷新目标页面，请求会自动出现在这里。"}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


