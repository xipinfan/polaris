import localStyles from "./index.module.less";

type SettingsMcpCardProps = {
  enabled: boolean;
  tools: string[];
};

export function SettingsMcpCard({ enabled, tools }: SettingsMcpCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{"MCP 接入"}</span>
          <h3>{"MCP 接入"}</h3>
        </div>
        <span className={`${localStyles.statusBadge} ${enabled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted}`}>
          {enabled ? "已启用" : "未启用"}
        </span>
      </div>

      <div className={localStyles.infoGrid}>
        <div className={localStyles.infoItem}>
          <span>{"状态"}</span>
          <strong>{enabled ? "已启用" : "未启用"}</strong>
        </div>
        <div className={`${localStyles.infoItem} ${localStyles.infoItemFull}`}>
          <span>{"基础工具"}</span>
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

