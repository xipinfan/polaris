import type { ConsoleMessageKey } from "../../../../i18n/messages";
import localStyles from "./index.module.less";

type ProxyModeItem = {
  key: string;
  title: string;
  descriptionKey: ConsoleMessageKey;
};

type SettingsProxyModeCardProps = {
  currentMode: string;
  currentModeLabel: string;
  allRuleCount: number;
  enabledRuleCount: number;
  modeItems: ProxyModeItem[];
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function SettingsProxyModeCard({
  currentMode,
  currentModeLabel,
  allRuleCount,
  enabledRuleCount,
  modeItems,
  t,
}: SettingsProxyModeCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{t("settings.proxyModesTitle")}</span>
          <h3>{t("settings.proxyModesTitle")}</h3>
        </div>
        <span className={localStyles.sectionBadge}>{currentModeLabel}</span>
      </div>

      <div className={localStyles.modeList}>
        {modeItems.map((mode) => (
          <article
            key={mode.key}
            className={`${localStyles.modeCard} ${currentMode === mode.key ? localStyles.modeCardActive : ""}`}
          >
            <strong>{mode.title}</strong>
            <p>{t(mode.descriptionKey)}</p>
          </article>
        ))}
      </div>

      <div className={localStyles.badgeRow}>
        <span className={localStyles.statusBadge}>{t("settings.currentMode", { mode: currentModeLabel })}</span>
        <span className={localStyles.statusBadge}>{t("settings.allRules", { count: allRuleCount })}</span>
        <span className={localStyles.statusBadge}>{t("settings.enabledRules", { count: enabledRuleCount })}</span>
      </div>
    </section>
  );
}
