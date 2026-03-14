import styles from "./StatusState.module.css";

type StatusStateProps = {
  title: string;
  description: string;
  tone?: "empty" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusState({
  title,
  description,
  tone = "empty",
  actionLabel,
  onAction,
}: StatusStateProps) {
  return (
    <section className={`${styles.card} ${tone === "error" ? styles.error : styles.empty}`}>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className={styles.action} onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
