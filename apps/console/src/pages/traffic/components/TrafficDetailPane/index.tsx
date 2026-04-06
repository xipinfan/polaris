import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import { uiSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import localStyles from "./index.module.less";
import {
  cx,
  getRequestResolutionLabel,
  getRequestResolutionMode,
  getRequestResolutionTooltip,
} from "../../utils/trafficFormatters";
import { TrafficOverviewTab } from "../TrafficOverviewTab";
import { TrafficTimelineTab } from "../TrafficTimelineTab";
import { TrafficToolsTab } from "../TrafficToolsTab";

const methodBadgeClassMap = {
  GET: localStyles.methodGet,
  POST: localStyles.methodPost,
  PUT: localStyles.methodPut,
  PATCH: localStyles.methodPatch,
  DELETE: localStyles.methodDelete,
};

const resolutionBadgeClassMap = {
  mock: localStyles.resolutionBadgeMock,
  proxy_forward: localStyles.resolutionBadgeProxyForward,
  direct: localStyles.resolutionBadgeDirect,
  block: localStyles.resolutionBadgeBlock,
  error: localStyles.resolutionBadgeError,
  unknown: localStyles.resolutionBadgeUnknown,
};

const emptyCards = [
  {
    key: "overview",
    label: "总览",
    title: "查看请求摘要",
    body: "快速查看方法、状态、Host、Header 和 Body。",
  },
  {
    key: "timeline",
    label: "时间线",
    title: "梳理请求阶段",
    body: "按时间顺序检查请求、传输和响应阶段。",
  },
  {
    key: "tools",
    label: "工具",
    title: "执行后续动作",
    body: "复制 curl、创建模拟或带入调试继续处理。",
  },
] as const;

type TrafficDetailPaneProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  selected?: RequestRecord;
  onCopyCurl: () => void;
  onCopyText: (value: string) => Promise<void>;
  onCreateMock: () => void;
  onOpenDebug: () => void;
  onOpenMockPage: () => void;
  onReplay: () => void;
};

export function TrafficDetailPane({
  inspectorBodyRef,
  selected,
  onCopyCurl,
  onCopyText,
  onCreateMock,
  onOpenDebug,
  onOpenMockPage,
}: TrafficDetailPaneProps) {
  const inspectorTab = useUiStore(uiSelectors.trafficInspectorTab);
  const setInspectorTab = useUiStore((state) => state.setTrafficInspectorTab);

  return (
    <section className={cx(localStyles.surface, localStyles.detailPane, localStyles.root)}>
      <div className={localStyles.detailTabs}>
        {([
          ["overview", "总览"],
          ["timeline", "时间线"],
          ["tools", "工具"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            className={cx(localStyles.detailTabButton, inspectorTab === tab && localStyles.detailTabButtonActive)}
            onClick={() => setInspectorTab(tab)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {!selected ? (
        <div className={localStyles.detailEmptyState}>
          <div className={localStyles.detailEmptyHero}>
            <span className={localStyles.featureBadge}>{"等待会话"}</span>
            <h3>{"等待选择请求"}</h3>
            <p>{"选中一条请求后，这里会分区显示总览、时间线与规则工具。"}</p>
          </div>
          <div className={localStyles.detailEmptyGrid}>
            {emptyCards.map((item) => (
              <div className={localStyles.detailEmptyCard} key={item.key}>
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <section className={localStyles.detailContext}>
          <div className={localStyles.detailContextUrl}>
            <span className={cx(localStyles.methodBadge, methodBadgeClassMap[selected.method as keyof typeof methodBadgeClassMap])}>
              {selected.method}
            </span>
            <strong title={selected.path}>{selected.path}</strong>
          </div>
          <div className={localStyles.detailContextMeta}>
            <span className={localStyles.detailContextHost} title={selected.host}>
              {selected.host}
            </span>
            <span
              className={cx(localStyles.resolutionBadge, resolutionBadgeClassMap[getRequestResolutionMode(selected)])}
              title={getRequestResolutionTooltip(selected)}
            >
              <span className={localStyles.resolutionGlyph} aria-hidden="true" />
              {getRequestResolutionLabel(selected)}
            </span>
            <div className={localStyles.detailContextActions}>
              <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
                {"复制 curl 命令"}
              </button>
              <button className={cx(localStyles.button, localStyles.buttonPrimary)} onClick={onOpenDebug} type="button">
                {"带入调试"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {selected && inspectorTab === "overview" ? (
        <TrafficOverviewTab inspectorBodyRef={inspectorBodyRef} onCopyText={onCopyText} selected={selected} />
      ) : null}
      {selected && inspectorTab === "timeline" ? (
        <TrafficTimelineTab inspectorBodyRef={inspectorBodyRef} selected={selected} />
      ) : null}
      {selected && inspectorTab === "tools" ? (
        <TrafficToolsTab
          inspectorBodyRef={inspectorBodyRef}
          onCopyCurl={onCopyCurl}
          onCreateMock={onCreateMock}
          onOpenDebug={onOpenDebug}
          onOpenMockPage={onOpenMockPage}
          selected={selected}
        />
      ) : null}
    </section>
  );
}
