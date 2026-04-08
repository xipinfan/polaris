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
import { buildCreateMockRuleInput, buildUpdateMockRuleInput } from "./mockRuleMutations";
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

const baseCreateMockRuleInputSchema = z.object({
  name: z.string().min(1).describe("Rule name. Use '[Group] Name' format for grouping."),
  group: z.string().min(1).optional(),
  method: z.string().min(1).describe("HTTP method, e.g. GET, POST."),
  url: z.string().min(1).describe("URL substring to match against. Plain string matching, not URL validation."),
  requestBodyExactMatch: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("DSL: 'dot.path: \"stringValue\"', combine with ';'. Only string values."),
  requestBodyKeyMatch: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Dot-path to check key existence, e.g. 'user.premium'."),
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

const detailInputSchema = z.object({
  id: z.string().min(1),
  view: z.enum(detailViewValues).optional(),
  requestId: z.string().min(1).optional(),
  scenario: z.string().min(1).optional(),
  bodyPreviewChars: z.number().int().positive().max(8000).optional()
});

const mockRuleIdInputSchema = z.object({
  id: z.string().min(1)
});

const proxyRuleIdInputSchema = z.object({
  ruleId: z.string().min(1)
});

const updateMockRuleToolInputSchema = z.union([
  baseCreateMockRuleInputSchema.extend({
    id: z.string().min(1)
  }),
  z.object({
    id: z.string().min(1),
    patch: mockRulePatchSchema
  }),
  z.object({
    id: z.string().min(1),
    operations: z.array(mockRuleOperationSchema).min(1)
  })
]);

const setActiveMockGroupInputSchema = z.object({
  group: z.string().min(1).nullable()
});

const proxyModeInputSchema = z.object({
  mode: z.enum(["direct", "global", "rules", "system"])
});

const upsertProxyRuleInputSchema = z.object({
  host: z.string().min(1),
  action: z.enum(["proxy", "direct"]),
  forwardMode: z.enum(["direct", "rewriteTarget", "rewriteHost", "rewritePath"]).optional(),
  targetUrl: z.string().url().optional(),
  rewriteHost: z.string().min(1).optional(),
  rewritePath: z.string().min(1).optional()
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

function getRuleGroupName(name: string): string | null {
  const match = name.match(/^\[(.+?)\]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

async function syncActiveMockGroupFromRuleName(mockService: MockService, ruleName: string): Promise<void> {
  const nextGroup = getRuleGroupName(ruleName);
  if (!nextGroup || nextGroup === mockService.getActiveGroup()) {
    return;
  }
  await mockService.setActiveGroup(nextGroup);
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
        return buildToolResult(paged.map(buildRequestSummary), `Loaded ${paged.length} request summaries`);
      });
    }
  );

  server.registerTool(
    getRequestDetailTool.name,
    {
      description: getRequestDetailTool.description,
      inputSchema: detailInputSchema.omit({ requestId: true, scenario: true }),
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, view, bodyPreviewChars }) => {
      return safe(() => {
        const record = requestService.getById(id);
        if (!record) {
          throw new Error("Request not found");
        }
        return buildToolResult(
          buildRequestDetailPayload(record, { view, bodyPreviewChars }),
          `Loaded request ${record.method} ${record.path} (${view ?? "summary"})`
        );
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
        return buildToolResult(paged.map(buildSavedRequestSummary), `Loaded ${paged.length} saved request summaries`);
      })
  );

  server.registerTool(
    getSavedRequestDetailTool.name,
    {
      description: getSavedRequestDetailTool.description,
      inputSchema: detailInputSchema.omit({ requestId: true, scenario: true }),
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, view, bodyPreviewChars }) => {
      return safe(() => {
        const savedRequest = requestService.getSavedById(id);
        if (!savedRequest) {
          throw new Error("Saved request not found");
        }
        return buildToolResult(
          buildSavedRequestDetailPayload(savedRequest, { view, bodyPreviewChars }),
          `Loaded saved request ${savedRequest.name} (${view ?? "summary"})`
        );
      });
    }
  );

  server.registerTool(
    saveRequestTool.name,
    {
      description: saveRequestTool.description,
      inputSchema: saveRequestInputSchema
    },
    async (args) =>
      safe(async () => {
        const data = await requestService.save(args as SaveRequestInput);
        return buildToolResult(buildWriteReceipt(null, data, `Saved request ${data.name}`), `Saved request ${data.name}`);
      })
  );

  server.registerTool(
    updateSavedRequestTool.name,
    {
      description: updateSavedRequestTool.description,
      inputSchema: updateSavedRequestInputSchema
    },
    async ({ id, ...input }) =>
      safe(async () => {
        const before = requestService.getSavedById(id);
        if (!before) {
          throw new Error("Saved request not found");
        }
        const data = await requestService.updateSaved(id, input as SaveRequestInput);
        return buildToolResult(
          buildWriteReceipt(before, data, `Updated saved request ${data.name}`),
          `Updated saved request ${data.name}`
        );
      })
  );

  server.registerTool(
    deleteSavedRequestTool.name,
    {
      description: deleteSavedRequestTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      }),
      annotations: {
        destructiveHint: true
      }
    },
    async ({ id }) => {
      return safe(async () => {
        await requestService.removeSaved(id);
        return buildToolResult({ id }, `Deleted saved request ${id}`);
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
    async ({ id }) =>
      safe(async () => {
        const data = await requestService.replayRequest(id);
        return buildToolResult(
          buildWriteReceipt(null, data, `Replayed request ${data.method} ${data.path}`),
          `Replayed request ${data.method} ${data.path}`
        );
      })
  );

  server.registerTool(
    clearRequestsTool.name,
    {
      description: clearRequestsTool.description,
      annotations: {
        destructiveHint: true
      }
    },
    async () => {
      return safe(async () => {
        await requestService.clear();
        return buildToolResult({ cleared: true }, "Cleared captured requests");
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
        return buildToolResult(paged.map(buildMockRuleSummary), `Loaded ${paged.length} mock rule summaries`);
      });
    }
  );

  server.registerTool(
    getMockRuleDetailTool.name,
    {
      description: getMockRuleDetailTool.description,
      inputSchema: detailInputSchema,
      annotations: {
        readOnlyHint: true
      }
    },
    async ({ id, view, requestId, scenario, bodyPreviewChars }) => {
      return safe(() => {
        const rule = mockService.list().find((item) => item.id === id);
        if (!rule) {
          throw new Error("Mock rule not found");
        }
        const requestRecord = requestId ? requestService.getById(requestId) : undefined;
        return buildToolResult(
          buildMockRuleDetailPayload(
            rule,
            {
              view,
              requestId,
              scenario,
              bodyPreviewChars
            },
            {
              activeGroup: mockService.getActiveGroup(),
              requestRecord
            }
          ),
          `Loaded mock rule ${rule.name} (${view ?? "summary"})`
        );
      });
    }
  );

  server.registerTool(
    createMockRuleTool.name,
    {
      description: createMockRuleTool.description,
      inputSchema: createMockRuleInputSchema
    },
    async (args) =>
      safe(async () => {
        const nextInput = buildCreateMockRuleInput(args, {
          requestRecord: "requestId" in args ? requestService.getById(args.requestId) : undefined
        });
        const data = await mockService.create(nextInput);
        await syncActiveMockGroupFromRuleName(mockService, data.name);
        return buildToolResult(
          buildWriteReceipt(null, data, `Created mock rule ${data.name}`),
          `Created mock rule ${data.name}`
        );
      })
  );

  server.registerTool(
    updateMockRuleTool.name,
    {
      description: updateMockRuleTool.description,
      inputSchema: updateMockRuleToolInputSchema
    },
    async (input) =>
      safe(async () => {
        const { id } = input;
        const before = mockService.list().find((item) => item.id === id);
        if (!before) {
          throw new Error("Mock rule not found");
        }
        const nextInput = buildUpdateMockRuleInput(before, input);
        const data = await mockService.update(id, nextInput as UpdateMockRuleInput);
        await syncActiveMockGroupFromRuleName(mockService, data.name);
        return buildToolResult(
          buildWriteReceipt(before, data, `Updated mock rule ${data.name}`),
          `Updated mock rule ${data.name}`
        );
      })
  );

  server.registerTool(
    deleteMockRuleTool.name,
    {
      description: deleteMockRuleTool.description,
      inputSchema: mockRuleIdInputSchema,
      annotations: {
        destructiveHint: true
      }
    },
    async ({ id }) => {
      return safe(async () => {
        await mockService.remove(id);
        return buildToolResult({ id }, `Deleted mock rule ${id}`);
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
          const data = await mockService.toggle(id, enabled);
          return buildToolResult(data, `Set mock rule ${data.name} enabled=${enabled}`);
        }

        const matched = mockService.list().filter((rule) => rule.name === name);
        if (matched.length === 0) {
          throw new Error("Mock rule not found");
        }
        if (matched.length > 1) {
          throw new Error("Multiple mock rules matched this name, please use id");
        }
        const data = await mockService.toggle(matched[0].id, enabled);
        return buildToolResult(data, `Set mock rule ${data.name} enabled=${enabled}`);
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
    async () => safe(() => buildToolResult({ group: mockService.getActiveGroup() }, "Loaded active mock group"))
  );

  server.registerTool(
    setActiveMockGroupTool.name,
    {
      description: setActiveMockGroupTool.description,
      inputSchema: setActiveMockGroupInputSchema
    },
    async ({ group }) =>
      safe(async () =>
        buildToolResult(
          {
            group: await mockService.setActiveGroup(group as SetActiveMockGroupInput["group"])
          },
          `Set active mock group to ${group ?? "null"}`
        )
      )
  );

  server.registerTool(
    runRequestTool.name,
    {
      description: runRequestTool.description,
      inputSchema: runRequestInputSchema
    },
    async (args) =>
      safe(async () => {
        const data = await requestService.run(args as RunRequestInput);
        return buildToolResult(
          buildWriteReceipt(null, data, `Ran request ${data.method} ${data.path}`),
          `Ran request ${data.method} ${data.path}`
        );
      })
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
        return buildToolResult(paged.map(buildProxyRuleSummary), `Loaded ${paged.length} proxy rule summaries`);
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
        return buildToolResult(rule, `Loaded proxy rule ${rule.pattern}`);
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
    async () => safe(() => buildToolResult({ mode: proxyService.getMode() }, "Loaded proxy mode"))
  );

  server.registerTool(
    setProxyModeTool.name,
    {
      description: setProxyModeTool.description,
      inputSchema: proxyModeInputSchema
    },
    async ({ mode }) => safe(async () => buildToolResult({ mode: await proxyService.setMode(mode) }, `Set proxy mode to ${mode}`))
  );

  server.registerTool(
    upsertProxyRuleTool.name,
    {
      description: upsertProxyRuleTool.description,
      inputSchema: upsertProxyRuleInputSchema
    },
    async (args) =>
      safe(async () => {
        const data = await proxyService.upsertSiteRule(args);
        return buildToolResult(data, `Upserted proxy rule ${data.pattern}`);
      })
  );

  server.registerTool(
    removeProxyRuleTool.name,
    {
      description: removeProxyRuleTool.description,
      inputSchema: removeProxyRuleInputSchema,
      annotations: {
        destructiveHint: true
      }
    },
    async ({ host }) => {
      return safe(async () => {
        await proxyService.removeSiteRule(host);
        return buildToolResult({ host }, `Removed proxy rule ${host}`);
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
        return buildToolResult(
          {
            host: resolvedHost,
            mode: proxyService.getMode(),
            decision: forwardDecision.mode === "proxy_forward" ? "proxy" : "direct",
            routeMode: forwardDecision.mode,
            source: forwardDecision.source,
            matchedRuleId: forwardDecision.matchedRuleId ?? null,
            matchedRuleName: forwardDecision.matchedRuleName ?? null,
            reason: forwardDecision.reason
          },
          `Loaded proxy decision for ${resolvedHost}`
        );
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
        buildToolResult(
          {
            online: true,
            activeRequestCount: requestService.list().length,
            settings: proxyService.getSettings()
          },
          "Loaded service health"
        )
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
    async () => safe(() => buildToolResult(proxyService.getSettings(), "Loaded runtime settings"))
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
        return buildToolResult(
          {
            trusted,
            available: Boolean(certificateManager)
          },
          "Loaded certificate status"
        );
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
        return buildToolResult(
          {
            ...getInstallGuideForPlatform(certificatePath),
            certificatePath: certificatePath ?? null
          },
          "Loaded certificate install guide"
        );
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
        return buildToolResult(
          {
            ready: Object.values(checks).every(Boolean),
            checks
          },
          "Loaded HTTPS interception readiness"
        );
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
      async () => buildResourceResult(requestListResource.uri, requestService.list({ limit: 20 }).map(buildRequestSummary))
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
      async () => buildResourceResult(savedRequestListResource.uri, requestService.listSaved().map(buildSavedRequestSummary))
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
      async () => buildResourceResult(mockRuleListResource.uri, mockService.list().map(buildMockRuleSummary))
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
      async () => buildResourceResult(proxyModeResource.uri, proxyService.getMode())
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
      async () => buildResourceResult(proxyRuleListResource.uri, proxyService.listRules().map(buildProxyRuleSummary))
    );
  }

  return server;
}
