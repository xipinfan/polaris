import type { JsonValue, KeyValueMap } from "../common/json";

export interface MockRule {
  id: string;
  name: string;
  method: string;
  url: string;
  responseStatus: number;
  responseHeaders: KeyValueMap;
  responseBody: string | JsonValue | null;
  enabled: boolean;
  hitCount: number;
  lastHitAt?: string;
  createdAt: string;
  updatedAt: string;
}
