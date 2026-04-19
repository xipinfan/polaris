import { describe, expect, it, vi } from "vitest";
import type { SetActiveGroupInput } from "../types";
import { applyActiveProxyForwardGroup } from "../mutations";

describe("applyActiveProxyForwardGroup", () => {
  it("removes existing rules and only upserts enabled rules", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([
        { id: "r-a", pattern: "a.com" },
        { id: "r-b", pattern: "b.com" },
      ]),
      removeRuleById: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    const group: SetActiveGroupInput["group"] = {
      id: "g1",
      name: "G1",
      rules: [
        { id: "1", pattern: "x.com", path: "/", method: "GET", action: "proxy", enabled: true },
        { id: "2", pattern: "y.com", path: "/", method: "GET", action: "direct", enabled: false },
      ] as any,
    };

    await applyActiveProxyForwardGroup(group, api as any);

    expect(api.removeRuleById).toHaveBeenCalledTimes(2);
    expect(api.upsertSiteRule).toHaveBeenCalledTimes(1);
    expect(api.upsertSiteRule).toHaveBeenCalledWith({
      id: "1",
      host: "x.com",
      path: "/",
      method: "GET",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
  });

  it("throws when remove step fails", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([{ id: "r-a", pattern: "a.com" }]),
      removeRuleById: vi.fn().mockRejectedValue(new Error("remove failed")),
      upsertSiteRule: vi.fn(),
      setProxyMode: vi.fn(),
    };

    const group: SetActiveGroupInput["group"] = {
      id: "g1",
      name: "G1",
      rules: [],
    };

    await expect(applyActiveProxyForwardGroup(group, api as any)).rejects.toThrow("remove failed");
    expect(api.upsertSiteRule).not.toHaveBeenCalled();
  });

  it("upserts all enabled rules even when host is duplicated with different path", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([]),
      removeRuleById: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    const group: SetActiveGroupInput["group"] = {
      id: "g1",
      name: "G1",
      rules: [
        { id: "1", pattern: "dup.com", path: "/v1", method: "GET", action: "proxy", enabled: true },
        { id: "2", pattern: "dup.com", path: "/v2", method: "POST", action: "proxy", enabled: true },
      ] as any,
    };

    await applyActiveProxyForwardGroup(group, api as any);

    expect(api.upsertSiteRule).toHaveBeenCalledTimes(2);
    expect(api.upsertSiteRule).toHaveBeenNthCalledWith(1, {
      id: "1",
      host: "dup.com",
      path: "/v1",
      method: "GET",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
    expect(api.upsertSiteRule).toHaveBeenNthCalledWith(2, {
      id: "2",
      host: "dup.com",
      path: "/v2",
      method: "POST",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
  });
});
