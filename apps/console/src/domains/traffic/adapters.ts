import type { RequestRecord } from "@polaris/shared-types";
import type { TrafficRequestFilters } from "./types";

export function normalizeTrafficFilters(filters: TrafficRequestFilters): TrafficRequestFilters {
  return {
    keyword: filters.keyword?.trim() || undefined,
    method: filters.method?.trim() || undefined,
    statusCode: filters.statusCode?.trim() || undefined,
    hostOnly: filters.hostOnly?.trim() || undefined,
  };
}

export function toRequestSearchParams(filters: TrafficRequestFilters) {
  const next = normalizeTrafficFilters(filters);
  const params = new URLSearchParams();

  if (next.keyword) params.set("keyword", next.keyword);
  if (next.method) params.set("method", next.method);
  if (next.statusCode) params.set("statusCode", next.statusCode);
  if (next.hostOnly) params.set("host", next.hostOnly);

  return params;
}

export function sortRequestsByCreatedAt(requests: RequestRecord[]) {
  const next = [...requests];
  next.sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  return next;
}
