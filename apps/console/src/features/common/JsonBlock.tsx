import { formatJson } from "@polaris/shared-utils";
import { useToast } from "../feedback/ToastProvider";
import { copyTextToClipboard } from "../../utils/clipboard";
import styles from "./JsonBlock.module.css";

export function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const { showToast } = useToast();
  const formatted = formatJson(value ?? {});

  const copy = async () => {
    try {
      await copyTextToClipboard(formatted);
      showToast("已复制到剪贴板");
    } catch {
      showToast("复制失败", "error");
    }
  };

  return (
    <section className={`${styles.block} panel json-block`}>
      <div className={`${styles.header} json-block-header`}>
        <h3>{title}</h3>
        <button className={`${styles.copyButton} json-copy-button`} onClick={copy} type="button">
          {"复制"}
        </button>
      </div>
      <div className={`${styles.codeShell} json-code-shell simple`}>
        <pre className={`${styles.code} json-code`}>{formatted}</pre>
      </div>
    </section>
  );
}

