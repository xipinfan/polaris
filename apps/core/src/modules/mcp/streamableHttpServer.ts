import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

interface SessionState {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  sessionId: string;
  packId?: string;
  closing?: Promise<void>;
}

export class PolarisMcpStreamableHttpServer {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService,
    private readonly certificateManager?: CertificateManager
  ) {}

  async createApp(): Promise<Express> {
    const app = express();
    const handler = async (req: Request, res: Response, pack?: McpPackDefinition) => {
      const requestSessionId = this.getSessionId(req);
      const requestedPackId = pack?.id;
      const existingSession = requestSessionId ? this.sessions.get(requestSessionId) : undefined;

      if (requestSessionId && !existingSession) {
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

      if (existingSession && existingSession.packId !== requestedPackId) {
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

      const session = existingSession ?? (await this.createSession(requestedPackId));
      if (!existingSession) {
        session.packId = requestedPackId;
      }

      try {
        await session.transport.handleRequest(req, res, req.body);
      } finally {
        const resolvedSessionId = session.transport.sessionId;
        if (resolvedSessionId && !this.sessions.has(resolvedSessionId)) {
          session.sessionId = resolvedSessionId;
          this.sessions.set(resolvedSessionId, session);
        }

        if (!resolvedSessionId) {
          await this.disposeSession(session, true);
        }
      }
    };

    app.all("/mcp", async (req, res) => handler(req, res));
    app.all("/mcp/:pack", async (req, res) => {
      const packId = resolveMcpPackId(req.params.pack);
      if (!packId) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32602,
            message: `Unknown MCP pack: ${req.params.pack}`,
            data: {
              code: "UNKNOWN_PACK",
              message: `Unknown MCP pack: ${req.params.pack}`,
              retryable: false
            }
          },
          id: null
        });
        return;
      }
      const pack = getMcpPackById(packId);
      if (!pack) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32602,
            message: `Unknown MCP pack: ${req.params.pack}`,
            data: {
              code: "UNKNOWN_PACK",
              message: `Unknown MCP pack: ${req.params.pack}`,
              retryable: false
            }
          },
          id: null
        });
        return;
      }
      await handler(req, res, pack);
    });

    return app;
  }

  async close(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => this.disposeSession(session, true)));
  }

  private getSessionId(req: { headers: Record<string, string | string[] | undefined> }): string | undefined {
    const header = req.headers["mcp-session-id"];
    return Array.isArray(header) ? header[0] : header;
  }

  private async createSession(packId?: string): Promise<SessionState> {
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
    const session: SessionState = {
      server,
      transport: undefined as never,
      sessionId: "",
      packId
    };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        session.sessionId = sessionId;
        this.sessions.set(sessionId, session);
      },
      onsessionclosed: async (sessionId) => {
        session.sessionId = sessionId;
        await this.disposeSession(session, false);
      }
    });

    transport.onclose = () => {
      void this.disposeSession(session, false);
    };

    session.transport = transport;
    await server.connect(transport);
    return session;
  }

  private async disposeSession(session: SessionState, closeTransport: boolean): Promise<void> {
    if (session.closing) {
      return session.closing;
    }

    if (session.sessionId) {
      this.sessions.delete(session.sessionId);
    }

    session.closing = this.closeSession(session, closeTransport);

    return session.closing;
  }

  private async closeSession(session: SessionState, closeTransport: boolean): Promise<void> {
    await session.server.close().catch(() => undefined);
    if (closeTransport) {
      await session.transport.close().catch(() => undefined);
    }
  }
}
