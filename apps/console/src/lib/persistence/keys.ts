export const persistenceKeys = {
  locale: "polaris.console.locale",
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
