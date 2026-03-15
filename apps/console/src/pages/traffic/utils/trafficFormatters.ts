import type { RequestRecord } from "@polaris/shared-types";
import type { TranslateFn } from "../../../i18n/I18nProvider";
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
  if (statusCode >= 500) {
    return "danger" as const;
  }
  if (statusCode >= 400) {
    return "warning" as const;
  }
  if (statusCode >= 300) {
    return "muted" as const;
  }
  return "success" as const;
}

export function getProtocolLabel(item: RequestRecord) {
  return item.secure ? "HTTPS" : "HTTP";
}

export function getContentType(item: RequestRecord) {
  const contentType =
    item.responseHeaders["content-type"] ??
    item.responseHeaders["Content-Type"];
  return typeof contentType === "string" ? contentType : "-";
}

export function getRequestResolutionMode(item: RequestRecord): TrafficResolutionViewMode {
  const mode = item.resolution?.mode;
  if (mode) {
    return mode;
  }
  if (item.source === "proxy") {
    return "proxy_forward";
  }
  if (item.source === "debug") {
    return "direct";
  }
  return "unknown";
}

export function getRequestResolutionReason(item: RequestRecord): string | undefined {
  return item.resolution?.reason;
}

export function getRequestResolutionLabelByMode(
  mode: TrafficResolutionViewMode,
  t: TranslateFn
): string {
  switch (mode) {
    case "mock":
      return t("traffic.resolution.mock");
    case "proxy_forward":
      return t("traffic.resolution.proxy_forward");
    case "direct":
      return t("traffic.resolution.direct");
    case "block":
      return t("traffic.resolution.block");
    case "error":
      return t("traffic.resolution.error");
    default:
      return t("traffic.resolution.unknown");
  }
}

export function getRequestResolutionLabel(item: RequestRecord, t: TranslateFn): string {
  return getRequestResolutionLabelByMode(getRequestResolutionMode(item), t);
}

export function getRequestResolutionSourceLabel(item: RequestRecord, t: TranslateFn): string {
  switch (item.resolution?.source) {
    case "mock_engine":
      return t("detail.resolution.source.mock_engine");
    case "proxy_rules":
      return t("detail.resolution.source.proxy_rules");
    case "proxy_global":
      return t("detail.resolution.source.proxy_global");
    case "none":
      return t("detail.resolution.source.none");
    default:
      return "-";
  }
}

export function getRequestResolutionTooltip(item: RequestRecord, t: TranslateFn): string {
  const mode = getRequestResolutionMode(item);
  const lines = [
    `${t("detail.resolution.mode")}: ${getRequestResolutionLabelByMode(mode, t)}`
  ];
  if (item.resolution?.matchedRuleName || item.resolution?.matchedRuleId) {
    lines.push(
      `${t("detail.resolution.rule")}: ${item.resolution?.matchedRuleName ?? item.resolution?.matchedRuleId ?? "-"}`
    );
  }
  if (item.resolution?.target) {
    lines.push(`${t("detail.resolution.target")}: ${item.resolution.target}`);
  }
  if (item.resolution?.reason) {
    lines.push(`${t("detail.resolution.reason")}: ${item.resolution.reason}`);
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
  const platform =
    browserNavigator.userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent;

  if (/mac/i.test(platform)) {
    return "mac";
  }

  if (/win/i.test(platform)) {
    return "windows";
  }

  return "other";
}
