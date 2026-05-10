import type {
  AppSetting,
  MockRule,
  ProxyMode,
  ProxyRule,
  RequestRecord,
  SavedRequest,
  ServiceStatus
} from "@polaris/shared-types";
import type { RequestFilters } from "../filters/requestFilters";

export interface ApiEnvelope<T> {
  data: T;
  error?: string;
}

export interface SaveRequestInput {
  name: string;
  requestId?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  tags?: string[];
}

export interface UpdateSavedRequestInput {
  name?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  tags?: string[];
}

export interface RunRequestInput {
  name?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface UpdateMockRuleInput {
  name: string;
  group?: string | null;
  method: string;
  url: string;
  requestBodyExactMatch?: string | null;
  requestBodyKeyMatch?: string | null;
  responseStatus: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  enabled: boolean;
}

export interface CreateMockRuleInput extends UpdateMockRuleInput {}

export interface ToggleMockRuleInput {
  enabled: boolean;
}

export interface SetActiveMockGroupInput {
  group: string | null;
}

export type WhistlePlatform = "windows" | "macos" | "linux";
export type WhistleImportCandidateType = "mock" | "proxy" | "unsupported";
export type WhistleImportConflictMode = "none" | "duplicate";
export type WhistleImportSkipReason =
  | "unsupported_script_rule"
  | "unsupported_plugin_rule"
  | "unsupported_multi_operator_rule"
  | "unsupported_dynamic_value"
  | "unsupported_proxy_granularity"
  | "invalid_matcher"
  | "missing_target"
  | "unresolved_value_reference"
  | "no_supported_mapping";

export interface WhistleImportWarning {
  code:
    | "not_found"
    | "missing_rules_dir"
    | "missing_values_dir"
    | "missing_properties_dir"
    | "invalid_storage"
    | "read_failed";
  message: string;
  detail?: string;
}

export interface WhistleImportSource {
  platform: WhistlePlatform;
  baseDir: string;
  resolvedDir: string | null;
  autoDetected: boolean;
  hasRules: boolean;
  hasValues: boolean;
  hasProperties: boolean;
  ruleFileCount: number;
  valueFileCount: number;
  groupCount: number;
  enabledRuleFileCount: number;
  scanWarnings: WhistleImportWarning[];
}

export interface WhistleImportGroupSummary {
  name: string;
  order: number;
  selected: boolean;
  ruleCount: number;
}

export interface WhistleImportProxyRule {
  id: string;
  name: string;
  pattern: string;
  method: string;
  url: string;
  path: string;
  priority: number;
  action: "proxy" | "direct";
  enabled: boolean;
  matchMode: string;
  queryMatch: string;
  headerMatch: string;
  bodyMatch: string;
  forwardMode: "direct" | "rewriteTarget" | "rewriteHost" | "rewritePath";
  targetUrl: string;
  rewriteHost: string;
  rewritePath: string;
  rewriteQuery: string;
  headerStrategy: "keep" | "inject" | "override" | "remove";
  requestHeaderPreview: string;
  responseHeaderPreview: string;
  responseDelay: number;
  fallbackPolicy: "closed" | "directOnFail" | "ignoreOnMiss";
  createdAt: string;
  updatedAt: string;
}

export interface WhistleImportProxyGroup {
  id: string;
  name: string;
  rules: WhistleImportProxyRule[];
}

interface WhistleImportCandidateBase {
  id: string;
  candidateType: WhistleImportCandidateType;
  groupName: string;
  title: string;
  sourceFileName: string;
  sourceFileKind: "rule" | "defaultRule";
  sourceSummary: string;
  rawLine: string;
  matcher: string;
  enabled: boolean;
  selectedByDefault: boolean;
  compatible: boolean;
  conflictMode: WhistleImportConflictMode;
  targetPreview: string;
  skipReason?: WhistleImportSkipReason;
}

export interface WhistleMockImportCandidate extends WhistleImportCandidateBase {
  candidateType: "mock";
  mockPayload: CreateMockRuleInput;
}

export interface WhistleProxyImportCandidate extends WhistleImportCandidateBase {
  candidateType: "proxy";
  proxyPayload: WhistleImportProxyRule;
}

export interface WhistleUnsupportedImportCandidate extends WhistleImportCandidateBase {
  candidateType: "unsupported";
  compatible: false;
  skipReason: WhistleImportSkipReason;
}

export type WhistleImportCandidate =
  | WhistleMockImportCandidate
  | WhistleProxyImportCandidate
  | WhistleUnsupportedImportCandidate;

export interface WhistleImportScanResponse {
  source: WhistleImportSource;
  groupSummaries: WhistleImportGroupSummary[];
  candidates: WhistleImportCandidate[];
}

export interface WhistleImportExecuteInput {
  mockRules: CreateMockRuleInput[];
  proxyGroups: WhistleImportProxyGroup[];
  currentProxyGroups: WhistleImportProxyGroup[];
  currentProxyActiveGroupId: string | null;
}

export interface WhistleImportResultItem {
  type: "mock" | "proxy" | "unsupported";
  title: string;
  groupName: string;
  status: "created" | "duplicated" | "skipped";
  message: string;
}

export interface WhistleImportExecuteResponse {
  createdMockCount: number;
  createdProxyCount: number;
  createdGroupCount: number;
  duplicatedCount: number;
  skippedCount: number;
  warnings: WhistleImportWarning[];
  items: WhistleImportResultItem[];
  nextProxyGroups: WhistleImportProxyGroup[];
  nextProxyActiveGroupId: string | null;
}

export interface ServiceSnapshot {
  status: ServiceStatus;
  settings: AppSetting;
  proxyRules: ProxyRule[];
  recentRequests: RequestRecord[];
  savedRequests: SavedRequest[];
  mockRules: MockRule[];
}

export interface CoreApiContract {
  "/api/health": { get: ApiEnvelope<ServiceStatus> };
  "/api/bootstrap": { get: ApiEnvelope<ServiceSnapshot> };
  "/api/requests": { get: ApiEnvelope<RequestRecord[]> & { filters?: RequestFilters } };
  "/api/requests/:id": { get: ApiEnvelope<RequestRecord> };
  "/api/requests/:id/save": { post: ApiEnvelope<SavedRequest> & { body: SaveRequestInput } };
  "/api/requests/:id/replay": { post: ApiEnvelope<RequestRecord> };
  "/api/saved-requests": { get: ApiEnvelope<SavedRequest[]>; post: ApiEnvelope<SavedRequest> & { body: SaveRequestInput } };
  "/api/saved-requests/:id": { put: ApiEnvelope<SavedRequest> & { body: UpdateSavedRequestInput }; delete: ApiEnvelope<{ id: string }> };
  "/api/saved-requests/:id/replay": { post: ApiEnvelope<RequestRecord> };
  "/api/mock-rules": { get: ApiEnvelope<MockRule[]>; post: ApiEnvelope<MockRule> & { body: CreateMockRuleInput } };
  "/api/mock-rules/:id": { put: ApiEnvelope<MockRule> & { body: UpdateMockRuleInput }; delete: ApiEnvelope<{ id: string }> };
  "/api/mock-rules/:id/enable": { post: ApiEnvelope<MockRule> & { body: ToggleMockRuleInput } };
  "/api/mock-groups/active": {
    get: ApiEnvelope<{ group: string | null }>;
    post: ApiEnvelope<{ group: string | null }> & { body: SetActiveMockGroupInput };
  };
  "/api/proxy-rules": { get: ApiEnvelope<ProxyRule[]> };
  "/api/proxy-rules/site": {
    post: ApiEnvelope<ProxyRule> & {
      body: {
        host: string;
        action: "proxy" | "direct";
        id?: string;
        path?: string;
        method?: string;
      };
    };
  };
  "/api/proxy-rules/:id": { delete: ApiEnvelope<{ id: string }> };
  "/api/proxy-rules/site/:host": { delete: ApiEnvelope<{ host: string }> };
  "/api/proxy-mode": { post: ApiEnvelope<{ mode: ProxyMode }> & { body: { mode: ProxyMode } } };
  "/api/system-proxy": {
    get: ApiEnvelope<{ enabled: boolean }>;
    post: ApiEnvelope<{ enabled: boolean }> & { body: { enabled: boolean } };
  };
  "/api/whistle-import/scan": { get: ApiEnvelope<WhistleImportScanResponse> };
  "/api/whistle-import/execute": {
    post: ApiEnvelope<WhistleImportExecuteResponse> & { body: WhistleImportExecuteInput };
  };
  "/api/debug/run": { post: ApiEnvelope<RequestRecord> & { body: RunRequestInput } };
  "/api/settings": { get: ApiEnvelope<AppSetting> };
}
