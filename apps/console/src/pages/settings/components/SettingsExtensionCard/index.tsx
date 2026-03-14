import { UiSlotPlaceholder } from "../../../../features/slots/UiSlotPlaceholder";
import localStyles from "./index.module.less";

type SettingsExtensionCardProps = {
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function SettingsExtensionCard({ t }: SettingsExtensionCardProps) {
  return (
    <>
      <section className={localStyles.card}>
        <div className={localStyles.cardHeader}>
          <div>
            <span className={localStyles.sectionLabel}>{t("settings.extensionTitle")}</span>
            <h3>{t("settings.extensionTitle")}</h3>
          </div>
        </div>

        <div className={localStyles.infoGrid}>
          <div className={localStyles.infoItem}>
            <span>{t("settings.uiSlots")}</span>
            <strong>{t("settings.uiSlotsBody")}</strong>
          </div>
          <div className={localStyles.infoItem}>
            <span>{t("settings.roleSplit")}</span>
            <strong>{t("settings.roleSplitBody")}</strong>
          </div>
        </div>
      </section>

      <div className={localStyles.slotWrap}>
        <UiSlotPlaceholder slot="settings-extension-panel" />
      </div>
    </>
  );
}
