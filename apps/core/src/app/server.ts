import cors from "cors";
import express from "express";
import { createApiRouter } from "../api/routes/createApiRouter";
import { ExtensionHost } from "../modules/extensions/extensionHost";
import { MpcServer } from "../modules/mcp/mcpServer";
import { MockService } from "../modules/mock/mockService";
import { ProxyEngine } from "../modules/proxy/proxyEngine";
import { ProxyService } from "../modules/proxy/proxyService";
import { RequestService } from "../modules/requests/requestService";
import { StorageAdapter } from "../modules/storage/storageAdapter";

export async function startServers() {
  const storage = new StorageAdapter();
  await storage.init();

  const extensionHost = new ExtensionHost();
  const proxyService = new ProxyService(storage);
  const mockService = new MockService(storage, extensionHost);
  const requestService = new RequestService(storage, mockService, extensionHost);
  const proxyEngine = new ProxyEngine(requestService);
  const mcpServer = new MpcServer(requestService, mockService, proxyService);
  const settings = proxyService.getSettings();

  const apiApp = express();
  apiApp.use(cors());
  apiApp.use(express.json({ limit: "2mb" }));
  apiApp.use("/api", createApiRouter(requestService, mockService, proxyService));

  const apiServer = apiApp.listen(settings.localApiPort);
  const proxyServer = proxyEngine.createServer(settings.localProxyPort);
  const mcpHttpServer = settings.mcpEnabled ? mcpServer.createApp().listen(settings.mcpPort) : undefined;

  return {
    apiServer,
    proxyServer,
    mcpHttpServer,
    extensionHost,
    proxyService,
    requestService,
    mockService
  };
}
