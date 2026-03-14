import localStyles from "./index.module.less";

type SettingsMcpCardProps = {
  enabled: boolean;
  tools: string[];
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function SettingsMcpCard({ enabled, tools, t }: SettingsMcpCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{t("settings.mcpTitle")}</span>
          <h3>{t("settings.mcpTitle")}</h3>
        </div>
        <span className={`${localStyles.statusBadge} ${enabled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted}`}>
          {enabled ? t("settings.mcpEnabledState") : t("settings.mcpDisabledState")}
        </span>
      </div>

      <div className={localStyles.infoGrid}>
        <div className={localStyles.infoItem}>
          <span>{t("settings.mcpStatus")}</span>
          <strong>{enabled ? t("settings.mcpEnabledState") : t("settings.mcpDisabledState")}</strong>
        </div>
        <div className={`${localStyles.infoItem} ${localStyles.infoItemFull}`}>
          <span>{t("settings.baseTools")}</span>
          <div className={localStyles.toolList}>
            {tools.map((tool) => (
              <code key={tool} className={localStyles.toolChip}>
                {tool}
              </code>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
