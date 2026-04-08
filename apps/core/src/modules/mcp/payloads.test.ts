import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import {
  DEFAULT_BODY_PREVIEW_CHARS,
  buildMockRuleDetailPayload,
  buildRequestDetailPayload,
  buildSavedRequestDetailPayload,
  buildToolResult,
  buildWriteReceipt
} from "./payloads";

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

test("buildToolResult keeps structuredContent and short text only", () => {
  const result = buildToolResult({ ok: true }, "Saved request receipt");
  assert.deepEqual(result.structuredContent.result, { ok: true });
  assert.equal(result.content[0]?.text, "Saved request receipt");
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
