import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, ProxyRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import { handleLegacyToolInvocation, handleMutateRequest, handleQueryProxy, handleTestMockMatch, type ToolServiceDeps } from "./toolHandlers";

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

function createCapturedRequest(input: Partial<RequestRecord> & Pick<RequestRecord, "id">): RequestRecord {
  return {
    id: input.id,
    method: input.method ?? "GET",
    url: input.url ?? "https://example.com/api/demo",
    host: input.host ?? "example.com",
    path: input.path ?? "/api/demo",
    statusCode: input.statusCode ?? 200,
    duration: input.duration ?? 10,
    requestHeaders: input.requestHeaders ?? {},
    requestQuery: input.requestQuery ?? {},
    requestBody: input.requestBody ?? null,
    responseHeaders: input.responseHeaders ?? {},
    responseBody: input.responseBody ?? null,
    createdAt: input.createdAt ?? now,
    source: input.source ?? "proxy",
    secure: input.secure ?? true,
    resolution: input.resolution
  };
}

function createSavedRequest(input: Partial<SavedRequest> & Pick<SavedRequest, "id">): SavedRequest {
  return {
    id: input.id,
    name: input.name ?? "Saved request",
    method: input.method ?? "GET",
    url: input.url ?? "https://example.com/api/demo",
    headers: input.headers ?? {},
    query: input.query ?? {},
    body: input.body ?? null,
    tags: input.tags ?? [],
    sourceType: input.sourceType ?? "manual",
    sourceRequestId: input.sourceRequestId,
    updatedAt: input.updatedAt ?? now
  };
}

function createDeps(overrides: {
  proxyRules?: ProxyRule[];
  mockRules?: MockRule[];
  activeGroup?: string | null;
  capturedRequests?: RequestRecord[];
  savedRequests?: SavedRequest[];
} = {}): ToolServiceDeps {
  const proxyRules = overrides.proxyRules ?? [];
  const mockRules = overrides.mockRules ?? [];
  const activeGroup = overrides.activeGroup ?? null;
  const capturedRequests = overrides.capturedRequests ?? [];
  let savedRequests = overrides.savedRequests ?? [];

  return {
    requestService: {
      list: () => [],
      listSaved: () => savedRequests,
      getById: (id: string) => capturedRequests.find((item) => item.id === id),
      getSavedById: (id: string) => savedRequests.find((item) => item.id === id),
      updateSaved: async (id: string, input: Partial<SavedRequest>) => {
        const existing = savedRequests.find((item) => item.id === id);
        if (!existing) {
          throw new Error("Saved request not found");
        }
        const next = { ...existing, ...input, updatedAt: now };
        savedRequests = savedRequests.map((item) => (item.id === id ? next : item));
        return next;
      }
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

test("mutate_request update preserves existing fields when only name changes", async () => {
  const saved = createSavedRequest({
    id: "saved-1",
    name: "Original",
    method: "POST",
    url: "https://example.com/api/users",
    headers: { accept: "application/json" },
    query: { page: "1" },
    body: { ok: true },
    tags: ["old"]
  });
  const deps = createDeps({ savedRequests: [saved] });

  const result = await handleMutateRequest({ op: "update", id: "saved-1", name: "Renamed" }, deps);

  const next = deps.requestService.getSavedById("saved-1")!;
  assert.equal(next.name, "Renamed");
  assert.equal(next.method, "POST");
  assert.equal(next.url, "https://example.com/api/users");
  assert.deepEqual(next.headers, { accept: "application/json" });
  assert.deepEqual(next.query, { page: "1" });
  assert.deepEqual(next.body, { ok: true });
  assert.deepEqual(next.tags, ["old"]);
  const payload = result.structuredContent.result as { changedFields: string[] };
  assert.ok(payload.changedFields.includes("name"));
});

test("mutate_request update writes normalized headers and query values", async () => {
  const deps = createDeps({
    savedRequests: [
      createSavedRequest({
        id: "saved-1",
        headers: { keep: "yes", remove: "old" },
        query: { keep: "yes", obsolete: "old" }
      })
    ]
  });

  await handleMutateRequest(
    {
      op: "update",
      id: "saved-1",
      headers: { count: 1, enabled: true, remove: null },
      query: { page: 2, debug: false, roles: ["admin", "tester"], obsolete: null }
    },
    deps
  );

  const next = deps.requestService.getSavedById("saved-1")!;
  assert.deepEqual(next.headers, { keep: "yes", count: "1", enabled: "true" });
  assert.deepEqual(next.query, { keep: "yes", page: "2", debug: "false", roles: "admin,tester" });
});

test("mutate_request update supports null body as an explicit update", async () => {
  const deps = createDeps({
    savedRequests: [createSavedRequest({ id: "saved-1", body: { before: true } })]
  });

  await handleMutateRequest({ op: "update", id: "saved-1", body: null }, deps);

  assert.equal(deps.requestService.getSavedById("saved-1")!.body, null);
});

test("mutate_request update reports captured request id misuse with next step", async () => {
  const deps = createDeps({ capturedRequests: [createCapturedRequest({ id: "captured-1" })] });

  await assert.rejects(
    () => handleMutateRequest({ op: "update", id: "captured-1", name: "Renamed" }, deps),
    (error: unknown) => {
      const payload = (error as { payload?: { code?: string; suggestions?: string[] } }).payload;
      assert.equal(payload?.code, "REQUEST_ID_NOT_SAVED");
      assert.ok(payload?.suggestions?.some((item) => item.includes("mutate_request")));
      return true;
    }
  );
});

test("legacy update_saved_request matches mutate_request update result semantics", async () => {
  const deps = createDeps({
    savedRequests: [createSavedRequest({ id: "saved-1", query: { page: "1" } })]
  });

  const result = await handleLegacyToolInvocation("update_saved_request", { id: "saved-1", query: { page: 2 } }, deps);
  const payload = result.structuredContent.result as { ok: boolean; id: string; changedFields: string[] };

  assert.equal(payload.ok, true);
  assert.equal(payload.id, "saved-1");
  assert.ok(payload.changedFields.includes("query"));
  assert.deepEqual(deps.requestService.getSavedById("saved-1")!.query, { page: "2" });
});

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
