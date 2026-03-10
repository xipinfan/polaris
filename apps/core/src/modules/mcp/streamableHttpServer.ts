import { randomUUID } from "node:crypto";
import { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { createPolarisMcpSdkServer } from "./sdkServer";

export class PolarisMcpStreamableHttpServer {
  private readonly server;
  private readonly transport;

  constructor(
    requestService: RequestService,
    mockService: MockService,
    proxyService: ProxyService
  ) {
    this.server = createPolarisMcpSdkServer(requestService, mockService, proxyService);
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });
  }

  async createApp(): Promise<Express> {
    await this.server.connect(this.transport);

    const app = createMcpExpressApp();
    app.all("/mcp", async (req, res) => {
      await this.transport.handleRequest(req, res, req.body);
    });

    return app;
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.server.close(), this.transport.close()]);
  }
}
