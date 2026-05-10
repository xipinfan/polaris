import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  clearRequestsTool,
  getWorkspaceSnapshotTool,
  mockRuleListResource,
  mutateMockTool,
  mutateProxyTool,
  mutateRequestTool,
  proxyModeResource,
  proxyRuleListResource,
  queryMockTool,
  queryProxyTool,
  queryRequestsTool,
  replayRequestTool,
  requestListResource,
  runRequestTool,
  savedRequestListResource,
  setupHttpsTool,
  testMockMatchTool
} from "@polaris/mcp-contracts";
import { buildMockRuleSummary, buildProxyRuleSummary, buildRequestSummary, buildResourceResult, buildSavedRequestSummary, detailViewValues } from "./payloads";
import { toMcpError } from "./errorHandling";
import { CertificateManager } from "../proxy/certificateManager";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import {
  handleClearRequests,
  handleGetWorkspaceSnapshot,
  handleMutateMock,
  handleMutateProxy,
  handleMutateRequest,
  handleQueryMock,
  handleQueryProxy,
  handleQueryRequests,
  handleReplayRequest,
  handleRunRequest,
  handleSetupHttps,
  handleTestMockMatch,
  type MutateMockArgs,
  type MutateProxyArgs,
  type MutateRequestArgs,
  type QueryMockArgs,
  type QueryProxyArgs,
  type QueryRequestsArgs,
  type SetupHttpsArgs,
  type ToolServiceDeps
} from "./toolHandlers";

export interface PolarisMcpSdkServerOptions {
  allowedToolNames?: ReadonlySet<string>;
  allowedResourceNames?: ReadonlySet<string>;
}

const stringMapSchema = z.record(z.string(), z.string());
const wideStringMapValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const wideHeaderMapSchema = z.record(z.string(), wideStringMapValueSchema);
const wideQueryMapSchema = z.record(
  z.string(),
  z.union([wideStringMapValueSchema, z.array(z.union([z.string(), z.number(), z.boolean()]))])
);
const detailFilterFields = {
  view: z.enum(detailViewValues).optional(),
  bodyPreviewChars: z.number().int().positive().max(8000).optional(),
  maxDepth: z.number().int().positive().max(20).optional(),
  maxArrayItems: z.number().int().positive().max(100).optional(),
  jsonPath: z.string().min(1).optional(),
  responsePath: z.string().min(1).optional(),
  includePaths: z.array(z.string().min(1)).optional(),
  excludePaths: z.array(z.string().min(1)).optional(),
  topLevelOnly: z.boolean().optional()
};

const queryRequestsInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    keyword: z.string().optional(),
    method: z.string().optional(),
    host: z.string().optional(),
    statusCode: z.number().int().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),
  z.object({
    action: z.literal("detail"),
    id: z.string().min(1),
    ...detailFilterFields
  }),
  z.object({
    action: z.literal("list_saved"),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),
  z.object({
    action: z.literal("saved_detail"),
    id: z.string().min(1),
    ...detailFilterFields
  })
]);

const mutateRequestInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    name: z.string().min(1),
    requestId: z.string().optional(),
    method: z.string().optional(),
    url: z.string().url().optional(),
    headers: stringMapSchema.optional(),
    query: stringMapSchema.optional(),
    body: z.unknown().nullable().optional(),
    tags: z.array(z.string()).optional()
  }),
  z.object({
    op: z.literal("update"),
    id: z.string().min(1),
    name: z.string().optional(),
    method: z.string().optional(),
    url: z.string().url().optional(),
    headers: wideHeaderMapSchema.optional(),
    query: wideQueryMapSchema.optional(),
    body: z.unknown().nullable().optional(),
    tags: z.array(z.string()).optional()
  }),
  z.object({
    op: z.literal("delete"),
    id: z.string().min(1)
  })
]);

const queryMockInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    name: z.string().optional(),
    group: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    enabled: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),
  z.object({
    action: z.literal("detail"),
    id: z.string().min(1),
    requestId: z.string().optional(),
    ...detailFilterFields
  }),
  z.object({
    action: z.literal("active_group")
  })
]);

const mutateMockInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    name: z.string().min(1),
    requestId: z.string().optional(),
    template: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    group: z.string().optional(),
    responseStatus: z.number().int().optional(),
    responseHeaders: stringMapSchema.optional(),
    responseBody: z.unknown().nullable().optional(),
    requestBodyExactMatch: z.string().nullable().optional(),
    requestBodyKeyMatch: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    patch: z.record(z.string(), z.unknown()).optional()
  }),
  z.object({
    op: z.literal("update"),
    id: z.string().min(1),
    name: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    group: z.string().optional(),
    responseStatus: z.number().int().optional(),
    responseHeaders: stringMapSchema.optional(),
    responseBody: z.unknown().nullable().optional(),
    requestBodyExactMatch: z.string().nullable().optional(),
    requestBodyKeyMatch: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    patch: z.record(z.string(), z.unknown()).optional(),
    operations: z
      .array(
        z.object({
          op: z.enum(["replace", "remove"]),
          path: z.string().min(1),
          value: z.unknown().optional()
        })
      )
      .optional()
  }),
  z.object({
    op: z.literal("delete"),
    id: z.string().min(1)
  }),
  z.object({
    op: z.literal("enable"),
    id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean()
  }),
  z.object({
    op: z.literal("set_group"),
    group: z.string().nullable()
  })
]);

const testMockMatchInputSchema = z.object({
  method: z.string().min(1),
  url: z.string().min(1),
  body: z.unknown().optional()
});

const queryProxyInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    host: z.string().optional(),
    enabled: z.boolean().optional(),
    ruleAction: z.enum(["proxy", "direct"]).optional(),
    actionFilter: z.enum(["proxy", "direct"]).optional()
  }),
  z.object({
    action: z.literal("detail"),
    ruleId: z.string().min(1)
  }),
  z.object({
    action: z.literal("mode")
  }),
  z.object({
    action: z.literal("decision"),
    host: z.string().min(1)
  })
]);

const mutateProxyInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_mode"),
    mode: z.enum(["direct", "global", "rules", "system"])
  }),
  z.object({
    op: z.literal("upsert"),
    host: z.string().min(1),
    action: z.enum(["proxy", "direct"]).optional(),
    enabled: z.boolean().optional(),
    forwardMode: z.enum(["direct", "rewriteTarget", "rewriteHost", "rewritePath"]).optional(),
    targetUrl: z.string().optional(),
    rewriteHost: z.string().optional(),
    rewritePath: z.string().optional()
  }),
  z.object({
    op: z.literal("remove"),
    host: z.string().min(1)
  })
]);

const setupHttpsInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("install_guide") }),
  z.object({ action: z.literal("verify") })
]);

export function createPolarisMcpSdkServer(
  requestService: RequestService,
  mockService: MockService,
  proxyService: ProxyService,
  certificateManager?: CertificateManager,
  options: PolarisMcpSdkServerOptions = {}
): McpServer {
  const server = new McpServer(
    {
      name: "polaris",
      version: "0.2.0"
    },
    {
      instructions: `Polaris 是本地接口调试工作台，提供请求抓包、Mock 规则、代理转发三大能力。

核心工作流：
1. 先 query 再 detail：先用列表动作定位目标，再看详情。
2. 写后不读：执行 mutate 后优先使用写回执，不要立刻 full 读回。
3. 大响应用 jsonPath：响应体大时先过滤再读取。
4. mock 排障用 diagnostic：排查规则不生效时用 diagnostic 并传 requestId。

常见任务 -> 工具链：
- mock 没生效：test_mock_match -> query_mock(list) -> query_mock(detail:diagnostic)
- 帮我 mock 接口：query_requests(detail) -> mutate_mock(create) -> test_mock_match
- HTTPS 抓不到包：setup_https(verify/status/install_guide)
- 请求被转发到哪了：query_proxy(decision) -> query_proxy(detail/list)

反模式：
- 不要直接使用 view="full" 读取大 body。
- 不要写操作后再读完整对象确认。`
    }
  );

  const deps: ToolServiceDeps = { requestService, mockService, proxyService, certificateManager };
  const safe = async <T>(operation: () => Promise<T> | T): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      throw toMcpError(error);
    }
  };

  const allowsTool = (name: string) => !options.allowedToolNames || options.allowedToolNames.has(name);
  const allowsResource = (name: string) => !options.allowedResourceNames || options.allowedResourceNames.has(name);

  const registerTool = server.registerTool.bind(server);
  (server as unknown as { registerTool: typeof registerTool }).registerTool = ((name, config, handler) => {
    if (!allowsTool(name)) {
      return server;
    }
    return registerTool(name, config, handler);
  }) as typeof registerTool;

  server.registerTool(
    queryRequestsTool.name,
    { description: queryRequestsTool.description, inputSchema: queryRequestsInputSchema, annotations: { readOnlyHint: true } },
    async (args) => safe(() => handleQueryRequests(args as QueryRequestsArgs, deps))
  );
  server.registerTool(
    mutateRequestTool.name,
    { description: mutateRequestTool.description, inputSchema: mutateRequestInputSchema },
    async (args) => safe(() => handleMutateRequest(args as MutateRequestArgs, deps))
  );
  server.registerTool(
    replayRequestTool.name,
    { description: replayRequestTool.description, inputSchema: z.object({ id: z.string().min(1) }) },
    async (args) => safe(() => handleReplayRequest(args, deps))
  );
  server.registerTool(
    runRequestTool.name,
    {
      description: runRequestTool.description,
      inputSchema: z.object({
        name: z.string().optional(),
        method: z.string().min(1),
        url: z.string().url(),
        headers: stringMapSchema.optional(),
        query: stringMapSchema.optional(),
        body: z.unknown().nullable().optional()
      })
    },
    async (args) => safe(() => handleRunRequest(args, deps))
  );
  server.registerTool(
    clearRequestsTool.name,
    { description: clearRequestsTool.description, annotations: { destructiveHint: true } },
    async () => safe(() => handleClearRequests(deps))
  );
  server.registerTool(
    queryMockTool.name,
    { description: queryMockTool.description, inputSchema: queryMockInputSchema, annotations: { readOnlyHint: true } },
    async (args) => safe(() => handleQueryMock(args as QueryMockArgs, deps))
  );
  server.registerTool(
    mutateMockTool.name,
    { description: mutateMockTool.description, inputSchema: mutateMockInputSchema },
    async (args) => safe(() => handleMutateMock(args as MutateMockArgs, deps))
  );
  server.registerTool(
    testMockMatchTool.name,
    { description: testMockMatchTool.description, inputSchema: testMockMatchInputSchema, annotations: { readOnlyHint: true } },
    async (args) => safe(() => handleTestMockMatch(args, deps))
  );
  server.registerTool(
    queryProxyTool.name,
    { description: queryProxyTool.description, inputSchema: queryProxyInputSchema, annotations: { readOnlyHint: true } },
    async (args) => safe(() => handleQueryProxy(args as QueryProxyArgs, deps))
  );
  server.registerTool(
    mutateProxyTool.name,
    { description: mutateProxyTool.description, inputSchema: mutateProxyInputSchema },
    async (args) => safe(() => handleMutateProxy(args as MutateProxyArgs, deps))
  );
  server.registerTool(
    getWorkspaceSnapshotTool.name,
    { description: getWorkspaceSnapshotTool.description, annotations: { readOnlyHint: true } },
    async () => safe(() => handleGetWorkspaceSnapshot(deps))
  );
  server.registerTool(
    setupHttpsTool.name,
    { description: setupHttpsTool.description, inputSchema: setupHttpsInputSchema },
    async (args) => safe(() => handleSetupHttps(args as SetupHttpsArgs, deps))
  );

  const promptServer = server as unknown as {
    registerPrompt?: (
      name: string,
      config: { title: string; description: string; argsSchema?: z.ZodTypeAny },
      handler: (args: Record<string, unknown>) => { messages: Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> }
    ) => void
  };

  promptServer.registerPrompt?.(
    "debug_mock",
    {
      title: "排查 Mock 不生效",
      description: "引导排查为什么某个请求没有被 Mock 规则命中",
      argsSchema: z.object({ url: z.string(), requestId: z.string().optional() })
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请排查 Mock 未命中问题：\n1) 先调用 test_mock_match(method,url,body) 检查匹配链路。\n2) 调用 query_mock(action=\"list\") 查看规则范围。\n3) 调用 query_mock(action=\"detail\", view=\"diagnostic\") 深入分析。url=${String(args.url ?? "")} requestId=${String(args.requestId ?? "")}\n4) 检查 active_group 并给出修复建议。`
          }
        }
      ]
    })
  );

  promptServer.registerPrompt?.(
    "mock_from_request",
    {
      title: "从请求创建 Mock",
      description: "引导从已捕获的请求快速创建 Mock 规则",
      argsSchema: z.object({ requestId: z.string(), group: z.string().optional() })
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请按步骤创建 Mock：\n1) query_requests(action=\"detail\", id=requestId)确认请求。\n2) mutate_mock(op=\"create\") 从该请求创建规则，名称前缀使用 [${String(args.group ?? "default")}] 。\n3) 使用 test_mock_match 验证是否命中。requestId=${String(args.requestId)}`
          }
        }
      ]
    })
  );

  promptServer.registerPrompt?.(
    "check_proxy_routing",
    {
      title: "检查代理路由",
      description: "引导检查某个域名的代理路由决策",
      argsSchema: z.object({ host: z.string() })
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `请检查该域名路由：先 query_proxy(action=\"decision\", host)，再解释命中规则和原因，并给出 mutate_proxy 的调整建议。host=${String(args.host)}`
          }
        }
      ]
    })
  );

  promptServer.registerPrompt?.(
    "setup_https",
    {
      title: "配置 HTTPS 抓包",
      description: "引导配置 HTTPS 抓包的完整流程"
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "请执行 setup_https(action=\"verify\")，逐项检查 certificateTrusted/proxyModeReady/mcpEnabled，给出修复建议并再次 verify 确认。"
          }
        }
      ]
    })
  );

  if (allowsResource(requestListResource.name)) {
    server.registerResource(
      requestListResource.name,
      requestListResource.uri,
      { title: "Recent requests", description: "Recent captured requests.", mimeType: "application/json" },
      async () => buildResourceResult(requestListResource.uri, requestService.list({ limit: 50 }).map(buildRequestSummary))
    );
  }
  if (allowsResource(savedRequestListResource.name)) {
    server.registerResource(
      savedRequestListResource.name,
      savedRequestListResource.uri,
      { title: "Saved requests", description: "Saved request assets.", mimeType: "application/json" },
      async () => buildResourceResult(savedRequestListResource.uri, requestService.listSaved().slice(0, 50).map(buildSavedRequestSummary))
    );
  }
  if (allowsResource(mockRuleListResource.name)) {
    server.registerResource(
      mockRuleListResource.name,
      mockRuleListResource.uri,
      { title: "Mock rules", description: "Configured mock rules.", mimeType: "application/json" },
      async () => buildResourceResult(mockRuleListResource.uri, mockService.list().slice(0, 50).map(buildMockRuleSummary))
    );
  }
  if (allowsResource(proxyModeResource.name)) {
    server.registerResource(
      proxyModeResource.name,
      proxyModeResource.uri,
      { title: "Proxy mode", description: "Current proxy mode.", mimeType: "application/json" },
      async () => buildResourceResult(proxyModeResource.uri, proxyService.getMode())
    );
  }
  if (allowsResource(proxyRuleListResource.name)) {
    server.registerResource(
      proxyRuleListResource.name,
      proxyRuleListResource.uri,
      { title: "Proxy rules", description: "Host based proxy rules.", mimeType: "application/json" },
      async () => buildResourceResult(proxyRuleListResource.uri, proxyService.listRules().slice(0, 50).map(buildProxyRuleSummary))
    );
  }

  return server;
}
