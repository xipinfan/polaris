import type { JsonValue, MockRule, ProxyRule, RequestRecord, SavedRequest } from "@polaris/shared-types";
import { getBodyPathValue, getRuleGroupName, hasBodyKeyPath, matchesExactBodyExpression } from "../mock/mockMatchers";
import {
  assignPathValue,
  buildEmptyLike,
  cloneJsonValue,
  executeJsonPath,
  extractWritableJsonPathTokens,
  isPlainObject,
  normalizeToJsonPath,
  removePathValue
} from "./jsonPathUtils";

export const detailViewValues = ["summary", "diagnostic", "preview", "full", "shape"] as const;
export type DetailView = (typeof detailViewValues)[number];
export const DEFAULT_BODY_PREVIEW_CHARS = 2000;
export const DEFAULT_LIST_LIMIT = 20;
export const MAX_FULL_VIEW_CHARS = 16000;
export { executeJsonPath, normalizeToJsonPath } from "./jsonPathUtils";

type DetailOptions = {
  view?: DetailView;
  requestId?: string;
  scenario?: string;
  bodyPreviewChars?: number;
  maxDepth?: number;
  maxArrayItems?: number;
  jsonPath?: string;
  responsePath?: string;
  includePaths?: string[];
  excludePaths?: string[];
  topLevelOnly?: boolean;
};

export type BodySizeClassification = "small" | "medium" | "large";
export type BodySizeInfo = {
  chars: number;
  classification: BodySizeClassification;
};

export type PaginationMeta = {
  offset: number;
  limit: number;
  returned: number;
  total: number;
  hasMore: boolean;
};

type ToolResultTextMode = "summary" | "preview";

type PathFilterResult = {
  normalizedJsonPath: string | null;
  matchedPaths: string[];
  matchedValues: unknown[];
  filteredValue: unknown;
};

type ShapeOptions = {
  maxDepth?: number;
  maxArrayItems?: number;
  topLevelOnly?: boolean;
};

type JsonStats = {
  serializedChars: number;
  nodeCount: number;
  maxDepth: number;
  topLevelKeys: string[];
};

type MockDiagnosticContext = {
  activeGroup: string | null;
  requestRecord?: RequestRecord;
};

type ScenarioCondition = {
  path: string;
  expected: string;
};

export function truncateText(value: unknown, maxChars: number): string {
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

function buildIncludeSubset(source: unknown, includePaths: string[]): unknown {
  let result: unknown = undefined;
  for (const rawPath of includePaths) {
    const normalized = normalizeToJsonPath(rawPath)!;
    const execution = executeJsonPath(source, normalized);
    for (let index = 0; index < execution.matchedPaths.length; index += 1) {
      const matchedPath = execution.matchedPaths[index]!;
      const matchedValue = execution.matchedValues[index];
      const tokens = extractWritableJsonPathTokens(matchedPath);
      result = assignPathValue(result, tokens, matchedValue);
    }
  }
  return result ?? buildEmptyLike(source);
}

function applyExcludePaths(source: unknown, excludePaths: string[]): unknown {
  let result = cloneJsonValue(source);
  for (const rawPath of excludePaths) {
    const normalized = normalizeToJsonPath(rawPath)!;
    const execution = executeJsonPath(result, normalized);
    for (const matchedPath of execution.matchedPaths) {
      const tokens = extractWritableJsonPathTokens(matchedPath);
      result = removePathValue(result, tokens);
    }
  }
  return result;
}

function buildTopLevelView(value: unknown, maxArrayItems?: number): unknown {
  if (Array.isArray(value)) {
    return buildShape(value, { topLevelOnly: true, maxArrayItems });
  }
  if (isPlainObject(value)) {
    return buildShape(value, { topLevelOnly: true, maxArrayItems });
  }
  return value;
}

function buildContentPreviewLine(value: unknown): string {
  if (Array.isArray(value)) {
    return `items=${value.length}`;
  }

  if (!isPlainObject(value)) {
    return truncateText(value, 160).replace(/\s+/g, " ");
  }

  const preferredKeys = [
    "id",
    "ruleId",
    "name",
    "title",
    "url",
    "method",
    "enabled",
    "host",
    "pattern",
    "action",
    "statusCode"
  ];
  const selectedKeys = preferredKeys.filter((key) => key in value);
  const fallbackKeys = Object.keys(value).slice(0, Math.max(0, 4 - selectedKeys.length));
  const keys = [...new Set([...selectedKeys, ...fallbackKeys])].slice(0, 4);
  if (keys.length === 0) {
    return "{}";
  }

  return keys
    .map((key) => `${key}=${truncateText(value[key], 80).replace(/\s+/g, " ")}`)
    .join(", ");
}

function buildContentPreview(value: unknown): string {
  if (Array.isArray(value)) {
    const lines = value.slice(0, 5).map((item, index) => `${index + 1}. ${buildContentPreviewLine(item)}`);
    if (value.length > 5) {
      lines.push(`... (+${value.length - 5} more items)`);
    }
    return lines.join("\n");
  }

  return buildContentPreviewLine(value);
}

function buildTextContent(result: unknown, summary: string, textMode: ToolResultTextMode): string {
  if (textMode === "summary") {
    return summary;
  }

  const preview = buildContentPreview(result);
  return preview ? `${summary}\n${preview}` : summary;
}

export function classifyBodySize(body: unknown): BodySizeInfo {
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  const chars = serialized?.length ?? 0;
  if (chars < 4000) {
    return { chars, classification: "small" };
  }
  if (chars <= MAX_FULL_VIEW_CHARS) {
    return { chars, classification: "medium" };
  }
  return { chars, classification: "large" };
}

export function buildPaginatedResult<T>(items: T[], total: number, offset: number, limit: number): { items: T[]; _pagination: PaginationMeta } {
  return {
    items,
    _pagination: {
      offset,
      limit,
      returned: items.length,
      total,
      hasMore: offset + items.length < total
    }
  };
}

function jsonTypeName(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function collapseMarker(value: unknown): string {
  if (Array.isArray(value)) {
    return `{array:${value.length}}`;
  }
  if (isPlainObject(value)) {
    return "{object}";
  }
  return jsonTypeName(value);
}

export function buildShape(value: unknown, options: ShapeOptions = {}, depth = 0): unknown {
  const maxDepth = options.topLevelOnly ? 1 : (options.maxDepth ?? 6);
  const maxArrayItems = options.maxArrayItems ?? 5;

  if (value === null || typeof value !== "object") {
    return jsonTypeName(value);
  }

  if (depth >= maxDepth) {
    return collapseMarker(value);
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, maxArrayItems).map((item) => buildShape(item, options, depth + 1));
    if (value.length > maxArrayItems) {
      items.push(`{+${value.length - maxArrayItems} more items}`);
    }
    return items;
  }

  const shape: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    shape[key] = buildShape(child, options, depth + 1);
  }
  return shape;
}

export function applyPathFilters(value: unknown, options: DetailOptions): PathFilterResult {
  const normalizedJsonPath = normalizeToJsonPath(options.jsonPath ?? options.responsePath) ?? null;
  let workingValue = cloneJsonValue(value);
  let matchedPaths: string[] = [];
  let matchedValues: unknown[] = [];

  if (normalizedJsonPath) {
    const execution = executeJsonPath(workingValue, normalizedJsonPath);
    matchedPaths = execution.matchedPaths;
    matchedValues = execution.matchedValues;
    if (matchedValues.length === 1) {
      workingValue = matchedValues[0];
    } else if (matchedValues.length > 1) {
      workingValue = matchedValues;
    } else {
      workingValue = null;
    }
  }

  if (options.includePaths?.length) {
    workingValue = buildIncludeSubset(workingValue, options.includePaths);
  }

  if (options.excludePaths?.length) {
    workingValue = applyExcludePaths(workingValue, options.excludePaths);
  }

  if (options.topLevelOnly) {
    workingValue = buildTopLevelView(workingValue, options.maxArrayItems);
  }

  return {
    normalizedJsonPath,
    matchedPaths,
    matchedValues,
    filteredValue: workingValue
  };
}

export function estimateJsonStats(value: unknown): JsonStats {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  const walk = (node: unknown, depth: number): { nodeCount: number; maxDepth: number } => {
    if (node === null || typeof node !== "object") {
      return { nodeCount: 1, maxDepth: depth };
    }

    if (Array.isArray(node)) {
      return node.reduce(
        (acc, item) => {
          const child = walk(item, depth + 1);
          return {
            nodeCount: acc.nodeCount + child.nodeCount,
            maxDepth: Math.max(acc.maxDepth, child.maxDepth)
          };
        },
        { nodeCount: 1, maxDepth: depth }
      );
    }

    return Object.values(node).reduce(
      (acc, item) => {
        const child = walk(item, depth + 1);
        return {
          nodeCount: acc.nodeCount + child.nodeCount,
          maxDepth: Math.max(acc.maxDepth, child.maxDepth)
        };
      },
      { nodeCount: 1, maxDepth: depth }
    );
  };

  const stats = walk(value, 1);
  const topLevelKeys = isPlainObject(value) ? Object.keys(value) : [];
  return {
    serializedChars: serialized?.length ?? 0,
    nodeCount: stats.nodeCount,
    maxDepth: stats.maxDepth,
    topLevelKeys
  };
}

function buildFilteredBodyPreview(value: unknown, maxChars: number): string {
  return truncateText(value, maxChars);
}

function buildMockRuleBaseDetail(rule: MockRule) {
  return {
    ...buildMockRuleSummary(rule),
    responseStatus: rule.responseStatus,
    requestBodyExactMatch: rule.requestBodyExactMatch ?? null,
    requestBodyKeyMatch: rule.requestBodyKeyMatch ?? null,
    responseHeaderCount: Object.keys(rule.responseHeaders).length,
    responseBodyMeta: estimateJsonStats(rule.responseBody)
  };
}

export function buildToolResult(
  result: unknown,
  summary: string,
  options: { textMode?: ToolResultTextMode } = {}
) {
  const textMode = options.textMode ?? "summary";
  return {
    structuredContent: {
      result
    },
    content: [
      {
        type: "text" as const,
        text: buildTextContent(result, summary, textMode)
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
    responseBodySize: classifyBodySize(record.responseBody),
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
    hasRequestBodyMatcher: Boolean(rule.requestBodyExactMatch || rule.requestBodyKeyMatch),
    hasResponseBody: rule.responseBody !== null && rule.responseBody !== undefined,
    responseBodySize: classifyBodySize(rule.responseBody),
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
  const filterResult = applyPathFilters(record.responseBody, options);
  if (view === "full") {
    const bodySize = classifyBodySize(filterResult.filteredValue);
    if (bodySize.classification === "large") {
      return {
        ...buildRequestSummary(record),
        _degradedFrom: "full" as const,
        _notice: `响应体过大(${bodySize.chars} 字符)，已自动降级为 shape 视图。使用 jsonPath/responsePath 过滤后重试 view="full"。`,
        responseBodyShape: buildShape(filterResult.filteredValue, options),
        responseBodyMeta: estimateJsonStats(filterResult.filteredValue),
        normalizedJsonPath: filterResult.normalizedJsonPath
      };
    }
    return {
      ...record,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      filteredResponseBody: filterResult.filteredValue
    };
  }

  if (view === "shape") {
    return {
      ...buildRequestSummary(record),
      requestBodyShape: buildShape(record.requestBody, options),
      responseBodyShape: buildShape(filterResult.filteredValue, options),
      normalizedJsonPath: filterResult.normalizedJsonPath
    };
  }

  if (view === "preview") {
    const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
    return {
      ...buildRequestSummary(record),
      requestHeaders: record.requestHeaders,
      requestQuery: record.requestQuery,
      responseHeaders: record.responseHeaders,
      requestBodyPreview: truncateText(record.requestBody, maxChars),
      responseBodyPreview: truncateText(filterResult.filteredValue, maxChars),
      normalizedJsonPath: filterResult.normalizedJsonPath,
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
      : null,
    normalizedJsonPath: filterResult.normalizedJsonPath,
    filteredResponseBody: filterResult.filteredValue
  };
}

export function buildSavedRequestDetailPayload(savedRequest: SavedRequest, options: DetailOptions) {
  const view = options.view ?? "summary";
  const filterResult = applyPathFilters(savedRequest.body, options);
  if (view === "full") {
    const bodySize = classifyBodySize(filterResult.filteredValue);
    if (bodySize.classification === "large") {
      return {
        ...buildSavedRequestSummary(savedRequest),
        _degradedFrom: "full" as const,
        _notice: `响应体过大(${bodySize.chars} 字符)，已自动降级为 shape 视图。使用 jsonPath/responsePath 过滤后重试 view="full"。`,
        bodyShape: buildShape(filterResult.filteredValue, options),
        bodyMeta: estimateJsonStats(filterResult.filteredValue),
        normalizedJsonPath: filterResult.normalizedJsonPath
      };
    }
    return {
      ...savedRequest,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      filteredBody: filterResult.filteredValue
    };
  }

  if (view === "shape") {
    return {
      ...buildSavedRequestSummary(savedRequest),
      bodyShape: buildShape(filterResult.filteredValue, options),
      normalizedJsonPath: filterResult.normalizedJsonPath
    };
  }

  if (view === "preview") {
    const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
    return {
      ...buildSavedRequestSummary(savedRequest),
      headers: savedRequest.headers,
      query: savedRequest.query,
      bodyPreview: truncateText(filterResult.filteredValue, maxChars),
      normalizedJsonPath: filterResult.normalizedJsonPath,
      bodyPreviewChars: maxChars
    };
  }

  return {
    ...buildSavedRequestSummary(savedRequest),
    headerCount: Object.keys(savedRequest.headers).length,
    queryCount: Object.keys(savedRequest.query).length,
    hasBody: savedRequest.body !== null && savedRequest.body !== undefined,
    normalizedJsonPath: filterResult.normalizedJsonPath,
    filteredBody: filterResult.filteredValue
  };
}

export function buildMockRuleDetailPayload(
  rule: MockRule,
  options: DetailOptions,
  context: MockDiagnosticContext
) {
  const view = options.view ?? "summary";
  const maxChars = options.bodyPreviewChars ?? DEFAULT_BODY_PREVIEW_CHARS;
  const filterResult = applyPathFilters(rule.responseBody, options);
  const baseDetail = buildMockRuleBaseDetail(rule);

  if (view === "full") {
    const bodySize = classifyBodySize(filterResult.filteredValue);
    if (bodySize.classification === "large") {
      return {
        ...baseDetail,
        _degradedFrom: "full" as const,
        _notice: `响应体过大(${bodySize.chars} 字符)，已自动降级为 shape 视图。使用 jsonPath/responsePath 过滤后重试 view="full"。`,
        responseBodyShape: buildShape(filterResult.filteredValue, options),
        responseBodyMeta: estimateJsonStats(filterResult.filteredValue),
        normalizedJsonPath: filterResult.normalizedJsonPath
      };
    }
    return {
      rule,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      matchedPaths: filterResult.matchedPaths,
      filteredResponseBody: filterResult.filteredValue
    };
  }

  if (view === "shape") {
    return {
      ...baseDetail,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      responseBodyShape: buildShape(filterResult.filteredValue, options)
    };
  }

  if (view === "preview") {
    return {
      ...baseDetail,
      responseHeaders: rule.responseHeaders,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      matchedPaths: filterResult.matchedPaths,
      filteredResponseBodyPreview: buildFilteredBodyPreview(filterResult.filteredValue, maxChars),
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
      ...baseDetail,
      normalizedJsonPath: filterResult.normalizedJsonPath,
      filteredResponseBody: filterResult.filteredValue,
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
    ...baseDetail,
    normalizedJsonPath: filterResult.normalizedJsonPath,
    filteredResponseBody: filterResult.filteredValue
  };
}
