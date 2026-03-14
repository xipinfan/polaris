import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import localStyles from "./index.module.less";
import { cx } from "../../utils/trafficFormatters";

type TrafficToolsTabProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  onCopyCurl: () => void;
  onCreateMock: () => void;
  onOpenDebug: () => void;
  onOpenMockPage: () => void;
  selected: RequestRecord;
  t: TranslateFn;
};

export function TrafficToolsTab({
  inspectorBodyRef,
  onCopyCurl,
  onCreateMock,
  onOpenDebug,
  onOpenMockPage,
  selected,
  t,
}: TrafficToolsTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <div className={cx(localStyles.toolCard, localStyles.toolCardMuted)}>
        <div className={localStyles.listRow}>
          <strong>{t("mock.title")}</strong>
          <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>{selected.host}</span>
        </div>
        <div className={localStyles.actionGrid}>
          <button className={cx(localStyles.button, localStyles.buttonPrimary)} onClick={onCreateMock} type="button">
            {t("traffic.action.mock")}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
            {t("traffic.action.curl")}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onOpenDebug} type="button">
            {t("traffic.action.debug")}
          </button>
          <button className={cx(localStyles.button, localStyles.buttonTertiary)} onClick={onOpenMockPage} type="button">
            {t("nav.mock")}
          </button>
        </div>
      </div>

      <div className={localStyles.toolPanelGrid}>
        <div className={cx(localStyles.toolCard, localStyles.toolCardStack)}>
          <div className={localStyles.listRow}>
            <strong>{t("mock.variantsTitle")}</strong>
            <span className={localStyles.featureBadge}>{t("nav.mock")}</span>
          </div>
          <p>{t("mock.workflowBody")}</p>
          <div className={cx(localStyles.actionGrid, localStyles.compactActionGrid)}>
            <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCreateMock} type="button">
              {t("traffic.action.mock")}
            </button>
            <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
              {t("traffic.action.curl")}
            </button>
          </div>
        </div>

        <div className={cx(localStyles.toolCard, localStyles.toolCardStack)}>
          <div className={localStyles.listRow}>
            <strong>{t("traffic.diagnosisTitle")}</strong>
            <span className={cx(localStyles.statusBadge, selected.secure ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted)}>
              {selected.secure ? "TLS" : "HTTP"}
            </span>
          </div>
          <div className={cx(localStyles.metaList, localStyles.metaListCompact)}>
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
  );
}


