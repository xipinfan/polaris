import { useToast } from "../feedback/ToastProvider";
import { useConsoleI18n } from "../../i18n/I18nProvider";

type KeyValueMap = Record<string, unknown> | null | undefined;
type KeyValueCopyMode = "block" | "row";

function normalizeEntries(value: KeyValueMap) {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).map(([key, item]) => ({
    key,
    value: typeof item === "string" ? item : JSON.stringify(item)
  }));
}

export function KeyValueBlock({
  title,
  value,
  copyMode = "block"
}: {
  title: string;
  value: KeyValueMap;
  copyMode?: KeyValueCopyMode;
}) {
  const { t } = useConsoleI18n();
  const { showToast } = useToast();
  const entries = normalizeEntries(value);
  const copy = async () => {
    const content = entries.map((entry) => `${entry.key}: ${entry.value}`).join("\n");
    await navigator.clipboard.writeText(content);
    showToast(t("common.copied"));
  };

  return (
    <section className="panel kv-block">
      <div className="kv-block-header">
        <h3>{title}</h3>
        <div className="kv-block-actions">
          <span className="feature-badge">{entries.length}</span>
          {copyMode === "block" ? (
            <button className="json-copy-button" onClick={() => void copy()} type="button">
              {t("json.copy")}
            </button>
          ) : null}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="kv-empty">{t("detail.emptySection")}</div>
      ) : (
        <div className="kv-table">
          {entries.map((entry) => (
            <div className="kv-row" key={entry.key}>
              <span className="kv-key">{entry.key}</span>
              {copyMode === "row" ? (
                <div className="kv-value-wrap">
                  <strong className="kv-value" title={entry.value}>{entry.value}</strong>
                  <button
                    className="inline-copy-button"
                    onClick={() => {
                      void navigator.clipboard.writeText(entry.value).then(() => {
                        showToast(t("common.copied"));
                      });
                    }}
                    type="button"
                  >
                    {t("json.copy")}
                  </button>
                </div>
              ) : (
                <strong className="kv-value" title={entry.value}>{entry.value}</strong>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
