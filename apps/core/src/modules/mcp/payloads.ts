import type { MockRule, ProxyRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import { getBodyPathValue, getRuleGroupName, hasBodyKeyPath, matchesExactBodyExpression } from "../mock/mockMatchers";

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

type ScenarioCondition = {
  path: string;
  expected: string;
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

function parseScenarioConditions(scenario?: string): ScenarioCondition[] {
  if (!scenario) {
    return [];
  }

  return scenario
    .split(/[\n;,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return [];
      }

      const path = entry.slice(0, separatorIndex).trim();
      const expected = entry.slice(separatorIndex + 1).trim();
      if (!path || !expected) {
        return [];
      }

      return [{ path, expected }];
    });
}

function buildScenarioChecks(requestBody: unknown, scenario?: string): string[] {
  return parseScenarioConditions(scenario).flatMap(({ path, expected }) => {
    const resolved = getBodyPathValue(requestBody, path);
    if (!resolved.found) {
      return [`缺少 ${path}=${expected}`];
    }

    if (String(resolved.value) !== expected) {
      return [`期望 ${path}=${expected}，实际为 ${String(resolved.value)}`];
    }

    return [];
  });
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
    const scenarioChecks = requestRecord
      ? buildScenarioChecks(requestRecord.requestBody, options.scenario)
      : options.scenario
        ? ["未提供 requestId，无法校验场景条件"]
        : [];

    const diagnostic = {
      enabled: rule.enabled,
      activeGroup,
      activeGroupMatches: !activeGroup ? true : ruleGroup === activeGroup,
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
      scenario: options.scenario ?? null,
      scenarioChecks
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
        diagnostic.requestBodyKeyMatches === false ? "body key 条件不匹配" : null,
        diagnostic.scenarioChecks.length > 0 ? "场景条件不满足" : null
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
