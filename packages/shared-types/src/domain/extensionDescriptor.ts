export interface ExtensionDescriptor {
  extensionId: string;
  name: string;
  version: string;
  capabilities: string[];
  hooks: string[];
  uiSlots: string[];
  mcpContributions: string[];
}
