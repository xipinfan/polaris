import type { FallbackPolicy, ForwardMode, HeaderStrategy } from "../types";
import { sanitizeText } from "./proxyForwardHelpers";

export function getForwardModeLabel(mode: ForwardMode) {
  switch (mode) {
    case "direct":
      return "直连转发";
    case "rewriteHost":
      return "仅改写 Host";
    case "rewritePath":
      return "仅改写 Path";
    default:
      return "改写目标地址";
  }
}

export function getHeaderStrategyLabel(strategy: HeaderStrategy) {
  switch (strategy) {
    case "inject":
      return "注入";
    case "override":
      return "覆盖";
    case "remove":
      return "删除";
    default:
      return "保留原始";
  }
}

export function getFallbackPolicyLabel(policy: FallbackPolicy) {
  switch (policy) {
    case "directOnFail":
      return "失败时直连";
    case "ignoreOnMiss":
      return "未命中不处理";
    default:
      return "关闭";
  }
}

export function countPreviewEntries(source: string | null | undefined) {
  const safeSource = sanitizeText(source, "");
  if (!safeSource) {
    return 0;
  }
  try {
    const parsed = JSON.parse(safeSource) as Record<string, unknown>;
    return Object.keys(parsed).length;
  } catch {
    return safeSource
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  }
}
