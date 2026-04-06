import localStyles from "./index.module.less";

type SettingsOverviewProps = {
  isOnline: boolean;
  proxyPort: number | string;
  apiPort: number | string;
  mcpPort: number | string;
};

export function SettingsOverview({
  isOnline,
  proxyPort,
  apiPort,
  mcpPort,
}: SettingsOverviewProps) {
  return (
    <section className={localStyles.overview}>
      <div className={localStyles.overviewHeader}>
        <div className={localStyles.overviewCopy}>
          <span className={localStyles.sectionLabel}>本地服务</span>
          <h3>{"本地服务"}</h3>
          <p>查看本地代理、接口和 MCP 端口，确认当前运行状态。</p>
        </div>
        <span className={`${localStyles.statusBadge} ${isOnline ? localStyles.statusBadgeSuccess : localStyles.statusBadgeWarning}`}>
          {isOnline ? "在线" : "离线"}
        </span>
      </div>

      <div className={localStyles.metricGrid}>
        <article className={localStyles.metricCard}>
          <span>{"代理端口"}</span>
          <strong>{proxyPort}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>{"API 地址"}</span>
          <strong>{`http://127.0.0.1:${apiPort}`}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>{"MCP 地址"}</span>
          <strong>{`http://127.0.0.1:${mcpPort}`}</strong>
        </article>
      </div>
    </section>
  );
}

