import express, { type Express, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  getMcpPackById,
  getMcpResourceRegistryByPackId,
  getMcpToolRegistryByPackId,
  resolveMcpPackId,
  type McpPackDefinition
} from "@polaris/mcp-contracts";
import { MockService } from "../mock/mockService";
import { CertificateManager } from "../proxy/certificateManager";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { createPolarisMcpSdkServer } from "./sdkServer";

interface SseSessionState {
  server: McpServer;
  transport: SSEServerTransport;
  sessionId: string;
  packId?: string;
  closing?: Promise<void>;
}

export class PolarisMcpSseServer {
  private readonly sessions = new Map<string, SseSessionState>();

  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService,
    private readonly certificateManager?: CertificateManager
  ) {}

  async createApp(): Promise<Express> {
    const app = express();

    app.get("/sse", async (req, res) => {
      await this.startSession(req, res);
    });

    app.get("/sse/:pack", async (req, res) => {
      const pack = this.resolvePack(req.params.pack, res);
      if (!pack) {
        return;
      }
      await this.startSession(req, res, pack);
    });

    app.post("/messages", async (req, res) => {
      await this.handleMessage(req, res);
    });

    app.post("/messages/:pack", async (req, res) => {
      const pack = this.resolvePack(req.params.pack, res);
      if (!pack) {
        return;
      }
      await this.handleMessage(req, res, pack);
    });

    return app;
  }

  async close(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => this.disposeSession(session, true)));
  }

  private resolvePack(packName: string, res: Response): McpPackDefinition | undefined {
    const packId = resolveMcpPackId(packName);
    if (!packId) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32602,
          message: `Unknown MCP pack: ${packName}`,
          data: {
            code: "UNKNOWN_PACK",
            message: `Unknown MCP pack: ${packName}`,
            retryable: false
          }
        },
        id: null
      });
      return undefined;
    }

    const pack = getMcpPackById(packId);
    if (!pack) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32602,
          message: `Unknown MCP pack: ${packName}`,
          data: {
            code: "UNKNOWN_PACK",
            message: `Unknown MCP pack: ${packName}`,
            retryable: false
          }
        },
        id: null
      });
      return undefined;
    }

    return pack;
  }

  private async startSession(req: Request, res: Response, pack?: McpPackDefinition): Promise<void> {
    const packId = pack?.id;
    const postEndpoint = packId ? `/messages/${packId}` : "/messages";
    const transport = new SSEServerTransport(postEndpoint, res);
    const session = await this.createSession(transport, packId);
    this.sessions.set(session.sessionId, session);

    transport.onclose = () => {
      void this.disposeSession(session, false);
    };
  }

  private async handleMessage(req: Request, res: Response, pack?: McpPackDefinition): Promise<void> {
    const sessionId = this.getSessionId(req);
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Missing sessionId"
        },
        id: null
      });
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Session not found"
        },
        id: null
      });
      return;
    }

    if (session.packId !== pack?.id) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Session pack mismatch"
        },
        id: null
      });
      return;
    }

    await session.transport.handlePostMessage(req, res, req.body);
  }

  private getSessionId(req: Request): string | undefined {
    const { sessionId } = req.query;
    if (typeof sessionId === "string") {
      return sessionId;
    }
    if (Array.isArray(sessionId) && typeof sessionId[0] === "string") {
      return sessionId[0];
    }
    return undefined;
  }

  private async createSession(transport: SSEServerTransport, packId?: string): Promise<SseSessionState> {
    const toolNames = new Set(getMcpToolRegistryByPackId(packId).map((tool) => tool.name));
    const resourceNames = new Set(getMcpResourceRegistryByPackId(packId).map((resource) => resource.name));
    const server = createPolarisMcpSdkServer(
      this.requestService,
      this.mockService,
      this.proxyService,
      this.certificateManager,
      packId
        ? {
            allowedToolNames: toolNames,
            allowedResourceNames: resourceNames
          }
        : {}
    );

    await server.connect(transport);

    return {
      server,
      transport,
      sessionId: transport.sessionId,
      packId
    };
  }

  private async disposeSession(session: SseSessionState, closeTransport: boolean): Promise<void> {
    if (session.closing) {
      return session.closing;
    }

    this.sessions.delete(session.sessionId);
    session.closing = this.closeSession(session, closeTransport);
    return session.closing;
  }

  private async closeSession(session: SseSessionState, closeTransport: boolean): Promise<void> {
    await session.server.close().catch(() => undefined);
    if (closeTransport) {
      await session.transport.close().catch(() => undefined);
    }
  }
}
