import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildCurl } from "../../features/common/curl";
import { useToast } from "../../features/feedback/ToastProvider";
import { getBrowserHostname } from "../../lib/browser/runtime";
import { toastQueryError } from "../../lib/query/queryOptions";
import { copyTextToClipboard } from "../../utils/clipboard";
import { MockRuleModal } from "../mock/components/MockRuleModal";
import { useMockWorkspace } from "../mock/hooks/useMockWorkspace";
import { buildEmptyForm } from "../mock/utils/mockHelpers";
import { TrafficCertificateModal } from "./components/TrafficCertificateModal";
import { TrafficDetailPane } from "./components/TrafficDetailPane";
import { TrafficProxyGuideModal } from "./components/TrafficProxyGuideModal";
import { TrafficRequestPane } from "./components/TrafficRequestPane";
import { TrafficToolbar } from "./components/TrafficToolbar";
import { useTrafficWorkspace } from "./hooks/useTrafficWorkspace";
import styles from "./TrafficPage.module.less";
import { getCertificatePlatform } from "./utils/trafficFormatters";

export function TrafficPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const workspace = useTrafficWorkspace();
  const defaultGroup = "默认组";
  const mockWorkspace = useMockWorkspace({
    defaultGroup,
    locationState: null,
    pathname: location.pathname,
    showToast,
  });
  const [isProxyGuideOpen, setIsProxyGuideOpen] = useState(false);

  const certificatePlatform = useMemo(() => getCertificatePlatform(), []);
  const browserHostname = getBrowserHostname();
  const rootCertificateUrl = workspace.settings
    ? `http://${browserHostname}:${workspace.settings.localApiPort}/api/certificates/root-ca`
    : "#";

  const copyText = async (value: string) => {
    try {
      await copyTextToClipboard(value);
      showToast("已复制到剪贴板");
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
      showToast(`已重放请求，状态码 ${replayed.statusCode}`);
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
      requestBodyExactMatch: "",
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
      showToast("已清空实时请求");
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
      showToast("已复制 curl 命令");
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
        onOpenProxyGuide={() => setIsProxyGuideOpen(true)}
        onOpenDebug={openInDebug}
        onOpenMockPage={() => navigate("/mock")}
        onReplay={() => void replaySelected()}
        onToggleAutoRefresh={() => workspace.setAutoRefresh(!workspace.autoRefresh)}
        requests={workspace.requests}
        selected={workspace.selected}
        settings={workspace.settings}
      />

      <TrafficCertificateModal
        certificatePlatform={certificatePlatform}
        isOpen={workspace.isCertificateModalOpen}
        onClose={() => workspace.setIsCertificateModalOpen(false)}
        onCopyUrl={() => {
          void copyTextToClipboard(rootCertificateUrl)
            .then(() => {
              showToast("根证书下载链接已复制");
            })
            .catch(() => {
              showToast("复制失败", "error");
            });
        }}
        rootCertificateUrl={rootCertificateUrl}
        settings={workspace.settings}
      />

      <TrafficProxyGuideModal
        isOpen={isProxyGuideOpen}
        onClose={() => setIsProxyGuideOpen(false)}
        settings={workspace.settings}
      />

      <section className={styles.workspace}>
        <TrafficRequestPane
          onSelectRequest={workspace.selectRequest}
          recordBodyRef={workspace.recordBodyRef}
          requests={workspace.requests}
          selected={workspace.selected}
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
        onSave={mockWorkspace.saveRule}
      />
    </div>
  );
}


