import { formatJson } from "@polaris/shared-utils";

export function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <pre>{formatJson(value ?? {})}</pre>
    </section>
  );
}
