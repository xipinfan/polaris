export function formatJson(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  return JSON.stringify(value, null, 2);
}

export function formatTime(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function truncate(value: string, length = 80): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}...`;
}
