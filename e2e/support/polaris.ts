type HealthPayload = {
  data?: {
    online?: boolean;
  };
};

const apiPortCandidates = Array.from({ length: 100 }, (_, index) => 9001 + index);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveApiPort(timeoutMs = 45_000): Promise<number> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const port of apiPortCandidates) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (!response.ok) {
          continue;
        }
        const payload = (await response.json()) as HealthPayload;
        if (payload.data?.online === true) {
          return port;
        }
      } catch {
        // try next candidate
      }
    }

    await sleep(600);
  }

  throw new Error("Unable to resolve Polaris API port in range 9001-9100");
}
