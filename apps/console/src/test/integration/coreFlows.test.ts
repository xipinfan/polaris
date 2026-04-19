import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { applyActiveProxyForwardGroup } from "../../domains/proxy-forward/mutations";
import { createReplayTrafficRequestMutationOptions } from "../../domains/traffic/mutations";
import { queryKeys } from "../../lib/query/queryKeys";

describe("core flows integration", () => {
  it("group switch is mutually exclusive and respects enabled hierarchy", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([
        { id: "old-1", pattern: "old-1.com" },
        { id: "old-2", pattern: "old-2.com" },
      ]),
      removeRuleById: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    await applyActiveProxyForwardGroup(
      {
        id: "group-a",
        name: "A",
        rules: [
          { id: "rule-1", pattern: "enabled-a.com", path: "/", method: "GET", action: "proxy", enabled: true },
          { id: "rule-2", pattern: "disabled-a.com", path: "/", method: "GET", action: "direct", enabled: false },
        ] as any,
      },
      api as any,
    );

    expect(api.removeRuleById).toHaveBeenCalledTimes(2);
    expect(api.upsertSiteRule).toHaveBeenCalledTimes(1);
    expect(api.upsertSiteRule).toHaveBeenCalledWith({
      id: "rule-1",
      host: "enabled-a.com",
      path: "/",
      method: "GET",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
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
