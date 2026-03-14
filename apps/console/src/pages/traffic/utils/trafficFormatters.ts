import type { RequestRecord } from "@polaris/shared-types";
import type { CertificatePlatform } from "../types";

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
