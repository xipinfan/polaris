import { UiSlotPlaceholder } from "../../../../features/slots/UiSlotPlaceholder";
import localStyles from "./index.module.less";

type SettingsExtensionCardProps = {
  t: (key: any, params?: Record<string, string | number>) => string;
};

const capabilityItems = [
  {
    title: "浏览器代理控制",
    body: "插件负责浏览器级开关和代理接入时机，避免直接改动系统网络环境。",
    tone: "primary",
  },
  {
    title: "状态面板渲染",
    body: "将实时状态和风险提示注入到控制台界面，保持操作链路可见。",
    tone: "neutral",
  },
  {
    title: "Core 能力复用",
    body: "请求转发、Mock、MCP 仍由 Core 提供，插件只做轻量控制层。",
    tone: "neutral",
  },
];

const workflowItems = [
  { step: "01", title: "安装并连接插件", description: "确保扩展与本地 Core 服务建立连接。" },
  { step: "02", title: "选择代理策略", description: "在浏览器范围内开启代理，不影响系统全局网络。" },
  { step: "03", title: "在控制台观测", description: "通过 UI Slot 查看状态与扩展面板，统一完成调试与排障。" },
];

export function SettingsExtensionCard({ t }: SettingsExtensionCardProps) {
  return (
    <section className={localStyles.card}>
      <header className={localStyles.hero}>
        <div className={localStyles.heroMain}>
          <span className={localStyles.sectionLabel}>浏览器插件模块</span>
          <h3>{t("settings.extensionTitle")}</h3>
          <p>
            将插件定位为浏览器侧控制层，把复杂业务能力继续留在 Core，确保职责清晰且易于扩展。
          </p>
          <div className={localStyles.badges}>
            <span className={`${localStyles.badge} ${localStyles.badgeSuccess}`}>轻量接入</span>
            <span className={localStyles.badge}>浏览器范围生效</span>
            <span className={localStyles.badge}>可插拔 UI Slot</span>
          </div>
        </div>
        <aside className={localStyles.heroAside}>
          <span>{t("settings.extensionShort")}</span>
          <strong>Extension + Core 协同</strong>
          <p>{t("settings.extensionBody")}</p>
        </aside>
      </header>

      <div className={localStyles.contentGrid}>
        <div className={localStyles.sectionBlock}>
          <div className={localStyles.blockHeader}>
            <span>能力边界</span>
            <strong>Boundary Map</strong>
          </div>
          <div className={localStyles.capabilityGrid}>
            {capabilityItems.map((item) => (
              <article
                key={item.title}
                className={`${localStyles.capabilityItem} ${item.tone === "primary" ? localStyles.capabilityPrimary : ""}`}
              >
                <h4>{item.title}</h4>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={localStyles.sectionBlock}>
          <div className={localStyles.blockHeader}>
            <span>接入流程</span>
            <strong>3 Steps</strong>
          </div>
          <div className={localStyles.workflowList}>
            {workflowItems.map((item) => (
              <article key={item.step} className={localStyles.workflowItem}>
                <span>{item.step}</span>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className={localStyles.slotSection}>
        <div className={localStyles.slotHeader}>
          <span>插件扩展区</span>
          <strong>{t("settings.uiSlots")}</strong>
        </div>
        <p>{t("settings.uiSlotsBody")}</p>
        <div className={localStyles.slotWrap}>
          <UiSlotPlaceholder slot="settings-extension-panel" />
        </div>
      </div>
    </section>
  );
}
