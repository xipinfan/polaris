import { describe, expect, it } from "vitest";
import { syncActiveGroupRulesFromBackend } from "../state";
import type { StoredGroup } from "../types";

describe("syncActiveGroupRulesFromBackend", () => {
  it("injects backend-only rules into the active group", () => {
    const groups: StoredGroup[] = [
      {
        id: "g1",
        name: "Group 1",
        rules: [
          {
            id: "r1",
            name: "old-a",
            pattern: "a.com",
            action: "proxy",
            enabled: true,
            method: "GET",
            url: "https://a.com/path",
            path: "/path",
            priority: 100,
            matchMode: "exact",
            queryMatch: "",
            headerMatch: "",
            bodyMatch: "",
            forwardMode: "rewriteTarget",
            targetUrl: "http://127.0.0.1:9000/path",
            rewriteHost: "a.com",
            rewritePath: "/path",
            rewriteQuery: "",
            headerStrategy: "keep",
            requestHeaderPreview: "{}",
            responseHeaderPreview: "{}",
            responseDelay: 0,
            fallbackPolicy: "closed",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "g2",
        name: "Group 2",
        rules: [],
      },
    ];

    const backendRules = [
      {
        id: "backend-new",
        pattern: "new.com",
        action: "proxy",
        enabled: true,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ] as any;

    const result = syncActiveGroupRulesFromBackend(groups, "g2", backendRules);
    const activeGroup = result.find((item) => item.id === "g2");

    expect(activeGroup?.rules).toHaveLength(1);
    expect(activeGroup?.rules[0]?.pattern).toBe("new.com");
    expect(activeGroup?.rules[0]?.enabled).toBe(true);
  });
});
