import { useConsoleI18n } from "../../i18n/I18nProvider";
import styles from "./UiSlotPlaceholder.module.css";

export function UiSlotPlaceholder({ slot }: { slot: string }) {
  const { t } = useConsoleI18n();
  return <div className={styles.placeholder}>{t("slot.placeholder", { slot })}</div>;
}
