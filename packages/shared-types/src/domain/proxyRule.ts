export interface ProxyRule {
  id: string;
  pattern: string;
  matchType: "host";
  action: "proxy" | "direct";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
