import localStyles from "./index.module.less";

type SettingsHttpsCardProps = {
  certificateInstalled: boolean;
  rootCertificateUrl: string;
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function SettingsHttpsCard({
  certificateInstalled,
  rootCertificateUrl,
  t,
}: SettingsHttpsCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{t("settings.httpsTitle")}</span>
          <h3>{t("settings.httpsTitle")}</h3>
        </div>
        <span className={`${localStyles.statusBadge} ${certificateInstalled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted}`}>
          {certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}
        </span>
      </div>

      <div className={localStyles.infoGrid}>
        <div className={localStyles.infoItem}>
          <span>{t("settings.httpsMode")}</span>
          <strong>{t("settings.httpsBody")}</strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{t("settings.certState")}</span>
          <strong>{certificateInstalled ? t("settings.certInstalled") : t("settings.certMissing")}</strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{t("settings.certDownload")}</span>
          <strong>
            <a href={rootCertificateUrl} rel="noreferrer" target="_blank">
              {t("settings.certDownloadAction")}
            </a>
          </strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{t("settings.macosNote")}</span>
          <strong>{t("settings.macosBody")}</strong>
        </div>
      </div>
    </section>
  );
}
