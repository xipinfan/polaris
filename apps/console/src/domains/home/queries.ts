import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";
import { apiClient } from "../../services/apiClient";

export function useHomeOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.home.overview,
    queryFn: async () => {
      const [bootstrap, health, settings] = await Promise.all([
        apiClient.bootstrap(),
        apiClient.health(),
        apiClient.settings(),
      ]);

      return {
        bootstrap,
        health,
        settings,
      };
    },
    staleTime: queryStaleTime.medium,
  });
}
