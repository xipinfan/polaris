import { QueryCache, QueryClient, MutationCache } from "@tanstack/react-query";
import { recordApiRetry } from "../../services/apiMetrics";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (_error, query) => {
      if ((query.state.fetchFailureCount ?? 0) > 0) {
        recordApiRetry(String(query.queryHash), query.state.fetchFailureCount);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (_error, _variables, _context, mutation) => {
      if ((mutation.state.failureCount ?? 0) > 0) {
        recordApiRetry(String(mutation.options.mutationKey ?? "mutation"), mutation.state.failureCount);
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
