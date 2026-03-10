import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RequestFilters, RunRequestInput, SaveRequestInput } from "@polaris/shared-contracts";
import {
  createMockRuleTool,
  enableMockRuleTool,
  getProxyModeTool,
  getRequestDetailTool,
  getSavedRequestDetailTool,
  listProxyRulesTool,
  listRequestsTool,
  listSavedRequestsTool,
  replayRequestTool,
  requestListResource,
  runRequestTool,
  saveRequestTool,
  savedRequestListResource,
  mockRuleListResource,
  proxyModeResource,
  proxyRuleListResource
} from "@polaris/mcp-contracts";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";

const stringMapSchema = z.record(z.string(), z.string());

const listRequestsInputSchema = z.object({
  keyword: z.string().optional(),
  method: z.string().optional(),
  host: z.string().optional(),
  statusCode: z.number().int().optional(),
  limit: z.number().int().positive().max(100).optional()
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
  method: z.string().min(1),
  url: z.string().url(),
  responseStatus: z.number().int(),
  responseHeaders: stringMapSchema.optional(),
  responseBody: z.unknown().nullable().optional(),
  enabled: z.boolean()
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

export function createPolarisMcpSdkServer(
  requestService: RequestService,
  mockService: MockService,
  proxyService: ProxyService
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
      const filters: RequestFilters = args;
      return jsonToolResult(requestService.list(filters));
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
      const record = requestService.getById(id);
      if (!record) {
        throw new Error("Request not found");
      }
      return jsonToolResult(record);
    }
  );

  server.registerTool(
    listSavedRequestsTool.name,
    {
      description: listSavedRequestsTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => jsonToolResult(requestService.listSaved())
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
      const savedRequest = requestService.getSavedById(id);
      if (!savedRequest) {
        throw new Error("Saved request not found");
      }
      return jsonToolResult(savedRequest);
    }
  );

  server.registerTool(
    saveRequestTool.name,
    {
      description: saveRequestTool.description,
      inputSchema: saveRequestInputSchema
    },
    async (args) => jsonToolResult(await requestService.save(args as SaveRequestInput))
  );

  server.registerTool(
    replayRequestTool.name,
    {
      description: replayRequestTool.description,
      inputSchema: z.object({
        id: z.string().min(1)
      })
    },
    async ({ id }) => jsonToolResult(await requestService.replayRequest(id))
  );

  server.registerTool(
    createMockRuleTool.name,
    {
      description: createMockRuleTool.description,
      inputSchema: createMockRuleInputSchema
    },
    async (args) => jsonToolResult(await mockService.create(args))
  );

  server.registerTool(
    enableMockRuleTool.name,
    {
      description: enableMockRuleTool.description,
      inputSchema: z.object({
        id: z.string().min(1),
        enabled: z.boolean()
      })
    },
    async ({ id, enabled }) => jsonToolResult(await mockService.toggle(id, enabled))
  );

  server.registerTool(
    runRequestTool.name,
    {
      description: runRequestTool.description,
      inputSchema: runRequestInputSchema
    },
    async (args) => jsonToolResult(await requestService.run(args as RunRequestInput))
  );

  server.registerTool(
    listProxyRulesTool.name,
    {
      description: listProxyRulesTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => jsonToolResult(proxyService.listRules())
  );

  server.registerTool(
    getProxyModeTool.name,
    {
      description: getProxyModeTool.description,
      annotations: {
        readOnlyHint: true
      }
    },
    async () => jsonToolResult({ mode: proxyService.getMode() })
  );

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

  return server;
}
