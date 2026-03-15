import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { queryKeys } from "../../lib/query/queryKeys";
import type { RemoveSiteRuleInput, SetActiveGroupInput, UpsertSiteRuleInput } from "./types";

type ProxyForwardMutationApi = Pick<
  typeof apiClient,
  "listProxyRules" | "removeSiteRule" | "upsertSiteRule" | "setProxyMode"
>;

export async function applyActiveProxyForwardGroup(
  group: SetActiveGroupInput["group"],
  api: ProxyForwardMutationApi,
) {
  const currentRules = await api.listProxyRules();

  for (const rule of currentRules) {
    await api.removeSiteRule(rule.pattern);
  }

  const enabledRulesByHost = new Map(
    group.rules
      .filter((rule) => rule.enabled)
      .map((rule) => [rule.pattern, rule.action] as const),
  );

  for (const [host, action] of enabledRulesByHost) {
    await api.upsertSiteRule(host, action);
  }

  return group;
}

async function invalidateProxyForwardQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.proxyForward.groups }),
    queryClient.invalidateQueries({ queryKey: queryKeys.proxyForward.rules }),
  ]);
}

export function useSetActiveProxyForwardGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ group }: SetActiveGroupInput) => applyActiveProxyForwardGroup(group, apiClient),
    onSuccess: async () => {
      await invalidateProxyForwardQueries(queryClient);
    },
  });
}

export function useUpsertProxyForwardSiteRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ host, action }: UpsertSiteRuleInput) => apiClient.upsertSiteRule(host, action),
    onSuccess: async () => {
      await invalidateProxyForwardQueries(queryClient);
    },
  });
}

export function useRemoveProxyForwardSiteRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ host }: RemoveSiteRuleInput) => apiClient.removeSiteRule(host),
    onSuccess: async () => {
      await invalidateProxyForwardQueries(queryClient);
    },
  });
}

export function useSetProxyForwardModeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: "direct" | "global" | "rules" | "system") =>
      apiClient.setProxyMode(mode),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.home.overview }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.root }),
      ]);
    },
  });
}
