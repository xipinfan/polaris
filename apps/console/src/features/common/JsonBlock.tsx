import { formatJson } from "@polaris/shared-utils";
import { useConsoleI18n } from "../../i18n/I18nProvider";

export function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const { t } = useConsoleI18n();
  const formatted = formatJson(value ?? {});

  const copy = async () => {
    await navigator.clipboard.writeText(formatted);
  };

  return (
    <section className="panel json-block">
      <div className="json-block-header">
        <h3>{title}</h3>
        <button className="json-copy-button" onClick={copy} type="button">
          {t("json.copy")}
        </button>
      </div>
      <div className="json-code-shell simple">
        <pre className="json-code">{formatted}</pre>
      </div>
    </section>
  );
}
