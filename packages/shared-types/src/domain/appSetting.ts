import type { ProxyMode } from "../enums/proxyMode";

export interface AppSetting {
  localProxyPort: number;
  localApiPort: number;
  mcpPort: number;
  currentProxyMode: ProxyMode;
  certificateInstalled: boolean;
  mcpEnabled: boolean;
}
