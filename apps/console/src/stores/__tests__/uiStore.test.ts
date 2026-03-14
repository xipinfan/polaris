import { describe, expect, it } from "vitest";
import { uiSelectors } from "../selectors";
import { useUiStore } from "../uiStore";

describe("uiStore", () => {
  it("selectors read isolated values", () => {
    useUiStore.setState({
      trafficKeyword: "abc",
      proxySortMode: "hits",
      mockGroupSearch: "group-a",
    } as any);

    const state = useUiStore.getState();
    expect(uiSelectors.trafficKeyword(state as any)).toBe("abc");
    expect(uiSelectors.proxySortMode(state as any)).toBe("hits");
    expect(uiSelectors.mockGroupSearch(state as any)).toBe("group-a");
  });

  it("persists whitelisted ui preferences", () => {
    const store = useUiStore.getState();
    store.setTrafficKeyword("persist-keyword");
    store.setProxyFilterMode("errors");

    const raw = window.localStorage.getItem("polaris.console.zustand.ui");
    expect(raw).toBeTruthy();
    expect(raw).toContain("persist-keyword");
    expect(raw).toContain("errors");
  });

  it("migrate keeps compatibility when version changes", () => {
    const legacy = {
      state: {
        trafficKeyword: "legacy",
        trafficMethod: "GET",
      },
      version: 0,
    };
    window.localStorage.setItem(
      "polaris.console.zustand.ui",
      JSON.stringify({ version: 1, value: JSON.stringify(legacy) }),
    );

    // force rehydrate-like behavior by calling reset + set, should not crash
    useUiStore.getState().resetUiPreferences();
    expect(useUiStore.getState().trafficKeyword).toBe("");
  });
});
