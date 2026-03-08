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
  method: string;
  url: string;
  responseStatus: number;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  enabled: boolean;
}

export interface CreateMockRuleInput extends UpdateMockRuleInput {}

export interface ToggleMockRuleInput {
  enabled: boolean;
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
  "/api/saved-requests/:id": { put: ApiEnvelope<SavedRequest> & { body: SaveRequestInput }; delete: ApiEnvelope<{ id: string }> };
  "/api/saved-requests/:id/replay": { post: ApiEnvelope<RequestRecord> };
  "/api/mock-rules": { get: ApiEnvelope<MockRule[]>; post: ApiEnvelope<MockRule> & { body: CreateMockRuleInput } };
  "/api/mock-rules/:id": { put: ApiEnvelope<MockRule> & { body: UpdateMockRuleInput }; delete: ApiEnvelope<{ id: string }> };
  "/api/mock-rules/:id/enable": { post: ApiEnvelope<MockRule> & { body: ToggleMockRuleInput } };
  "/api/proxy-rules": { get: ApiEnvelope<ProxyRule[]> };
  "/api/proxy-rules/site": { post: ApiEnvelope<ProxyRule> & { body: { host: string; action: "proxy" | "direct" } } };
  "/api/proxy-rules/site/:host": { delete: ApiEnvelope<{ host: string }> };
  "/api/proxy-mode": { post: ApiEnvelope<{ mode: ProxyMode }> & { body: { mode: ProxyMode } } };
  "/api/debug/run": { post: ApiEnvelope<RequestRecord> & { body: RunRequestInput } };
  "/api/settings": { get: ApiEnvelope<AppSetting> };
}
