import { mcpHooks, mockHooks, requestHooks, uiSlots } from "@polaris/extension-sdk";

export class ExtensionHost {
  getHookSummary() {
    return {
      requestHooks: [...requestHooks],
      mockHooks: [...mockHooks],
      mcpHooks: [...mcpHooks],
      uiSlots: [...uiSlots]
    };
  }

  async emit(_hook: string, payload: unknown): Promise<unknown> {
    return payload;
  }
}
