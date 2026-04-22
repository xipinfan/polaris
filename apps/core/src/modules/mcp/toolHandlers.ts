import type { RunRequestInput, SaveRequestInput, UpdateMockRuleInput } from "@polaris/shared-contracts";
import type { MockRule, ProxyRule } from "@polaris/shared-types";
import { mockTemplates } from "../mock/mockTemplates";
import { hasBodyKeyPath, matchesExactBodyExpression } from "../mock/mockMatchers";
import { CertificateManager } from "../proxy/certificateManager";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { MockService } from "../mock/mockService";
import {
  DEFAULT_LIST_LIMIT,
  buildMockRuleDetailPayload,
  buildMockRuleSummary,
  buildPaginatedResult,
  buildProxyRuleSummary,
  buildRequestDetailPayload,
  buildRequestSummary,
  buildSavedRequestDetailPayload,
  buildSavedRequestSummary,
  buildToolResult,
  buildWriteReceipt
} from "./payloads";
import { buildCreateMockRuleInput, buildUpdateMockRuleInput } from "./mockRuleMutations";
import { resolveDetailTextMode } from "./toolResultPolicy";

export interface ToolServiceDeps {
  requestService: RequestService;
  mockService: MockService;
  proxyService: ProxyService;
  certificateManager?: CertificateManager;
}

export type DetailOptions = {
  view?: "summary" | "diagnostic" | "preview" | "full" | "shape";
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

export type QueryRequestsArgs =
  | { action: "list"; keyword?: string; method?: string; host?: string; statusCode?: number; limit?: number; offset?: number }
  | ({ action: "detail"; id: string } & DetailOptions)
  | { action: "list_saved"; limit?: number; offset?: number }
  | ({ action: "saved_detail"; id: string } & DetailOptions);

export type MutateRequestArgs =
  | {
      op: "save";
      name: string;
      requestId?: string;
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
      tags?: string[];
    }
  | {
      op: "update";
      id: string;
      name?: string;
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
      tags?: string[];
    }
  | { op: "delete"; id: string };

export type QueryMockArgs =
  | { action: "list"; name?: string; group?: string; method?: string; url?: string; enabled?: boolean; limit?: number; offset?: number }
  | ({ action: "detail"; id: string; requestId?: string } & DetailOptions)
  | { action: "active_group" };

export type MutateMockArgs =
  | {
      op: "create";
      name: string;
      requestId?: string;
      template?: string;
      method?: string;
      url?: string;
      group?: string;
      responseStatus?: number;
      responseHeaders?: Record<string, string>;
      responseBody?: unknown;
      requestBodyExactMatch?: string | null;
      requestBodyKeyMatch?: string | null;
      enabled?: boolean;
      patch?: Record<string, unknown>;
    }
  | {
      op: "update";
      id: string;
      name?: string;
      patch?: Record<string, unknown>;
      operations?: Array<{ op: "replace" | "remove"; path: string; value?: unknown }>;
      method?: string;
      url?: string;
      group?: string;
      responseStatus?: number;
      responseHeaders?: Record<string, string>;
      responseBody?: unknown;
      requestBodyExactMatch?: string | null;
      requestBodyKeyMatch?: string | null;
      enabled?: boolean;
    }
  | { op: "delete"; id: string }
  | { op: "enable"; id?: string; name?: string; enabled: boolean }
  | { op: "set_group"; group: string | null };

export type TestMockMatchArgs = { method: string; url: string; body?: unknown };

export type QueryProxyArgs =
  | {
      action: "list";
      host?: string;
      enabled?: boolean;
      ruleAction?: ProxyRule["action"];
      actionFilter?: ProxyRule["action"];
    }
  | { action: "detail"; ruleId: string }
  | { action: "mode" }
  | { action: "decision"; host?: string; url?: string };

export type MutateProxyArgs =
  | { op: "set_mode"; mode: "direct" | "global" | "rules" | "system" }
  | {
      op: "upsert";
      host: string;
      action?: ProxyRule["action"];
      enabled?: boolean;
      forwardMode?: ProxyRule["forwardMode"];
      targetUrl?: string;
      rewriteHost?: string;
      rewritePath?: string;
    }
  | { op: "remove"; host: string };

export type SetupHttpsArgs = { action: "status" } | { action: "install_guide" } | { action: "verify" };

function getRuleGroupName(name: string): string | null {
  const match = name.match(/^\[(.+?)\]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

export async function syncActiveMockGroupFromRuleName(mockService: MockService, ruleName: string): Promise<void> {
  const nextGroup = getRuleGroupName(ruleName);
  if (!nextGroup || nextGroup === mockService.getActiveGroup()) {
    return;
  }
  await mockService.setActiveGroup(nextGroup);
}

export function getInstallGuideForPlatform(certificatePath?: string): { platform: string; steps: string[] } {
  if (process.platform === "win32") {
    return {
      platform: "win32",
      steps: [
        `找到 Polaris 根证书${certificatePath ? `（${certificatePath}）` : ""}。`,
        "Edge 打开 edge://certificate-manager/，Chrome 打开 chrome://settings/certificates。",
        "导入到 Current User -> Trusted Root Certification Authorities。",
        "确认证书主题包含 Polaris Development Root CA。",
        "重启浏览器后再次验证。"
      ]
    };
  }
  if (process.platform === "darwin") {
    return {
      platform: "darwin",
      steps: [
        `打开钥匙串访问并导入证书${certificatePath ? `（${certificatePath}）` : ""}。`,
        "导入到 System 钥匙串。",
        "SSL 信任设置为 Always Trust。"
      ]
    };
  }
  return {
    platform: process.platform,
    steps: [
      `将证书${certificatePath ? `（${certificatePath}）` : ""}导入系统或浏览器信任存储。`,
      "将该 CA 设为可用于 HTTPS 调试。",
      "重启浏览器或客户端进程后重试。"
    ]
  };
}

export function handleQueryRequests(args: QueryRequestsArgs, deps: ToolServiceDeps) {
  if (args.action === "list") {
    const { limit = DEFAULT_LIST_LIMIT, offset = 0, ...filters } = args;
    const records = deps.requestService.list(filters);
    const items = records.slice(offset, offset + limit).map(buildRequestSummary);
    return buildToolResult(
      buildPaginatedResult(items, records.length, offset, limit),
      `Loaded ${items.length} request summaries`
    );
  }

  if (args.action === "detail") {
    const record = deps.requestService.getById(args.id);
    if (!record) {
      throw new Error("Request not found");
    }
    return buildToolResult(
      buildRequestDetailPayload(record, args),
      `Loaded request ${record.method} ${record.path} (${args.view ?? "summary"})`,
      { textMode: resolveDetailTextMode(args.view) }
    );
  }

  if (args.action === "list_saved") {
    const { limit = DEFAULT_LIST_LIMIT, offset = 0 } = args;
    const records = deps.requestService.listSaved();
    const items = records.slice(offset, offset + limit).map(buildSavedRequestSummary);
    return buildToolResult(
      buildPaginatedResult(items, records.length, offset, limit),
      `Loaded ${items.length} saved request summaries`
    );
  }

  const saved = deps.requestService.getSavedById(args.id);
  if (!saved) {
    throw new Error("Saved request not found");
  }
  return buildToolResult(
    buildSavedRequestDetailPayload(saved, args),
    `Loaded saved request ${saved.name} (${args.view ?? "summary"})`,
    { textMode: resolveDetailTextMode(args.view) }
  );
}

export async function handleMutateRequest(args: MutateRequestArgs, deps: ToolServiceDeps) {
  if (args.op === "save") {
    let input: SaveRequestInput = {
      name: args.name,
      method: args.method ?? "GET",
      url: args.url ?? "http://localhost",
      headers: args.headers ?? {},
      query: args.query ?? {},
      body: args.body ?? null,
      tags: args.tags ?? []
    };
    if (args.requestId) {
      const record = deps.requestService.getById(args.requestId);
      if (!record) {
        throw new Error("Request not found");
      }
      input = {
        ...input,
        method: args.method ?? record.method,
        url: args.url ?? record.url,
        headers: args.headers ?? record.requestHeaders,
        query: args.query ?? record.requestQuery,
        body: args.body ?? record.requestBody
      };
    }
    const data = await deps.requestService.save(input);
    return buildToolResult(buildWriteReceipt(null, data, `Saved request ${data.name}`), `Saved request ${data.name}`);
  }

  if (args.op === "update") {
    const before = deps.requestService.getSavedById(args.id);
    if (!before) {
      throw new Error("Saved request not found");
    }
    const data = await deps.requestService.updateSaved(args.id, {
      name: args.name ?? before.name,
      method: args.method ?? before.method,
      url: args.url ?? before.url,
      headers: args.headers ?? before.headers,
      query: args.query ?? before.query,
      body: args.body ?? before.body,
      tags: args.tags ?? before.tags
    });
    return buildToolResult(buildWriteReceipt(before, data, `Updated saved request ${data.name}`), `Updated saved request ${data.name}`);
  }

  await deps.requestService.removeSaved(args.id);
  return buildToolResult({ ok: true, id: args.id }, `Deleted saved request ${args.id}`);
}

export async function handleReplayRequest(args: { id: string }, deps: ToolServiceDeps) {
  const replayed = await deps.requestService.replayRequest(args.id);
  return buildToolResult(buildRequestSummary(replayed), `Replayed request ${replayed.method} ${replayed.path}`);
}

export async function handleRunRequest(args: { name?: string; method: string; url: string; headers?: Record<string, string>; query?: Record<string, string>; body?: unknown }, deps: ToolServiceDeps) {
  const input: RunRequestInput = {
    name: args.name,
    method: args.method,
    url: args.url,
    headers: args.headers,
    query: args.query,
    body: args.body
  };
  const record = await deps.requestService.run(input);
  return buildToolResult(
    {
      id: record.id,
      method: record.method,
      url: record.url,
      statusCode: record.statusCode,
      responseHeaders: record.responseHeaders,
      responseBodyPreview: JSON.stringify(record.responseBody).slice(0, 2000)
    },
    `Ran request ${record.method} ${record.path}`
  );
}

export async function handleClearRequests(deps: ToolServiceDeps) {
  await deps.requestService.clear();
  return buildToolResult({ ok: true }, "Cleared captured requests");
}

export function handleQueryMock(args: QueryMockArgs, deps: ToolServiceDeps) {
  if (args.action === "list") {
    const rules = deps.mockService.list().filter((rule) => {
      const nameMatch = !args.name || rule.name.includes(args.name);
      const groupMatch = !args.group || getRuleGroupName(rule.name) === args.group;
      const methodMatch = !args.method || rule.method === args.method.toUpperCase();
      const urlMatch = !args.url || rule.url.includes(args.url);
      const enabledMatch = typeof args.enabled !== "boolean" || rule.enabled === args.enabled;
      return nameMatch && groupMatch && methodMatch && urlMatch && enabledMatch;
    });
    const offset = args.offset ?? 0;
    const limit = args.limit ?? DEFAULT_LIST_LIMIT;
    const items = rules.slice(offset, offset + limit).map(buildMockRuleSummary);
    return buildToolResult(buildPaginatedResult(items, rules.length, offset, limit), `Loaded ${items.length} mock rule summaries`);
  }

  if (args.action === "detail") {
    const rule = deps.mockService.list().find((item) => item.id === args.id);
    if (!rule) {
      throw new Error("Mock rule not found");
    }
    const requestRecord = args.requestId ? deps.requestService.getById(args.requestId) : undefined;
    return buildToolResult(
      buildMockRuleDetailPayload(rule, args, { activeGroup: deps.mockService.getActiveGroup(), requestRecord }),
      `Loaded mock rule ${rule.name} (${args.view ?? "summary"})`,
      { textMode: resolveDetailTextMode(args.view) }
    );
  }

  return buildToolResult({ group: deps.mockService.getActiveGroup() }, "Loaded active mock group");
}

export async function handleMutateMock(args: MutateMockArgs, deps: ToolServiceDeps) {
  if (args.op === "create") {
    const createArgs = args.requestId
      ? { name: args.name, requestId: args.requestId, patch: args.patch }
      : args.template
        ? { name: args.name, template: args.template, patch: args.patch }
        : {
            name: args.name,
            method: args.method ?? "GET",
            url: args.url ?? "https://example.com/api/mock",
            group: args.group,
            responseStatus: args.responseStatus ?? 200,
            responseHeaders: args.responseHeaders ?? {},
            responseBody: args.responseBody ?? { ok: true },
            requestBodyExactMatch: args.requestBodyExactMatch ?? null,
            requestBodyKeyMatch: args.requestBodyKeyMatch ?? null,
            enabled: args.enabled ?? true
          };
    const requestRecord = args.requestId ? deps.requestService.getById(args.requestId) : undefined;
    const input = buildCreateMockRuleInput(createArgs as never, { requestRecord: requestRecord ?? undefined });
    const data = await deps.mockService.create(input);
    await syncActiveMockGroupFromRuleName(deps.mockService, data.name);
    return buildToolResult(buildWriteReceipt(null, data, `Created mock rule ${data.name}`), `Created mock rule ${data.name}`);
  }

  if (args.op === "update") {
    const before = deps.mockService.list().find((item) => item.id === args.id);
    if (!before) {
      throw new Error("Mock rule not found");
    }
    const updateArgs = args.patch
      ? { id: args.id, patch: args.patch }
      : args.operations
        ? { id: args.id, operations: args.operations }
        : {
            id: args.id,
            name: args.name ?? before.name,
            method: args.method ?? before.method,
            url: args.url ?? before.url,
            group: args.group ?? getRuleGroupName(before.name) ?? undefined,
            responseStatus: args.responseStatus ?? before.responseStatus,
            responseHeaders: args.responseHeaders ?? before.responseHeaders,
            responseBody: args.responseBody ?? before.responseBody,
            requestBodyExactMatch: args.requestBodyExactMatch ?? before.requestBodyExactMatch,
            requestBodyKeyMatch: args.requestBodyKeyMatch ?? before.requestBodyKeyMatch,
            enabled: args.enabled ?? before.enabled
          };
    const nextInput = buildUpdateMockRuleInput(before, updateArgs as never);
    const data = await deps.mockService.update(args.id, nextInput as UpdateMockRuleInput);
    await syncActiveMockGroupFromRuleName(deps.mockService, data.name);
    return buildToolResult(buildWriteReceipt(before, data, `Updated mock rule ${data.name}`), `Updated mock rule ${data.name}`);
  }

  if (args.op === "delete") {
    await deps.mockService.remove(args.id);
    return buildToolResult({ ok: true, id: args.id }, `Deleted mock rule ${args.id}`);
  }

  if (args.op === "enable") {
    if (args.id) {
      const data = await deps.mockService.toggle(args.id, args.enabled);
      return buildToolResult(buildWriteReceipt(null, data, `Set mock rule ${data.name} enabled=${args.enabled}`), `Set mock rule ${data.name} enabled=${args.enabled}`);
    }
    const matched = deps.mockService.list().filter((rule) => rule.name === args.name);
    if (matched.length === 0) {
      throw new Error("Mock rule not found");
    }
    if (matched.length > 1) {
      throw new Error("Multiple mock rules matched this name, please use id");
    }
    const data = await deps.mockService.toggle(matched[0]!.id, args.enabled);
    return buildToolResult(buildWriteReceipt(null, data, `Set mock rule ${data.name} enabled=${args.enabled}`), `Set mock rule ${data.name} enabled=${args.enabled}`);
  }

  const group = await deps.mockService.setActiveGroup(args.group);
  return buildToolResult({ group }, `Set active mock group to ${group ?? "null"}`);
}

function explainNoMatch(phase: "enabled" | "group" | "method" | "url" | "body"): string {
  switch (phase) {
    case "enabled":
      return "无 enabled 规则";
    case "group":
      return "活跃分组过滤后无可用规则";
    case "method":
      return "method 不匹配";
    case "url":
      return "url 不包含";
    default:
      return "body 条件不匹配";
  }
}

export function handleTestMockMatch(args: TestMockMatchArgs, deps: ToolServiceDeps) {
  const all = deps.mockService.list();
  const activeGroup = deps.mockService.getActiveGroup();
  const enabled = all.filter((rule) => rule.enabled);
  if (enabled.length === 0) {
    return buildToolResult({ matched: false, matchedRules: [], activeGroup, totalRulesChecked: all.length, reason: explainNoMatch("enabled") }, "Mock match not found");
  }
  const inGroup = activeGroup ? enabled.filter((rule) => getRuleGroupName(rule.name) === activeGroup) : enabled;
  if (inGroup.length === 0) {
    return buildToolResult({ matched: false, matchedRules: [], activeGroup, totalRulesChecked: enabled.length, reason: explainNoMatch("group") }, "Mock match not found");
  }
  const method = args.method.toUpperCase();
  const methodMatched = inGroup.filter((rule) => rule.method.toUpperCase() === method);
  if (methodMatched.length === 0) {
    return buildToolResult({ matched: false, matchedRules: [], activeGroup, totalRulesChecked: inGroup.length, reason: explainNoMatch("method") }, "Mock match not found");
  }
  const urlMatched = methodMatched.filter((rule) => args.url.includes(rule.url));
  if (urlMatched.length === 0) {
    return buildToolResult({ matched: false, matchedRules: [], activeGroup, totalRulesChecked: methodMatched.length, reason: explainNoMatch("url") }, "Mock match not found");
  }
  const bodyMatched = urlMatched.filter((rule) => {
    const exact = matchesExactBodyExpression(args.body, rule.requestBodyExactMatch);
    const key = rule.requestBodyKeyMatch ? hasBodyKeyPath(args.body, rule.requestBodyKeyMatch) : true;
    return exact && key;
  });
  const matchedRules = bodyMatched.map((rule) => ({ id: rule.id, name: rule.name, method: rule.method, url: rule.url }));
  return buildToolResult(
    {
      matched: matchedRules.length > 0,
      matchedRules,
      activeGroup,
      totalRulesChecked: all.length,
      reason: matchedRules.length > 0 ? "matched" : explainNoMatch("body")
    },
    matchedRules.length > 0 ? "Mock match found" : "Mock match not found"
  );
}

export function handleQueryProxy(args: QueryProxyArgs, deps: ToolServiceDeps) {
  if (args.action === "list") {
    const effectiveAction = args.ruleAction ?? args.actionFilter;
    const rules = deps.proxyService.listRules().filter((rule) => {
      const hostMatch = !args.host || rule.pattern.includes(args.host);
      const enabledMatch = typeof args.enabled !== "boolean" || rule.enabled === args.enabled;
      const actionMatch = !effectiveAction || rule.action === effectiveAction;
      return hostMatch && enabledMatch && actionMatch;
    });
    return buildToolResult(rules.map(buildProxyRuleSummary), `Loaded ${rules.length} proxy rule summaries`);
  }
  if (args.action === "detail") {
    const rule = deps.proxyService.listRules().find((item) => item.id === args.ruleId);
    if (!rule) {
      throw new Error("Proxy rule not found");
    }
    return buildToolResult(rule, `Loaded proxy rule ${rule.pattern}`);
  }
  if (args.action === "mode") {
    const settings = deps.proxyService.getSettings();
    return buildToolResult({ mode: settings.currentProxyMode }, "Loaded proxy mode");
  }
  const resolvedHost = args.host ?? (args.url ? new URL(args.url).host : undefined);
  if (!resolvedHost) {
    throw new Error("Host or url is required");
  }
  const decision = deps.proxyService.getForwardDecision(resolvedHost, "/", "GET");
  return buildToolResult(decision, `Loaded proxy decision for ${resolvedHost}`);
}

export async function handleMutateProxy(args: MutateProxyArgs, deps: ToolServiceDeps) {
  if (args.op === "set_mode") {
    const mode = await deps.proxyService.setMode(args.mode);
    return buildToolResult({ mode }, `Set proxy mode to ${mode}`);
  }
  if (args.op === "upsert") {
    const data = await deps.proxyService.upsertSiteRule({
      host: args.host,
      action: args.action ?? "proxy",
      enabled: args.enabled,
      forwardMode: args.forwardMode,
      targetUrl: args.targetUrl,
      rewriteHost: args.rewriteHost,
      rewritePath: args.rewritePath
    });
    return buildToolResult(buildWriteReceipt(null, data, `Upserted proxy rule ${data.pattern}`), `Upserted proxy rule ${data.pattern}`);
  }
  await deps.proxyService.removeSiteRule(args.host);
  return buildToolResult({ ok: true, host: args.host }, `Removed proxy rule ${args.host}`);
}

export function handleGetWorkspaceSnapshot(deps: ToolServiceDeps) {
  const settings = deps.proxyService.getSettings();
  const recent = deps.requestService.list().slice(0, 5).map(buildRequestSummary);
  const saved = deps.requestService.listSaved();
  const mockRules = deps.mockService.list();
  const proxyRules = deps.proxyService.listRules();
  const byGroup = mockRules.reduce<Record<string, number>>((acc, rule) => {
    const group = getRuleGroupName(rule.name) ?? "ungrouped";
    acc[group] = (acc[group] ?? 0) + 1;
    return acc;
  }, {});
  return buildToolResult(
    {
      service: settings,
      requests: {
        recent,
        savedCount: saved.length
      },
      mock: {
        rules: mockRules.map(buildMockRuleSummary),
        activeGroup: deps.mockService.getActiveGroup(),
        stats: {
          total: mockRules.length,
          enabled: mockRules.filter((rule) => rule.enabled).length,
          byGroup
        }
      },
      proxy: {
        mode: settings.currentProxyMode,
        rules: proxyRules.map(buildProxyRuleSummary)
      },
      templates: Object.keys(mockTemplates)
    },
    "Loaded workspace snapshot"
  );
}

export async function handleSetupHttps(args: SetupHttpsArgs, deps: ToolServiceDeps) {
  if (args.action === "status") {
    return buildToolResult(
      {
        trusted: deps.certificateManager ? await deps.certificateManager.isRootCertificateTrusted() : false,
        available: Boolean(deps.certificateManager)
      },
      "Loaded certificate status"
    );
  }
  if (args.action === "install_guide") {
    return buildToolResult(
      {
        ...getInstallGuideForPlatform(deps.certificateManager?.getRootCertificatePath()),
        certificatePath: deps.certificateManager?.getRootCertificatePath() ?? null
      },
      "Loaded certificate install guide"
    );
  }
  const settings = deps.proxyService.getSettings();
  const checks = {
    certificateTrusted: deps.certificateManager
      ? await deps.certificateManager.isRootCertificateTrusted()
      : settings.certificateInstalled,
    mcpEnabled: settings.mcpEnabled,
    proxyModeReady: settings.currentProxyMode === "rules" || settings.currentProxyMode === "global",
    localProxyPortValid: Number.isInteger(settings.localProxyPort) && settings.localProxyPort > 0
  };
  return buildToolResult(
    {
      ready: Object.values(checks).every(Boolean),
      checks
    },
    "Loaded HTTPS interception readiness"
  );
}

export async function handleLegacyToolInvocation(toolName: string, args: Record<string, unknown>, deps: ToolServiceDeps) {
  switch (toolName) {
    case "list_requests":
      {
        const filters = args as {
          keyword?: string;
          method?: string;
          host?: string;
          statusCode?: number;
          limit?: number;
          offset?: number;
        };
        const { offset = 0, limit, ...rawFilters } = filters;
        const records = deps.requestService.list(rawFilters);
        const sliced = records.slice(offset);
        const paged = typeof limit === "number" ? sliced.slice(0, limit) : sliced;
        return buildToolResult(paged.map(buildRequestSummary), `Loaded ${paged.length} request summaries`);
      }
    case "get_request_detail":
      return handleQueryRequests({ ...args, action: "detail" } as QueryRequestsArgs, deps);
    case "list_saved_requests":
      return handleQueryRequests({ ...args, action: "list_saved" } as QueryRequestsArgs, deps);
    case "get_saved_request_detail":
      return handleQueryRequests({ ...args, action: "saved_detail" } as QueryRequestsArgs, deps);
    case "save_request":
      return handleMutateRequest({ ...args, op: "save" } as MutateRequestArgs, deps);
    case "update_saved_request":
      return handleMutateRequest({ ...args, op: "update" } as MutateRequestArgs, deps);
    case "delete_saved_request":
      return handleMutateRequest({ ...args, op: "delete" } as MutateRequestArgs, deps);
    case "replay_request":
      return handleReplayRequest(args as { id: string }, deps);
    case "run_request":
      return handleRunRequest(args as never, deps);
    case "clear_requests":
      return handleClearRequests(deps);
    case "list_mock_rules":
      return handleQueryMock({ ...args, action: "list" } as QueryMockArgs, deps);
    case "get_mock_rule_detail":
      return handleQueryMock({ ...args, action: "detail" } as QueryMockArgs, deps);
    case "get_active_mock_group":
      return handleQueryMock({ action: "active_group" }, deps);
    case "create_mock_rule":
      return handleMutateMock({ ...args, op: "create" } as MutateMockArgs, deps);
    case "update_mock_rule":
      return handleMutateMock({ ...args, op: "update" } as MutateMockArgs, deps);
    case "delete_mock_rule":
      return handleMutateMock({ ...args, op: "delete" } as MutateMockArgs, deps);
    case "enable_mock_rule":
      return handleMutateMock({ ...args, op: "enable" } as MutateMockArgs, deps);
    case "set_active_mock_group":
      return handleMutateMock({ ...args, op: "set_group" } as MutateMockArgs, deps);
    case "test_mock_match":
      return handleTestMockMatch(args as TestMockMatchArgs, deps);
    case "list_proxy_rules":
      return handleQueryProxy({
        action: "list",
        host: typeof args.host === "string" ? args.host : undefined,
        enabled: typeof args.enabled === "boolean" ? args.enabled : undefined,
        ruleAction: args.action === "proxy" || args.action === "direct" ? args.action : undefined
      }, deps);
    case "get_proxy_rule_detail":
      return handleQueryProxy({ ...args, action: "detail" } as QueryProxyArgs, deps);
    case "get_proxy_mode":
      return handleQueryProxy({ action: "mode" }, deps);
    case "get_proxy_decision":
      {
        const legacyArgs = args as { host?: string; url?: string };
        return handleQueryProxy(
          {
            action: "decision",
            host: legacyArgs.host,
            url: legacyArgs.url
          },
          deps
        );
      }
    case "set_proxy_mode":
      return handleMutateProxy({ ...args, op: "set_mode" } as MutateProxyArgs, deps);
    case "upsert_proxy_rule":
      return handleMutateProxy({ ...args, op: "upsert" } as MutateProxyArgs, deps);
    case "remove_proxy_rule":
      return handleMutateProxy({ ...args, op: "remove" } as MutateProxyArgs, deps);
    case "get_service_health": {
      return buildToolResult(
        {
          online: true,
          activeRequestCount: deps.requestService.list().length,
          settings: deps.proxyService.getSettings()
        },
        "Loaded service health"
      );
    }
    case "get_runtime_settings":
      return buildToolResult(deps.proxyService.getSettings(), "Loaded runtime settings");
    case "get_certificate_status":
      return handleSetupHttps({ action: "status" }, deps);
    case "get_certificate_install_guide":
      return handleSetupHttps({ action: "install_guide" }, deps);
    case "verify_https_interception_ready":
      return handleSetupHttps({ action: "verify" }, deps);
    case "get_workspace_snapshot":
      return handleGetWorkspaceSnapshot(deps);
    case "query_requests":
      return handleQueryRequests(args as QueryRequestsArgs, deps);
    case "mutate_request":
      return handleMutateRequest(args as MutateRequestArgs, deps);
    case "query_mock":
      return handleQueryMock(args as QueryMockArgs, deps);
    case "mutate_mock":
      return handleMutateMock(args as MutateMockArgs, deps);
    case "query_proxy":
      return handleQueryProxy(args as QueryProxyArgs, deps);
    case "mutate_proxy":
      return handleMutateProxy(args as MutateProxyArgs, deps);
    case "setup_https":
      return handleSetupHttps(args as SetupHttpsArgs, deps);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
