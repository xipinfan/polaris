import { useUiStore } from "./uiStore";
import { useWorkspaceStore } from "./workspaceStore";

export const uiSelectors = {
  trafficKeyword: (state: ReturnType<typeof useUiStore.getState>) => state.trafficKeyword,
  trafficMethod: (state: ReturnType<typeof useUiStore.getState>) => state.trafficMethod,
  trafficStatusCode: (state: ReturnType<typeof useUiStore.getState>) => state.trafficStatusCode,
  trafficHostOnly: (state: ReturnType<typeof useUiStore.getState>) => state.trafficHostOnly,
  trafficFocusMode: (state: ReturnType<typeof useUiStore.getState>) => state.trafficFocusMode,
  trafficInspectorTab: (state: ReturnType<typeof useUiStore.getState>) => state.trafficInspectorTab,
  trafficAutoRefresh: (state: ReturnType<typeof useUiStore.getState>) => state.trafficAutoRefresh,
  proxyGroupSearch: (state: ReturnType<typeof useUiStore.getState>) => state.proxyGroupSearch,
  proxyRuleSearch: (state: ReturnType<typeof useUiStore.getState>) => state.proxyRuleSearch,
  proxyFilterMode: (state: ReturnType<typeof useUiStore.getState>) => state.proxyFilterMode,
  proxySortMode: (state: ReturnType<typeof useUiStore.getState>) => state.proxySortMode,
  mockGroupSearch: (state: ReturnType<typeof useUiStore.getState>) => state.mockGroupSearch,
};

export const workspaceSelectors = {
  trafficSelectedRequestId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.trafficSelectedRequestId,
  trafficCertificateModalOpen: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.trafficCertificateModalOpen,
  proxyActiveGroupId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyActiveGroupId,
  proxyMenuGroupId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyMenuGroupId,
  proxyHeaderMenuOpen: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyHeaderMenuOpen,
  proxyCollapsedHosts: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyCollapsedHosts,
  proxyDrawerRule: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyDrawerRule,
  proxyEditingRule: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyEditingRule,
  proxyEditingGroup: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyEditingGroup,
  proxyRuleForm: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyRuleForm,
  proxyRuleModalOpen: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyRuleModalOpen,
  proxyGroupModalOpen: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyGroupModalOpen,
  proxySubmitting: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxySubmitting,
  proxyGroupName: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.proxyGroupName,
  mockSelectedGroup: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockSelectedGroup,
  mockSelectedRuleId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockSelectedRuleId,
  mockEditingId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockEditingId,
  mockModalOpen: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockModalOpen,
  mockGroupMenuName: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockGroupMenuName,
  mockRuleMenuId: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockRuleMenuId,
  mockCollapsedBlocks: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockCollapsedBlocks,
  mockCustomGroups: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockCustomGroups,
  mockGroupMeta: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockGroupMeta,
  mockForm: (state: ReturnType<typeof useWorkspaceStore.getState>) => state.mockForm,
};
