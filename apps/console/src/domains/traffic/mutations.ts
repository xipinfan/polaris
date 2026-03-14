import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RequestRecord } from "@polaris/shared-types";
import { queryKeys } from "../../lib/query/queryKeys";
import { apiClient } from "../../services/apiClient";

type TrafficMutationApi = Pick<typeof apiClient, "clearRequests" | "replayCapturedRequest">;

export function createClearTrafficRequestsMutationOptions(queryClient: QueryClient, api: TrafficMutationApi) {
  return {
    mutationFn: () => api.clearRequests(),
    onMutate: async () => {
      const snapshots = queryClient.getQueriesData<RequestRecord[]>({ queryKey: queryKeys.traffic.root });
      queryClient.setQueriesData<RequestRecord[]>({ queryKey: queryKeys.traffic.root }, []);
      return { snapshots };
    },
    onError: (_error: unknown, _variables: void, context: { snapshots: Array<[readonly unknown[], RequestRecord[] | undefined]> } | undefined) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.traffic.root });
    },
  };
}

export function createReplayTrafficRequestMutationOptions(queryClient: QueryClient, api: TrafficMutationApi) {
  return {
    mutationFn: (id: string) => api.replayCapturedRequest(id),
    onSuccess: async (_data: RequestRecord, id: string) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.traffic.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.traffic.request(id) }),
      ]);
    },
  };
}

export function useClearTrafficRequestsMutation() {
  const queryClient = useQueryClient();

  return useMutation(createClearTrafficRequestsMutationOptions(queryClient, apiClient));
}

export function useReplayTrafficRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation(createReplayTrafficRequestMutationOptions(queryClient, apiClient));
}
