import type { AppSetting } from "@polaris/shared-types";

const envNumber = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const defaultSettings: AppSetting = {
  localProxyPort: envNumber("POLARIS_PROXY_PORT", 9000),
  localApiPort: envNumber("POLARIS_API_PORT", 9001),
  mcpPort: envNumber("POLARIS_MCP_PORT", 9002),
  currentProxyMode: (process.env.POLARIS_PROXY_MODE as AppSetting["currentProxyMode"]) ?? "direct",
  certificateInstalled: false,
  mcpEnabled: process.env.POLARIS_MCP_ENABLED === "false" ? false : true,
  activeMockGroup: null
};
