import type { ProxyRule, RequestRecord } from "@polaris/shared-types";

export type FilterMode = "all" | "enabled" | "hits" | "errors";
export type SortMode = "hits" | "created";
export type RuleAction = ProxyRule["action"];
export type ForwardMode = "direct" | "rewriteTarget" | "rewriteHost" | "rewritePath";
export type HeaderStrategy = "keep" | "inject" | "override" | "remove";
export type FallbackPolicy = "closed" | "directOnFail" | "ignoreOnMiss";

export type StoredForwardRule = {
  id: string;
  name: string;
  pattern: string;
  method: string;
  url: string;
  path: string;
  priority: number;
  action: RuleAction;
  enabled: boolean;
  matchMode: string;
  queryMatch: string;
  headerMatch: string;
  bodyMatch: string;
  forwardMode: ForwardMode;
  targetUrl: string;
  rewriteHost: string;
  rewritePath: string;
  rewriteQuery: string;
  headerStrategy: HeaderStrategy;
  requestHeaderPreview: string;
  responseHeaderPreview: string;
  responseDelay: number;
  fallbackPolicy: FallbackPolicy;
  createdAt: string;
  updatedAt: string;
};

export type StoredGroup = {
  id: string;
  name: string;
  rules: StoredForwardRule[];
};
export type RuleView = StoredForwardRule & {
  hitCountToday: number;
  recentErrorCount: number;
  lastHitAt: string | null;
  latestRecord: RequestRecord | null;
  recentRecords: RequestRecord[];
};

export type ProxyForwardGroupsData = {
  groups: StoredGroup[];
  activeGroupId: string;
};

export type SetActiveGroupInput = {
  group: StoredGroup;
};

export type UpsertSiteRuleInput = {
  host: string;
  action: ProxyRule["action"];
};

export type RemoveSiteRuleInput = {
  host: string;
};
