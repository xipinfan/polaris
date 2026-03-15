import type { JsonValue, KeyValueMap } from "../common/json";

export type RequestResolutionMode = "direct" | "mock" | "proxy_forward" | "block" | "error";

export type RequestResolutionSource = "mock_engine" | "proxy_rules" | "proxy_global" | "none";

export interface RequestResolution {
  mode: RequestResolutionMode;
  source: RequestResolutionSource;
  matchedRuleId?: string | null;
  matchedRuleName?: string | null;
  target?: string | null;
  reason: string;
  decidedAt: string;
}

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
  resolution?: RequestResolution;
}
