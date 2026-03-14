import type { AppSetting, RequestRecord } from "@polaris/shared-types";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
import localStyles from "./index.module.less";
import { cx, formatRequestTime } from "../../utils/trafficFormatters";

type TrafficToolbarProps = {
  autoRefresh: boolean;
  isLoading: boolean;
  lastUpdatedAt?: string;
  requests: RequestRecord[];
  selected?: RequestRecord;
  settings: AppSetting | null;
  onClear: () => void;
  onCreateMock: () => void;
  onReplay: () => void;
  onOpenDebug: () => void;
  onOpenMockPage: () => void;
  onOpenCertificate: () => void;
  onToggleAutoRefresh: () => void;
  t: TranslateFn;
};

export function TrafficToolbar({
  autoRefresh,
  isLoading,
  lastUpdatedAt,
  requests,
  selected,
  settings,
  onClear,
  onCreateMock,
  onReplay,
  onOpenDebug,
  onOpenMockPage,
  onOpenCertificate,
  onToggleAutoRefresh,
  t,
}: TrafficToolbarProps) {
  return (
    <section className={cx(localStyles.toolbar, localStyles.surface, localStyles.root)}>
      <div className={localStyles.toolbarGroups}>
        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>{t("traffic.toolbar.capture")}</span>
          <button
            className={cx(
              localStyles.button,
              settings?.certificateInstalled
                ? localStyles.buttonSecondary
                : localStyles.buttonPrimary,
            )}
            onClick={onOpenCertificate}
            type="button"
          >
            {settings?.certificateInstalled
              ? t("traffic.toolbar.certificateInstalled")
              : t("traffic.toolbar.certificate")}
          </button>
          <button
            className={cx(
              localStyles.button,
              localStyles.toolbarMode,
              autoRefresh ? localStyles.buttonPrimary : localStyles.buttonSecondary,
            )}
            onClick={onToggleAutoRefresh}
            type="button"
          >
            {autoRefresh ? t("traffic.toolbar.recording") : t("traffic.toolbar.paused")}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={requests.length === 0}
            onClick={onClear}
            type="button"
          >
            {t("traffic.toolbar.clear")}
          </button>
        </div>

        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>{t("nav.mock")}</span>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onCreateMock}
            type="button"
          >
            {t("traffic.action.mock")}
          </button>
        </div>

        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>{t("traffic.toolbar.actions")}</span>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onReplay}
            type="button"
          >
            {t("traffic.action.replay")}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onOpenDebug}
            type="button"
          >
            {t("traffic.action.debug")}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            onClick={onOpenMockPage}
            type="button"
          >
            {t("nav.mock")}
          </button>
        </div>
      </div>

      <div className={localStyles.toolbarMeta}>
        <span className={cx(localStyles.statusDot, !isLoading && localStyles.statusDotOnline)} />
        <strong>{t("traffic.liveState")}</strong>
        <small>
          {lastUpdatedAt
            ? t("traffic.lastUpdated", { time: formatRequestTime(lastUpdatedAt) })
            : t("traffic.feedBody")}
        </small>
      </div>
    </section>
  );
}


