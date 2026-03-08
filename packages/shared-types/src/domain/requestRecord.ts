import type { JsonValue, KeyValueMap } from "../common/json";

export interface RequestRecord {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  statusCode: number;
  duration: number;
  requestHeaders: KeyValueMap;
  requestQuery: KeyValueMap;
  requestBody: string | JsonValue | null;
  responseHeaders: KeyValueMap;
  responseBody: string | JsonValue | null;
  createdAt: string;
  source: "proxy" | "debug";
  secure: boolean;
}
