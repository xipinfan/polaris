import type { MockRule } from "@polaris/shared-types";

export type ExportTableRecord = {
  key: string;
  method: string;
  name: string;
  url: string;
  rule: MockRule;
};

export type DuplicateUrlBlockDraft = {
  sourceUrl: string;
  rules: MockRule[];
  url: string;
  requestBodyExactMatch: string;
  requestBodyKeyMatch: string;
};
