import type { AppSetting, RequestRecord } from "@polaris/shared-types";
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
  onOpenProxyGuide: () => void;
  onToggleAutoRefresh: () => void;
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
  onOpenProxyGuide,
  onToggleAutoRefresh,
}: TrafficToolbarProps) {
  return (
    <section
      className={cx(localStyles.toolbar, localStyles.surface, localStyles.root)}
    >
      <div className={localStyles.toolbarGroups}>
        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>
            {"抓取"}
          </span>
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
              ? "已安装证书"
              : "安装证书"}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            onClick={onOpenProxyGuide}
            type="button"
          >
            手机代理指南
          </button>
          <button
            className={cx(
              localStyles.button,
              localStyles.toolbarMode,
              autoRefresh
                ? localStyles.buttonPrimary
                : localStyles.buttonSecondary,
            )}
            onClick={onToggleAutoRefresh}
            type="button"
          >
            {autoRefresh
              ? "录制中"
              : "已暂停"}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={requests.length === 0}
            onClick={onClear}
            type="button"
          >
            {"清空"}
          </button>
        </div>

        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>{"模拟"}</span>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onCreateMock}
            type="button"
          >
            {"创建模拟"}
          </button>
        </div>

        <div className={localStyles.toolbarSection}>
          <span className={localStyles.toolbarCaption}>
            {"动作"}
          </span>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onReplay}
            type="button"
          >
            {"重放请求"}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            disabled={!selected}
            onClick={onOpenDebug}
            type="button"
          >
            {"带入调试"}
          </button>
          <button
            className={cx(localStyles.button, localStyles.toolbarButton)}
            onClick={onOpenMockPage}
            type="button"
          >
            {"模拟"}
          </button>
        </div>
      </div>

      <div className={localStyles.toolbarMeta}>
        <span
          className={cx(
            localStyles.statusDot,
            !isLoading && localStyles.statusDotOnline,
          )}
        />
        <strong>{"实时同步中"}</strong>
        <small>
          {lastUpdatedAt
            ? `最后刷新 ${formatRequestTime(lastUpdatedAt)}`
            : "每 3 秒自动刷新一次。"}
        </small>
      </div>
    </section>
  );
}


