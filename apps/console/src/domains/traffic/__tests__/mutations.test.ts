import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../lib/query/queryKeys";
import { createClearTrafficRequestsMutationOptions, createReplayTrafficRequestMutationOptions } from "../mutations";

describe("traffic mutation options", () => {
  it("clear mutation snapshots and rollbacks on error", async () => {
    const client = new QueryClient();
    const key = queryKeys.traffic.requests({});
    client.setQueryData(key, [{ id: "r1" }] as any);

    const api = {
      clearRequests: vi.fn().mockResolvedValue({ cleared: true }),
      replayCapturedRequest: vi.fn(),
    };

    const options = createClearTrafficRequestsMutationOptions(client, api as any);
    const context = await options.onMutate();

    expect(client.getQueryData(key)).toEqual([]);

    options.onError?.(new Error("boom"), undefined as any, context as any);

    expect(client.getQueryData(key)).toEqual([{ id: "r1" }]);
  });

  it("replay mutation invalidates root and request key", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined as any);
    const api = {
      clearRequests: vi.fn(),
      replayCapturedRequest: vi.fn(),
    };

    const options = createReplayTrafficRequestMutationOptions(client, api as any);
    await options.onSuccess?.({} as any, "req-1");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.traffic.root });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.traffic.request("req-1") });
  });
});
