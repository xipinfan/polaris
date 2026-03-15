import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpResourceRegistryByPackId, getMcpToolRegistryByPackId } from "@polaris/mcp-contracts";
import { MockService } from "../mock/mockService";
import { CertificateManager } from "../proxy/certificateManager";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { createPolarisMcpSdkServer } from "./sdkServer";

export class PolarisMcpStdioServer {
  private readonly server;

  constructor(
    requestService: RequestService,
    mockService: MockService,
    proxyService: ProxyService,
    certificateManager?: CertificateManager,
    packId?: string
  ) {
    const options = packId
      ? {
          allowedToolNames: new Set(getMcpToolRegistryByPackId(packId).map((tool) => tool.name)),
          allowedResourceNames: new Set(getMcpResourceRegistryByPackId(packId).map((resource) => resource.name))
        }
      : {};
    this.server = createPolarisMcpSdkServer(requestService, mockService, proxyService, certificateManager, options);
  }

  async connect(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
