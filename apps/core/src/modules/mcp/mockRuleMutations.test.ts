import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { buildCreateMockRuleInput, buildUpdateMockRuleInput } from "./mockRuleMutations";

const existingRule: MockRule = {
  id: "mock-1",
  name: "demo",
  method: "GET",
  url: "https://polaris.local/demo",
  requestBodyExactMatch: null,
  requestBodyKeyMatch: null,
  responseStatus: 200,
  responseHeaders: { "content-type": "application/json" },
  responseBody: { ok: true },
  enabled: false,
  hitCount: 0,
  createdAt: "2026-04-08T00:00:00.000Z",
  updatedAt: "2026-04-08T00:00:00.000Z"
};

const capturedRequest: RequestRecord = {
  id: "req-1",
  method: "POST",
  url: "https://polaris.local/from-request",
  host: "polaris.local",
  path: "/from-request",
  statusCode: 201,
  duration: 12,
  requestHeaders: { "content-type": "application/json" },
  requestQuery: {},
  requestBody: { popType: "6" },
  responseHeaders: { "content-type": "application/json" },
  responseBody: { from: "request" },
  createdAt: "2026-04-08T00:00:00.000Z",
  source: "debug",
  secure: true,
  resolution: undefined
};

test("buildUpdateMockRuleInput merges patch fields onto an existing rule", () => {
  const next = buildUpdateMockRuleInput(existingRule, {
    id: "mock-1",
    patch: {
      enabled: true,
      method: "POST"
    }
  });

  assert.equal(next.enabled, true);
  assert.equal(next.method, "POST");
  assert.equal(next.url, existingRule.url);
});

test("buildUpdateMockRuleInput applies replace and remove operations", () => {
  const next = buildUpdateMockRuleInput(existingRule, {
    id: "mock-1",
    operations: [
      { op: "replace", path: "responseStatus", value: 204 },
      { op: "remove", path: "requestBodyExactMatch" }
    ]
  });

  assert.equal(next.responseStatus, 204);
  assert.equal(next.requestBodyExactMatch, null);
});

test("buildUpdateMockRuleInput can replace a deep responseBody path", () => {
  const next = buildUpdateMockRuleInput(
    {
      ...existingRule,
      responseBody: {
        data: {
          taskHbList: [{ couponArea: "A", amount: 1 }]
        }
      }
    },
    {
      id: "mock-1",
      operations: [
        {
          op: "replace",
          path: "responseBody.data.taskHbList[0].couponArea",
          value: "B"
        }
      ]
    }
  );

  assert.deepEqual(next.responseBody, {
    data: {
      taskHbList: [{ couponArea: "B", amount: 1 }]
    }
  });
});

test("buildUpdateMockRuleInput can remove a deep responseBody path", () => {
  const next = buildUpdateMockRuleInput(
    {
      ...existingRule,
      responseBody: {
        data: {
          taskHbList: [{ couponArea: "A", amount: 1 }]
        }
      }
    },
    {
      id: "mock-1",
      operations: [
        {
          op: "remove",
          path: "responseBody.data.taskHbList[0].couponArea"
        }
      ]
    }
  );

  assert.deepEqual(next.responseBody, {
    data: {
      taskHbList: [{ amount: 1 }]
    }
  });
});

test("buildCreateMockRuleInput can seed from a captured request", () => {
  const next = buildCreateMockRuleInput(
    {
      name: "from request",
      requestId: "req-1",
      patch: {
        enabled: true
      }
    },
    { requestRecord: capturedRequest }
  );

  assert.equal(next.method, "POST");
  assert.equal(next.url, "https://polaris.local/from-request");
  assert.equal(next.responseStatus, 201);
  assert.deepEqual(next.responseBody, { from: "request" });
});

test("buildCreateMockRuleInput can seed from a named template", () => {
  const next = buildCreateMockRuleInput(
    {
      name: "from template",
      template: "json_ok",
      patch: {
        url: "https://polaris.local/template"
      }
    },
    {}
  );

  assert.equal(next.responseStatus, 200);
  assert.equal(next.url, "https://polaris.local/template");
  assert.equal(next.enabled, true);
});
