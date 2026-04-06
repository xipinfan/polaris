import { useShallow } from "zustand/react/shallow";
import { uiSelectors, workspaceSelectors } from "../../../stores/selectors";
import { useUiStore } from "../../../stores/uiStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";

export function useProxyForwardWorkspace() {
  const uiState = useUiStore(
    useShallow((state) => ({
      filterMode: uiSelectors.proxyFilterMode(state),
      groupSearch: uiSelectors.proxyGroupSearch(state),
      ruleSearch: uiSelectors.proxyRuleSearch(state),
      sortMode: uiSelectors.proxySortMode(state),
      setProxyFilterMode: state.setProxyFilterMode,
      setProxyRuleSearch: state.setProxyRuleSearch,
    })),
  );

  const workspaceState = useWorkspaceStore(
    useShallow((state) => ({
      editingGroup: workspaceSelectors.proxyEditingGroup(state),
      editingRule: workspaceSelectors.proxyEditingRule(state),
      groupName: workspaceSelectors.proxyGroupName(state),
      headerMenuOpen: workspaceSelectors.proxyHeaderMenuOpen(state),
      isGroupModalOpen: workspaceSelectors.proxyGroupModalOpen(state),
      isRuleModalOpen: workspaceSelectors.proxyRuleModalOpen(state),
      proxyRuleForm: workspaceSelectors.proxyRuleForm(state),
      storeActiveGroupId: workspaceSelectors.proxyActiveGroupId(state),
      submitting: workspaceSelectors.proxySubmitting(state),
      setActiveGroupId: state.setProxyActiveGroupId,
      setEditingGroup: state.setProxyEditingGroup,
      setEditingRule: state.setProxyEditingRule,
      setGroupName: state.setProxyGroupName,
      setHeaderMenuOpen: state.setProxyHeaderMenuOpen,
      setIsGroupModalOpen: state.setProxyGroupModalOpen,
      setIsRuleModalOpen: state.setProxyRuleModalOpen,
      setProxyRuleForm: state.setProxyRuleForm,
      setSubmitting: state.setProxySubmitting,
    })),
  );

  return {
    ...uiState,
    ...workspaceState,
  };
}
