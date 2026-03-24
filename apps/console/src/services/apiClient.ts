import type {
  CreateMockRuleInput,
  RunRequestInput,
  SaveRequestInput,
  ServiceSnapshot,
  UpdateMockRuleInput
} from "@polaris/shared-contracts";
import type {
  AppSetting,
  MockRule,
  ProxyMode,
  ProxyRule,
  RequestRecord,
  SavedRequest,
  ServiceStatus
} from "@polaris/shared-types";
import type { UpsertSiteRuleInput } from "../domains/proxy-forward/types";
import { mapApiError, ApiError } from "./apiErrors";
import { recordApiRequest } from "./apiMetrics";
import { getApiBaseUrl } from "./coreDiscovery";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const startedAt = Date.now();
  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json"
      },
      ...init
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ApiError({
        message: "Invalid response payload",
        code: "PARSE_ERROR",
        path,
        status: response.status,
        details: error,
      });
    }

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String((payload as { error?: unknown }).error ?? "Request failed")
          : "Request failed";

      throw new ApiError({
        message,
        code: "HTTP_ERROR",
        path,
        status: response.status,
        details: payload,
      });
    }

    recordApiRequest({ path, durationMs: Date.now() - startedAt, ok: true });

    if (typeof payload === "object" && payload && "data" in payload) {
      return (payload as { data: T }).data;
    }

    throw new ApiError({
      message: "Missing response data",
      code: "PARSE_ERROR",
      path,
      status: response.status,
      details: payload,
    });
  } catch (error) {
    const mapped = mapApiError(error, path);
    if (mapped.code === "UNKNOWN_ERROR") {
      mapped.code = "NETWORK_ERROR";
    }
    recordApiRequest({ path, durationMs: Date.now() - startedAt, ok: false });
    throw mapped;
  }
}

export const apiClient = {
  bootstrap: () => request<ServiceSnapshot>("/bootstrap"),
  health: () => request<ServiceStatus>("/health"),
  listRequests: (params?: URLSearchParams) => request<RequestRecord[]>(`/requests${params ? `?${params.toString()}` : ""}`),
  clearRequests: () => request<{ cleared: true }>("/requests", { method: "DELETE" }),
  getRequest: (id: string) => request<RequestRecord>(`/requests/${id}`),
  saveCapturedRequest: (id: string, body: SaveRequestInput) =>
    request<SavedRequest>(`/requests/${id}/save`, { method: "POST", body: JSON.stringify(body) }),
  replayCapturedRequest: (id: string) => request<RequestRecord>(`/requests/${id}/replay`, { method: "POST" }),
  listSavedRequests: () => request<SavedRequest[]>("/saved-requests"),
  saveManualRequest: (body: SaveRequestInput) =>
    request<SavedRequest>("/saved-requests", { method: "POST", body: JSON.stringify(body) }),
  updateSavedRequest: (id: string, body: SaveRequestInput) =>
    request<SavedRequest>(`/saved-requests/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSavedRequest: (id: string) => request<{ id: string }>(`/saved-requests/${id}`, { method: "DELETE" }),
  replaySavedRequest: (id: string) => request<RequestRecord>(`/saved-requests/${id}/replay`, { method: "POST" }),
  listMockRules: () => request<MockRule[]>("/mock-rules"),
  createMockRule: (body: CreateMockRuleInput) =>
    request<MockRule>("/mock-rules", { method: "POST", body: JSON.stringify(body) }),
  updateMockRule: (id: string, body: UpdateMockRuleInput) =>
    request<MockRule>(`/mock-rules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteMockRule: (id: string) => request<{ id: string }>(`/mock-rules/${id}`, { method: "DELETE" }),
  enableMockRule: (id: string, enabled: boolean) =>
    request<MockRule>(`/mock-rules/${id}/enable`, { method: "POST", body: JSON.stringify({ enabled }) }),
  getActiveMockGroup: () => request<{ group: string | null }>("/mock-groups/active"),
  setActiveMockGroup: (group: string | null) =>
    request<{ group: string | null }>("/mock-groups/active", { method: "POST", body: JSON.stringify({ group }) }),
  listProxyRules: () => request<ProxyRule[]>("/proxy-rules"),
  setProxyMode: (mode: ProxyMode) =>
    request<{ mode: ProxyMode }>("/proxy-mode", { method: "POST", body: JSON.stringify({ mode }) }),
  upsertSiteRule: (body: UpsertSiteRuleInput) =>
    request<ProxyRule>("/proxy-rules/site", { method: "POST", body: JSON.stringify(body) }),
  removeSiteRule: (host: string) =>
    request<{ host: string }>(`/proxy-rules/site/${encodeURIComponent(host)}`, { method: "DELETE" }),
  runRequest: (body: RunRequestInput) => request<RequestRecord>("/debug/run", { method: "POST", body: JSON.stringify(body) }),
  settings: () => request<AppSetting>("/settings")
};
