import type { ExtensionDescriptor } from "@polaris/shared-types";

export const internalExtensionDescriptor: ExtensionDescriptor = {
  extensionId: "polaris.internal.v1",
  name: "Polaris Internal Extension Host",
  version: "0.1.0",
  capabilities: ["request-hooks", "mock-hooks", "mcp-contributions", "ui-slots"],
  hooks: [],
  uiSlots: [],
  mcpContributions: []
};
