type ApiMetricSnapshot = {
  total: number;
  failed: number;
  retried: number;
  slow: number;
};

const metrics: ApiMetricSnapshot = {
  total: 0,
  failed: 0,
  retried: 0,
  slow: 0,
};

const slowThresholdMs = 800;

export function recordApiRequest(params: {
  path: string;
  durationMs: number;
  ok: boolean;
}) {
  metrics.total += 1;
  if (!params.ok) {
    metrics.failed += 1;
  }
  if (params.durationMs >= slowThresholdMs) {
    metrics.slow += 1;
    console.warn("[api-slow]", params.path, `${params.durationMs}ms`);
  }
}

export function recordApiRetry(path: string, attempt: number) {
  metrics.retried += 1;
  console.warn("[api-retry]", path, `attempt=${attempt}`);
}

export function getApiMetricSnapshot() {
  return { ...metrics };
}
