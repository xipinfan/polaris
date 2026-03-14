import type { ProxyMode } from "./types";

export function getProxyModeLabel(mode: ProxyMode) {
  if (mode === "rules") {
    return "规则代理";
  }
  if (mode === "direct") {
    return "直连模式";
  }
  if (mode === "global") {
    return "全局代理";
  }
  return "跟随系统";
}
