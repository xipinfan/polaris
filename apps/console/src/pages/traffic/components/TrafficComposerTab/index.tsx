import type { RequestRecord } from "@polaris/shared-types";
import type { RefObject } from "react";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import localStyles from "./index.module.less";
import { cx } from "../../utils/trafficFormatters";

type TrafficComposerTabProps = {
  inspectorBodyRef: RefObject<HTMLDivElement | null>;
  onCopyCurl: () => void;
  onCreateMock: () => void;
  onOpenDebug: () => void;
  onReplay: () => void;
  selected: RequestRecord;
  t: TranslateFn;
};

export function TrafficComposerTab({
  inspectorBodyRef,
  onCopyCurl,
  onCreateMock,
  onOpenDebug,
  onReplay,
  selected,
  t,
}: TrafficComposerTabProps) {
  return (
    <div className={cx(localStyles.detailScroll, localStyles.root)} ref={inspectorBodyRef}>
      <div className={localStyles.composerCard}>
        <div className={localStyles.composerHead}>
          <div>
            <span>{t("traffic.composerTitle")}</span>
            <strong>{selected.method} {selected.path}</strong>
          </div>
          <span className={cx(localStyles.statusBadge, localStyles.statusBadgeMuted)}>{selected.host}</span>
        </div>
        <p>{t("traffic.composerBody")}</p>
        <div className={localStyles.composerPreview}>
          <div className={localStyles.composerPreviewRow}>
            <span>{t("traffic.column.method")}</span>
            <strong>{selected.method}</strong>
          </div>
          <div className={localStyles.composerPreviewRow}>
            <span>{t("traffic.column.host")}</span>
            <strong>{selected.host}</strong>
          </div>
          <div className={localStyles.composerPreviewRow}>
            <span>{t("traffic.column.path")}</span>
            <strong>{selected.path}</strong>
          </div>
        </div>
      </div>
      <div className={localStyles.actionGrid}>
        <button className={cx(localStyles.button, localStyles.buttonPrimary)} onClick={onOpenDebug} type="button">
          {t("traffic.action.debug")}
        </button>
        <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onReplay} type="button">
          {t("traffic.action.replay")}
        </button>
        <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyCurl} type="button">
          {t("traffic.action.curl")}
        </button>
        <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCreateMock} type="button">
          {t("traffic.action.mock")}
        </button>
      </div>
    </div>
  );
}


