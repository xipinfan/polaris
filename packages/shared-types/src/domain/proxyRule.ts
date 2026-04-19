export interface ProxyRule {
  id: string;
  pattern: string;
  matchType: "host" | "host+path";
  // 匹配路径，仅 matchType 为 "host+path" 时生效
  path?: string;
  // 匹配 HTTP 方法，为空表示匹配所有方法
  method?: string;
  action: "proxy" | "direct";
  forwardMode?: "direct" | "rewriteTarget" | "rewriteHost" | "rewritePath";
  targetUrl?: string;
  rewriteHost?: string;
  rewritePath?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
