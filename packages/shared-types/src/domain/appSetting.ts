import type { ProxyMode } from "../enums/proxyMode";

export interface AppSetting {
  localProxyPort: number;
  localApiPort: number;
  mcpPort: number;
  lanIp?: string;
  currentProxyMode: ProxyMode;
  certificateInstalled: boolean;
  mcpEnabled: boolean;
  activeMockGroup: string | null;
  maxRequestCount: number;
  maxRequestBodySize: number;
}
