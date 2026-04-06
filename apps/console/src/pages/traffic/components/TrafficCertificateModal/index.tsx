import type { AppSetting } from "@polaris/shared-types";
import localStyles from "./index.module.less";
import type { CertificatePlatform } from "../../types";
import { cx } from "../../utils/trafficFormatters";

type TrafficCertificateModalProps = {
  certificatePlatform: CertificatePlatform;
  isOpen: boolean;
  rootCertificateUrl: string;
  settings: AppSetting | null;
  onClose: () => void;
  onCopyUrl: () => void;
};

export function TrafficCertificateModal({
  certificatePlatform,
  isOpen,
  rootCertificateUrl,
  settings,
  onClose,
  onCopyUrl,
}: TrafficCertificateModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={localStyles.modalOverlay} onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className={cx(localStyles.modalCard, localStyles.root)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={localStyles.modalHead}>
          <div>
            <span className={localStyles.featureBadge}>{"HTTPS"}</span>
            <h3>{"安装 Polaris 根证书"}</h3>
          </div>
          <button className={cx(localStyles.button, localStyles.buttonTertiary)} onClick={onClose} type="button">
            {"关闭"}
          </button>
        </div>
        <p className={localStyles.modalBody}>{"要查看 HTTPS 明文请求，需先下载并信任 Polaris 根证书。信任完成后，刷新目标页面即可在 Traffic 中看到 HTTPS 详情。"}</p>
        <div className={localStyles.certificateVisual}>
          <div className={localStyles.certificateVisualCopy}>
            <span className={localStyles.featureBadge}>
              {certificatePlatform === "mac"
                ? "macOS / Chrome"
                : certificatePlatform === "windows"
                  ? "Windows / Chrome"
                  : "其他系统"}
            </span>
            <strong>{"按当前系统显示导入路径"}</strong>
            <small>
              {certificatePlatform === "mac"
                ? "检测到当前是 macOS。下载后，需要导入到钥匙串访问，并将该根证书设为始终信任。"
                : certificatePlatform === "windows"
                  ? "检测到当前是 Windows。下载后，可在 Chrome 的证书管理入口或 Windows 证书管理器中导入。"
                  : "未识别为 Windows 或 macOS。你仍可先下载 Polaris 根证书，再将其导入 Chrome 或系统的受信任证书存储。"}
            </small>
          </div>
          <div className={localStyles.certificateFallback}>
            <strong>
              {certificatePlatform === "mac"
                ? "macOS 导入建议"
                : certificatePlatform === "windows"
                  ? "Windows 导入建议"
                  : "其他系统"}
            </strong>
            <p>
              {certificatePlatform === "mac"
                ? "打开钥匙串访问，将下载的根证书拖入“系统”钥匙串，再将信任设置改为“始终信任”。"
                : certificatePlatform === "windows"
                  ? "双击下载的证书文件后，按导入向导放入“受信任的根证书颁发机构”，然后重启 Chrome 或刷新页面。"
                  : "未识别为 Windows 或 macOS。你仍可先下载 Polaris 根证书，再将其导入 Chrome 或系统的受信任证书存储。"}
            </p>
          </div>
        </div>
        <div className={localStyles.certificateSteps}>
          <div>
            <span>1</span>
            <strong>{certificatePlatform === "mac" ? "下载根证书，并准备导入到钥匙串访问" : "下载根证书"}</strong>
          </div>
          <div>
            <span>2</span>
            <strong>{certificatePlatform === "mac" ? "导入到 macOS 钥匙串，并设为“始终信任”" : "导入到系统或浏览器信任区"}</strong>
          </div>
          <div>
            <span>3</span>
            <strong>{"刷新目标页面重新抓包"}</strong>
          </div>
        </div>
        <div className={localStyles.modalActions}>
          <a className={cx(localStyles.button, localStyles.buttonPrimary, localStyles.modalLink)} href={rootCertificateUrl} rel="noreferrer" target="_blank">
            {settings?.certificateInstalled ? "下载根证书" : "下载根证书"}
          </a>
          <button className={cx(localStyles.button, localStyles.buttonSecondary)} onClick={onCopyUrl} type="button">
            {"复制下载链接"}
          </button>
        </div>
      </section>
    </div>
  );
}
