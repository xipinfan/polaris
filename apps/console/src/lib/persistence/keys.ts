export const persistenceKeys = {
  apiPort: "polaris.apiPort",
  mock: {
    groups: "polaris.console.mock.groups",
    groupMeta: "polaris.console.mock.group-meta",
  },
  proxyForward: {
    groups: "polaris.console.proxy-forward.groups",
    activeGroup: "polaris.console.proxy-forward.active-group",
  },
} as const;
