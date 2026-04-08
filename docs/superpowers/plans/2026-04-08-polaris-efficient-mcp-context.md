# Polaris Efficient MCP Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Polaris MCP context usage by making existing tools return lighter defaults, adding low-context mock mutation flows, and shipping AI guidance without growing the tool surface area.

**Architecture:** Keep the current MCP surface area and transports (`sdkServer` + legacy `mcpServer`) intact, but route both through one shared output-shaping layer and one shared mock-input normalization layer. Ship only P0 and P1 behavior in this plan; defer `generate_mock_from_code` until the lighter foundation proves useful.

**Tech Stack:** TypeScript, Express, Model Context Protocol SDK, Zod, Node test runner, pnpm workspace

---

## Scope Notes

- This plan intentionally covers `P0 + P1` only. `generate_mock_from_code` stays out of scope for now because it would introduce parsing, type discovery, and template semantics that are not required to validate the core context-saving strategy.
- `get_mock_rule_detail(view="diagnostic")` cannot truthfully answer “method/url/body mismatch” from a rule id alone. To stay honest without adding a new tool, this plan adds an optional `requestId` to the existing detail input so diagnostics can compare the rule against a real captured request when available.
- `run_request` and `replay_request` become light receipts by default. The follow-up path for full payload inspection is `get_request_detail(id, view="preview" | "full")`. This is the key behavior change that actually reduces context in practice.
- Template-based mock creation is feasible only with a tiny in-repo registry. This plan uses one checked-in `mockTemplates.ts` file instead of adding more MCP tools or remote template storage.

## File Map

- Create: `apps/core/src/modules/mock/mockMatchers.ts`
- Create: `apps/core/src/modules/mcp/payloads.ts`
- Create: `apps/core/src/modules/mcp/payloads.test.ts`
- Create: `apps/core/src/modules/mcp/mockRuleMutations.ts`
- Create: `apps/core/src/modules/mcp/mockRuleMutations.test.ts`
- Create: `apps/core/src/modules/mock/mockTemplates.ts`
- Create: `docs/skills/polaris-efficient-mcp/SKILL.md`
- Create: `docs/mcp-efficient-usage.md`
- Modify: `apps/core/package.json`
- Modify: `apps/core/src/modules/mock/mockService.ts`
- Modify: `apps/core/src/modules/mcp/sdkServer.ts`
- Modify: `apps/core/src/modules/mcp/mcpServer.ts`
- Modify: `packages/mcp-contracts/src/tools/listRequests.ts`
- Modify: `packages/mcp-contracts/src/tools/listSavedRequests.ts`
- Modify: `packages/mcp-contracts/src/tools/listMockRules.ts`
- Modify: `packages/mcp-contracts/src/tools/getRequestDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/getSavedRequestDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/getMockRuleDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/createMockRule.ts`
- Modify: `packages/mcp-contracts/src/tools/updateMockRule.ts`
- Modify: `scripts/dev/mcp-selftest.mjs`
- Modify: `docs/mcp.md`

---

### Task 1: Extract Shared Matchers And Lightweight MCP Payload Helpers

**Files:**
- Modify: `apps/core/package.json`
- Create: `apps/core/src/modules/mock/mockMatchers.ts`
- Modify: `apps/core/src/modules/mock/mockService.ts`
- Create: `apps/core/src/modules/mcp/payloads.ts`
- Create: `apps/core/src/modules/mcp/payloads.test.ts`

- [ ] **Step 1: Add a failing Core test entry and payload helper tests**

Update `apps/core/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/app/bootstrap.ts",
    "mcp": "tsx src/app/mcpStdio.ts",
    "mcp:dev": "tsx watch src/app/mcpStdio.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --test --import tsx src/**/*.test.ts"
  }
}
```

Create `apps/core/src/modules/mcp/payloads.test.ts`:

```ts
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
  assert.equal(detail.bodyPreviewChars, 12);
  assert.match(detail.requestBodyPreview, /truncated/i);
  assert.match(detail.responseBodyPreview, /truncated/i);
});

test("saved request full view keeps full body", () => {
  const detail = buildSavedRequestDetailPayload(savedRequest, { view: "full" });
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

  assert.equal(detail.diagnostic.enabled, true);
  assert.equal(detail.diagnostic.activeGroupMatches, true);
  assert.equal(detail.diagnostic.methodMatches, true);
  assert.equal(detail.diagnostic.urlMatches, true);
  assert.equal(detail.diagnostic.requestBodyExactMatches, true);
  assert.equal(detail.diagnostic.requestBodyKeyMatches, true);
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
```

- [ ] **Step 2: Run Core tests to confirm the helper modules do not exist yet**

Run: `corepack pnpm --filter @polaris/core test`

Expected: FAIL with module resolution errors for `./payloads`.

- [ ] **Step 3: Add the reusable matcher and payload helper modules**

Create `apps/core/src/modules/mock/mockMatchers.ts`:

```ts
type ExactBodyCondition = { path: string; expected: string };

export function getRuleGroupName(name: string): string | null {
  const match = name.match(/^\[(.+?)\]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

export function hasBodyKeyPath(value: unknown, keyPath: string): boolean {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }

  const segments = keyPath
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object") {
      return false;
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return false;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return true;
}

export function getBodyPathValue(value: unknown, keyPath: string): { found: boolean; value?: unknown } {
  if (value === null || value === undefined || typeof value !== "object") {
    return { found: false };
  }

  const segments = keyPath
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }

    if (current === null || typeof current !== "object") {
      return { found: false };
    }

    if (!(segment in (current as Record<string, unknown>))) {
      return { found: false };
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return { found: true, value: current };
}

export function parseExactBodyMatch(expression?: string | null): ExactBodyCondition[] | null {
  if (!expression) {
    return [];
  }

  const conditions: ExactBodyCondition[] = [];
  const entries = expression
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    const path = entry.slice(0, separatorIndex).trim();
    const expectedLiteral = entry.slice(separatorIndex + 1).trim();
    if (!path || !expectedLiteral) {
      return null;
    }

    if (!(expectedLiteral.startsWith("\"") && expectedLiteral.endsWith("\""))) {
      return null;
    }

    const expected = JSON.parse(expectedLiteral);
    if (typeof expected !== "string") {
      return null;
    }

    conditions.push({ path, expected });
  }

  return conditions;
}

export function matchesExactBodyExpression(requestBody: unknown, expression?: string | null): boolean {
  const conditions = parseExactBodyMatch(expression);
  if (conditions === null) {
    return false;
  }

  for (const condition of conditions) {
    const resolved = getBodyPathValue(requestBody, condition.path);
    if (!resolved.found) {
      return false;
    }
    if (typeof resolved.value !== "string" || resolved.value !== condition.expected) {
      return false;
    }
  }

  return true;
}
```

Update `apps/core/src/modules/mock/mockService.ts` imports and matcher usage:

```ts
import { getRuleGroupName, hasBodyKeyPath, matchesExactBodyExpression } from "./mockMatchers";

function getRuleGroup(rule: MockRule): string | null {
  return getRuleGroupName(rule.name);
}
```

Create `apps/core/src/modules/mcp/payloads.ts`:

```ts
import type { MockRule, ProxyRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import { getRuleGroupName, hasBodyKeyPath, matchesExactBodyExpression } from "../mock/mockMatchers";

export const detailViewValues = ["summary", "diagnostic", "preview", "full"] as const;
export type DetailView = (typeof detailViewValues)[number];
export const DEFAULT_BODY_PREVIEW_CHARS = 2000;

type DetailOptions = {
  view?: DetailView;
  requestId?: string;
  scenario?: string;
  bodyPreviewChars?: number;
};

type MockDiagnosticContext = {
  activeGroup: string | null;
  requestRecord?: RequestRecord;
};

function truncateText(value: unknown, maxChars: number): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (serialized.length <= maxChars) {
    return serialized;
  }
  return `${serialized.slice(0, maxChars)}… [truncated, original size: ${serialized.length} chars]`;
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export function buildToolResult(result: unknown, summary: string) {
  return {
    structuredContent: {
      result
    },
    content: [
      {
        type: "text" as const,
        text: summary
      }
    ]
  };
}

export function buildResourceResult(uri: string, result: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(result, null, 2)
      }
    ],
    _meta: {
      "polaris/resultCount": Array.isArray(result) ? result.length : 1
    }
  };
}

export function buildWriteReceipt<T extends { id: string }>(
  before: Partial<T> | null,
  after: T,
  summary: string
) {
  return {
    ok: true,
    id: after.id,
    summary,
    changedFields: before
      ? changedFields(before as Record<string, unknown>, after as Record<string, unknown>)
      : Object.keys(after).filter((key) => key !== "id")
  };
}

export function buildRequestSummary(record: RequestRecord) {
  return {
    id: record.id,
    title: `${record.method} ${record.path}`,
    method: record.method,
    host: record.host,
    path: record.path,
    url: record.url,
    statusCode: record.statusCode,
    duration: record.duration,
    createdAt: record.createdAt,
    source: record.source,
    secure: record.secure,
    resolutionMode: record.resolution?.mode ?? null,
    detail: {
      tool: "get_request_detail",
      id: record.id,
      defaultView: "summary"
    }
  };
}

export function buildSavedRequestSummary(savedRequest: SavedRequest) {
  return {
    id: savedRequest.id,
    title: savedRequest.name,
    name: savedRequest.name,
    method: savedRequest.method,
    url: savedRequest.url,
    sourceType: savedRequest.sourceType,
    tags: savedRequest.tags,
    updatedAt: savedRequest.updatedAt,
    detail: {
      tool: "get_saved_request_detail",
      id: savedRequest.id,
      defaultView: "summary"
    }
  };
}

export function buildMockRuleSummary(rule: MockRule) {
  return {
    id: rule.id,
    title: rule.name,
    name: rule.name,
    group: getRuleGroupName(rule.name),
    method: rule.method,
    url: rule.url,
    enabled: rule.enabled,
    hitCount: rule.hitCount,
    updatedAt: rule.updatedAt,
    detail: {
      tool: "get_mock_rule_detail",
      id: rule.id,
      defaultView: "summary"
    }
  };
}

export function buildProxyRuleSummary(rule: ProxyRule) {
  return {
    ruleId: rule.id,
    title: `${rule.action.toUpperCase()} ${rule.pattern}`,
    pattern: rule.pattern,
    action: rule.action,
    enabled: rule.enabled,
    updatedAt: rule.updatedAt,
    detail: {
      tool: "get_proxy_rule_detail",
      ruleId: rule.id
    }
  };
}

export function buildRequestDetailPayload(record: RequestRecord, options: DetailOptions) {
  const view = options.view ?? "summary";
  if (view === "full") {
    return record;
  }

  if (view === "preview") {
    const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
    return {
      ...buildRequestSummary(record),
      requestHeaders: record.requestHeaders,
      requestQuery: record.requestQuery,
      responseHeaders: record.responseHeaders,
      requestBodyPreview: truncateText(record.requestBody, maxChars),
      responseBodyPreview: truncateText(record.responseBody, maxChars),
      bodyPreviewChars: maxChars
    };
  }

  return {
    ...buildRequestSummary(record),
    resolution: record.resolution
      ? {
          mode: record.resolution.mode,
          source: record.resolution.source,
          matchedRuleId: record.resolution.matchedRuleId ?? null,
          matchedRuleName: record.resolution.matchedRuleName ?? null,
          reason: record.resolution.reason
        }
      : null
  };
}

export function buildSavedRequestDetailPayload(savedRequest: SavedRequest, options: DetailOptions) {
  const view = options.view ?? "summary";
  if (view === "full") {
    return savedRequest;
  }

  if (view === "preview") {
    const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
    return {
      ...buildSavedRequestSummary(savedRequest),
      headers: savedRequest.headers,
      query: savedRequest.query,
      bodyPreview: truncateText(savedRequest.body, maxChars),
      bodyPreviewChars: maxChars
    };
  }

  return {
    ...buildSavedRequestSummary(savedRequest),
    headerCount: Object.keys(savedRequest.headers).length,
    queryCount: Object.keys(savedRequest.query).length,
    hasBody: savedRequest.body !== null && savedRequest.body !== undefined
  };
}

export function buildMockRuleDetailPayload(
  rule: MockRule,
  options: DetailOptions,
  context: MockDiagnosticContext
) {
  const view = options.view ?? "summary";
  if (view === "full") {
    return rule;
  }

  if (view === "preview") {
    const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
    return {
      ...buildMockRuleSummary(rule),
      requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
      requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
      responseHeaders: rule.responseHeaders,
      responseBodyPreview: truncateText(rule.responseBody, maxChars),
      bodyPreviewChars: maxChars
    };
  }

  if (view === "diagnostic") {
    const requestRecord = context.requestRecord;
    const activeGroup = context.activeGroup;
    const ruleGroup = getRuleGroupName(rule.name);

    const diagnostic = {
      enabled: rule.enabled,
      activeGroup,
      activeGroupMatches: !activeGroup || !ruleGroup ? true : ruleGroup === activeGroup,
      requestId: options.requestId ?? null,
      methodMatches: requestRecord ? rule.method === requestRecord.method : null,
      urlMatches: requestRecord ? requestRecord.url.includes(rule.url) : null,
      requestBodyExactMatches: requestRecord
        ? matchesExactBodyExpression(requestRecord.requestBody, rule.requestBodyExactMatch)
        : null,
      requestBodyKeyMatches: requestRecord && rule.requestBodyKeyMatch
        ? hasBodyKeyPath(requestRecord.requestBody, rule.requestBodyKeyMatch)
        : rule.requestBodyKeyMatch
          ? null
          : true,
      scenario: options.scenario ?? null
    };

    return {
      ...buildMockRuleSummary(rule),
      diagnostic,
      summary: [
        diagnostic.enabled ? "规则已启用" : "规则已禁用",
        diagnostic.activeGroupMatches ? "分组命中" : "当前激活分组不匹配",
        diagnostic.methodMatches === false ? "方法不匹配" : null,
        diagnostic.urlMatches === false ? "URL 不匹配" : null,
        diagnostic.requestBodyExactMatches === false ? "精确 body 条件不匹配" : null,
        diagnostic.requestBodyKeyMatches === false ? "body key 条件不匹配" : null
      ]
        .filter(Boolean)
        .join("，")
    };
  }

  return {
    ...buildMockRuleSummary(rule),
    responseStatus: rule.responseStatus,
    hasBodyMatcher: Boolean(rule.requestBodyExactMatch || rule.requestBodyKeyMatch),
    responseHeaderCount: Object.keys(rule.responseHeaders).length,
    hasResponseBody: rule.responseBody !== null && rule.responseBody !== undefined
  };
}
```

- [ ] **Step 4: Run Core tests to prove the helpers work**

Run: `corepack pnpm --filter @polaris/core test`

Expected: PASS with `payloads.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add apps/core/package.json apps/core/src/modules/mock/mockMatchers.ts apps/core/src/modules/mock/mockService.ts apps/core/src/modules/mcp/payloads.ts apps/core/src/modules/mcp/payloads.test.ts
git commit -m "test: add shared MCP payload helpers"
```

---

### Task 2: Wire SDK MCP Tools And Resources To Lightweight Defaults

**Files:**
- Modify: `apps/core/src/modules/mcp/sdkServer.ts`
- Modify: `scripts/dev/mcp-selftest.mjs`

- [ ] **Step 1: Extend the self-test with failing low-context expectations**

Update `scripts/dev/mcp-selftest.mjs` near the request/mock flow:

```js
function parseResourceJson(resource) {
  return JSON.parse(resource.contents[0].text);
}

function assertShortText(callResult, maxChars = 160) {
  const text = callResult?.content?.[0]?.text ?? "";
  assert(text.length > 0 && text.length <= maxChars, `Expected short summary text, got length ${text.length}`);
}
```

Add assertions after the initial resource checks:

```js
const recentRequestsResource = await client.readResource({ uri: "polaris://requests/recent" });
const recentRequestsJson = parseResourceJson(recentRequestsResource);
assert(Array.isArray(recentRequestsJson), "recent_requests resource should be an array");
if (recentRequestsJson[0]) {
  assert(!("requestBody" in recentRequestsJson[0]), "recent_requests resource must not return full request bodies");
}
```

Replace the first `run_request` expectations with:

```js
const runCall = await client.callTool({
  name: "run_request",
  arguments: {
    method: "GET",
    url: "https://polaris.local/selftest"
  }
});
assertShortText(runCall);
const runResult = getToolResult(runCall);
assert(runResult?.ok === true && runResult?.id, "run_request should return a receipt");
```

Replace the first request detail assertions with:

```js
const requestDetailSummary = getToolResult(
  await client.callTool({
    name: "get_request_detail",
    arguments: { id: runResult.id }
  })
);
assert(!("requestBody" in requestDetailSummary), "default request detail should be summary-only");

const requestDetailPreview = getToolResult(
  await client.callTool({
    name: "get_request_detail",
    arguments: { id: runResult.id, view: "preview", bodyPreviewChars: 32 }
  })
);
assert(typeof requestDetailPreview?.requestBodyPreview === "string", "preview should expose requestBodyPreview");

const requestDetailFull = getToolResult(
  await client.callTool({
    name: "get_request_detail",
    arguments: { id: runResult.id, view: "full" }
  })
);
assert(requestDetailFull?.requestBody !== undefined, "full request detail should expose requestBody");
```

- [ ] **Step 2: Run the self-test and confirm the SDK server still returns heavy payloads**

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: FAIL on the new “short summary text”, “summary-only resource”, or “default request detail should be summary-only” assertions.

- [ ] **Step 3: Replace SDK-local payload shaping with the shared helper**

Update `apps/core/src/modules/mcp/sdkServer.ts` imports:

```ts
import {
  buildMockRuleDetailPayload,
  buildMockRuleSummary,
  buildProxyRuleSummary,
  buildRequestDetailPayload,
  buildRequestSummary,
  buildResourceResult,
  buildSavedRequestDetailPayload,
  buildSavedRequestSummary,
  buildToolResult,
  buildWriteReceipt,
  detailViewValues
} from "./payloads";
```

Add a reusable detail input schema:

```ts
const detailInputSchema = z.object({
  id: z.string().min(1),
  view: z.enum(detailViewValues).optional(),
  requestId: z.string().min(1).optional(),
  scenario: z.string().min(1).optional(),
  bodyPreviewChars: z.number().int().positive().max(8000).optional()
});
```

Replace the old `jsonToolResult` and `jsonResourceResult` helpers by calling `buildToolResult` and `buildResourceResult` directly inside handlers.

Update the request detail handler:

```ts
server.registerTool(
  getRequestDetailTool.name,
  {
    description: getRequestDetailTool.description,
    inputSchema: detailInputSchema.omit({ requestId: true, scenario: true }),
    annotations: {
      readOnlyHint: true
    }
  },
  async ({ id, view, bodyPreviewChars }) =>
    safe(() => {
      const record = requestService.getById(id);
      if (!record) {
        throw new Error("Request not found");
      }
      const payload = buildRequestDetailPayload(record, { view, bodyPreviewChars });
      return buildToolResult(payload, `Loaded request ${record.method} ${record.path} (${view ?? "summary"})`);
    })
);
```

Update the saved request detail handler:

```ts
server.registerTool(
  getSavedRequestDetailTool.name,
  {
    description: getSavedRequestDetailTool.description,
    inputSchema: detailInputSchema.omit({ requestId: true, scenario: true }),
    annotations: {
      readOnlyHint: true
    }
  },
  async ({ id, view, bodyPreviewChars }) =>
    safe(() => {
      const savedRequest = requestService.getSavedById(id);
      if (!savedRequest) {
        throw new Error("Saved request not found");
      }
      const payload = buildSavedRequestDetailPayload(savedRequest, { view, bodyPreviewChars });
      return buildToolResult(payload, `Loaded saved request ${savedRequest.name} (${view ?? "summary"})`);
    })
);
```

Update write operations to return receipts instead of full objects:

```ts
async (args) =>
  safe(async () => {
    const data = await requestService.save(args as SaveRequestInput);
    return buildToolResult(buildWriteReceipt(null, data, `Saved request ${data.name}`), `Saved request ${data.name}`);
  })
```

Use the same receipt pattern for `update_saved_request`, `create_mock_rule`, `update_mock_rule`, `run_request`, and `replay_request`.

Update resources to emit summary arrays only:

```ts
async () => buildResourceResult(requestListResource.uri, requestService.list({ limit: 20 }).map(buildRequestSummary))
async () => buildResourceResult(savedRequestListResource.uri, requestService.listSaved().map(buildSavedRequestSummary))
async () => buildResourceResult(mockRuleListResource.uri, mockService.list().map(buildMockRuleSummary))
async () => buildResourceResult(proxyRuleListResource.uri, proxyService.listRules().map(buildProxyRuleSummary))
```

- [ ] **Step 4: Run self-test and typecheck**

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: PASS through the SDK assertions added in this task.

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/mcp/sdkServer.ts scripts/dev/mcp-selftest.mjs
git commit -m "feat: make SDK MCP responses lightweight by default"
```

---

### Task 3: Keep Legacy HTTP MCP Behavior In Lockstep

**Files:**
- Modify: `apps/core/src/modules/mcp/mcpServer.ts`
- Modify: `scripts/dev/mcp-selftest.mjs`

- [ ] **Step 1: Add failing legacy parity assertions**

Append these checks near the existing legacy assertions in `scripts/dev/mcp-selftest.mjs`:

```js
const legacyRun = await postLegacy(legacyUrl, "run_request", {
  method: "GET",
  url: "https://polaris.local/selftest"
});
assert(legacyRun.response.status === 200, "legacy run_request should succeed");
assert(legacyRun.payload?.data?.ok === true && legacyRun.payload?.data?.id, "legacy run_request should return a receipt");

const legacySummaryDetail = await postLegacy(legacyUrl, "get_request_detail", {
  id: legacyRun.payload.data.id
});
assert(!("requestBody" in legacySummaryDetail.payload.data), "legacy get_request_detail should default to summary");

const legacyMockResource = await fetch(`${legacyUrl}/resource/mock_rules`);
const legacyMockResourcePayload = await legacyMockResource.json();
assert(Array.isArray(legacyMockResourcePayload.data), "legacy mock_rules resource should stay an array");
if (legacyMockResourcePayload.data[0]) {
  assert(!("responseBody" in legacyMockResourcePayload.data[0]), "legacy mock_rules resource must be summary-only");
}
```

- [ ] **Step 2: Run the self-test to confirm the legacy server is still heavy**

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: FAIL on one of the new legacy assertions.

- [ ] **Step 3: Replace legacy response shaping with the same helper layer**

Update `apps/core/src/modules/mcp/mcpServer.ts` imports:

```ts
import {
  buildMockRuleDetailPayload,
  buildMockRuleSummary,
  buildProxyRuleSummary,
  buildRequestDetailPayload,
  buildRequestSummary,
  buildSavedRequestDetailPayload,
  buildSavedRequestSummary,
  buildWriteReceipt
} from "./payloads";
```

Delete the local `getRuleGroupName`, `buildMockRuleSummary`, `buildProxyRuleSummary`, `buildRequestSummary`, and `buildSavedRequestSummary` implementations.

Update representative handlers:

```ts
case "get_request_detail":
  {
    const request = this.requestService.getById(req.body.id);
    if (!request) {
      throw new Error("Request not found");
    }
    res.json({
      data: buildRequestDetailPayload(request, {
        view: req.body.view,
        bodyPreviewChars: req.body.bodyPreviewChars
      })
    });
  }
  return;
```

```ts
case "save_request":
  {
    const saved = await this.requestService.save(req.body as SaveRequestInput);
    res.json({ data: buildWriteReceipt(null, saved, `Saved request ${saved.name}`) });
  }
  return;
```

```ts
case "get_mock_rule_detail":
  {
    const mockRule = this.mockService.list().find((item) => item.id === req.body.id);
    if (!mockRule) {
      throw new Error("Mock rule not found");
    }
    const requestRecord = req.body.requestId ? this.requestService.getById(req.body.requestId) : undefined;
    res.json({
      data: buildMockRuleDetailPayload(
        mockRule,
        {
          view: req.body.view,
          requestId: req.body.requestId,
          scenario: req.body.scenario,
          bodyPreviewChars: req.body.bodyPreviewChars
        },
        {
          activeGroup: this.mockService.getActiveGroup(),
          requestRecord
        }
      )
    });
  }
  return;
```

Update `/resource/:name` to return summary-only lists:

```ts
case "recent_requests":
  res.json({ data: this.requestService.list().slice(0, 20).map(buildRequestSummary) });
  return;
case "saved_requests":
  res.json({ data: this.requestService.listSaved().map(buildSavedRequestSummary) });
  return;
case "mock_rules":
  res.json({ data: this.mockService.list().map(buildMockRuleSummary) });
  return;
case "proxy_rules":
  res.json({ data: this.proxyService.listRules().map(buildProxyRuleSummary) });
  return;
```

- [ ] **Step 4: Run the end-to-end self-test**

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: PASS for both SDK MCP and legacy `/invoke` + `/resource` flows.

- [ ] **Step 5: Commit**

```bash
git add apps/core/src/modules/mcp/mcpServer.ts scripts/dev/mcp-selftest.mjs
git commit -m "feat: align legacy MCP responses with lightweight defaults"
```

---

### Task 4: Support Patch Updates And Reusable Mock Creation Without Adding More Tools

**Files:**
- Create: `apps/core/src/modules/mock/mockTemplates.ts`
- Create: `apps/core/src/modules/mcp/mockRuleMutations.ts`
- Create: `apps/core/src/modules/mcp/mockRuleMutations.test.ts`
- Modify: `apps/core/src/modules/mcp/sdkServer.ts`
- Modify: `apps/core/src/modules/mcp/mcpServer.ts`
- Modify: `scripts/dev/mcp-selftest.mjs`

- [ ] **Step 1: Add failing unit tests for flexible mock mutation inputs**

Create `apps/core/src/modules/mcp/mockRuleMutations.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import {
  buildCreateMockRuleInput,
  buildUpdateMockRuleInput
} from "./mockRuleMutations";

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

test("buildUpdateMockRuleInput applies replace operations", () => {
  const next = buildUpdateMockRuleInput(existingRule, {
    id: "mock-1",
    operations: [
      { op: "replace", path: "responseStatus", value: 204 },
      { op: "replace", path: "enabled", value: true }
    ]
  });

  assert.equal(next.responseStatus, 204);
  assert.equal(next.enabled, true);
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
});
```

- [ ] **Step 2: Run Core tests and confirm the mutation helper is missing**

Run: `corepack pnpm --filter @polaris/core test`

Expected: FAIL with module resolution errors for `./mockRuleMutations`.

- [ ] **Step 3: Implement the minimal template registry and mutation normalizer**

Create `apps/core/src/modules/mock/mockTemplates.ts`:

```ts
import type { CreateMockRuleInput } from "@polaris/shared-contracts";

export const mockTemplates: Record<string, Omit<CreateMockRuleInput, "name">> = {
  json_ok: {
    group: "templates",
    method: "GET",
    url: "https://example.com/api/template",
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: 200,
    responseHeaders: { "content-type": "application/json" },
    responseBody: { ok: true },
    enabled: true
  }
};
```

Create `apps/core/src/modules/mcp/mockRuleMutations.ts`:

```ts
import type { CreateMockRuleInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule, RequestRecord } from "@polaris/shared-types";
import { mockTemplates } from "../mock/mockTemplates";

type MockRulePatch = Partial<CreateMockRuleInput>;
type MockRuleOperation = {
  op: "replace" | "remove";
  path: keyof CreateMockRuleInput;
  value?: unknown;
};

type CreateArgs =
  | CreateMockRuleInput
  | {
      name: string;
      requestId: string;
      patch?: MockRulePatch;
    }
  | {
      name: string;
      template: keyof typeof mockTemplates;
      patch?: MockRulePatch;
    };

type UpdateArgs =
  | ({ id: string } & UpdateMockRuleInput)
  | {
      id: string;
      patch: MockRulePatch;
    }
  | {
      id: string;
      operations: MockRuleOperation[];
    };

function isFullCreateInput(args: CreateArgs): args is CreateMockRuleInput {
  return "method" in args && "url" in args && "responseStatus" in args;
}

function isFullUpdateInput(args: UpdateArgs): args is { id: string } & UpdateMockRuleInput {
  return "method" in args && "url" in args && "responseStatus" in args;
}

function applyPatch(base: CreateMockRuleInput, patch?: MockRulePatch): CreateMockRuleInput {
  return {
    ...base,
    ...(patch ?? {})
  };
}

function applyOperations(base: CreateMockRuleInput, operations: MockRuleOperation[]): CreateMockRuleInput {
  return operations.reduce<CreateMockRuleInput>((current, operation) => {
    if (operation.op === "remove") {
      return {
        ...current,
        [operation.path]: null
      } as CreateMockRuleInput;
    }

    return {
      ...current,
      [operation.path]: operation.value
    } as CreateMockRuleInput;
  }, base);
}

function fromRequestRecord(name: string, record: RequestRecord): CreateMockRuleInput {
  return {
    name,
    method: record.method,
    url: record.url,
    requestBodyExactMatch: null,
    requestBodyKeyMatch: null,
    responseStatus: record.statusCode,
    responseHeaders: record.responseHeaders,
    responseBody: record.responseBody,
    enabled: true
  };
}

function fromExistingRule(rule: MockRule): CreateMockRuleInput {
  return {
    name: rule.name,
    method: rule.method,
    url: rule.url,
    requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
    responseStatus: rule.responseStatus,
    responseHeaders: rule.responseHeaders,
    responseBody: rule.responseBody,
    enabled: rule.enabled,
    group: undefined
  };
}

export function buildCreateMockRuleInput(
  args: CreateArgs,
  context: { requestRecord?: RequestRecord }
): CreateMockRuleInput {
  if (isFullCreateInput(args)) {
    return args;
  }

  if ("requestId" in args) {
    if (!context.requestRecord) {
      throw new Error("Request not found");
    }
    return applyPatch(fromRequestRecord(args.name, context.requestRecord), args.patch);
  }

  const template = mockTemplates[args.template];
  if (!template) {
    throw new Error("Mock template not found");
  }

  return applyPatch(
    {
      name: args.name,
      ...template
    },
    args.patch
  );
}

export function buildUpdateMockRuleInput(existingRule: MockRule, args: UpdateArgs): UpdateMockRuleInput {
  if (isFullUpdateInput(args)) {
    const { id: _id, ...input } = args;
    return input;
  }

  const base = fromExistingRule(existingRule);
  if ("patch" in args) {
    const { name, ...input } = applyPatch(base, args.patch);
    return {
      name,
      ...input
    };
  }

  const { name, ...input } = applyOperations(base, args.operations);
  return {
    name,
    ...input
  };
}
```

- [ ] **Step 4: Wire create/update handlers in both MCP servers**

Update the SDK schemas in `apps/core/src/modules/mcp/sdkServer.ts`:

```ts
const baseCreateMockRuleInputSchema = z.object({
  name: z.string().min(1).describe("Rule name. Use '[Group] Name' format for grouping."),
  group: z.string().min(1).optional(),
  method: z.string().min(1).describe("HTTP method, e.g. GET, POST."),
  url: z.string().min(1).describe("URL substring to match against."),
  requestBodyExactMatch: z.string().min(1).nullable().optional(),
  requestBodyKeyMatch: z.string().min(1).nullable().optional(),
  responseStatus: z.number().int(),
  responseHeaders: stringMapSchema.optional(),
  responseBody: z.unknown().nullable().optional(),
  enabled: z.boolean()
});

const mockRulePatchSchema = z.object({
  name: z.string().min(1).optional(),
  group: z.string().min(1).nullable().optional(),
  method: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  requestBodyExactMatch: z.string().min(1).nullable().optional(),
  requestBodyKeyMatch: z.string().min(1).nullable().optional(),
  responseStatus: z.number().int().optional(),
  responseHeaders: stringMapSchema.optional(),
  responseBody: z.unknown().nullable().optional(),
  enabled: z.boolean().optional()
});

const mockRuleOperationSchema = z.object({
  op: z.enum(["replace", "remove"]),
  path: z.enum([
    "name",
    "group",
    "method",
    "url",
    "requestBodyExactMatch",
    "requestBodyKeyMatch",
    "responseStatus",
    "responseHeaders",
    "responseBody",
    "enabled"
  ]),
  value: z.unknown().optional()
});

const createMockRuleInputSchema = z.union([
  baseCreateMockRuleInputSchema,
  z.object({
    name: z.string().min(1),
    requestId: z.string().min(1),
    patch: mockRulePatchSchema.optional()
  }),
  z.object({
    name: z.string().min(1),
    template: z.string().min(1),
    patch: mockRulePatchSchema.optional()
  })
]);

const updateMockRuleToolInputSchema = z.union([
  baseCreateMockRuleInputSchema.extend({ id: z.string().min(1) }),
  z.object({
    id: z.string().min(1),
    patch: mockRulePatchSchema
  }),
  z.object({
    id: z.string().min(1),
    operations: z.array(mockRuleOperationSchema).min(1)
  })
]);
```

Update the SDK create/update handlers:

```ts
const nextInput = buildCreateMockRuleInput(args as never, {
  requestRecord: "requestId" in args ? requestService.getById(args.requestId) : undefined
});
const data = await mockService.create(nextInput);
return buildToolResult(buildWriteReceipt(null, data, `Created mock rule ${data.name}`), `Created mock rule ${data.name}`);
```

```ts
const existingRule = mockService.list().find((item) => item.id === id);
if (!existingRule) {
  throw new Error("Mock rule not found");
}
const nextInput = buildUpdateMockRuleInput(existingRule, { id, ...input } as never);
const data = await mockService.update(id, nextInput);
return buildToolResult(buildWriteReceipt(existingRule, data, `Updated mock rule ${data.name}`), `Updated mock rule ${data.name}`);
```

Make the same normalization calls in `apps/core/src/modules/mcp/mcpServer.ts`.

Extend mock diagnostics in both servers to resolve optional `requestId`:

```ts
const requestRecord = requestId ? requestService.getById(requestId) : undefined;
const payload = buildMockRuleDetailPayload(
  rule,
  { view, requestId, scenario, bodyPreviewChars },
  {
    activeGroup: mockService.getActiveGroup(),
    requestRecord
  }
);
```

- [ ] **Step 5: Add end-to-end self-test coverage for the new flows**

Append to `scripts/dev/mcp-selftest.mjs`:

```js
const createFromRequestReceipt = getToolResult(
  await client.callTool({
    name: "create_mock_rule",
    arguments: {
      name: "[selftest] mock-from-request",
      requestId: runResult.id,
      patch: {
        enabled: true
      }
    }
  })
);
assert(createFromRequestReceipt?.ok === true, "create_mock_rule requestId mode failed");

const createFromTemplateReceipt = getToolResult(
  await client.callTool({
    name: "create_mock_rule",
    arguments: {
      name: "[selftest] mock-from-template",
      template: "json_ok",
      patch: {
        url: "https://polaris.local/template"
      }
    }
  })
);
assert(createFromTemplateReceipt?.ok === true, "create_mock_rule template mode failed");

const patchUpdateReceipt = getToolResult(
  await client.callTool({
    name: "update_mock_rule",
    arguments: {
      id: mockB.id,
      patch: {
        enabled: true,
        method: "POST"
      }
    }
  })
);
assert(patchUpdateReceipt?.ok === true, "update_mock_rule patch mode failed");
assert(patchUpdateReceipt.changedFields.includes("method"), "patch update should report method change");

const operationsUpdateReceipt = getToolResult(
  await client.callTool({
    name: "update_mock_rule",
    arguments: {
      id: mockB.id,
      operations: [
        { op: "replace", path: "responseStatus", value: 204 },
        { op: "remove", path: "requestBodyExactMatch" }
      ]
    }
  })
);
assert(operationsUpdateReceipt?.ok === true, "update_mock_rule operations mode failed");

const diagnosticDetail = getToolResult(
  await client.callTool({
    name: "get_mock_rule_detail",
    arguments: {
      id: mockB.id,
      view: "diagnostic",
      requestId: runResult.id
    }
  })
);
assert(diagnosticDetail?.diagnostic, "diagnostic detail should be returned");
```

- [ ] **Step 6: Run unit tests, self-test, and typecheck**

Run: `corepack pnpm --filter @polaris/core test`

Expected: PASS.

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: PASS.

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/core/src/modules/mock/mockTemplates.ts apps/core/src/modules/mcp/mockRuleMutations.ts apps/core/src/modules/mcp/mockRuleMutations.test.ts apps/core/src/modules/mcp/sdkServer.ts apps/core/src/modules/mcp/mcpServer.ts scripts/dev/mcp-selftest.mjs
git commit -m "feat: add low-context mock patch and reuse flows"
```

---

### Task 5: Strengthen Tool Descriptions And Ship The AI Guidance Artifacts

**Files:**
- Modify: `packages/mcp-contracts/src/tools/listRequests.ts`
- Modify: `packages/mcp-contracts/src/tools/listSavedRequests.ts`
- Modify: `packages/mcp-contracts/src/tools/listMockRules.ts`
- Modify: `packages/mcp-contracts/src/tools/getRequestDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/getSavedRequestDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/getMockRuleDetail.ts`
- Modify: `packages/mcp-contracts/src/tools/createMockRule.ts`
- Modify: `packages/mcp-contracts/src/tools/updateMockRule.ts`
- Create: `docs/skills/polaris-efficient-mcp/SKILL.md`
- Create: `docs/mcp-efficient-usage.md`
- Modify: `docs/mcp.md`

- [ ] **Step 1: Update the tool descriptions to bias the model toward low-context flows**

Update `packages/mcp-contracts/src/tools/getRequestDetail.ts`:

```ts
export const getRequestDetailTool = {
  name: "get_request_detail",
  description:
    "Get one captured request by id. Defaults to view='summary'. Use view='preview' before view='full' unless you truly need complete request/response bodies."
};
```

Update `packages/mcp-contracts/src/tools/getSavedRequestDetail.ts`:

```ts
export const getSavedRequestDetailTool = {
  name: "get_saved_request_detail",
  description:
    "Get one saved request by id. Defaults to view='summary'. Use view='preview' before view='full' to avoid loading full headers/query/body."
};
```

Update `packages/mcp-contracts/src/tools/getMockRuleDetail.ts`:

```ts
export const getMockRuleDetailTool = {
  name: "get_mock_rule_detail",
  description:
    "Get one mock rule by id. Defaults to view='summary'. Use view='diagnostic' to troubleshoot why a mock may not match; include requestId when available. Use view='preview' before view='full'."
};
```

Update `packages/mcp-contracts/src/tools/createMockRule.ts`:

```ts
export const createMockRuleTool = {
  name: "create_mock_rule",
  description:
    "Create a mock rule. Prefer requestId + patch or template + patch instead of rebuilding large mock payloads from scratch. Returns a lightweight receipt; call get_mock_rule_detail only if you need more detail."
};
```

Update `packages/mcp-contracts/src/tools/updateMockRule.ts`:

```ts
export const updateMockRuleTool = {
  name: "update_mock_rule",
  description:
    "Update a mock rule by id. Prefer patch or operations for small changes instead of resending the full rule. Returns a lightweight receipt with changedFields."
};
```

Update the three list tool descriptions so they explicitly say “start here first”.

- [ ] **Step 2: Add the repo-owned skill and example guide**

Create `docs/skills/polaris-efficient-mcp/SKILL.md`:

```md
---
name: polaris-efficient-mcp
description: Default low-context workflow for using Polaris MCP
---

1. Start with `list_requests`, `list_saved_requests`, `list_mock_rules`, or summary-only resources.
2. When you need one item, call the matching `get_*_detail` tool with the default summary view first.
3. Use `view="diagnostic"` only for mock troubleshooting, and include `requestId` whenever you have one.
4. Use `view="preview"` before `view="full"` when investigating payloads.
5. Prefer `update_mock_rule` with `patch` or `operations`.
6. Prefer `create_mock_rule` with `requestId` or `template` plus `patch`.
7. After a write receipt, do not re-read the full object unless you need one specific omitted field.
```

Create `docs/mcp-efficient-usage.md`:

````md
# Polaris MCP Low-Context Usage

## 排查 mock 不生效

1. `list_mock_rules`
2. `get_mock_rule_detail({ id, view: "diagnostic", requestId })`
3. 仅在仍然缺信息时再用 `view: "preview"` 或 `view: "full"`

## 小改动 patch mock

```json
{
  "id": "mock-rule-id",
  "patch": {
    "enabled": true,
    "method": "POST"
  }
}
```

## 从请求或模板创建 mock

```json
{
  "name": "wxhb_mainPage mock",
  "requestId": "captured-request-id",
  "patch": {
    "enabled": true
  }
}
```

```json
{
  "name": "json_ok mock",
  "template": "json_ok",
  "patch": {
    "url": "https://polaris.local/template"
  }
}
```
````

Update `docs/mcp.md` near the top with:

```md
如果你希望模型默认按低上下文方式使用 Polaris，再看：

- `docs/mcp-efficient-usage.md`
- `docs/skills/polaris-efficient-mcp/SKILL.md`
```

- [ ] **Step 3: Verify the guidance artifacts are present and the workspace still typechecks**

Run: `git grep -n "low-context\\|view='summary'\\|patch or operations" -- packages/mcp-contracts docs`

Expected: PASS with matches in the updated tool description files and docs.

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/mcp-contracts/src/tools docs/skills/polaris-efficient-mcp/SKILL.md docs/mcp-efficient-usage.md docs/mcp.md
git commit -m "docs: add low-context Polaris MCP guidance"
```

---

### Task 6: Final Verification Sweep

**Files:**
- Modify: `scripts/dev/mcp-selftest.mjs`

- [ ] **Step 1: Run the full verification sequence**

Run: `corepack pnpm --filter @polaris/core test`

Expected: PASS.

Run: `corepack pnpm typecheck`

Expected: PASS.

Run: `node scripts/dev/mcp-selftest.mjs`

Expected: PASS.

- [ ] **Step 2: Smoke-check that the core goals are all covered**

Run: `git grep -n "view: \\\"diagnostic\\\"\\|requestId\\|patch\\|template\\|changedFields" -- apps/core packages/mcp-contracts docs scripts/dev/mcp-selftest.mjs`

Expected: PASS with matches showing:
- detail view support
- request-aware diagnostics
- patch/operations support
- template/request create support
- lightweight write receipts

- [ ] **Step 3: Commit verification-only adjustments if needed**

```bash
git add apps/core scripts/dev/mcp-selftest.mjs packages/mcp-contracts docs
git commit -m "chore: verify efficient MCP context flow"
```

---

## Self-Review

- **Spec coverage:** The plan covers P0 (`jsonToolResult` dedupe, resource summary-only, detail views, write receipts) and P1 (`patch/operations`, `requestId`/`template` mock creation, mock diagnostics, tool description guidance, skill/doc examples). It intentionally excludes P2 `generate_mock_from_code`.
- **Placeholder scan:** No placeholder markers remain. The only scoped deferral is the explicit P2 exclusion in the scope notes.
- **Type consistency:** The same detail view vocabulary (`summary`, `diagnostic`, `preview`, `full`) is used across tests, helper modules, SDK handlers, legacy handlers, tool descriptions, and docs. The same `patch` / `operations` / `template` naming is used end-to-end.
