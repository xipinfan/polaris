import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { apiClient } from "../../services/apiClient";

export function useSetSystemProxyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nextEnabled: boolean) => apiClient.setSystemProxy(nextEnabled),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.root }),
        queryClient.invalidateQueries({ queryKey: queryKeys.home.overview }),
      ]);
    },
  });
}
