import type { RequestRecord } from "@polaris/shared-types";
import type { CertificatePlatform } from "../types";

export type TrafficResolutionViewMode =
  | "mock"
  | "proxy_forward"
  | "direct"
  | "block"
  | "error"
  | "unknown";

export function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function formatRequestTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getStatusTone(statusCode: number) {
  if (statusCode >= 500) return "danger" as const;
  if (statusCode >= 400) return "warning" as const;
  if (statusCode >= 300) return "muted" as const;
  return "success" as const;
}

export function getProtocolLabel(item: RequestRecord) {
  return item.secure ? "HTTPS" : "HTTP";
}

export function getContentType(item: RequestRecord) {
  const contentType = item.responseHeaders["content-type"] ?? item.responseHeaders["Content-Type"];
  return typeof contentType === "string" ? contentType : "-";
}

export function getRequestResolutionMode(item: RequestRecord): TrafficResolutionViewMode {
  return item.resolution?.mode ?? "unknown";
}

export function getRequestResolutionReason(item: RequestRecord): string | undefined {
  return item.resolution?.reason;
}

export function getRequestResolutionLabelByMode(mode: TrafficResolutionViewMode): string {
  switch (mode) {
    case "mock":
      return "模拟";
    case "proxy_forward":
      return "转发代理";
    case "direct":
      return "直连";
    case "block":
      return "阻断";
    case "error":
      return "异常";
    default:
      return "未知";
  }
}

export function getRequestResolutionLabel(item: RequestRecord): string {
  return getRequestResolutionLabelByMode(getRequestResolutionMode(item));
}

export function getRequestResolutionSourceLabel(item: RequestRecord): string {
  switch (item.resolution?.source) {
    case "mock_engine":
      return "模拟引擎";
    case "proxy_rules":
      return "代理规则";
    case "proxy_global":
      return "全局代理模式";
    case "none":
      return "无";
    default:
      return "-";
  }
}

export function getRequestResolutionTooltip(item: RequestRecord): string {
  const lines = [`处理模式: ${getRequestResolutionLabel(item)}`];
  if (item.resolution?.matchedRuleName || item.resolution?.matchedRuleId) {
    lines.push(`命中规则: ${item.resolution?.matchedRuleName ?? item.resolution?.matchedRuleId ?? "-"}`);
  }
  if (item.resolution?.target) {
    lines.push(`转发目标: ${item.resolution.target}`);
  }
  if (item.resolution?.reason) {
    lines.push(`命中说明: ${item.resolution.reason}`);
  }
  return lines.join("\n");
}

export function getCertificatePlatform(): CertificatePlatform {
  if (typeof navigator === "undefined") {
    return "windows";
  }

  const browserNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = browserNavigator.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;

  if (/mac/i.test(platform)) {
    return "mac";
  }
  if (/win/i.test(platform)) {
    return "windows";
  }
  return "other";
}
