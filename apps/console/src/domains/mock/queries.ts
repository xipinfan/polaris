import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";
import { apiClient } from "../../services/apiClient";

export function useMockRulesQuery() {
  return useQuery({
    queryKey: queryKeys.mock.rules,
    queryFn: () => apiClient.listMockRules(),
    staleTime: queryStaleTime.medium,
  });
}

export function useMockActiveGroupQuery() {
  return useQuery({
    queryKey: queryKeys.mock.activeGroup,
    queryFn: () => apiClient.getActiveMockGroup(),
    staleTime: queryStaleTime.baseConfig,
  });
}
