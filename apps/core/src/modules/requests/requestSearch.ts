import type { RequestRecord } from "@polaris/shared-types";

const URL_MAX_CHARS = 4096;
const HOST_MAX_CHARS = 512;
const PATH_MAX_CHARS = 2048;
const MAP_MAX_CHARS = 8192;
const BODY_MAX_CHARS = 20000;
const RESOLUTION_MAX_CHARS = 4096;
const TRUNCATED_MARKER = "[truncated]";
const BINARY_MARKER = "[binary content]";
const CIRCULAR_MARKER = "[circular]";

function truncateForSearch(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}${TRUNCATED_MARKER}` : value;
}

function isBinaryLike(value: unknown): boolean {
  return (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof Buffer !== "undefined" && Buffer.isBuffer(value))
  );
}

export function safeSerializeForSearch(value: unknown, maxChars = BODY_MAX_CHARS): string {
  if (value === undefined) {
    return "";
  }
  if (isBinaryLike(value)) {
    return BINARY_MARKER;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return truncateForSearch(String(value), maxChars);
  }
  if (typeof value === "string") {
    return truncateForSearch(value, maxChars);
  }

  const seen = new WeakSet<object>();
  try {
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (nestedValue === undefined) {
        return undefined;
      }
      if (isBinaryLike(nestedValue)) {
        return BINARY_MARKER;
      }
      if (nestedValue && typeof nestedValue === "object") {
        if (seen.has(nestedValue)) {
          return CIRCULAR_MARKER;
        }
        seen.add(nestedValue);
      }
      return nestedValue;
    });
    return truncateForSearch(serialized ?? "", maxChars);
  } catch {
    return CIRCULAR_MARKER;
  }
}

function serializeMapForSearch(value: Record<string, unknown> | undefined): string {
  if (!value) {
    return "";
  }

  const lines: string[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      continue;
    }
    const serialized = Array.isArray(item)
      ? item.map((entry) => safeSerializeForSearch(entry, MAP_MAX_CHARS)).join(",")
      : safeSerializeForSearch(item, MAP_MAX_CHARS);
    lines.push(`${key}: ${serialized}`);
  }
  return truncateForSearch(lines.join("\n"), MAP_MAX_CHARS);
}

function pushIfPresent(parts: string[], value: unknown, maxChars: number): void {
  const serialized = safeSerializeForSearch(value, maxChars);
  if (serialized) {
    parts.push(serialized);
  }
}

export function buildRequestSearchText(record: RequestRecord): string {
  const parts: string[] = [];
  pushIfPresent(parts, record.method, 64);
  pushIfPresent(parts, record.url, URL_MAX_CHARS);
  pushIfPresent(parts, record.host, HOST_MAX_CHARS);
  pushIfPresent(parts, record.path, PATH_MAX_CHARS);
  pushIfPresent(parts, record.statusCode, 32);
  pushIfPresent(parts, record.source, 64);
  pushIfPresent(parts, serializeMapForSearch(record.requestHeaders as Record<string, unknown>), MAP_MAX_CHARS);
  pushIfPresent(parts, serializeMapForSearch(record.requestQuery as Record<string, unknown>), MAP_MAX_CHARS);
  pushIfPresent(parts, record.requestBody, BODY_MAX_CHARS);
  pushIfPresent(parts, serializeMapForSearch(record.responseHeaders as Record<string, unknown>), MAP_MAX_CHARS);
  pushIfPresent(parts, record.responseBody, BODY_MAX_CHARS);

  if (record.resolution) {
    pushIfPresent(parts, record.resolution.mode, 64);
    pushIfPresent(parts, record.resolution.source, 64);
    pushIfPresent(parts, record.resolution.reason, PATH_MAX_CHARS);
    pushIfPresent(parts, record.resolution.matchedRuleName, PATH_MAX_CHARS);
    pushIfPresent(parts, record.resolution.target, RESOLUTION_MAX_CHARS);
  }

  return parts.join("\n");
}

export function matchRequestKeyword(record: RequestRecord, keyword?: string): boolean {
  const normalizedKeyword = keyword?.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }
  return buildRequestSearchText(record).toLowerCase().includes(normalizedKeyword);
}

export function normalizeHostFilter(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return withoutProtocol.split(/[/?#]/, 1)[0]?.toLowerCase() ?? "";
}

export function matchRequestHost(record: RequestRecord, host?: string): boolean {
  const normalizedHost = normalizeHostFilter(host);
  if (!normalizedHost) {
    return true;
  }
  return record.host.toLowerCase().includes(normalizedHost);
}
