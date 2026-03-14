import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";
import { apiClient } from "../../services/apiClient";

export function useSettingsOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.settings.root,
    queryFn: async () => {
      const [health, settings, proxyRules] = await Promise.all([
        apiClient.health(),
        apiClient.settings(),
        apiClient.listProxyRules(),
      ]);

      return {
        health,
        settings,
        proxyRules,
      };
    },
    staleTime: queryStaleTime.baseConfig,
  });
}
