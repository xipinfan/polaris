import type { JsonValue, KeyValueMap } from "../common/json";

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: KeyValueMap;
  query: KeyValueMap;
  body: string | JsonValue | null;
  tags: string[];
  sourceType: "captured" | "manual";
  sourceRequestId?: string;
  updatedAt: string;
}
