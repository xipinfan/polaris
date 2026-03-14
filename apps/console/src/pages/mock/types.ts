import type { MockRule, RequestRecord } from "@polaris/shared-types";

export type MockPageLocationState = {
  seedRequest?: RequestRecord;
};

export type GroupMetaMap = Record<string, { description?: string }>;

export type RuleUrlBlock = {
  key: string;
  host: string;
  label: string;
  rules: MockRule[];
};

export type MockFormState = {
  group: string;
  variant: string;
  method: string;
  url: string;
  responseStatus: number;
  responseHeaders: string;
  responseBody: string;
  enabled: boolean;
  allowProxy: boolean;
  delayMs: number;
  priority: number;
};

