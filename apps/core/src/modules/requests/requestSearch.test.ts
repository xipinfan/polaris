import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RequestRecord } from "@polaris/shared-types";
import {
  buildRequestSearchText,
  matchRequestHost,
  matchRequestKeyword,
  normalizeHostFilter,
  safeSerializeForSearch,
} from "./requestSearch";

function createRecord(overrides: Partial<RequestRecord> = {}): RequestRecord {
  return {
    id: "request-1",
    method: "POST",
    url: "https://api.example.com:443/v1/users?page=1",
    host: "api.example.com:443",
    path: "/v1/users",
    statusCode: 201,
    duration: 42,
    requestHeaders: {
      "x-trace-id": "TRACE-9001",
      accept: "application/json",
    },
    requestQuery: {
      page: "1",
      role: "Admin",
    },
    requestBody: {
      user: {
        id: 123,
        name: "Ada Lovelace",
      },
    },
    responseHeaders: {
      "content-type": "application/json",
    },
    responseBody: {
      ok: true,
      token: "SESSION-TOKEN",
    },
    createdAt: "2026-05-10T00:00:00.000Z",
    source: "proxy",
    secure: true,
    resolution: {
      mode: "proxy_forward",
      source: "proxy_rules",
      matchedRuleId: "rule-1",
      matchedRuleName: "用户服务转发",
      target: "https://upstream.example.com",
      reason: "Matched proxy forward rule",
      decidedAt: "2026-05-10T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("requestSearch", () => {
  it("matches keyword across request, response, and resolution fields case-insensitively", () => {
    const record = createRecord();

    assert.equal(matchRequestKeyword(record, "ada lovelace"), true);
    assert.equal(matchRequestKeyword(record, "SESSION-token"), true);
    assert.equal(matchRequestKeyword(record, "trace-9001"), true);
    assert.equal(matchRequestKeyword(record, "proxy forward"), true);
    assert.equal(matchRequestKeyword(record, "用户服务"), true);
    assert.equal(matchRequestKeyword(record, "not-present"), false);
  });

  it("normalizes host filters and matches host fragments", () => {
    const record = createRecord();

    assert.equal(normalizeHostFilter(" https://api.example.com:443/foo?bar=1 "), "api.example.com:443");
    assert.equal(normalizeHostFilter("api.example.com/path"), "api.example.com");
    assert.equal(matchRequestHost(record, "EXAMPLE.com"), true);
    assert.equal(matchRequestHost(record, "https://other.example.com/foo"), false);
  });

  it("builds searchable text without throwing on binary and circular values", () => {
    const circular: Record<string, unknown> = { name: "root" };
    circular.self = circular;
    const record = createRecord({
      requestBody: Buffer.from("hello") as unknown as RequestRecord["requestBody"],
      responseBody: circular as RequestRecord["responseBody"],
    });

    const text = buildRequestSearchText(record);

    assert.match(text, /\[binary content\]/);
    assert.match(text, /\[circular\]/);
  });

  it("serializes large values with truncation marker", () => {
    const text = safeSerializeForSearch({ payload: "x".repeat(100) }, 32);

    assert.ok(text.length <= 43);
    assert.match(text, /\[truncated\]$/);
  });

  it("skips undefined map values and joins array map values", () => {
    const record = createRecord({
      requestHeaders: {
        "x-roles": ["admin", "tester"] as unknown as string,
        "x-empty": undefined as unknown as string,
      },
      requestBody: null,
    });

    const text = buildRequestSearchText(record);

    assert.match(text, /x-roles/);
    assert.match(text, /admin,tester/);
    assert.match(text, /\bnull\b/);
    assert.doesNotMatch(text, /x-empty/);
  });
});
