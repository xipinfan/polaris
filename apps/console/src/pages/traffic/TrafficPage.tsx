import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildCurl } from "../../features/common/curl";
import { useToast } from "../../features/feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";
import { toastQueryError } from "../../lib/query/queryOptions";
import { copyTextToClipboard } from "../../utils/clipboard";
import { MockRuleModal } from "../mock/components/MockRuleModal";
import { useMockWorkspace } from "../mock/hooks/useMockWorkspace";
import { buildEmptyForm } from "../mock/utils/mockHelpers";
import { TrafficCertificateModal } from "./components/TrafficCertificateModal";
import { TrafficDetailPane } from "./components/TrafficDetailPane";
import { TrafficRequestPane } from "./components/TrafficRequestPane";
import { TrafficToolbar } from "./components/TrafficToolbar";
import { useTrafficWorkspace } from "./hooks/useTrafficWorkspace";
import styles from "./TrafficPage.module.less";
import { getCertificatePlatform } from "./utils/trafficFormatters";

export function TrafficPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const workspace = useTrafficWorkspace();
  const defaultGroup = t("mock.defaultGroup");
  const mockWorkspace = useMockWorkspace({
    defaultGroup,
    locationState: null,
    pathname: location.pathname,
    showToast,
    t,
  });

  const certificatePlatform = useMemo(() => getCertificatePlatform(), []);
  const rootCertificateUrl = workspace.settings
    ? `http://127.0.0.1:${workspace.settings.localApiPort}/api/certificates/root-ca`
    : "#";

  const copyText = async (value: string) => {
    try {
      await copyTextToClipboard(value);
      showToast(t("common.copied"));
    } catch {
      showToast("复制失败", "error");
    }
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
    const activeGroup = mockWorkspace.currentGroup || defaultGroup;
    mockWorkspace.setEditingId(null);
    mockWorkspace.setForm(() => ({
      ...buildEmptyForm(activeGroup),
      group: activeGroup,
      variant: `${workspace.selected.method} ${workspace.selected.path}`,
      method: workspace.selected.method,
      url: workspace.selected.url,
      requestBodyKeyMatch: "",
      responseStatus: workspace.selected.statusCode,
      responseHeaders: JSON.stringify(workspace.selected.responseHeaders ?? {}, null, 2),
      responseBody: JSON.stringify(workspace.selected.responseBody ?? {}, null, 2),
      enabled: true,
    }));
    mockWorkspace.setIsModalOpen(true);
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
    try {
      await copyTextToClipboard(buildCurl(workspace.selected));
      showToast(t("common.curlCopied"));
    } catch {
      showToast("复制失败", "error");
    }
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
          void copyTextToClipboard(rootCertificateUrl)
            .then(() => {
              showToast(t("traffic.certificate.copied"));
            })
            .catch(() => {
              showToast("复制失败", "error");
            });
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

      <MockRuleModal
        defaultGroup={defaultGroup}
        editingId={mockWorkspace.editingId}
        form={mockWorkspace.form}
        groups={mockWorkspace.groups}
        isOpen={mockWorkspace.isModalOpen}
        setForm={mockWorkspace.setForm}
        setIsOpen={mockWorkspace.setIsModalOpen}
        showToast={showToast}
        t={t}
        onSave={mockWorkspace.saveRule}
      />
    </div>
  );
}
