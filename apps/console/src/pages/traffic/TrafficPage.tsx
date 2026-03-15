import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { buildCurl } from "../../features/common/curl";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { toastQueryError } from "../../lib/query/queryOptions";
import { TrafficCertificateModal } from "./components/TrafficCertificateModal";
import { TrafficDetailPane } from "./components/TrafficDetailPane";
import { TrafficRequestPane } from "./components/TrafficRequestPane";
import { TrafficToolbar } from "./components/TrafficToolbar";
import { useTrafficWorkspace } from "./hooks/useTrafficWorkspace";
import styles from "./TrafficPage.module.less";
import { getCertificatePlatform } from "./utils/trafficFormatters";

export function TrafficPage() {
  const navigate = useNavigate();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const workspace = useTrafficWorkspace();

  const certificatePlatform = useMemo(() => getCertificatePlatform(), []);
  const rootCertificateUrl = workspace.settings
    ? `http://127.0.0.1:${workspace.settings.localApiPort}/api/certificates/root-ca`
    : "#";

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    showToast(t("common.copied"));
  };

  const replaySelected = async () => {
    if (!workspace.selected) {
      return;
    }
    try {
      const replayed = await workspace.replaySelectedRequest(workspace.selected.id);
      showToast(t("common.replayedRequest", { status: replayed.statusCode }));
    } catch (error) {
      toastQueryError(showToast, error, "操作失败");
    }
  };

  const createMockFromSelected = () => {
    if (!workspace.selected) {
      return;
    }
    navigate("/mock", { state: { seedRequest: workspace.selected } });
  };

  const clearRequests = async () => {
    try {
      await workspace.clearRequests();
      showToast(t("common.cleared"));
    } catch (error) {
      toastQueryError(showToast, error, "操作失败");
    }
  };

  const copyCurl = async () => {
    if (!workspace.selected) {
      return;
    }
    await navigator.clipboard.writeText(buildCurl(workspace.selected));
    showToast(t("common.curlCopied"));
  };

  const openInDebug = () => {
    if (!workspace.selected) {
      return;
    }
    navigate("/debug", {
      state: {
        draft: {
          name: `${workspace.selected.method} ${workspace.selected.path}`,
          method: workspace.selected.method,
          url: workspace.selected.url,
          body: workspace.selected.requestBody,
        },
      },
    });
  };

  return (
    <div className={styles.page}>
      <TrafficToolbar
        autoRefresh={workspace.autoRefresh}
        isLoading={workspace.isLoading}
        lastUpdatedAt={workspace.lastUpdatedAt}
        onClear={() => void clearRequests()}
        onCreateMock={createMockFromSelected}
        onOpenCertificate={() => workspace.setIsCertificateModalOpen(true)}
        onOpenDebug={openInDebug}
        onOpenMockPage={() => navigate("/mock")}
        onReplay={() => void replaySelected()}
        onToggleAutoRefresh={() => workspace.setAutoRefresh(!workspace.autoRefresh)}
        requests={workspace.requests}
        selected={workspace.selected}
        settings={workspace.settings}
        t={t}
      />

      <TrafficCertificateModal
        certificatePlatform={certificatePlatform}
        isOpen={workspace.isCertificateModalOpen}
        onClose={() => workspace.setIsCertificateModalOpen(false)}
        onCopyUrl={() => {
          void navigator.clipboard.writeText(rootCertificateUrl);
          showToast(t("traffic.certificate.copied"));
        }}
        rootCertificateUrl={rootCertificateUrl}
        settings={workspace.settings}
        t={t}
      />

      <section className={styles.workspace}>
        <TrafficRequestPane
          onSelectRequest={workspace.selectRequest}
          recordBodyRef={workspace.recordBodyRef}
          requests={workspace.requests}
          selected={workspace.selected}
          t={t}
          visibleRequests={workspace.visibleRequests}
        />

        <TrafficDetailPane
          inspectorBodyRef={workspace.inspectorBodyRef}
          onCopyCurl={() => void copyCurl()}
          onCopyText={copyText}
          onCreateMock={createMockFromSelected}
          onOpenDebug={openInDebug}
          onOpenMockPage={() => navigate("/mock")}
          onReplay={() => void replaySelected()}
          selected={workspace.selected}
          t={t}
        />
      </section>
    </div>
  );
}
