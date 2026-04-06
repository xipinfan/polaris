import localStyles from "./index.module.less";

type SettingsHttpsCardProps = {
  certificateInstalled: boolean;
  rootCertificateUrl: string;
};

export function SettingsHttpsCard({
  certificateInstalled,
  rootCertificateUrl,
}: SettingsHttpsCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{"HTTPS 与证书"}</span>
          <h3>{"HTTPS 与证书"}</h3>
        </div>
        <span className={`${localStyles.statusBadge} ${certificateInstalled ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted}`}>
          {certificateInstalled ? "本地根证书已生成" : "本地根证书尚未生成"}
        </span>
      </div>

      <div className={localStyles.infoGrid}>
        <div className={localStyles.infoItem}>
          <span>{"HTTPS 模式"}</span>
          <strong>{"当前通过应用内 CA 和按域名签发证书实现 HTTPS MITM；浏览器信任根证书后，可查看 HTTPS 明文请求与响应。"}</strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{"证书状态"}</span>
          <strong>{certificateInstalled ? "本地根证书已生成" : "本地根证书尚未生成"}</strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{"根证书下载"}</span>
          <strong>
            <a href={rootCertificateUrl} rel="noreferrer" target="_blank">
              {"下载 Polaris 根证书"}
            </a>
          </strong>
        </div>
        <div className={localStyles.infoItem}>
          <span>{"macOS 说明"}</span>
          <strong>{"将根证书导入系统或浏览器信任区后，HTTPS 请求才会被浏览器接受并展示明文内容。"}</strong>
        </div>
      </div>
    </section>
  );
}

