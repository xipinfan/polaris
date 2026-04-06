import styles from "./UiSlotPlaceholder.module.css";

export function UiSlotPlaceholder({ slot }: { slot: string }) {
  return <div className={styles.placeholder}>{`预留扩展位：${slot}`}</div>;
}
