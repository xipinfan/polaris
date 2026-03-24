import { describe, expect, it, vi } from "vitest";
import type { SetActiveGroupInput } from "../types";
import { applyActiveProxyForwardGroup } from "../mutations";

describe("applyActiveProxyForwardGroup", () => {
  it("removes existing rules and only upserts enabled rules", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([
        { pattern: "a.com" },
        { pattern: "b.com" },
      ]),
      removeSiteRule: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    const group: SetActiveGroupInput["group"] = {
      id: "g1",
      name: "G1",
      rules: [
        { id: "1", pattern: "x.com", action: "proxy", enabled: true },
        { id: "2", pattern: "y.com", action: "direct", enabled: false },
      ] as any,
    };

    await applyActiveProxyForwardGroup(group, api as any);

    expect(api.removeSiteRule).toHaveBeenCalledTimes(2);
    expect(api.upsertSiteRule).toHaveBeenCalledTimes(1);
    expect(api.upsertSiteRule).toHaveBeenCalledWith({
      host: "x.com",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
  });

  it("throws when remove step fails", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([{ pattern: "a.com" }]),
      removeSiteRule: vi.fn().mockRejectedValue(new Error("remove failed")),
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

  it("deduplicates enabled rules by host before upsert", async () => {
    const api = {
      listProxyRules: vi.fn().mockResolvedValue([]),
      removeSiteRule: vi.fn().mockResolvedValue({}),
      upsertSiteRule: vi.fn().mockResolvedValue({}),
      setProxyMode: vi.fn(),
    };

    const group: SetActiveGroupInput["group"] = {
      id: "g1",
      name: "G1",
      rules: [
        { id: "1", pattern: "dup.com", action: "proxy", enabled: true },
        { id: "2", pattern: "dup.com", action: "proxy", enabled: true },
      ] as any,
    };

    await applyActiveProxyForwardGroup(group, api as any);

    expect(api.upsertSiteRule).toHaveBeenCalledTimes(1);
    expect(api.upsertSiteRule).toHaveBeenCalledWith({
      host: "dup.com",
      action: "proxy",
      forwardMode: undefined,
      targetUrl: undefined,
      rewriteHost: undefined,
      rewritePath: undefined,
    });
  });
});
