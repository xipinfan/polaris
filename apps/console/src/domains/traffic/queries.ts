import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";
import { normalizeTrafficFilters, sortRequestsByCreatedAt, toRequestSearchParams } from "./adapters";
import type { TrafficRequestFilters, TrafficRequestsQueryOptions } from "./types";

const refreshIntervalMs = 3_000;

export function useTrafficRequestsQuery(filters: TrafficRequestFilters, options: TrafficRequestsQueryOptions) {
  const normalized = normalizeTrafficFilters(filters);

  return useQuery({
    queryKey: queryKeys.traffic.requests(normalized),
    queryFn: async () => {
      const requests = await apiClient.listRequests(toRequestSearchParams(normalized));
      return sortRequestsByCreatedAt(requests);
    },
    staleTime: queryStaleTime.highFrequency,
    refetchInterval: options.autoRefresh ? refreshIntervalMs : false,
  });
}

export function useTrafficRequestQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.traffic.request(id ?? ""),
    queryFn: () => apiClient.getRequest(id ?? ""),
    enabled: Boolean(id),
    staleTime: queryStaleTime.medium,
  });
}

export function useTrafficSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings.app,
    queryFn: () => apiClient.settings(),
    staleTime: queryStaleTime.baseConfig,
  });
}
