import type { AppSetting } from "@polaris/shared-types";
import { ProxyQRCode } from "../../../../features/common/ProxyQRCode";
import localStyles from "./index.module.less";

type SettingsLanProxyCardProps = {
  settings: AppSetting;
};

export function SettingsLanProxyCard({ settings }: SettingsLanProxyCardProps) {
  const portalUrl = "http://polaris.local";
  const mobileCertificateUrl = "http://polaris.local/certificates/root-ca";

  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>手机 / 局域网代理</span>
          <h3>LAN / Mobile Proxy</h3>
        </div>
        <span className={`${localStyles.statusBadge} ${settings.lanIp ? localStyles.statusBadgeSuccess : localStyles.statusBadgeMuted}`}>
          {settings.lanIp ? "可连接" : "等待网络"}
        </span>
      </div>

      <p className={localStyles.summary}>
        让手机和同网段设备直接接入这台电脑上的 Polaris 代理，用于移动端抓包、证书安装和 HTTPS 解密。
      </p>

      <div className={localStyles.metricGrid}>
        <article className={localStyles.metricCard}>
          <span>LAN IP</span>
          <strong>{settings.lanIp ?? "LAN IPv4 unavailable"}</strong>
        </article>
        <article className={localStyles.metricCard}>
          <span>Proxy Port</span>
          <strong>{settings.localProxyPort}</strong>
        </article>
      </div>

      <ProxyQRCode lanIp={settings.lanIp ?? null} proxyPort={settings.localProxyPort} />

      <div className={localStyles.guide}>
        <strong>手机端接入说明</strong>
        <p>1. 先确认手机与电脑处于同一个 Wi-Fi 网络。</p>
        <p>2. Android：在当前 Wi-Fi 的代理设置中选择“手动”，主机填写上方 LAN IP，端口填写 {settings.localProxyPort}。</p>
        <p>3. iPhone / iPad：在“设置 → Wi-Fi → 当前网络 → 配置代理”中选择“手动”，服务器填写上方 LAN IP，端口填写 {settings.localProxyPort}。</p>
        <p>4. 代理保存后，在手机浏览器访问 {portalUrl} 下载 Polaris 根证书。</p>
        <p>5. Android 安装证书后，按系统提示为“VPN 和应用”或对应用途启用；iPhone 安装描述文件后，还要到“证书信任设置”里手动打开完全信任。</p>
        <p>
          手机证书直链：
          <a href={mobileCertificateUrl} rel="noreferrer" target="_blank">
            {mobileCertificateUrl}
          </a>
        </p>
      </div>
    </section>
  );
}
