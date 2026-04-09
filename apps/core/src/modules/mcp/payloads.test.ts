import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import {
  DEFAULT_BODY_PREVIEW_CHARS,
  buildMockRuleDetailPayload,
  buildRequestDetailPayload,
  buildSavedRequestDetailPayload,
  buildToolResult,
  executeJsonPath,
  normalizeToJsonPath,
  buildWriteReceipt
} from "./payloads";
import { resolveDetailTextMode } from "./toolResultPolicy";

const requestRecord: RequestRecord = {
  id: "req-1",
  method: "POST",
  url: "https://polaris.local/api/demo?debug=1",
  host: "polaris.local",
  path: "/api/demo",
  statusCode: 200,
  duration: 18,
  requestHeaders: { "content-type": "application/json" },
  requestQuery: { debug: "1" },
  requestBody: { popType: "6", nested: { flag: "yes" } },
  responseHeaders: { "content-type": "application/json" },
  responseBody: { ok: true, payload: "abcdefghijklmnopqrstuvwxyz" },
  createdAt: "2026-04-08T00:00:00.000Z",
  source: "debug",
  secure: true,
  resolution: {
    mode: "mock",
    source: "mock_engine",
    matchedRuleId: "mock-1",
    matchedRuleName: "[demo] rule",
    target: null,
    reason: "Matched mock rule [demo] rule",
    decidedAt: "2026-04-08T00:00:00.000Z"
  }
};

const savedRequest: SavedRequest = {
  id: "saved-1",
  name: "demo request",
  method: "POST",
  url: "https://polaris.local/api/demo",
  headers: { "content-type": "application/json" },
  query: { debug: "1" },
  body: { hello: "world" },
  tags: ["demo"],
  sourceType: "manual",
  updatedAt: "2026-04-08T00:00:00.000Z"
};

const mockRule: MockRule = {
  id: "mock-1",
  name: "[demo] rule",
  method: "POST",
  url: "https://polaris.local/api/demo",
  requestBodyExactMatch: "popType: \"6\"",
  requestBodyKeyMatch: "nested.flag",
  responseStatus: 200,
  responseHeaders: { "content-type": "application/json" },
  responseBody: { ok: true },
  enabled: true,
  hitCount: 2,
  lastHitAt: "2026-04-08T00:00:00.000Z",
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z"
};

test("buildToolResult keeps structuredContent and supports preview key=value text", () => {
  const result = buildToolResult(
    { name: "demo", enabled: true, count: 2 },
    "Saved request receipt",
    { textMode: "preview" }
  );
  assert.deepEqual(result.structuredContent.result, { name: "demo", enabled: true, count: 2 });
  assert.match(result.content[0]?.text ?? "", /Saved request receipt/);
  assert.match(result.content[0]?.text ?? "", /name=demo/);
  assert.match(result.content[0]?.text ?? "", /enabled=true/);
});

test("buildToolResult list preview includes indexed rows and key fields", () => {
  const result = buildToolResult(
    [
      { id: "1", name: "alpha", enabled: true },
      { id: "2", name: "beta", enabled: false }
    ],
    "Loaded list",
    { textMode: "preview" }
  );

  const text = result.content[0]?.text ?? "";
  assert.match(text, /1\.\s*id=1/);
  assert.match(text, /2\.\s*id=2/);
});

test("buildToolResult summary and full text modes are different", () => {
  const summaryOnly = buildToolResult({ ok: true }, "Only summary", { textMode: "summary" });
  assert.equal(summaryOnly.content[0]?.text, "Only summary");

  const full = buildToolResult({ ok: true }, "Ignored summary", { textMode: "full" });
  assert.equal(full.content[0]?.text, JSON.stringify({ ok: true }, null, 2));
});

test("request summary view omits heavy payload fields", () => {
  const detail = buildRequestDetailPayload(requestRecord, { view: "summary" });
  assert.equal(detail.id, "req-1");
  assert.equal("requestBody" in detail, false);
  assert.equal("responseBody" in detail, false);
});

test("request preview view truncates bodies instead of returning full payloads", () => {
  const detail = buildRequestDetailPayload(requestRecord, { view: "preview", bodyPreviewChars: 12 });
  if (!("bodyPreviewChars" in detail && "requestBodyPreview" in detail && "responseBodyPreview" in detail)) {
    assert.fail("Expected preview request payload");
  }
  assert.equal(detail.bodyPreviewChars, 12);
  assert.match(detail.requestBodyPreview, /truncated/i);
  assert.match(detail.responseBodyPreview, /truncated/i);
});

test("saved request full view keeps full body", () => {
  const detail = buildSavedRequestDetailPayload(savedRequest, { view: "full" });
  if (!("body" in detail)) {
    assert.fail("Expected full saved request payload");
  }
  assert.deepEqual(detail.body, { hello: "world" });
});

test("mock diagnostic view reports intrinsic state and request-based matching", () => {
  const detail = buildMockRuleDetailPayload(
    mockRule,
    { view: "diagnostic", requestId: "req-1", scenario: "popType=6" },
    {
      activeGroup: "demo",
      requestRecord
    }
  );

  if (!("diagnostic" in detail)) {
    assert.fail("Expected diagnostic mock rule payload");
  }
  assert.equal(detail.diagnostic.enabled, true);
  assert.equal(detail.diagnostic.activeGroupMatches, true);
  assert.equal(detail.diagnostic.methodMatches, true);
  assert.equal(detail.diagnostic.urlMatches, true);
  assert.equal(detail.diagnostic.requestBodyExactMatches, true);
  assert.equal(detail.diagnostic.requestBodyKeyMatches, true);
  assert.deepEqual(detail.diagnostic.scenarioChecks, []);
});

test("mock diagnostic reports active group mismatch for ungrouped rule", () => {
  const detail = buildMockRuleDetailPayload(
    {
      ...mockRule,
      name: "ungrouped rule"
    },
    { view: "diagnostic", requestId: "req-1" },
    {
      activeGroup: "demo",
      requestRecord
    }
  );

  if (!("diagnostic" in detail)) {
    assert.fail("Expected diagnostic mock rule payload");
  }
  assert.equal(detail.diagnostic.activeGroupMatches, false);
});

test("mock diagnostic reports active group mismatch for different grouped rule", () => {
  const detail = buildMockRuleDetailPayload(
    {
      ...mockRule,
      name: "[other] rule"
    },
    { view: "diagnostic", requestId: "req-1" },
    {
      activeGroup: "demo",
      requestRecord
    }
  );

  if (!("diagnostic" in detail)) {
    assert.fail("Expected diagnostic mock rule payload");
  }
  assert.equal(detail.diagnostic.activeGroupMatches, false);
});

test("mock diagnostic reports scenario checks when scenario conditions are missing", () => {
  const detail = buildMockRuleDetailPayload(
    mockRule,
    { view: "diagnostic", requestId: "req-1", scenario: "popType=7;nested.missing=yes" },
    {
      activeGroup: "demo",
      requestRecord
    }
  );

  if (!("diagnostic" in detail)) {
    assert.fail("Expected diagnostic mock rule payload");
  }

  assert.deepEqual(detail.diagnostic.scenarioChecks, [
    "期望 popType=7，实际为 6",
    "缺少 nested.missing=yes"
  ]);
});

test("buildWriteReceipt reports changed fields only", () => {
  const receipt = buildWriteReceipt(
    { id: "mock-1", enabled: false, method: "GET" },
    { id: "mock-1", enabled: true, method: "POST" },
    "Updated mock rule mock-1"
  );

  assert.deepEqual(receipt.changedFields.sort(), ["enabled", "method"]);
  assert.equal(receipt.summary, "Updated mock rule mock-1");
});

test("default preview size stays small enough for low-context reads", () => {
  assert.equal(DEFAULT_BODY_PREVIEW_CHARS, 2000);
});

test("mock summary includes body matcher flags and response body metadata", () => {
  const detail = buildMockRuleDetailPayload(
    mockRule,
    { view: "summary" },
    {
      activeGroup: "demo"
    }
  );

  if (!("hasRequestBodyMatcher" in detail && "responseBodyMeta" in detail)) {
    assert.fail("Expected summary mock rule payload");
  }
  assert.equal(detail.hasRequestBodyMatcher, true);
  assert.equal(detail.hasResponseBody, true);
  assert.equal(typeof detail.responseBodyMeta.serializedChars, "number");
  assert.equal(typeof detail.responseBodyMeta.nodeCount, "number");
  assert.equal(typeof detail.responseBodyMeta.maxDepth, "number");
});

test("executeJsonPath supports wildcard lookup and returns matched paths and values", () => {
  const source = {
    data: {
      taskHbList: [{ couponArea: "A" }, { couponArea: "B" }]
    }
  };
  const result = executeJsonPath(source, "$.data.taskHbList[*].couponArea");

  assert.deepEqual(result.matchedPaths, ["$.data.taskHbList[0].couponArea", "$.data.taskHbList[1].couponArea"]);
  assert.deepEqual(result.matchedValues, ["A", "B"]);
});

test("responsePath shorthand is normalized and used for filtering", () => {
  const detail = buildMockRuleDetailPayload(
    {
      ...mockRule,
      responseBody: {
        data: {
          taskHbList: [{ couponArea: "A" }, { couponArea: "B" }]
        }
      }
    },
    {
      view: "summary",
      responsePath: "data.taskHbList.0.couponArea"
    },
    {
      activeGroup: "demo"
    }
  );

  assert.equal(normalizeToJsonPath("data.taskHbList.0.couponArea"), "$.data.taskHbList[0].couponArea");
  assert.equal(detail.normalizedJsonPath, "$.data.taskHbList[0].couponArea");
  assert.equal(detail.filteredResponseBody, "A");
});

test("includePaths with no matches does not fall back to the full response body", () => {
  const detail = buildMockRuleDetailPayload(
    {
      ...mockRule,
      responseBody: {
        data: {
          taskHbList: [{ couponArea: "A" }, { couponArea: "B" }]
        }
      }
    },
    {
      view: "summary",
      includePaths: ["missing.path"]
    },
    {
      activeGroup: "demo"
    }
  );

  assert.deepEqual(detail.filteredResponseBody, {});
});

test("mock shape view returns response body shape skeleton", () => {
  const detail = buildMockRuleDetailPayload(
    {
      ...mockRule,
      responseBody: {
        data: {
          taskHbList: [{ couponArea: "A", amount: 1 }, { couponArea: "B", amount: 2 }]
        }
      }
    },
    {
      view: "shape",
      maxDepth: 4,
      maxArrayItems: 1
    },
    {
      activeGroup: "demo"
    }
  );

  if (!("responseBodyShape" in detail)) {
    assert.fail("Expected shape mock rule payload");
  }
  assert.deepEqual(detail.responseBodyShape, {
    data: {
      taskHbList: [{ couponArea: "string", amount: "number" }, "{+1 more items}"]
    }
  });
});

test("full/shape/diagnostic views map to full JSON text mode", () => {
  const payload = { ok: true, nested: { count: 1 } };
  const fullText = JSON.stringify(payload, null, 2);

  assert.equal(
    buildToolResult(payload, "x", { textMode: resolveDetailTextMode("full") }).content[0]?.text,
    fullText
  );
  assert.equal(
    buildToolResult(payload, "x", { textMode: resolveDetailTextMode("shape") }).content[0]?.text,
    fullText
  );
  assert.equal(
    buildToolResult(payload, "x", { textMode: resolveDetailTextMode("diagnostic") }).content[0]?.text,
    fullText
  );
});

test("resolveDetailTextMode maps views to expected text modes", () => {
  assert.equal(resolveDetailTextMode("summary"), "summary");
  assert.equal(resolveDetailTextMode("preview"), "preview");
  assert.equal(resolveDetailTextMode("full"), "full");
  assert.equal(resolveDetailTextMode("shape"), "full");
  assert.equal(resolveDetailTextMode("diagnostic"), "full");
  assert.equal(resolveDetailTextMode(undefined), "preview");
});
