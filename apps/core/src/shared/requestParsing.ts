import zlib from "node:zlib";
import type { KeyValueMap } from "@polaris/shared-types";

const binaryContentTypeMarkers = [
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/x-zip",
  "application/x-rar",
  "application/x-7z",
  "application/x-gzip",
  "application/gzip",
  "application/wasm",
  "application/protobuf",
  "multipart/",
  "image/",
  "audio/",
  "video/",
  "font/",
];

function decodeContent(buffer: Buffer, encoding?: string): Buffer {
  const normalized = encoding?.toLowerCase();
  if (!normalized || normalized === "identity") {
    return buffer;
  }

  try {
    if (normalized.includes("gzip")) {
      return zlib.gunzipSync(buffer);
    }
    if (normalized.includes("deflate")) {
      return zlib.inflateSync(buffer);
    }
    if (normalized.includes("br")) {
      return zlib.brotliDecompressSync(buffer);
    }
  } catch {
    return buffer;
  }

  return buffer;
}

function isBinaryContentType(contentType: string) {
  return binaryContentTypeMarkers.some((marker) =>
    contentType.includes(marker),
  );
}

function extractCharset(contentType: string) {
  const match = contentType.match(/charset\s*=\s*("?)([^";,\s]+)\1/i);
  return match?.[2]?.trim().toLowerCase();
}

function decodeTextBuffer(buffer: Buffer, charset?: string) {
  const candidates = charset ? [charset, "utf-8"] : ["utf-8"];

  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate, { fatal: true }).decode(buffer);
    } catch {
      continue;
    }
  }

  return buffer.toString("utf8");
}

function looksLikeStructuredText(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("\"") ||
    trimmed === "null" ||
    trimmed === "true" ||
    trimmed === "false"
  );
}

export function parseSearchParamsRecord(
  searchParams: URLSearchParams,
): KeyValueMap {
  const entries = new Map<string, string[]>();

  for (const [key, value] of searchParams.entries()) {
    const bucket = entries.get(key) ?? [];
    bucket.push(value);
    entries.set(key, bucket);
  }

  return Object.fromEntries(
    Array.from(entries.entries()).map(([key, values]) => [
      key,
      values.join(", "),
    ]),
  );
}

export function normalizeCapturedBody(
  buffer: Buffer,
  headers: Record<string, string>,
) {
  if (!buffer.length) {
    return null;
  }

  const decoded = decodeContent(buffer, headers["content-encoding"]);
  const contentType = (headers["content-type"] ?? "").toLowerCase();
  if (isBinaryContentType(contentType)) {
    return `[binary ${decoded.length} bytes]`;
  }

  const text = decodeTextBuffer(decoded, extractCharset(contentType));
  if (!text) {
    return "";
  }

  if (contentType.includes("x-www-form-urlencoded")) {
    return parseSearchParamsRecord(new URLSearchParams(text));
  }

  if (
    contentType.includes("json") ||
    contentType.includes("+json") ||
    looksLikeStructuredText(text)
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}
