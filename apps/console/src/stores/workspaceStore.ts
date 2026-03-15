import { create } from "zustand";
import type { RuleView, StoredForwardRule, StoredGroup } from "../domains/proxy-forward/types";
import type { MockFormState, GroupMetaMap } from "../pages/mock/types";

type WorkspaceStoreState = {
  trafficSelectedRequestId?: string;
  trafficCertificateModalOpen: boolean;

  proxyActiveGroupId: string;
  proxyMenuGroupId: string | null;
  proxyHeaderMenuOpen: boolean;
  proxyCollapsedHosts: Record<string, boolean>;
  proxyDrawerRule: RuleView | null;
  proxyEditingRule: StoredForwardRule | null;
  proxyEditingGroup: StoredGroup | null;
  proxyRuleForm: StoredForwardRule | null;
  proxyRuleModalOpen: boolean;
  proxyGroupModalOpen: boolean;
  proxySubmitting: boolean;
  proxyGroupName: string;

  mockSelectedGroup: string;
  mockSelectedRuleId: string | null;
  mockEditingId: string | null;
  mockModalOpen: boolean;
  mockGroupMenuName: string | null;
  mockRuleMenuId: string | null;
  mockCollapsedBlocks: Record<string, boolean>;
  mockCustomGroups: string[];
  mockGroupMeta: GroupMetaMap;
  mockForm: MockFormState | null;

  setTrafficSelectedRequestId: (id?: string) => void;
  setTrafficCertificateModalOpen: (open: boolean) => void;

  setProxyActiveGroupId: (id: string) => void;
  setProxyMenuGroupId: (id: string | null) => void;
  setProxyHeaderMenuOpen: (open: boolean) => void;
  setProxyCollapsedHosts: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  setProxyDrawerRule: (rule: RuleView | null) => void;
  setProxyEditingRule: (rule: StoredForwardRule | null) => void;
  setProxyEditingGroup: (group: StoredGroup | null) => void;
  setProxyRuleForm: (rule: StoredForwardRule | null) => void;
  setProxyRuleModalOpen: (open: boolean) => void;
  setProxyGroupModalOpen: (open: boolean) => void;
  setProxySubmitting: (value: boolean) => void;
  setProxyGroupName: (value: string) => void;

  setMockSelectedGroup: (value: string) => void;
  setMockSelectedRuleId: (value: string | null) => void;
  setMockEditingId: (value: string | null) => void;
  setMockModalOpen: (open: boolean) => void;
  setMockGroupMenuName: (value: string | null) => void;
  setMockRuleMenuId: (value: string | null) => void;
  setMockCollapsedBlocks: (updater: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  setMockCustomGroups: (updater: (current: string[]) => string[]) => void;
  setMockGroupMeta: (updater: (current: GroupMetaMap) => GroupMetaMap) => void;
  setMockForm: (form: MockFormState | null | ((current: MockFormState | null) => MockFormState | null)) => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  trafficSelectedRequestId: undefined,
  trafficCertificateModalOpen: false,

  proxyActiveGroupId: "",
  proxyMenuGroupId: null,
  proxyHeaderMenuOpen: false,
  proxyCollapsedHosts: {},
  proxyDrawerRule: null,
  proxyEditingRule: null,
  proxyEditingGroup: null,
  proxyRuleForm: null,
  proxyRuleModalOpen: false,
  proxyGroupModalOpen: false,
  proxySubmitting: false,
  proxyGroupName: "",

  mockSelectedGroup: "",
  mockSelectedRuleId: null,
  mockEditingId: null,
  mockModalOpen: false,
  mockGroupMenuName: null,
  mockRuleMenuId: null,
  mockCollapsedBlocks: {},
  mockCustomGroups: [],
  mockGroupMeta: {},
  mockForm: null,

  setTrafficSelectedRequestId: (id) => set({ trafficSelectedRequestId: id }),
  setTrafficCertificateModalOpen: (open) => set({ trafficCertificateModalOpen: open }),

  setProxyActiveGroupId: (id) => set({ proxyActiveGroupId: id }),
  setProxyMenuGroupId: (id) => set({ proxyMenuGroupId: id }),
  setProxyHeaderMenuOpen: (open) => set({ proxyHeaderMenuOpen: open }),
  setProxyCollapsedHosts: (updater) => set((state) => ({ proxyCollapsedHosts: updater(state.proxyCollapsedHosts) })),
  setProxyDrawerRule: (rule) => set({ proxyDrawerRule: rule }),
  setProxyEditingRule: (rule) => set({ proxyEditingRule: rule }),
  setProxyEditingGroup: (group) => set({ proxyEditingGroup: group }),
  setProxyRuleForm: (rule) => set({ proxyRuleForm: rule }),
  setProxyRuleModalOpen: (open) => set({ proxyRuleModalOpen: open }),
  setProxyGroupModalOpen: (open) => set({ proxyGroupModalOpen: open }),
  setProxySubmitting: (value) => set({ proxySubmitting: value }),
  setProxyGroupName: (value) => set({ proxyGroupName: value }),

  setMockSelectedGroup: (value) => set({ mockSelectedGroup: value }),
  setMockSelectedRuleId: (value) => set({ mockSelectedRuleId: value }),
  setMockEditingId: (value) => set({ mockEditingId: value }),
  setMockModalOpen: (open) => set({ mockModalOpen: open }),
  setMockGroupMenuName: (value) => set({ mockGroupMenuName: value }),
  setMockRuleMenuId: (value) => set({ mockRuleMenuId: value }),
  setMockCollapsedBlocks: (updater) => set((state) => ({ mockCollapsedBlocks: updater(state.mockCollapsedBlocks) })),
  setMockCustomGroups: (updater) => set((state) => ({ mockCustomGroups: updater(state.mockCustomGroups) })),
  setMockGroupMeta: (updater) => set((state) => ({ mockGroupMeta: updater(state.mockGroupMeta) })),
  setMockForm: (form) =>
    set((state) => ({
      mockForm: typeof form === "function" ? form(state.mockForm) : form,
    })),
}));

export type { WorkspaceStoreState };

