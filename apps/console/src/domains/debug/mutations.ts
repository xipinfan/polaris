import type { RunRequestInput, SaveRequestInput } from "@polaris/shared-contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { apiClient } from "../../services/apiClient";

export function useRunDebugRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RunRequestInput) => apiClient.runRequest(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.traffic.root });
    },
  });
}

export function useSaveDebugRequestMutation() {
  return useMutation({
    mutationFn: (payload: SaveRequestInput) => apiClient.saveManualRequest(payload),
  });
}
