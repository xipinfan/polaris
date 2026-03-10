import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { createPolarisMcpSdkServer } from "./sdkServer";

export class PolarisMcpStdioServer {
  private readonly server;

  constructor(
    requestService: RequestService,
    mockService: MockService,
    proxyService: ProxyService
  ) {
    this.server = createPolarisMcpSdkServer(requestService, mockService, proxyService);
  }

  async connect(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
