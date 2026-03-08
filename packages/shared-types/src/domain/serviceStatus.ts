import type { ProxyMode } from "../enums/proxyMode";

export interface ServiceStatus {
  online: boolean;
  proxyPort: number;
  apiPort: number;
  mcpPort: number;
  proxyMode: ProxyMode;
  mcpEnabled: boolean;
  certificateInstalled: boolean;
  activeRequestCount: number;
}
