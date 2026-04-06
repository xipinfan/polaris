import localStyles from "./index.module.less";

type ProxyModeItem = {
  key: string;
  title: string;
  description: string;
};

type SettingsProxyModeCardProps = {
  currentMode: string;
  currentModeLabel: string;
  allRuleCount: number;
  enabledRuleCount: number;
  modeItems: ProxyModeItem[];
};

export function SettingsProxyModeCard({
  currentMode,
  currentModeLabel,
  allRuleCount,
  enabledRuleCount,
  modeItems,
}: SettingsProxyModeCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{"代理模式说明"}</span>
          <h3>{"代理模式说明"}</h3>
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
            <p>{mode.description}</p>
          </article>
        ))}
      </div>

      <div className={localStyles.badgeRow}>
        <span className={localStyles.statusBadge}>{`当前模式：${currentModeLabel}`}</span>
        <span className={localStyles.statusBadge}>{`全部规则：${allRuleCount}`}</span>
        <span className={localStyles.statusBadge}>{`启用中：${enabledRuleCount}`}</span>
      </div>
    </section>
  );
}
