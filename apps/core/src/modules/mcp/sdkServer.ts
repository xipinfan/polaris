import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type {
  RequestFilters,
  RunRequestInput,
  SaveRequestInput,
  SetActiveMockGroupInput,
  UpdateMockRuleInput
} from "@polaris/shared-contracts";
import {
  clearRequestsTool,
  createMockRuleTool,
  deleteMockRuleTool,
  deleteSavedRequestTool,
  enableMockRuleTool,
  getActiveMockGroupTool,
  getCertificateInstallGuideTool,
  getCertificateStatusTool,
  getMockRuleDetailTool,
  getProxyRuleDetailTool,
  getProxyDecisionTool,
  getProxyModeTool,
  getRequestDetailTool,
  getRuntimeSettingsTool,
  getSavedRequestDetailTool,
  getServiceHealthTool,
  listMockRulesTool,
  listProxyRulesTool,
  listRequestsTool,
  listSavedRequestsTool,
  removeProxyRuleTool,
  replayRequestTool,
  requestListResource,
  runRequestTool,
  saveRequestTool,
  setProxyModeTool,
  savedRequestListResource,
  mockRuleListResource,
  proxyModeResource,
  proxyRuleListResource,
  setActiveMockGroupTool,
  upsertProxyRuleTool,
  verifyHttpsInterceptionReadyTool,
  updateMockRuleTool,
  updateSavedRequestTool
} from "@polaris/mcp-contracts";
import { CertificateManager } from "../proxy/certificateManager";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { toMcpError } from "./errorHandling";

export interface PolarisMcpSdkServerOptions {
  allowedToolNames?: ReadonlySet<string>;
  allowedResourceNames?: ReadonlySet<string>;
}

const stringMapSchema = z.record(z.string(), z.string());

const listRequestsInputSchema = z.object({
  keyword: z.string().optional(),
  method: z.string().optional(),
  host: z.string().optional(),
  statusCode: z.number().int().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const saveRequestInputSchema = z.object({
  name: z.string().min(1),
  requestId: z.string().optional(),
  method: z.string().optional(),
  url: z.string().url().optional(),
  headers: stringMapSchema.optional(),
  query: stringMapSchema.optional(),
  body: z.unknown().nullable().optional(),
  tags: z.array(z.string()).optional()
});

const runRequestInputSchema = z.object({
  name: z.string().optional(),
  method: z.string().min(1),
  url: z.string().url(),
  headers: stringMapSchema.optional(),
  query: stringMapSchema.optional(),
  body: z.unknown().nullable().optional()
});

const createMockRuleInputSchema = z.object({
  name: z.string().min(1),
  group: z.string().min(1).optional(),
  method: z.string().min(1),
  url: z.string().url(),
  requestBodyExactMatch: z.string().min(1).nullable().optional(),
  requestBodyKeyMatch: z.string().min(1).nullable().optional(),
  responseStatus: z.number().int(),
  responseHeaders: stringMapSchema.optional(),
  responseBody: z.unknown().nullable().optional(),
  enabled: z.boolean()
});

const updateSavedRequestInputSchema = saveRequestInputSchema.extend({
  id: z.string().min(1)
});

const listMockRulesInputSchema = z.object({
  name: z.string().optional(),
  group: z.string().optional(),
  method: z.string().optional(),
  url: z.string().optional(),
  enabled: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const listSavedRequestsInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const mockRuleIdInputSchema = z.object({
  id: z.string().min(1)
});

const proxyRuleIdInputSchema = z.object({
  ruleId: z.string().min(1)
});

const updateMockRuleToolInputSchema = createMockRuleInputSchema.extend({
  id: z.string().min(1)
});

const setActiveMockGroupInputSchema = z.object({
  group: z.string().min(1).nullable()
});

const proxyModeInputSchema = z.object({
  mode: z.enum(["direct", "global", "rules", "system"])
});

const upsertProxyRuleInputSchema = z.object({
  host: z.string().min(1),
  action: z.enum(["proxy", "direct"])
});

const removeProxyRuleInputSchema = z.object({
  host: z.string().min(1)
});

const listProxyRulesInputSchema = z.object({
  host: z.string().optional(),
  enabled: z.boolean().optional(),
  action: z.enum(["proxy", "direct"]).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const proxyDecisionInputSchema = z
  .object({
    host: z.string().min(1).optional(),
    url: z.string().url().optional()
  })
  .refine((value) => Boolean(value.host || value.url), {
    message: "Either host or url is required"
  });

function asJsonText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function jsonToolResult(data: unknown) {
  return {
    structuredContent: {
      result: data
    },
    content: [
      {
        type: "text" as const,
        text: asJsonText(data)
      }
    ]
  };
}

function jsonResourceResult(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: asJsonText(data)
      }
    ],
    _meta: {
      "polaris/resultCount": Array.isArray(data) ? data.length : 1
    }
  };
}

function getRuleGroupName(name: string): string | null {
  const match = name.match(/^\[(.+?)\]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

function buildMockRuleSummary(rule: ReturnType<MockService["list"]>[number]) {
  return {
    id: rule.id,
    title: rule.name,
    name: rule.name,
    group: getRuleGroupName(rule.name),
    method: rule.method,
    url: rule.url,
    enabled: rule.enabled,
    updatedAt: rule.updatedAt,
    detail: {
      tool: getMockRuleDetailTool.name,
      id: rule.id,
      omittedFields: ["requestBodyExactMatch", "requestBodyKeyMatch", "responseHeaders", "responseBody"]
    }
  };
}

function buildProxyRuleSummary(rule: ReturnType<ProxyService["listRules"]>[number]) {
  return {
    ruleId: rule.id,
    title: `${rule.action.toUpperCase()} ${rule.pattern}`,
    pattern: rule.pattern,
    action: rule.action,
    enabled: rule.enabled,
    updatedAt: rule.updatedAt,
    detail: {
      tool: getProxyRuleDetailTool.name,
      ruleId: rule.id,
      omittedFields: ["matchType", "createdAt"]
    }
  };
}

function buildRequestSummary(record: ReturnType<RequestService["list"]>[number]) {
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
      tool: getRequestDetailTool.name,
      id: record.id,
      omittedFields: ["requestHeaders", "requestQuery", "requestBody", "responseHeaders", "responseBody", "resolution"]
    }
  };
}

function buildSavedRequestSummary(savedRequest: ReturnType<RequestService["listSaved"]>[number]) {
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
      tool: getSavedRequestDetailTool.name,
      id: savedRequest.id,
      omittedFields: ["headers", "query", "body"]
    }
  };
}

function getInstallGuideForPlatform(certificatePath?: string) {
  if (process.platform === "win32") {
    return {
      platform: "win32",
      steps: [
        `Download or locate the Polaris root certificate${certificatePath ? ` (${certificatePath})` : ""}.`,
        "In Edge, open edge://certificate-manager/ (or Settings -> Privacy, search, and services -> Security -> Manage certificates).",
        "In Chrome, open chrome://settings/certificates and click Manage certificates.",
        "Import the certificate into Current User -> Trusted Root Certification Authorities.",
        "Confirm the subject Polaris Development Root CA exists in Trusted Root Certification Authorities.",
        "Optional PowerShell check: Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Subject -like '*Polaris Development Root CA*' }",
        "Restart Edge/Chrome and verify certificate trust status again from Polaris."
      ]
    };
  }

  if (process.platform === "darwin") {
    return {
      platform: "darwin",
      steps: [
        `Open Keychain Access and import the certificate${certificatePath ? ` at ${certificatePath}` : ""}.`,
        "Add it to the System keychain.",
        "Set trust to Always Trust for SSL."
      ]
    };
  }

  return {
    platform: process.platform,
    steps: [
      `Import the certificate${certificatePath ? ` from ${certificatePath}` : ""} into your OS/browser trust store.`,
      "Trust the certificate authority for HTTPS interception.",
      "Restart browsers/apps that should use the local proxy."
    ]
  };
}

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
      version: "0.1.0"
    },
    {
      instructions:
        "Use Polaris to inspect captured requests, read saved assets, replay requests, and manage mock or proxy state for local debugging."
    }
  );

  const safe = async <T>(operation: () => Promise<T> | T): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      throw toMcpError(error);
    }
  };

  const allowsTool = (name: string) => !options.allowedToolNames || options.allowedToolNames.has(name);
  const allowsResource = (name: string) =>
    !options.allowedResourceNames || options.allowedResourceNames.has(name);

  const registerTool = server.registerTool.bind(server);

  (server as unknown as { registerTool: typeof registerTool }).registerTool = ((name, config, handler) => {
    if (!allowsTool(name)) {
      return server;
    }
    return registerTool(name, config, handler);
  }) as typeof registerTool;

  server.registerTool(
    listRequestsTool.name,
    {
      description: listRequestsTool.description,
      inputSchema: listRequestsInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => {
      return safe(() => {
        const { offset, limit, ...rawFilters } = args;
        const records = requestService.list(rawFilters as RequestFilters);
        const start = offset ?? 0;
        const sliced = records.slice(start);
        const paged = typeof limit === "number" ? sliced.slice(0, limit) : sliced;
        return jsonToolResult(paged.map(buildRequestSummary));
      });
    }
  );

  server.registerTool(
    getRequestDetailTool.name,
    {
      description: getRequestDetailTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id }) => {
      return safe(() => {
        const record = requestService.getById(id);
        if (!record) {
          throw new Error("Request not found");
        }
        return jsonToolResult(record);
      });
    }
  );

  server.registerTool(
    listSavedRequestsTool.name,
    {
      description: listSavedRequestsTool.description,
      inputSchema: listSavedRequestsInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) =>
      safe(() => {
        const saved = requestService.listSaved();
        const start = args.offset ?? 0;
        const sliced = saved.slice(start);
        const paged = typeof args.limit === "number" ? sliced.slice(0, args.limit) : sliced;
        return jsonToolResult(paged.map(buildSavedRequestSummary));
      })
  );

  server.registerTool(
    getSavedRequestDetailTool.name,
    {
      description: getSavedRequestDetailTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id }) => {
      return safe(() => {
        const savedRequest = requestService.getSavedById(id);
        if (!savedRequest) {
          throw new Error("Saved request not found");
        }
        return jsonToolResult(savedRequest);
      });
    }
  );

  server.registerTool(
    saveRequestTool.name,
    {
      description: saveRequestTool.description,
      inputSchema: saveRequestInputSchema
    },
    async (args) => safe(() => requestService.save(args as SaveRequestInput).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    updateSavedRequestTool.name,
    {
      description: updateSavedRequestTool.description,
      inputSchema: updateSavedRequestInputSchema
    },
    async ({ id, ...input }) =>
      safe(() => requestService.updateSaved(id, input as SaveRequestInput).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    deleteSavedRequestTool.name,
    {
      description: deleteSavedRequestTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      })
    },
    async ({ id }) => {
      return safe(async () => {
        await requestService.removeSaved(id);
        return jsonToolResult({ id });
      });
    }
  );

  server.registerTool(
    replayRequestTool.name,
    {
      description: replayRequestTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      })
    },
    async ({ id }) => safe(() => requestService.replayRequest(id).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    clearRequestsTool.name,
    {
      description: clearRequestsTool.description
    },
    async () => {
      return safe(async () => {
        await requestService.clear();
        return jsonToolResult({ cleared: true });
      });
    }
  );

  server.registerTool(
    listMockRulesTool.name,
    {
      description: listMockRulesTool.description,
      inputSchema: listMockRulesInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) => {
      return safe(() => {
        const rules = mockService.list().filter((rule) => {
          const nameMatch = !args.name || rule.name.includes(args.name);
          const groupMatch = !args.group || getRuleGroupName(rule.name) === args.group;
          const methodMatch = !args.method || rule.method === args.method.toUpperCase();
          const urlMatch = !args.url || rule.url.includes(args.url);
          const enabledMatch = typeof args.enabled !== "boolean" || rule.enabled === args.enabled;
          return nameMatch && groupMatch && methodMatch && urlMatch && enabledMatch;
        });
        const start = args.offset ?? 0;
        const sliced = rules.slice(start);
        const paged = typeof args.limit === "number" ? sliced.slice(0, args.limit) : sliced;
        return jsonToolResult(paged.map(buildMockRuleSummary));
      });
    }
  );

  server.registerTool(
    getMockRuleDetailTool.name,
    {
      description: getMockRuleDetailTool.description,
      inputSchema: mockRuleIdInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id }) => {
      return safe(() => {
        const rule = mockService.list().find((item) => item.id === id);
        if (!rule) {
          throw new Error("Mock rule not found");
        }
        return jsonToolResult(rule);
      });
    }
  );

  server.registerTool(
    createMockRuleTool.name,
    {
      description: createMockRuleTool.description,
      inputSchema: createMockRuleInputSchema
    },
    async (args) => safe(() => mockService.create(args).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    updateMockRuleTool.name,
    {
      description: updateMockRuleTool.description,
      inputSchema: updateMockRuleToolInputSchema
    },
    async ({ id, ...input }) =>
      safe(() => mockService.update(id, input as UpdateMockRuleInput).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    deleteMockRuleTool.name,
    {
      description: deleteMockRuleTool.description,
      inputSchema: mockRuleIdInputSchema
    },
    async ({ id }) => {
      return safe(async () => {
        await mockService.remove(id);
        return jsonToolResult({ id });
      });
    }
  );

  server.registerTool(
    enableMockRuleTool.name,
    {
      description: enableMockRuleTool.description,
      inputSchema: z
        .object({
          id: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
          enabled: z.boolean()
        })
        .refine((value) => Boolean(value.id || value.name), {
          message: "Either id or name is required"
        })
    },
    async ({ id, name, enabled }) =>
      safe(async () => {
        if (id) {
          return jsonToolResult(await mockService.toggle(id, enabled));
        }

        const matched = mockService.list().filter((rule) => rule.name === name);
        if (matched.length === 0) {
          throw new Error("Mock rule not found");
        }
        if (matched.length > 1) {
          throw new Error("Multiple mock rules matched this name, please use id");
        }
        return jsonToolResult(await mockService.toggle(matched[0].id, enabled));
      })
  );

  server.registerTool(
    getActiveMockGroupTool.name,
    {
      description: getActiveMockGroupTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => safe(() => jsonToolResult({ group: mockService.getActiveGroup() }))
  );

  server.registerTool(
    setActiveMockGroupTool.name,
    {
      description: setActiveMockGroupTool.description,
      inputSchema: setActiveMockGroupInputSchema
    },
    async ({ group }) =>
      safe(async () =>
        jsonToolResult({
          group: await mockService.setActiveGroup(group as SetActiveMockGroupInput["group"])
        })
      )
  );

  server.registerTool(
    runRequestTool.name,
    {
      description: runRequestTool.description,
      inputSchema: runRequestInputSchema
    },
    async (args) => safe(() => requestService.run(args as RunRequestInput).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    listProxyRulesTool.name,
    {
      description: listProxyRulesTool.description,
      inputSchema: listProxyRulesInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async (args) =>
      safe(() => {
        const filtered = proxyService.listRules().filter((rule) => {
          const hostMatch = !args.host || rule.pattern.includes(args.host);
          const enabledMatch = typeof args.enabled !== "boolean" || rule.enabled === args.enabled;
          const actionMatch = !args.action || rule.action === args.action;
          return hostMatch && enabledMatch && actionMatch;
        });
        const start = args.offset ?? 0;
        const sliced = filtered.slice(start);
        const paged = typeof args.limit === "number" ? sliced.slice(0, args.limit) : sliced;
        return jsonToolResult(paged.map(buildProxyRuleSummary));
      })
  );

  server.registerTool(
    getProxyRuleDetailTool.name,
    {
      description: getProxyRuleDetailTool.description,
      inputSchema: proxyRuleIdInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ ruleId }) =>
      safe(() => {
        const rule = proxyService.listRules().find((item) => item.id === ruleId);
        if (!rule) {
          throw new Error("Proxy rule not found");
        }
        return jsonToolResult(rule);
      })
  );

  server.registerTool(
    getProxyModeTool.name,
    {
      description: getProxyModeTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => safe(() => jsonToolResult({ mode: proxyService.getMode() }))
  );

  server.registerTool(
    setProxyModeTool.name,
    {
      description: setProxyModeTool.description,
      inputSchema: proxyModeInputSchema
    },
    async ({ mode }) => safe(async () => jsonToolResult({ mode: await proxyService.setMode(mode) }))
  );

  server.registerTool(
    upsertProxyRuleTool.name,
    {
      description: upsertProxyRuleTool.description,
      inputSchema: upsertProxyRuleInputSchema
    },
    async ({ host, action }) =>
      safe(() => proxyService.upsertSiteRule(host, action).then((data) => jsonToolResult(data)))
  );

  server.registerTool(
    removeProxyRuleTool.name,
    {
      description: removeProxyRuleTool.description,
      inputSchema: removeProxyRuleInputSchema
    },
    async ({ host }) => {
      return safe(async () => {
        await proxyService.removeSiteRule(host);
        return jsonToolResult({ host });
      });
    }
  );

  server.registerTool(
    getProxyDecisionTool.name,
    {
      description: getProxyDecisionTool.description,
      inputSchema: proxyDecisionInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ host, url }) =>
      safe(() => {
        const resolvedHost = host ?? new URL(url!).host;
        const forwardDecision = proxyService.getForwardDecision(resolvedHost);
        return jsonToolResult({
          host: resolvedHost,
          mode: proxyService.getMode(),
          decision: forwardDecision.mode === "proxy_forward" ? "proxy" : "direct",
          routeMode: forwardDecision.mode,
          source: forwardDecision.source,
          matchedRuleId: forwardDecision.matchedRuleId ?? null,
          matchedRuleName: forwardDecision.matchedRuleName ?? null,
          reason: forwardDecision.reason
        });
      })
  );

  server.registerTool(
    getServiceHealthTool.name,
    {
      description: getServiceHealthTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () =>
      safe(() =>
        jsonToolResult({
          online: true,
          activeRequestCount: requestService.list({ limit: 200 }).length,
          settings: proxyService.getSettings()
        })
      )
  );

  server.registerTool(
    getRuntimeSettingsTool.name,
    {
      description: getRuntimeSettingsTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => safe(() => jsonToolResult(proxyService.getSettings()))
  );

  server.registerTool(
    getCertificateStatusTool.name,
    {
      description: getCertificateStatusTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () =>
      safe(async () => {
        const trusted = certificateManager ? await certificateManager.isRootCertificateTrusted() : undefined;
        return jsonToolResult({
          trusted,
          available: Boolean(certificateManager)
        });
      })
  );

  server.registerTool(
    getCertificateInstallGuideTool.name,
    {
      description: getCertificateInstallGuideTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () =>
      safe(() => {
        const certificatePath = certificateManager?.getRootCertificatePath();
        return jsonToolResult({
          ...getInstallGuideForPlatform(certificatePath),
          certificatePath: certificatePath ?? null
        });
      })
  );

  server.registerTool(
    verifyHttpsInterceptionReadyTool.name,
    {
      description: verifyHttpsInterceptionReadyTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () =>
      safe(async () => {
        const settings = proxyService.getSettings();
        const certificateTrusted = certificateManager
          ? await certificateManager.isRootCertificateTrusted()
          : settings.certificateInstalled;
        const proxyModeReady = settings.currentProxyMode === "rules" || settings.currentProxyMode === "global";
        const checks = {
          certificateTrusted,
          mcpEnabled: settings.mcpEnabled,
          proxyModeReady,
          localProxyPortValid: Number.isInteger(settings.localProxyPort) && settings.localProxyPort > 0
        };
        return jsonToolResult({
          ready: Object.values(checks).every(Boolean),
          checks
        });
      })
  );

  if (allowsResource(requestListResource.name)) {
    server.registerResource(
      requestListResource.name,
      requestListResource.uri,
      {
        title: "Recent requests",
        description: "The 20 most recent captured requests.",
        mimeType: "application/json"
      },
      async () => jsonResourceResult(requestListResource.uri, requestService.list({ limit: 20 }))
    );
  }

  if (allowsResource(savedRequestListResource.name)) {
    server.registerResource(
      savedRequestListResource.name,
      savedRequestListResource.uri,
      {
        title: "Saved requests",
        description: "Saved request assets that can be replayed later.",
        mimeType: "application/json"
      },
      async () => jsonResourceResult(savedRequestListResource.uri, requestService.listSaved())
    );
  }

  if (allowsResource(mockRuleListResource.name)) {
    server.registerResource(
      mockRuleListResource.name,
      mockRuleListResource.uri,
      {
        title: "Mock rules",
        description: "All configured mock rules.",
        mimeType: "application/json"
      },
      async () => jsonResourceResult(mockRuleListResource.uri, mockService.list())
    );
  }

  if (allowsResource(proxyModeResource.name)) {
    server.registerResource(
      proxyModeResource.name,
      proxyModeResource.uri,
      {
        title: "Proxy mode",
        description: "The current Polaris proxy mode.",
        mimeType: "application/json"
      },
      async () => jsonResourceResult(proxyModeResource.uri, proxyService.getMode())
    );
  }

  if (allowsResource(proxyRuleListResource.name)) {
    server.registerResource(
      proxyRuleListResource.name,
      proxyRuleListResource.uri,
      {
        title: "Proxy rules",
        description: "Current host-based proxy rules.",
        mimeType: "application/json"
      },
      async () => jsonResourceResult(proxyRuleListResource.uri, proxyService.listRules())
    );
  }

  return server;
}
