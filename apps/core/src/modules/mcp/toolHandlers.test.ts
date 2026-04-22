import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, ProxyRule } from "@polaris/shared-types";
import { handleLegacyToolInvocation, handleQueryProxy, handleTestMockMatch, type ToolServiceDeps } from "./toolHandlers";

const now = "2026-04-22T00:00:00.000Z";

function createProxyRule(id: string, pattern: string, action: "proxy" | "direct"): ProxyRule {
  return {
    id,
    pattern,
    matchType: "host",
    action,
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
}

function createMockRule(input: Partial<MockRule> & Pick<MockRule, "id" | "name">): MockRule {
  return {
    id: input.id,
    name: input.name,
    method: input.method ?? "GET",
    url: input.url ?? "https://example.com/api/demo",
    requestBodyExactMatch: input.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: input.requestBodyKeyMatch ?? null,
    responseStatus: input.responseStatus ?? 200,
    responseHeaders: input.responseHeaders ?? { "content-type": "application/json" },
    responseBody: input.responseBody ?? { ok: true },
    enabled: input.enabled ?? true,
    hitCount: input.hitCount ?? 0,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

function createDeps(overrides: {
  proxyRules?: ProxyRule[];
  mockRules?: MockRule[];
  activeGroup?: string | null;
} = {}): ToolServiceDeps {
  const proxyRules = overrides.proxyRules ?? [];
  const mockRules = overrides.mockRules ?? [];
  const activeGroup = overrides.activeGroup ?? null;

  return {
    requestService: {
      list: () => [],
      listSaved: () => [],
      getById: () => undefined,
      getSavedById: () => undefined
    } as unknown as ToolServiceDeps["requestService"],
    mockService: {
      list: () => mockRules,
      getActiveGroup: () => activeGroup
    } as unknown as ToolServiceDeps["mockService"],
    proxyService: {
      listRules: () => proxyRules,
      getSettings: () => ({
        localProxyPort: 19602,
        currentProxyMode: "rules",
        mcpEnabled: true,
        certificateInstalled: true
      }),
      getForwardDecision: () => ({
        mode: "direct",
        source: "none",
        reason: "none"
      })
    } as unknown as ToolServiceDeps["proxyService"],
    certificateManager: undefined
  };
}

test("legacy list_proxy_rules maps action filter without overwriting discriminated action", async () => {
  const deps = createDeps({
    proxyRules: [createProxyRule("r1", "a.example.com", "proxy"), createProxyRule("r2", "b.example.com", "direct")]
  });

  const result = await handleLegacyToolInvocation("list_proxy_rules", { action: "proxy" }, deps);
  const payload = result.structuredContent.result as Array<{ action: string }>;

  assert.equal(payload.length, 1);
  assert.equal(payload[0]?.action, "proxy");
});

test("query_proxy list supports actionFilter alias", () => {
  const deps = createDeps({
    proxyRules: [createProxyRule("r1", "a.example.com", "proxy"), createProxyRule("r2", "b.example.com", "direct")]
  });

  const result = handleQueryProxy({ action: "list", actionFilter: "direct" }, deps);
  const payload = result.structuredContent.result as Array<{ action: string }>;

  assert.equal(payload.length, 1);
  assert.equal(payload[0]?.action, "direct");
});

test("legacy get_proxy_decision accepts url-only input", async () => {
  const deps = createDeps();
  deps.proxyService = {
    ...deps.proxyService,
    getForwardDecision: (host: string) => ({
      mode: "proxy_forward",
      source: "proxy_rules",
      matchedRuleId: "r1",
      matchedRuleName: "rule-1",
      reason: `Matched ${host}`
    })
  } as unknown as ToolServiceDeps["proxyService"];

  const result = await handleLegacyToolInvocation(
    "get_proxy_decision",
    { url: "https://api.example.com/v1/users" },
    deps
  );
  const payload = result.structuredContent.result as { reason: string };
  assert.equal(payload.reason, "Matched api.example.com");
});

test("legacy get_service_health keeps online and activeRequestCount fields", async () => {
  const deps = createDeps();
  deps.requestService = {
    ...deps.requestService,
    list: () => [{ id: "r1" }, { id: "r2" }]
  } as unknown as ToolServiceDeps["requestService"];

  const result = await handleLegacyToolInvocation("get_service_health", {}, deps);
  const payload = result.structuredContent.result as {
    online: boolean;
    activeRequestCount: number;
    settings: unknown;
  };
  assert.equal(payload.online, true);
  assert.equal(payload.activeRequestCount, 2);
  assert.ok(payload.settings);
});

test("legacy list_requests returns plain summary array", async () => {
  const deps = createDeps();
  deps.requestService = {
    ...deps.requestService,
    list: () =>
      [
        {
          id: "req-1",
          method: "GET",
          url: "https://a.example.com/a",
          host: "a.example.com",
          path: "/a",
          statusCode: 200,
          duration: 10,
          requestHeaders: {},
          requestQuery: {},
          requestBody: null,
          responseHeaders: {},
          responseBody: { ok: true },
          createdAt: now,
          source: "debug",
          secure: true
        }
      ]
  } as unknown as ToolServiceDeps["requestService"];

  const result = await handleLegacyToolInvocation("list_requests", {}, deps);
  const payload = result.structuredContent.result as Array<{ id: string }>;
  assert.ok(Array.isArray(payload));
  assert.equal(payload.length, 1);
  assert.equal(payload[0]?.id, "req-1");
});

test("mutate_proxy upsert with enabled=false keeps rule and marks disabled", async () => {
  const deps = createDeps();
  deps.proxyService = {
    ...deps.proxyService,
    upsertSiteRule: async (input: { enabled?: boolean }) =>
      createProxyRule("r1", "a.example.com", "proxy") && {
        ...createProxyRule("r1", "a.example.com", "proxy"),
        enabled: input.enabled ?? true
      },
    removeRuleById: async () => {
      throw new Error("removeRuleById should not be called");
    }
  } as unknown as ToolServiceDeps["proxyService"];

  const result = await handleLegacyToolInvocation(
    "mutate_proxy",
    { op: "upsert", host: "a.example.com", action: "proxy", enabled: false },
    deps
  );
  const payload = result.structuredContent.result as { changedFields: string[] };
  assert.ok(payload.changedFields.includes("enabled"));
});

test("test_mock_match reports group mismatch reason", () => {
  const deps = createDeps({
    activeGroup: "demo",
    mockRules: [createMockRule({ id: "m1", name: "[other] rule", method: "GET" })]
  });

  const result = handleTestMockMatch({ method: "GET", url: "https://example.com/api/demo" }, deps);
  const payload = result.structuredContent.result as { matched: boolean; reason: string };

  assert.equal(payload.matched, false);
  assert.equal(payload.reason, "活跃分组过滤后无可用规则");
});

test("test_mock_match reports method mismatch reason", () => {
  const deps = createDeps({
    mockRules: [createMockRule({ id: "m1", name: "[demo] rule", method: "POST" })]
  });

  const result = handleTestMockMatch({ method: "GET", url: "https://example.com/api/demo" }, deps);
  const payload = result.structuredContent.result as { matched: boolean; reason: string };

  assert.equal(payload.matched, false);
  assert.equal(payload.reason, "method 不匹配");
});
