import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";
import { buildProxyForwardGroupsData } from "./adapters";

export function useProxyForwardGroupsQuery() {
  return useQuery({
    queryKey: queryKeys.proxyForward.groups,
    queryFn: async () => {
      const backendRules = await apiClient.listProxyRules();
      return buildProxyForwardGroupsData(backendRules);
    },
    staleTime: queryStaleTime.baseConfig,
  });
}

export function useProxyForwardRulesQuery() {
  return useQuery({
    queryKey: queryKeys.proxyForward.rules,
    queryFn: () => apiClient.listProxyRules(),
    staleTime: queryStaleTime.medium,
  });
}
