import type { RequestRecord, SavedRequest } from "@polaris/shared-types";

type CurlSource =
  | RequestRecord
  | SavedRequest
  | {
      method: string;
      url: string;
      headers?: Record<string, string>;
      requestHeaders?: Record<string, string>;
      body?: unknown;
      requestBody?: unknown;
    };

export function buildCurl(record: CurlSource): string {
  const headers = Object.entries("requestHeaders" in record ? (record.requestHeaders ?? {}) : (record.headers ?? {}))
    .map(([key, value]) => `-H "${key}: ${value}"`)
    .join(" ");
  const body = "requestBody" in record ? record.requestBody : record.body;
  const payload = body ? ` --data '${typeof body === "string" ? body : JSON.stringify(body)}'` : "";
  return `curl -X ${record.method} "${record.url}" ${headers}${payload}`.trim();
}
