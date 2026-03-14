import localStyles from "./index.module.less";

type SettingsLanguageCardProps = {
  locale: "zh-CN" | "en-US";
  localeLabel: string;
  setLocale: (locale: "zh-CN" | "en-US") => void;
  t: (key: any, params?: Record<string, string | number>) => string;
};

export function SettingsLanguageCard({
  locale,
  localeLabel,
  setLocale,
  t,
}: SettingsLanguageCardProps) {
  return (
    <section className={localStyles.card}>
      <div className={localStyles.cardHeader}>
        <div>
          <span className={localStyles.sectionLabel}>{t("settings.languageTitle")}</span>
          <h3>{t("settings.languageTitle")}</h3>
        </div>
        <span className={localStyles.sectionBadge}>
          {t("settings.language.current", { locale: localeLabel })}
        </span>
      </div>

      <div className={localStyles.segmented}>
        <button
          className={`${localStyles.segmentButton} ${locale === "zh-CN" ? localStyles.segmentButtonActive : ""}`}
          onClick={() => setLocale("zh-CN")}
          type="button"
        >
          {t("settings.language.zh")}
        </button>
        <button
          className={`${localStyles.segmentButton} ${locale === "en-US" ? localStyles.segmentButtonActive : ""}`}
          onClick={() => setLocale("en-US")}
          type="button"
        >
          {t("settings.language.en")}
        </button>
      </div>
    </section>
  );
}
