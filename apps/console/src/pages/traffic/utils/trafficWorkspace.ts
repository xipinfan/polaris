import type { RequestRecord } from "@polaris/shared-types";
import { getRequestResolutionMode } from "./trafficFormatters";

export function filterVisibleTrafficRequests(
  requests: RequestRecord[],
  focusMode: string,
  trafficSessionStartedAt: number,
) {
  const sessionRequests = requests.filter((item) => {
    const createdAtMs = Date.parse(item.createdAt);
    return Number.isNaN(createdAtMs) || createdAtMs >= trafficSessionStartedAt;
  });

  switch (focusMode) {
    case "errors":
      return sessionRequests.filter((item) => item.statusCode >= 400);
    case "https":
      return sessionRequests.filter((item) => item.secure);
    case "debug":
      return sessionRequests.filter((item) => item.source === "debug");
    case "mock":
      return sessionRequests.filter((item) => getRequestResolutionMode(item) === "mock");
    case "proxyForward":
      return sessionRequests.filter((item) => getRequestResolutionMode(item) === "proxy_forward");
    case "direct":
      return sessionRequests.filter((item) => getRequestResolutionMode(item) === "direct");
    default:
      return sessionRequests;
  }
}

export function findSelectedTrafficRequest(
  visibleRequests: RequestRecord[],
  selectedId?: string,
) {
  return (
    visibleRequests.find((item) => item.id === selectedId) ??
    visibleRequests[visibleRequests.length - 1]
  );
}

export function findNextSelectedTrafficRequestId(
  visibleRequests: RequestRecord[],
  selectedId?: string,
) {
  if (visibleRequests.length === 0) {
    return undefined;
  }

  if (!selectedId || !visibleRequests.some((item) => item.id === selectedId)) {
    return visibleRequests[visibleRequests.length - 1]?.id;
  }

  return selectedId;
}

export function summarizeTrafficRequests(visibleRequests: RequestRecord[]) {
  const errorCount = visibleRequests.filter((item) => item.statusCode >= 400).length;
  const secureCount = visibleRequests.filter((item) => item.secure).length;
  const avgDuration = visibleRequests.length
    ? Math.round(
        visibleRequests.reduce((total, item) => total + item.duration, 0) /
          visibleRequests.length,
      )
    : 0;
  const mockCount = visibleRequests.filter((item) => getRequestResolutionMode(item) === "mock").length;
  const proxyForwardCount = visibleRequests.filter(
    (item) => getRequestResolutionMode(item) === "proxy_forward",
  ).length;
  const directCount = visibleRequests.filter((item) => getRequestResolutionMode(item) === "direct").length;

  return {
    total: visibleRequests.length,
    errorCount,
    secureCount,
    avgDuration,
    mockCount,
    proxyForwardCount,
    directCount,
  };
}
