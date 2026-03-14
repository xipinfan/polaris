import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/queryKeys";
import { apiClient } from "../../services/apiClient";

async function invalidateMock(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.mock.rules }),
    queryClient.invalidateQueries({ queryKey: queryKeys.mock.activeGroup }),
  ]);
}

export function useSetActiveMockGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (group: string | null) => apiClient.setActiveMockGroup(group),
    onSuccess: async () => {
      await invalidateMock(queryClient);
    },
  });
}

export function useCreateMockRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMockRuleInput) => apiClient.createMockRule(payload),
    onSuccess: async () => {
      await invalidateMock(queryClient);
    },
  });
}

export function useUpdateMockRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMockRuleInput }) =>
      apiClient.updateMockRule(id, payload),
    onSuccess: async () => {
      await invalidateMock(queryClient);
    },
  });
}

export function useEnableMockRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiClient.enableMockRule(id, enabled),
    onSuccess: async () => {
      await invalidateMock(queryClient);
    },
  });
}

export function useDeleteMockRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteMockRule(id),
    onSuccess: async () => {
      await invalidateMock(queryClient);
    },
  });
}
