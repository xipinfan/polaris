export interface ProxyRule {
  id: string;
  pattern: string;
  matchType: "host";
  action: "proxy" | "direct";
  forwardMode?: "direct" | "rewriteTarget" | "rewriteHost" | "rewritePath";
  targetUrl?: string;
  rewriteHost?: string;
  rewritePath?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
