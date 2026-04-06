import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import localStyles from "./index.module.less";
import { cx } from "../../utils/trafficFormatters";

type TrafficToolsTabProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  onCopyCurl: () => void;
  onCreateMock: () => void;
  onOpenDebug: () => void;
  onOpenMockPage: () => void;
  selected: RequestRecord;
};

export function TrafficToolsTab({
  inspectorBodyRef,
  onCopyCurl,
  onCreateMock,
  onOpenDebug,
  onOpenMockPage,
  selected,
}: TrafficToolsTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <div className={cx(localStyles.toolCard, localStyles.toolCardMuted)}>
        <div className={localStyles.listRow}>
          <strong>{"模拟规则"}</strong>
          <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>{selected.host}</span>
        </div>
        <div className={localStyles.actionGrid}>
          <button className={cx(localStyles.button, localStyles.buttonPrimary)} onClick={onCreateMock} type="button">
            {"创建模拟"}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
            {"复制 curl 命令"}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onOpenDebug} type="button">
            {"带入调试"}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonTertiary)} onClick={onOpenMockPage} type="button">
            {"模拟"}
          </button>
        </div>
      </div>

      <div className={localStyles.toolPanelGrid}>
        <div className={cx(localStyles.toolCard, localStyles.toolCardStack)}>
          <div className={localStyles.listRow}>
            <strong>{"模拟方案"}</strong>
            <span className={localStyles.featureBadge}>{"模拟"}</span>
          </div>
          <p>{"先选接口分组，再选择要处理的方案，然后在右侧编辑。"}</p>
          <div className={cx(localStyles.actionGrid, localStyles.compactActionGrid)}>
            <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCreateMock} type="button">
              {"创建模拟"}
            </button>
            <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
              {"复制 curl 命令"}
            </button>
          </div>
        </div>

        <div className={cx(localStyles.toolCard, localStyles.toolCardStack)}>
          <div className={localStyles.listRow}>
            <strong>{"会话诊断"}</strong>
            <span className={cx(localStyles.statusBadge, selected.secure ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted)}>
              {selected.secure ? "TLS" : "HTTP"}
            </span>
          </div>
          <div className={cx(localStyles.metaList, localStyles.metaListCompact)}>
            <div>
              <span>{"主机"}</span>
              <strong>{selected.host}</strong>
            </div>
            <div>
              <span>{"来源"}</span>
              <strong>{selected.source.toUpperCase()}</strong>
            </div>
            <div>
              <span>{"耗时"}</span>
              <strong>{selected.duration} ms</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
