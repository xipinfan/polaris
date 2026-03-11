import { randomUUID } from "node:crypto";
import { type Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { createPolarisMcpSdkServer } from "./sdkServer";

interface SessionState {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  sessionId: string;
  closing?: Promise<void>;
}

export class PolarisMcpStreamableHttpServer {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService
  ) {}

  async createApp(): Promise<Express> {
    const app = createMcpExpressApp();
    app.all("/mcp", async (req, res) => {
      const requestSessionId = this.getSessionId(req);
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

      const session = existingSession ?? (await this.createSession());

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

  private async createSession(): Promise<SessionState> {
    const server = createPolarisMcpSdkServer(this.requestService, this.mockService, this.proxyService);
    const session: SessionState = {
      server,
      transport: undefined as never,
      sessionId: ""
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

  private disposeSession(session: SessionState, closeTransport: boolean): Promise<void> {
    if (session.closing) {
      return session.closing;
    }

    if (session.sessionId) {
      this.sessions.delete(session.sessionId);
    }

    session.closing = Promise.allSettled([
      session.server.close(),
      closeTransport ? session.transport.close() : Promise.resolve()
    ]).then(() => undefined);

    return session.closing;
  }
}
