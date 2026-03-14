import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { applyActiveProxyForwardGroup } from "../../domains/proxy-forward/mutations";
import { createReplayTrafficRequestMutationOptions } from "../../domains/traffic/mutations";
import { queryKeys } from "../../lib/query/queryKeys";

describe("core flows integration", () => {
  it("group switch is mutually exclusive and respects enabled hierarchy", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([
        { pattern: "old-1.com" },
        { pattern: "old-2.com" },
      ]),
      removeSiteRule: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    await applyActiveProxyForwardGroup(
      {
        id: "group-a",
        name: "A",
        rules: [
          { pattern: "enabled-a.com", action: "proxy", enabled: true },
          { pattern: "disabled-a.com", action: "direct", enabled: false },
        ] as any,
      },
      api as any,
    );

    expect(api.removeSiteRule).toHaveBeenCalledTimes(2);
    expect(api.upsertSiteRule).toHaveBeenCalledTimes(1);
    expect(api.upsertSiteRule).toHaveBeenCalledWith("enabled-a.com", "proxy");
  });

  it("replay flow invalidates traffic list and detail chain", async () => {
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined as any);

    const options = createReplayTrafficRequestMutationOptions(client, {
      clearRequests: vi.fn(),
      replayCapturedRequest: vi.fn(),
    } as any);

    await options.onSuccess?.({ id: "req-2" } as any, "req-2");

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.traffic.root });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.traffic.request("req-2") });
  });
});
