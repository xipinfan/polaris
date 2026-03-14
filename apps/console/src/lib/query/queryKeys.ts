import type { TrafficRequestFilters } from "../../domains/traffic/types";

export const queryKeys = {
  proxyForward: {
    root: ["proxyForward"] as const,
    groups: ["proxyForward", "groups"] as const,
    rules: ["proxyForward", "rules"] as const,
  },
  traffic: {
    root: ["traffic"] as const,
    requests: (params: TrafficRequestFilters) => ["traffic", "requests", params] as const,
    request: (id: string) => ["traffic", "request", id] as const,
  },
  mock: {
    root: ["mock"] as const,
    rules: ["mock", "rules"] as const,
    activeGroup: ["mock", "activeGroup"] as const,
  },
  home: {
    overview: ["home", "overview"] as const,
  },
  settings: {
    root: ["settings"] as const,
    app: ["settings", "app"] as const,
    health: ["settings", "health"] as const,
    proxyRules: ["settings", "proxyRules"] as const,
  },
};
