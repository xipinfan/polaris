export const requestHooks = [
  "onRequestCaptured",
  "beforeRequestReplay",
  "afterRequestReplay",
  "beforeRequestSave",
  "afterRequestSave"
] as const;

export const mockHooks = [
  "beforeMockCreate",
  "afterMockCreate",
  "beforeMockMatch",
  "afterMockHit",
  "beforeMockResponse"
] as const;

export const mcpHooks = [
  "registerTool",
  "registerResource",
  "beforeToolInvoke",
  "afterToolInvoke"
] as const;
