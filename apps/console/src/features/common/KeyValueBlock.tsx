import { useToast } from "../feedback/ToastProvider";
import { copyTextToClipboard } from "../../utils/clipboard";
import styles from "./KeyValueBlock.module.css";

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
  const { showToast } = useToast();
  const entries = normalizeEntries(value);
  const copy = async () => {
    const content = entries.map((entry) => `${entry.key}: ${entry.value}`).join("\n");
    try {
      await copyTextToClipboard(content);
      showToast("已复制到剪贴板");
    } catch {
      showToast("复制失败", "error");
    }
  };

  return (
    <section className={`${styles.block} panel kv-block`}>
      <div className={`${styles.header} kv-block-header`}>
        <h3>{title}</h3>
        <div className={`${styles.actions} kv-block-actions`}>
          <span className={styles.countBadge}>{entries.length}</span>
          {copyMode === "block" ? (
            <button className={`${styles.copyButton} json-copy-button`} onClick={() => void copy()} type="button">
              {"复制"}
            </button>
          ) : null}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className={styles.empty}>{"当前区块暂无数据"}</div>
      ) : (
        <div className={`${styles.table} kv-table`}>
          {entries.map((entry) => (
            <div className={`${styles.row} kv-row`} key={entry.key}>
              <span className={`${styles.key} kv-key`}>{entry.key}</span>
              {copyMode === "row" ? (
                <div className={`${styles.valueWrap} kv-value-wrap`}>
                  <strong className={`${styles.value} kv-value`} title={entry.value}>{entry.value}</strong>
                  <button
                    className={`${styles.inlineCopyButton} inline-copy-button`}
                    onClick={() => {
                      void copyTextToClipboard(entry.value)
                        .then(() => {
                          showToast("已复制到剪贴板");
                        })
                        .catch(() => {
                          showToast("复制失败", "error");
                        });
                    }}
                    type="button"
                  >
                    {"复制"}
                  </button>
                </div>
              ) : (
                <strong className={`${styles.value} kv-value`} title={entry.value}>{entry.value}</strong>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

