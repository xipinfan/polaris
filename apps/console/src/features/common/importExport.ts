export type ExportEnvelope<TKind extends string, TPayload> = {
  version: 1;
  kind: TKind;
  exportedAt: string;
  payload: TPayload;
};

export function buildExportEnvelope<TKind extends string, TPayload>(
  kind: TKind,
  payload: TPayload,
): ExportEnvelope<TKind, TPayload> {
  return {
    version: 1,
    kind,
    exportedAt: new Date().toISOString(),
    payload,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("未选择文件"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          resolve(JSON.parse(text));
        } catch {
          reject(new Error("JSON 格式无效"));
        }
      };
      reader.readAsText(file, "utf-8");
    };
    input.click();
  });
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
