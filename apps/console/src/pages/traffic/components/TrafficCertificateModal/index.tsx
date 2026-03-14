import type { AppSetting } from "@polaris/shared-types";
import type { TranslateFn } from "../../../../i18n/I18nProvider";
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
  t: TranslateFn;
};

export function TrafficCertificateModal({
  certificatePlatform,
  isOpen,
  rootCertificateUrl,
  settings,
  onClose,
  onCopyUrl,
  t,
}: TrafficCertificateModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={localStyles.modalOverlay}
      onClick={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className={cx(localStyles.modalCard, localStyles.root)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={localStyles.modalHead}>
          <div>
            <span className={localStyles.featureBadge}>{t("traffic.certificate.badge")}</span>
            <h3>{t("traffic.certificate.title")}</h3>
          </div>
          <button
            className={cx(localStyles.button, localStyles.buttonTertiary)}
            onClick={onClose}
            type="button"
          >
            {t("traffic.certificate.close")}
          </button>
        </div>
        <p className={localStyles.modalBody}>{t("traffic.certificate.body")}</p>
        <div className={localStyles.certificateVisual}>
          <div className={localStyles.certificateVisualCopy}>
            <span className={localStyles.featureBadge}>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.platform.mac")
                : certificatePlatform === "windows"
                  ? t("traffic.certificate.platform.windows")
                  : t("traffic.certificate.platform.other")}
            </span>
            <strong>{t("traffic.certificate.visualTitle")}</strong>
            <small>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.visualBodyMac")
                : certificatePlatform === "windows"
                  ? t("traffic.certificate.visualBodyWindows")
                  : t("traffic.certificate.otherBody")}
            </small>
          </div>
          <div className={localStyles.certificateFallback}>
            <strong>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.inlineTitleMac")
                : certificatePlatform === "windows"
                  ? t("traffic.certificate.inlineTitleWindows")
                  : t("traffic.certificate.platform.other")}
            </strong>
            <p>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.inlineBodyMac")
                : certificatePlatform === "windows"
                  ? t("traffic.certificate.inlineBodyWindows")
                  : t("traffic.certificate.otherBody")}
            </p>
          </div>
        </div>
        <div className={localStyles.certificateSteps}>
          <div>
            <span>1</span>
            <strong>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.stepDownloadMac")
                : t("traffic.certificate.stepDownload")}
            </strong>
          </div>
          <div>
            <span>2</span>
            <strong>
              {certificatePlatform === "mac"
                ? t("traffic.certificate.stepTrustMac")
                : t("traffic.certificate.stepTrust")}
            </strong>
          </div>
          <div>
            <span>3</span>
            <strong>{t("traffic.certificate.stepRefresh")}</strong>
          </div>
        </div>
        <div className={localStyles.modalActions}>
          <a
            className={cx(localStyles.button, localStyles.buttonPrimary, localStyles.modalLink)}
            href={rootCertificateUrl}
            rel="noreferrer"
            target="_blank"
          >
            {settings?.certificateInstalled
              ? t("traffic.certificate.download")
              : t("traffic.certificate.download")}
          </a>
          <button
            className={cx(localStyles.button, localStyles.buttonSecondary)}
            onClick={onCopyUrl}
            type="button"
          >
            {t("traffic.certificate.copy")}
          </button>
        </div>
      </section>
    </div>
  );
}


