import { QRCodeSVG } from "qrcode.react";
import styles from "./index.module.less";

type ProxyQRCodeProps = {
  lanIp?: string | null;
  proxyPort?: number | null;
};

export function ProxyQRCode({ lanIp, proxyPort }: ProxyQRCodeProps) {
  const canRender = Boolean(lanIp) && typeof proxyPort === "number" && Number.isFinite(proxyPort);
  const address = canRender ? `${lanIp}:${proxyPort}` : null;

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>扫码接入</span>
        <strong>局域网代理二维码</strong>
      </div>
      {address ? (
        <div className={styles.qrContainer}>
          <QRCodeSVG
            bgColor="#ffffff"
            fgColor="#0f172a"
            includeMargin
            level="M"
            size={148}
            value={address}
          />
        </div>
      ) : (
        <div className={styles.placeholder}>等待网络连接...</div>
      )}
      <code className={styles.address}>{address ?? "等待网络连接..."}</code>
    </section>
  );
}
