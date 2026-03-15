import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FilterMode, SortMode } from "../domains/proxy-forward/types";
import type { TrafficFocusMode, TrafficInspectorTab } from "../pages/traffic/types";
import { zustandPersistStorage } from "./persist";

const UI_STORE_VERSION = 2;

type UiStoreState = {
  trafficKeyword: string;
  trafficMethod: string;
  trafficStatusCode: string;
  trafficHostOnly: string;
  trafficFocusMode: TrafficFocusMode;
  trafficInspectorTab: TrafficInspectorTab;
  trafficAutoRefresh: boolean;

  proxyGroupSearch: string;
  proxyRuleSearch: string;
  proxyFilterMode: FilterMode;
  proxySortMode: SortMode;

  mockGroupSearch: string;

  setTrafficKeyword: (value: string) => void;
  setTrafficMethod: (value: string) => void;
  setTrafficStatusCode: (value: string) => void;
  setTrafficHostOnly: (value: string) => void;
  setTrafficFocusMode: (value: TrafficFocusMode) => void;
  setTrafficInspectorTab: (value: TrafficInspectorTab) => void;
  setTrafficAutoRefresh: (value: boolean) => void;

  setProxyGroupSearch: (value: string) => void;
  setProxyRuleSearch: (value: string) => void;
  setProxyFilterMode: (value: FilterMode) => void;
  setProxySortMode: (value: SortMode) => void;

  setMockGroupSearch: (value: string) => void;
  resetUiPreferences: () => void;
};

type UiPersistedState = Pick<
  UiStoreState,
  | "trafficKeyword"
  | "trafficMethod"
  | "trafficStatusCode"
  | "trafficHostOnly"
  | "trafficFocusMode"
  | "trafficAutoRefresh"
  | "proxyGroupSearch"
  | "proxyRuleSearch"
  | "proxyFilterMode"
  | "proxySortMode"
  | "mockGroupSearch"
>;

const initialUiState: UiPersistedState & Pick<UiStoreState, "trafficInspectorTab"> = {
  trafficKeyword: "",
  trafficMethod: "",
  trafficStatusCode: "",
  trafficHostOnly: "",
  trafficFocusMode: "all",
  trafficInspectorTab: "overview",
  trafficAutoRefresh: true,

  proxyGroupSearch: "",
  proxyRuleSearch: "",
  proxyFilterMode: "all",
  proxySortMode: "created",

  mockGroupSearch: "",
};

function toPersistedState(state: UiStoreState): UiPersistedState {
  return {
    trafficKeyword: state.trafficKeyword,
    trafficMethod: state.trafficMethod,
    trafficStatusCode: state.trafficStatusCode,
    trafficHostOnly: state.trafficHostOnly,
    trafficFocusMode: state.trafficFocusMode,
    trafficAutoRefresh: state.trafficAutoRefresh,
    proxyGroupSearch: state.proxyGroupSearch,
    proxyRuleSearch: state.proxyRuleSearch,
    proxyFilterMode: state.proxyFilterMode,
    proxySortMode: state.proxySortMode,
    mockGroupSearch: state.mockGroupSearch,
  };
}

export const useUiStore = create<UiStoreState>()(
  persist(
    (set) => ({
      ...initialUiState,
      setTrafficKeyword: (value) => set({ trafficKeyword: value }),
      setTrafficMethod: (value) => set({ trafficMethod: value }),
      setTrafficStatusCode: (value) => set({ trafficStatusCode: value }),
      setTrafficHostOnly: (value) => set({ trafficHostOnly: value }),
      setTrafficFocusMode: (value) => set({ trafficFocusMode: value }),
      setTrafficInspectorTab: (value) => set({ trafficInspectorTab: value }),
      setTrafficAutoRefresh: (value) => set({ trafficAutoRefresh: value }),

      setProxyGroupSearch: (value) => set({ proxyGroupSearch: value }),
      setProxyRuleSearch: (value) => set({ proxyRuleSearch: value }),
      setProxyFilterMode: (value) => set({ proxyFilterMode: value }),
      setProxySortMode: (value) => set({ proxySortMode: value }),

      setMockGroupSearch: (value) => set({ mockGroupSearch: value }),
      resetUiPreferences: () => set(initialUiState),
    }),
    {
      name: "polaris.console.zustand.ui",
      version: UI_STORE_VERSION,
      storage: zustandPersistStorage,
      partialize: (state) => toPersistedState(state) as unknown as UiStoreState,
      migrate: (persistedState, fromVersion) => {
        if (!persistedState || fromVersion > UI_STORE_VERSION) {
          return initialUiState as unknown as UiStoreState;
        }

        const legacy = persistedState as Partial<UiPersistedState>;
        const normalizedSortMode =
          legacy.proxySortMode === "hits" || legacy.proxySortMode === "created"
            ? legacy.proxySortMode
            : "created";

        return {
          ...initialUiState,
          ...legacy,
          proxySortMode: normalizedSortMode,
        } as unknown as UiStoreState;
      },
    },
  ),
);

export type { UiStoreState };

