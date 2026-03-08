import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { RequestRecord } from "@polaris/shared-types";
import { buildCurl } from "../../features/common/curl";
import { JsonBlock } from "../../features/common/JsonBlock";
import { KeyValueBlock } from "../../features/common/KeyValueBlock";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { apiClient } from "../../services/apiClient";

const refreshIntervalMs = 3000;

type TrafficFocusMode = "all" | "errors" | "https" | "debug";
type TrafficInspectorTab = "overview" | "timeline" | "composer" | "tools";

function formatRequestTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStatusTone(statusCode: number) {
  if (statusCode >= 500) {
    return "danger";
  }
  if (statusCode >= 400) {
    return "warning";
  }
  if (statusCode >= 300) {
    return "muted";
  }
  return "success";
}

function getProtocolLabel(item: RequestRecord) {
  return item.secure ? "HTTPS" : "HTTP";
}

function getContentType(item: RequestRecord) {
  const contentType =
    item.responseHeaders["content-type"] ??
    item.responseHeaders["Content-Type"];
  return typeof contentType === "string" ? contentType : "-";
}

export function TrafficPage() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [method, setMethod] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [hostOnly, setHostOnly] = useState("");
  const [focusMode, setFocusMode] = useState<TrafficFocusMode>("all");
  const [inspectorTab, setInspectorTab] =
    useState<TrafficInspectorTab>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>();
  const [message, setMessage] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const navigate = useNavigate();
  const { t } = useConsoleI18n();
  const latestLoadId = useRef(0);
  const recordBodyRef = useRef<HTMLDivElement | null>(null);
  const inspectorBodyRef = useRef<HTMLDivElement | null>(null);
  const previousVisibleCountRef = useRef(0);
  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const buildParams = () => {
    const params = new URLSearchParams();
    if (deferredKeyword) {
      params.set("keyword", deferredKeyword);
    }
    if (method) {
      params.set("method", method);
    }
    if (statusCode) {
      params.set("statusCode", statusCode);
    }
    if (hostOnly) {
      params.set("host", hostOnly);
    }
    return params;
  };

  const load = async () => {
    const loadId = ++latestLoadId.current;
    setIsLoading(true);
    try {
      const nextRequests = await apiClient.listRequests(buildParams());
      if (loadId !== latestLoadId.current) {
        return;
      }
      nextRequests.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      );
      setRequests(nextRequests);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      if (loadId === latestLoadId.current) {
        console.error(error);
      }
    } finally {
      if (loadId === latestLoadId.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [deferredKeyword, method, statusCode, hostOnly]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = window.setInterval(() => {
      load().catch(console.error);
    }, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [autoRefresh, deferredKeyword, method, statusCode, hostOnly]);

  const visibleRequests = useMemo(() => {
    switch (focusMode) {
      case "errors":
        return requests.filter((item) => item.statusCode >= 400);
      case "https":
        return requests.filter((item) => item.secure);
      case "debug":
        return requests.filter((item) => item.source === "debug");
      default:
        return requests;
    }
  }, [focusMode, requests]);

  useEffect(() => {
    if (visibleRequests.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (
      !selectedId ||
      !visibleRequests.some((item) => item.id === selectedId)
    ) {
      setSelectedId(visibleRequests[visibleRequests.length - 1].id);
    }
  }, [selectedId, visibleRequests]);

  const selected = useMemo(
    () =>
      visibleRequests.find((item) => item.id === selectedId) ??
      visibleRequests[visibleRequests.length - 1],
    [visibleRequests, selectedId],
  );

  useEffect(() => {
    setInspectorTab("overview");
  }, [selected?.id]);

  useLayoutEffect(() => {
    if (!inspectorBodyRef.current) {
      return;
    }
    inspectorBodyRef.current.scrollTop = 0;
  }, [selected?.id, inspectorTab]);

  useEffect(() => {
    const nextCount = visibleRequests.length;
    if (nextCount === 0) {
      previousVisibleCountRef.current = 0;
      return;
    }

    if (nextCount > previousVisibleCountRef.current && recordBodyRef.current) {
      recordBodyRef.current.scrollTop = recordBodyRef.current.scrollHeight;
    }

    previousVisibleCountRef.current = nextCount;
  }, [visibleRequests.length]);

  const summary = useMemo(() => {
    const errorCount = visibleRequests.filter(
      (item) => item.statusCode >= 400,
    ).length;
    const secureCount = visibleRequests.filter((item) => item.secure).length;
    const avgDuration = visibleRequests.length
      ? Math.round(
          visibleRequests.reduce((total, item) => total + item.duration, 0) /
            visibleRequests.length,
        )
      : 0;

    return {
      total: visibleRequests.length,
      errorCount,
      secureCount,
      avgDuration,
    };
  }, [visibleRequests]);

  const saveSelected = async () => {
    if (!selected) {
      return;
    }
    const name = window.prompt(
      t("common.savePrompt"),
      `${selected.method} ${selected.path}`,
    );
    if (!name) {
      return;
    }
    await apiClient.saveCapturedRequest(selected.id, { name });
    setMessage(t("common.savedRequest", { name }));
  };

  const replaySelected = async () => {
    if (!selected) {
      return;
    }
    const replayed = await apiClient.replayCapturedRequest(selected.id);
    setMessage(t("common.replayedRequest", { status: replayed.statusCode }));
    await load();
  };

  const createMockFromSelected = () => {
    if (!selected) {
      return;
    }
    navigate("/rules", {
      state: {
        seedRequest: selected,
        mode: "mock",
      },
    });
  };

  const createRoutingRuleFromSelected = (action: "proxy" | "direct") => {
    if (!selected) {
      return;
    }
    navigate("/rules", {
      state: {
        seedRequest: selected,
        mode: "proxy",
        suggestedAction: action,
      },
    });
  };

  const copyCurl = async () => {
    if (!selected) {
      return;
    }
    await navigator.clipboard.writeText(buildCurl(selected));
    setMessage(t("common.curlCopied"));
  };

  const openInDebug = () => {
    if (!selected) {
      return;
    }
    navigate("/debug", {
      state: {
        draft: {
          name: `${selected.method} ${selected.path}`,
          method: selected.method,
          url: selected.url,
          body: selected.requestBody,
        },
      },
    });
  };

  return (
    <div className="page-stack traffic-page-shell">
      <section className="traffic-scene-header">
        <div className="traffic-scene-copy">
          <span className="feature-badge traffic-scene-badge">
            {t("traffic.title")}
          </span>
          <h2>{t("traffic.sceneTitle")}</h2>
          <p>{t("traffic.sceneBody")}</p>
        </div>
        <div className="traffic-scene-metrics">
          <div className="traffic-scene-metric">
            <span>{t("traffic.metric.visible")}</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="traffic-scene-metric">
            <span>{t("traffic.metric.errors")}</span>
            <strong>{summary.errorCount}</strong>
          </div>
          <div className="traffic-scene-metric">
            <span>{t("traffic.metric.https")}</span>
            <strong>{summary.secureCount}</strong>
          </div>
        </div>
      </section>

      <section className="traffic-toolbar-strip panel">
        <div className="traffic-toolbar-primary">
          <div className="traffic-toolbar-group traffic-toolbar-group-emphasis">
            <span className="traffic-toolbar-label">
              {t("traffic.toolbar.capture")}
            </span>
            <button
              className={`traffic-button traffic-toolbar-mode ${autoRefresh ? "traffic-button-primary" : "traffic-button-secondary"}`}
              onClick={() => setAutoRefresh((current) => !current)}
              type="button"
            >
              {autoRefresh
                ? t("traffic.toolbar.recording")
                : t("traffic.toolbar.paused")}
            </button>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={() => setRequests([])}
              disabled={requests.length === 0}
              type="button"
            >
              {t("traffic.toolbar.clear")}
            </button>
          </div>

          <div className="traffic-toolbar-group">
            <span className="traffic-toolbar-label">
              {t("traffic.toolbar.assets")}
            </span>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={saveSelected}
              disabled={!selected}
              type="button"
            >
              {t("traffic.action.save")}
            </button>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={() => navigate("/requests")}
              type="button"
            >
              {t("traffic.toolbar.import")}
            </button>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={() =>
                navigator.clipboard
                  .writeText(JSON.stringify(visibleRequests, null, 2))
                  .then(() => setMessage(t("traffic.exported")))
              }
              disabled={visibleRequests.length === 0}
              type="button"
            >
              {t("traffic.toolbar.export")}
            </button>
          </div>

          <div className="traffic-toolbar-group">
            <span className="traffic-toolbar-label">
              {t("traffic.toolbar.actions")}
            </span>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={replaySelected}
              disabled={!selected}
              type="button"
            >
              {t("traffic.action.replay")}
            </button>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={openInDebug}
              disabled={!selected}
              type="button"
            >
              {t("traffic.action.debug")}
            </button>
            <button
              className="traffic-button traffic-toolbar-button"
              onClick={() => navigate("/rules")}
              type="button"
            >
              {t("nav.rules")}
            </button>
          </div>
        </div>
        <div className="traffic-toolbar-status">
          <span className={`status-dot ${isLoading ? "" : "online"}`} />
          <strong>{t("traffic.liveState")}</strong>
          <small>
            {lastUpdatedAt
              ? t("traffic.lastUpdated", {
                  time: formatRequestTime(lastUpdatedAt),
                })
              : t("traffic.feedBody")}
          </small>
        </div>
      </section>

      {message ? <div className="panel banner-panel">{message}</div> : null}

      <section className="traffic-shell-v2">
        <section className="panel traffic-grid-panel">
          <div className="traffic-table-toolbar">
            <div className="traffic-filter-row">
              <input
                className="traffic-filter-input"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t("traffic.searchPlaceholder")}
              />
              <input
                className="traffic-filter-input"
                value={hostOnly}
                onChange={(event) => setHostOnly(event.target.value)}
                placeholder={t("traffic.hostPlaceholder")}
              />
              <input
                className="traffic-filter-input"
                value={statusCode}
                onChange={(event) => setStatusCode(event.target.value)}
                placeholder={t("traffic.statusPlaceholder")}
              />
              <select
                className="traffic-filter-input"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
              >
                <option value="">{t("traffic.allMethods")}</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="traffic-filter-row traffic-filter-row-secondary">
              <div className="segmented-control">
                {(
                  [
                    ["all", t("traffic.focus.all")],
                    ["errors", t("traffic.focus.errors")],
                    ["https", t("traffic.focus.https")],
                    ["debug", t("traffic.focus.debug")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    className={focusMode === value ? "active" : ""}
                    onClick={() => setFocusMode(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="traffic-table-metrics">
                <span>
                  {t("traffic.metric.visible")} {summary.total}
                </span>
                <span>
                  {t("traffic.metric.errors")} {summary.errorCount}
                </span>
                <span>
                  {t("traffic.metric.https")} {summary.secureCount}
                </span>
                <span>
                  {t("traffic.metric.avgDuration")} {summary.avgDuration} ms
                </span>
              </div>
            </div>
          </div>

          <div className="traffic-record-table">
            <div className="traffic-record-header">
              <span>#</span>
              <span>{t("traffic.column.status")}</span>
              <span>{t("traffic.column.method")}</span>
              <span>{t("traffic.column.protocol")}</span>
              <span>{t("traffic.column.host")}</span>
              <span>{t("traffic.column.path")}</span>
              <span>{t("traffic.column.type")}</span>
              <span>{t("traffic.column.time")}</span>
            </div>
            <div className="traffic-record-body" ref={recordBodyRef}>
              {visibleRequests.map((item, index) => (
                <button
                  key={item.id}
                  className={`traffic-record-row ${selected?.id === item.id ? "active" : ""} ${item.statusCode >= 400 ? "warning-row" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <span>{index + 1}</span>
                  <span
                    className={`traffic-status-cell ${getStatusTone(item.statusCode)}`}
                  >
                    {item.statusCode}
                  </span>
                  <span>{item.method}</span>
                  <span>{getProtocolLabel(item)}</span>
                  <span title={item.host}>{item.host}</span>
                  <strong title={item.path}>{item.path}</strong>
                  <span title={getContentType(item)}>
                    {getContentType(item)}
                  </span>
                  <span>{item.duration} ms</span>
                </button>
              ))}
              {visibleRequests.length === 0 && requests.length > 0 && (
                <div className="empty-card compact-empty">
                  <h3>{t("traffic.emptyFilteredTitle")}</h3>
                  <p>{t("traffic.emptyFilteredBody")}</p>
                </div>
              )}
              {requests.length === 0 && (
                <div className="empty-card">
                  <h3>{t("traffic.noTrafficTitle")}</h3>
                  <p>{t("traffic.noTrafficBody")}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="panel traffic-inspector-panel-v2">
          <div className="traffic-inspector-tabs">
            {(
              [
                ["overview", t("traffic.tab.overview")],
                ["timeline", t("traffic.tab.timeline")],
                ["composer", t("traffic.tab.composer")],
                ["tools", t("traffic.tab.tools")],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                className={inspectorTab === tab ? "active" : ""}
                onClick={() => setInspectorTab(tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {!selected ? (
            <div className="traffic-empty-inspector">
              <div className="traffic-empty-inspector-hero">
                <span className="feature-badge">
                  {t("traffic.emptyInspectorBadge")}
                </span>
                <h3>{t("detail.noneTitle")}</h3>
                <p>{t("traffic.emptyInspectorBody")}</p>
              </div>
              <div className="traffic-empty-inspector-grid">
                <div className="traffic-empty-module">
                  <span>{t("traffic.tab.overview")}</span>
                  <strong>{t("traffic.emptyModule.overview")}</strong>
                  <small>{t("traffic.emptyModule.overviewBody")}</small>
                </div>
                <div className="traffic-empty-module">
                  <span>{t("traffic.tab.timeline")}</span>
                  <strong>{t("traffic.emptyModule.timeline")}</strong>
                  <small>{t("traffic.emptyModule.timelineBody")}</small>
                </div>
                <div className="traffic-empty-module">
                  <span>{t("traffic.tab.tools")}</span>
                  <strong>{t("traffic.emptyModule.tools")}</strong>
                  <small>{t("traffic.emptyModule.toolsBody")}</small>
                </div>
              </div>
            </div>
          ) : null}

          {selected ? (
            <section className="traffic-inspector-context">
              <div className="traffic-inspector-context-main">
                <div className="traffic-inspector-context-top">
                  <span
                    className={`method-badge method-${selected.method.toLowerCase()}`}
                  >
                    {selected.method}
                  </span>
                  <strong title={selected.path}>{selected.path}</strong>
                  <span className="traffic-inspector-context-separator">·</span>
                  <span
                    className="traffic-inspector-context-host"
                    title={selected.host}
                  >
                    {selected.host}
                  </span>
                </div>
              </div>
              <div className="traffic-inspector-context-actions">
                <button
                  className="traffic-button traffic-button-secondary"
                  onClick={copyCurl}
                  type="button"
                >
                  {t("traffic.action.curl")}
                </button>
                <button
                  className="traffic-button traffic-button-primary"
                  onClick={openInDebug}
                  type="button"
                >
                  {t("traffic.action.debug")}
                </button>
              </div>
            </section>
          ) : null}

          {selected && inspectorTab === "overview" ? (
            <div className="traffic-inspector-stack" ref={inspectorBodyRef}>
              <section className="traffic-inspector-rich">
                <div className="traffic-inspector-rich-head">
                  <strong>{t("detail.title")}</strong>
                  <span>
                    {selected.method} {selected.path}
                  </span>
                </div>
                <div className="traffic-inspector-facts">
                  <div className="traffic-inspector-fact-row">
                    <span>URL</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.url}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(selected.url)}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.method")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.method}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(selected.method)}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.protocol")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{getProtocolLabel(selected)}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() =>
                          void copyText(getProtocolLabel(selected))
                        }
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.status")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.statusCode}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() =>
                          void copyText(String(selected.statusCode))
                        }
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.host")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.host}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(selected.host)}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.path")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.path}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(selected.path)}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("traffic.column.type")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{getContentType(selected)}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(getContentType(selected))}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("detail.source")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.source.toUpperCase()}</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() =>
                          void copyText(selected.source.toUpperCase())
                        }
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("detail.duration")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>{selected.duration} ms</strong>
                      <button
                        className="inline-copy-button"
                        onClick={() => void copyText(`${selected.duration} ms`)}
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                  <div className="traffic-inspector-fact-row">
                    <span>{t("detail.capturedAt")}</span>
                    <div className="traffic-inspector-fact-value">
                      <strong>
                        {new Date(selected.createdAt).toLocaleString()}
                      </strong>
                      <button
                        className="inline-copy-button"
                        onClick={() =>
                          void copyText(
                            new Date(selected.createdAt).toLocaleString(),
                          )
                        }
                        type="button"
                      >
                        {t("json.copy")}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              <section className="traffic-inspector-section">
                <KeyValueBlock
                  title={t("detail.queryParams")}
                  value={selected.requestQuery}
                />
              </section>
              <section className="traffic-inspector-section">
                <KeyValueBlock
                  title={t("detail.requestHeaders")}
                  value={selected.requestHeaders}
                />
              </section>
              <section className="traffic-inspector-section">
                <KeyValueBlock
                  title={t("detail.responseHeaders")}
                  value={selected.responseHeaders}
                  copyMode="row"
                />
              </section>
              <div className="traffic-inspector-body-stack">
                <section className="traffic-inspector-section">
                  <JsonBlock
                    title={t("detail.requestBody")}
                    value={selected.requestBody}
                  />
                </section>
                <section className="traffic-inspector-section">
                  <JsonBlock
                    title={t("detail.responseBody")}
                    value={selected.responseBody}
                  />
                </section>
              </div>
            </div>
          ) : null}

          {selected && inspectorTab === "timeline" ? (
            <div className="traffic-inspector-stack" ref={inspectorBodyRef}>
              <div className="traffic-timeline">
                <div className="traffic-timeline-item active">
                  <span className="traffic-timeline-dot" />
                  <div className="traffic-timeline-content">
                    <div className="list-row">
                      <strong>{t("traffic.timeline.request")}</strong>
                      <span className="status-badge muted">
                        {formatRequestTime(selected.createdAt)}
                      </span>
                    </div>
                    <p>{t("traffic.timeline.requestBody")}</p>
                  </div>
                </div>
                <div className="traffic-timeline-item">
                  <span className="traffic-timeline-dot" />
                  <div className="traffic-timeline-content">
                    <div className="list-row">
                      <strong>{t("traffic.timeline.transfer")}</strong>
                      <span className="status-badge muted">
                        {selected.duration} ms
                      </span>
                    </div>
                    <p>
                      {t("traffic.timeline.transferBody", {
                        duration: selected.duration,
                      })}
                    </p>
                  </div>
                </div>
                <div className="traffic-timeline-item">
                  <span className="traffic-timeline-dot" />
                  <div className="traffic-timeline-content">
                    <div className="list-row">
                      <strong>{t("traffic.timeline.response")}</strong>
                      <span
                        className={`status-badge ${getStatusTone(selected.statusCode)}`}
                      >
                        {selected.statusCode}
                      </span>
                    </div>
                    <p>
                      {t("traffic.timeline.responseBody", {
                        type: getContentType(selected),
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="traffic-timeline-stats">
                <div className="traffic-timeline-stat">
                  <span>{t("traffic.timeline.metric.total")}</span>
                  <strong>{selected.duration} ms</strong>
                </div>
                <div className="traffic-timeline-stat">
                  <span>{t("traffic.timeline.metric.protocol")}</span>
                  <strong>{getProtocolLabel(selected)}</strong>
                </div>
                <div className="traffic-timeline-stat">
                  <span>{t("traffic.timeline.metric.source")}</span>
                  <strong>{selected.source.toUpperCase()}</strong>
                </div>
              </div>
            </div>
          ) : null}

          {selected && inspectorTab === "composer" ? (
            <div className="traffic-inspector-stack" ref={inspectorBodyRef}>
              <div className="traffic-composer-card">
                <div className="traffic-composer-head">
                  <div>
                    <span>{t("traffic.composerTitle")}</span>
                    <strong>
                      {selected.method} {selected.path}
                    </strong>
                  </div>
                  <span className="status-badge muted">{selected.host}</span>
                </div>
                <p>{t("traffic.composerBody")}</p>
                <div className="traffic-composer-preview">
                  <div>
                    <span>{t("traffic.column.method")}</span>
                    <strong>{selected.method}</strong>
                  </div>
                  <div>
                    <span>{t("traffic.column.host")}</span>
                    <strong>{selected.host}</strong>
                  </div>
                  <div>
                    <span>{t("traffic.column.path")}</span>
                    <strong>{selected.path}</strong>
                  </div>
                </div>
              </div>
              <div className="traffic-action-panel-grid">
                <button
                  className="traffic-button traffic-button-primary"
                  onClick={openInDebug}
                  type="button"
                >
                  {t("traffic.action.debug")}
                </button>
                <button
                  className="traffic-button traffic-button-secondary"
                  onClick={replaySelected}
                  type="button"
                >
                  {t("traffic.action.replay")}
                </button>
                <button
                  className="traffic-button traffic-button-secondary"
                  onClick={copyCurl}
                  type="button"
                >
                  {t("traffic.action.curl")}
                </button>
                <button
                  className="traffic-button traffic-button-secondary"
                  onClick={saveSelected}
                  type="button"
                >
                  {t("traffic.action.save")}
                </button>
              </div>
            </div>
          ) : null}

          {selected && inspectorTab === "tools" ? (
            <div className="traffic-inspector-stack" ref={inspectorBodyRef}>
              <div className="traffic-tool-card traffic-tool-card-primary">
                <div className="list-row">
                  <strong>{t("traffic.ruleActions")}</strong>
                  <span className="status-badge muted">{selected.host}</span>
                </div>
                <p>{t("traffic.ruleActionsBody")}</p>
                <div className="traffic-action-panel-grid">
                  <button
                    className="traffic-button traffic-button-primary"
                    onClick={createMockFromSelected}
                    type="button"
                  >
                    {t("traffic.action.mock")}
                  </button>
                  <button
                    className="traffic-button traffic-button-secondary"
                    onClick={() => createRoutingRuleFromSelected("proxy")}
                    type="button"
                  >
                    {t("traffic.action.routeProxy")}
                  </button>
                  <button
                    className="traffic-button traffic-button-secondary"
                    onClick={() => createRoutingRuleFromSelected("direct")}
                    type="button"
                  >
                    {t("traffic.action.routeDirect")}
                  </button>
                  <button
                    className="traffic-button traffic-button-tertiary"
                    onClick={() => navigate("/rules")}
                    type="button"
                  >
                    {t("traffic.action.openRules")}
                  </button>
                </div>
              </div>
              <div className="traffic-tool-grid">
                <div className="traffic-tool-card">
                  <div className="list-row">
                    <strong>{t("traffic.tools.assetTitle")}</strong>
                    <span className="feature-badge">
                      {t("traffic.tools.assetBadge")}
                    </span>
                  </div>
                  <p>{t("traffic.tools.assetBody")}</p>
                  <div className="traffic-action-panel-grid compact">
                    <button
                      className="traffic-button traffic-button-secondary"
                      onClick={saveSelected}
                      type="button"
                    >
                      {t("traffic.action.save")}
                    </button>
                    <button
                      className="traffic-button traffic-button-secondary"
                      onClick={copyCurl}
                      type="button"
                    >
                      {t("traffic.action.curl")}
                    </button>
                  </div>
                </div>

                <div className="traffic-tool-card">
                  <div className="list-row">
                    <strong>{t("traffic.diagnosisTitle")}</strong>
                    <span
                      className={`status-badge ${selected.secure ? "success" : "muted"}`}
                    >
                      {selected.secure ? "TLS" : "HTTP"}
                    </span>
                  </div>
                  <div className="meta-list compact">
                    <div>
                      <span>{t("traffic.diagnosis.host")}</span>
                      <strong>{selected.host}</strong>
                    </div>
                    <div>
                      <span>{t("traffic.diagnosis.source")}</span>
                      <strong>{selected.source.toUpperCase()}</strong>
                    </div>
                    <div>
                      <span>{t("traffic.diagnosis.duration")}</span>
                      <strong>{selected.duration} ms</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  );
}
