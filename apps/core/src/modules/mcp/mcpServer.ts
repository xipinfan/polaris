import express, { type Express, type Request } from "express";
import {
  getLegacyMcpToolRegistryByPackId,
  getMcpResourceRegistryByPackId,
  mcpLegacyPackRegistry,
  resolveMcpPackId
} from "@polaris/mcp-contracts";
import { buildMockRuleSummary, buildProxyRuleSummary, buildRequestSummary, buildSavedRequestSummary } from "./payloads";
import { MockService } from "../mock/mockService";
import { CertificateManager } from "../proxy/certificateManager";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { toLegacyErrorResponse, unknownPackError, unknownResourceError, unknownToolError } from "./errorHandling";
import { handleLegacyToolInvocation, type ToolServiceDeps } from "./toolHandlers";

export class MpcServer {
  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService,
    private readonly certificateManager?: CertificateManager
  ) {}

  private resolvePackId(req: Request): string | undefined {
    const packFromQuery = typeof req.query?.pack === "string" ? req.query.pack : undefined;
    const packFromHeader = typeof req.headers["x-polaris-mcp-pack"] === "string" ? req.headers["x-polaris-mcp-pack"] : undefined;
    return resolveMcpPackId(packFromQuery ?? packFromHeader);
  }

  private assertToolAllowed(toolName: string, packId?: string): void {
    if (!packId) {
      return;
    }
    const allowed = new Set(getLegacyMcpToolRegistryByPackId(packId).map((tool) => tool.name));
    if (!allowed.has(toolName)) {
      throw unknownToolError(toolName);
    }
  }

  createApp(): Express {
    const deps: ToolServiceDeps = {
      requestService: this.requestService,
      mockService: this.mockService,
      proxyService: this.proxyService,
      certificateManager: this.certificateManager
    };

    const app = express();

    app.get("/packs", (_req, res) => {
      res.json({
        data: mcpLegacyPackRegistry.map((pack) => ({
          ...pack,
          toolsCount: pack.toolNames.length,
          resourcesCount: pack.resourceNames.length
        }))
      });
    });

    app.get("/packs/:pack/tools", (req, res) => {
      const packId = resolveMcpPackId(req.params.pack);
      if (!packId) {
        const response = toLegacyErrorResponse(unknownPackError(req.params.pack));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getLegacyMcpToolRegistryByPackId(packId) });
    });

    app.get("/tools", (req, res) => {
      const packId = this.resolvePackId(req);
      if (req.query.pack && !packId) {
        const response = toLegacyErrorResponse(unknownPackError(String(req.query.pack)));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getLegacyMcpToolRegistryByPackId(packId) });
    });

    app.get("/resources", (req, res) => {
      const packId = this.resolvePackId(req);
      if (req.query.pack && !packId) {
        const response = toLegacyErrorResponse(unknownPackError(String(req.query.pack)));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getMcpResourceRegistryByPackId(packId) });
    });

    app.post("/invoke/:tool", async (req, res) => {
      try {
        const tool = req.params.tool;
        const packId = this.resolvePackId(req);
        this.assertToolAllowed(tool, packId);
        const result = await handleLegacyToolInvocation(tool, req.body ?? {}, deps);
        res.json({ data: result.structuredContent.result });
      } catch (error) {
        const response = toLegacyErrorResponse(error);
        res.status(response.status).json({ error: response.error });
      }
    });

    app.get("/resource/:name", (req, res) => {
      try {
        const { name } = req.params;
        const packId = this.resolvePackId(req);
        if (packId) {
          const allowedResources = new Set(getMcpResourceRegistryByPackId(packId).map((resource) => resource.name));
          if (!allowedResources.has(name)) {
            throw unknownResourceError(name);
          }
        }
        switch (name) {
          case "recent_requests":
            res.json({ data: this.requestService.list().slice(0, 20).map(buildRequestSummary) });
            return;
          case "saved_requests":
            res.json({ data: this.requestService.listSaved().slice(0, 50).map(buildSavedRequestSummary) });
            return;
          case "mock_rules":
            res.json({ data: this.mockService.list().slice(0, 50).map(buildMockRuleSummary) });
            return;
          case "proxy_mode":
            res.json({ data: this.proxyService.getMode() });
            return;
          case "proxy_rules":
            res.json({ data: this.proxyService.listRules().slice(0, 50).map(buildProxyRuleSummary) });
            return;
          default:
            throw unknownResourceError(name);
        }
      } catch (error) {
        const response = toLegacyErrorResponse(error);
        res.status(response.status).json({ error: response.error });
      }
    });

    return app;
  }
}

