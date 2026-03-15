import http from "node:http";
import cors from "cors";
import express from "express";
import { createApiRouter } from "../api/routes/createApiRouter";
import { MpcServer } from "../modules/mcp/mcpServer";
import { PolarisMcpStreamableHttpServer } from "../modules/mcp/streamableHttpServer";
import { bindServerWithFallback } from "./ports";
import { createRuntime } from "./runtime";
import { defaultSettings } from "./config";

export async function startServers() {
  const runtime = await createRuntime();
  const currentSettings = runtime.proxyService.getSettings();
  const preferredProxyPort = defaultSettings.localProxyPort;
  const preferredApiPort = defaultSettings.localApiPort;
  const preferredMcpPort = defaultSettings.mcpPort;
  const legacyMcpServer = new MpcServer(
    runtime.requestService,
    runtime.mockService,
    runtime.proxyService,
    runtime.certificateManager
  );
  const streamableMcpServer = new PolarisMcpStreamableHttpServer(
    runtime.requestService,
    runtime.mockService,
    runtime.proxyService,
    runtime.certificateManager
  );

  const apiApp = express();
  apiApp.use(cors());
  apiApp.use(express.json({ limit: "2mb" }));
  apiApp.use(
    "/api",
    createApiRouter(runtime.requestService, runtime.mockService, runtime.proxyService, runtime.certificateManager)
  );
  const usedPorts = new Set<number>();
  const { server: proxyServer, port: proxyPort } = await bindServerWithFallback(
    () => runtime.proxyEngine.createServer(),
    preferredProxyPort,
    usedPorts
  );
  const { server: apiServer, port: apiPort } = await bindServerWithFallback(
    () => http.createServer(apiApp),
    preferredApiPort,
    usedPorts
  );

  let resolvedMcpHttpServer: http.Server | undefined;
  let runtimeSettings = currentSettings;

  try {
    if (currentSettings.mcpEnabled) {
      const mcpApp = express();
      mcpApp.use(cors());
      mcpApp.use(express.json({ limit: "2mb" }));
      mcpApp.use(await streamableMcpServer.createApp());
      mcpApp.use(legacyMcpServer.createApp());

      const mcpBinding = await bindServerWithFallback(
        () => http.createServer(mcpApp),
        preferredMcpPort,
        usedPorts
      );
      resolvedMcpHttpServer = mcpBinding.server;
      runtimeSettings = await runtime.proxyService.setSettings({
        ...currentSettings,
        localProxyPort: proxyPort,
        localApiPort: apiPort,
        mcpPort: mcpBinding.port
      });
    } else {
      runtimeSettings = await runtime.proxyService.setSettings({
        ...currentSettings,
        localProxyPort: proxyPort,
        localApiPort: apiPort
      });
    }
  } catch (error) {
    const mcpServerToClose = resolvedMcpHttpServer;
    await Promise.allSettled([
      new Promise((resolve) => proxyServer.close(() => resolve(null))),
      new Promise((resolve) => apiServer.close(() => resolve(null))),
      mcpServerToClose ? new Promise((resolve) => mcpServerToClose.close(() => resolve(null))) : Promise.resolve(null),
      streamableMcpServer.close()
    ]);
    throw error;
  }

  return {
    apiServer,
    proxyServer,
    mcpHttpServer: resolvedMcpHttpServer,
    streamableMcpServer,
    extensionHost: runtime.extensionHost,
    certificateManager: runtime.certificateManager,
    proxyService: runtime.proxyService,
    requestService: runtime.requestService,
    mockService: runtime.mockService,
    runtimeSettings
  };
}
