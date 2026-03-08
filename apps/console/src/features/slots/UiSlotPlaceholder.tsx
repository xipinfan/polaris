import { useConsoleI18n } from "../../i18n/I18nProvider";

export function UiSlotPlaceholder({ slot }: { slot: string }) {
  const { t } = useConsoleI18n();
  return <div className="slot-placeholder">{t("slot.placeholder", { slot })}</div>;
}
