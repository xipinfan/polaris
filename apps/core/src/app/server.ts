import cors from "cors";
import express from "express";
import { createApiRouter } from "../api/routes/createApiRouter";
import { ExtensionHost } from "../modules/extensions/extensionHost";
import { MpcServer } from "../modules/mcp/mcpServer";
import { MockService } from "../modules/mock/mockService";
import { CertificateManager } from "../modules/proxy/certificateManager";
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
  const certificateManager = new CertificateManager();
  await certificateManager.init();
  await proxyService.setCertificateInstalled(await certificateManager.isRootCertificateTrusted());
  const proxyEngine = new ProxyEngine(requestService, mockService, certificateManager);
  const mcpServer = new MpcServer(requestService, mockService, proxyService);
  const runtimeSettings = proxyService.getSettings();

  const apiApp = express();
  apiApp.use(cors());
  apiApp.use(express.json({ limit: "2mb" }));
  apiApp.use("/api", createApiRouter(requestService, mockService, proxyService, certificateManager));

  const apiServer = apiApp.listen(runtimeSettings.localApiPort);
  const proxyServer = proxyEngine.createServer(runtimeSettings.localProxyPort);
  const mcpHttpServer = runtimeSettings.mcpEnabled ? mcpServer.createApp().listen(runtimeSettings.mcpPort) : undefined;

  return {
    apiServer,
    proxyServer,
    mcpHttpServer,
    extensionHost,
    certificateManager,
    proxyService,
    requestService,
    mockService
  };
}
