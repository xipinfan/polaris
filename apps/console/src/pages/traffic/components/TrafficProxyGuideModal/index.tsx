import type { AppSetting } from "@polaris/shared-types";
import { ProxyQRCode } from "../../../../features/common/ProxyQRCode";
import localStyles from "./index.module.less";

type TrafficProxyGuideModalProps = {
  isOpen: boolean;
  settings: AppSetting | null;
  onClose: () => void;
};

function getPortalAddress(settings: AppSetting | null): string {
  if (!settings?.lanIp) {
    return "http://polaris.local";
  }

  return `http://polaris.local（当前代理 ${settings.lanIp}:${settings.localProxyPort}）`;
}

function getCertificateDownloadAddress(): string {
  return "http://polaris.local/certificates/root-ca";
}

export function TrafficProxyGuideModal({
  isOpen,
  settings,
  onClose,
}: TrafficProxyGuideModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={localStyles.modalOverlay} onClick={onClose} role="presentation">
      <section
        aria-modal="true"
        className={localStyles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={localStyles.modalHead}>
          <div>
            <span className={localStyles.featureBadge}>代理指南</span>
            <h3>手机 / 局域网代理接入指南</h3>
          </div>
          <button className={localStyles.closeButton} onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className={localStyles.stepCard}>
          <div className={localStyles.stepBadge}>01</div>
          <div className={localStyles.stepContent}>
            <strong>浏览器代理</strong>
            <p>桌面浏览器优先推荐用扩展接管流量，改动最小，也不用切换整机系统代理。</p>
            <ul>
              <li>安装 Polaris 扩展，或任意支持 HTTP/HTTPS 代理切换的浏览器扩展。</li>
              <li>代理服务器填写本机 Polaris 代理地址，通常是 `127.0.0.1`，端口填写当前的本地代理端口。</li>
              <li>HTTPS 抓包前，需要先安装并信任 Polaris 根证书，否则只能看到 CONNECT 或握手信息。</li>
            </ul>
          </div>
        </div>

        <div className={localStyles.stepCard}>
          <div className={localStyles.stepBadge}>02</div>
          <div className={localStyles.stepContent}>
            <strong>手机 / 局域网代理</strong>
            <p>先让手机和电脑连接同一个 Wi-Fi，再在手机的 Wi-Fi 详情页里手动配置代理。</p>
            <div className={localStyles.metricGrid}>
              <article className={localStyles.metricCard}>
                <span>代理服务器</span>
                <strong>{settings?.lanIp ?? "未检测到局域网 IP"}</strong>
              </article>
              <article className={localStyles.metricCard}>
                <span>代理端口</span>
                <strong>{settings?.localProxyPort ?? "-"}</strong>
              </article>
            </div>
            <ProxyQRCode
              lanIp={settings?.lanIp ?? null}
              proxyPort={settings?.localProxyPort ?? null}
            />
            <div className={localStyles.platformSection}>
              <h4>连接代理</h4>
              <ul>
                <li>Android：进入“设置 → WLAN / Wi-Fi → 当前网络 → 代理”，选择“手动”。主机名填写上方 IP，端口填写上方端口后保存。</li>
                <li>iPhone / iPad：进入“设置 → Wi-Fi → 当前网络右侧 i → 配置代理”，选择“手动”。服务器填写上方 IP，端口填写上方端口后保存。</li>
                <li>代理保存成功后，手机浏览器访问 {getPortalAddress(settings)}，即可打开 Polaris 证书安装页。</li>
                <li>如果下载按钮没有自动拉起安装，也可以直接访问 {getCertificateDownloadAddress()} 重新下载证书。</li>
              </ul>
            </div>
            <div className={localStyles.platformGrid}>
              <section className={localStyles.platformCard}>
                <h4>Android 证书安装</h4>
                <ul>
                  <li>在代理已生效的前提下，用手机浏览器访问 `http://polaris.local`，点击下载根证书。</li>
                  <li>若系统弹出“安装证书”或“从存储设备安装证书”，证书用途请选择“VPN 和应用”或系统允许的等效项。</li>
                  <li>若下载后未自动弹出安装页，可进入“设置 → 安全 / 隐私 → 加密与凭据 / 安装证书”，手动选择刚下载的证书文件。</li>
                  <li>如果页面跳空白，可直接打开 `http://polaris.local/certificates/root-ca`，现在会由 Polaris 代理直接返回证书文件。</li>
                  <li>部分 Android 设备安装用户证书后，默认只对部分应用生效；浏览器抓包通常可用，但某些 App 还需要额外放开用户证书信任。</li>
                </ul>
              </section>
              <section className={localStyles.platformCard}>
                <h4>iPhone / iPad 证书安装</h4>
                <ul>
                  <li>在 Safari 中访问 `http://polaris.local`，下载 Polaris 根证书，系统会提示“已下载描述文件”。</li>
                  <li>进入“设置 → 已下载描述文件”或“设置 → 通用 → VPN 与设备管理”，安装刚下载的 Polaris 描述文件。</li>
                  <li>如果下载按钮没有反应，可直接访问 `http://polaris.local/certificates/root-ca` 再试一次。</li>
                  <li>安装完成后，再进入“设置 → 通用 → 关于本机 → 证书信任设置”，手动开启 Polaris 根证书的完全信任。</li>
                  <li>如果没有打开“完全信任”，HTTPS 仍然无法被正常解密，这是 iOS 上最常见的遗漏步骤。</li>
                </ul>
              </section>
            </div>
            <div className={localStyles.tipBox}>
              <strong>排查建议</strong>
              <p>如果手机打不开 `polaris.local`，通常说明代理没有真正生效。先确认手机和电脑在同一网段、局域网 IP 没填错、电脑防火墙没有拦截对应端口。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
