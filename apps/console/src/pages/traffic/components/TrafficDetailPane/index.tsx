import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import { uiSelectors } from "../../../../stores/selectors";
import { useUiStore } from "../../../../stores/uiStore";
import localStyles from "./index.module.less";
import { cx } from "../../utils/trafficFormatters";
import { TrafficComposerTab } from "../TrafficComposerTab";
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

type TrafficDetailPaneProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  selected?: RequestRecord;
  onCopyCurl: () => void;
  onCopyText: (value: string) => Promise<void>;
  onCreateMock: () => void;
  onOpenDebug: () => void;
  onOpenMockPage: () => void;
  onReplay: () => void;
  t: TranslateFn;
};

export function TrafficDetailPane({
  inspectorBodyRef,
  selected,
  onCopyCurl,
  onCopyText,
  onCreateMock,
  onOpenDebug,
  onOpenMockPage,
  onReplay,
  t,
}: TrafficDetailPaneProps) {
  const inspectorTab = useUiStore(uiSelectors.trafficInspectorTab);
  const setInspectorTab = useUiStore((state) => state.setTrafficInspectorTab);

  return (
    <section className={cx(localStyles.surface, localStyles.detailPane, localStyles.root)}>
      <div className={localStyles.detailTabs}>
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
            className={cx(
              localStyles.detailTabButton,
              inspectorTab === tab && localStyles.detailTabButtonActive,
            )}
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
            <span className={localStyles.featureBadge}>{t("traffic.emptyInspectorBadge")}</span>
            <h3>{t("detail.noneTitle")}</h3>
            <p>{t("traffic.emptyInspectorBody")}</p>
          </div>
          <div className={localStyles.detailEmptyGrid}>
            {(
              [
                ["traffic.tab.overview", "traffic.emptyModule.overview", "traffic.emptyModule.overviewBody"],
                ["traffic.tab.timeline", "traffic.emptyModule.timeline", "traffic.emptyModule.timelineBody"],
                ["traffic.tab.tools", "traffic.emptyModule.tools", "traffic.emptyModule.toolsBody"],
              ] as const
            ).map(([labelKey, titleKey, bodyKey]) => (
              <div className={localStyles.detailEmptyCard} key={labelKey}>
                <span>{t(labelKey)}</span>
                <strong>{t(titleKey)}</strong>
                <small>{t(bodyKey)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <section className={localStyles.detailContext}>
          <div className={localStyles.detailContextMain}>
            <div className={localStyles.detailContextTop}>
              <span
                className={cx(
                  localStyles.methodBadge,
                  methodBadgeClassMap[selected.method as keyof typeof methodBadgeClassMap],
                )}
              >
                {selected.method}
              </span>
              <strong title={selected.path}>{selected.path}</strong>
              <span className={localStyles.detailContextSeparator}>·</span>
              <span className={localStyles.detailContextHost} title={selected.host}>
                {selected.host}
              </span>
            </div>
          </div>
          <div className={localStyles.detailContextActions}>
            <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
              {t("traffic.action.curl")}
            </button>
            <button className={cx(localStyles.button, localStyles.buttonPrimary)} onClick={onOpenDebug} type="button">
              {t("traffic.action.debug")}
            </button>
          </div>
        </section>
      ) : null}

      {selected && inspectorTab === "overview" ? (
        <TrafficOverviewTab
          inspectorBodyRef={inspectorBodyRef}
          onCopyText={onCopyText}
          selected={selected}
          t={t}
        />
      ) : null}
      {selected && inspectorTab === "timeline" ? (
        <TrafficTimelineTab inspectorBodyRef={inspectorBodyRef} selected={selected} t={t} />
      ) : null}
      {selected && inspectorTab === "composer" ? (
        <TrafficComposerTab
          inspectorBodyRef={inspectorBodyRef}
          onCopyCurl={onCopyCurl}
          onCreateMock={onCreateMock}
          onOpenDebug={onOpenDebug}
          onReplay={onReplay}
          selected={selected}
          t={t}
        />
      ) : null}
      {selected && inspectorTab === "tools" ? (
        <TrafficToolsTab
          inspectorBodyRef={inspectorBodyRef}
          onCopyCurl={onCopyCurl}
          onCreateMock={onCreateMock}
          onOpenDebug={onOpenDebug}
          onOpenMockPage={onOpenMockPage}
          selected={selected}
          t={t}
        />
      ) : null}
    </section>
  );
}
