import { existsSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createApiRouter } from "../api/routes/createApiRouter";
import { MpcServer } from "../modules/mcp/mcpServer";
import { PolarisMcpSseServer } from "../modules/mcp/sseServer";
import { PolarisMcpStreamableHttpServer } from "../modules/mcp/streamableHttpServer";
import { bindServerWithFallback } from "./ports";
import { createRuntime } from "./runtime";
import { defaultSettings } from "./config";

const LAN_LISTEN_HOST = "0.0.0.0";
const moduleDir = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

function resolveConsoleDistDir(): string | null {
  const configuredDir = process.env.POLARIS_CONSOLE_DIST;
  const candidateDirs = [
    configuredDir,
    path.resolve(moduleDir, "../../../console/dist"),
    path.resolve(process.cwd(), "apps/console/dist")
  ].filter((value): value is string => Boolean(value));

  for (const candidateDir of candidateDirs) {
    if (existsSync(path.join(candidateDir, "index.html"))) {
      return candidateDir;
    }
  }

  return null;
}

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
  const sseMcpServer = new PolarisMcpSseServer(
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

  const consoleDistDir = resolveConsoleDistDir();
  if (consoleDistDir) {
    apiApp.use(express.static(consoleDistDir));
    apiApp.get(/^(?!\/api(?:\/|$)|\/mcp(?:\/|$)|\/sse(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(consoleDistDir, "index.html"));
    });
  }

  const usedPorts = new Set<number>();
  const { server: proxyServer, port: proxyPort } = await bindServerWithFallback(
    () => runtime.proxyEngine.createServer(),
    preferredProxyPort,
    usedPorts,
    LAN_LISTEN_HOST
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
      mcpApp.use(await streamableMcpServer.createApp());
      mcpApp.use(await sseMcpServer.createApp());
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
      streamableMcpServer.close(),
      sseMcpServer.close()
    ]);
    throw error;
  }

  return {
    apiServer,
    proxyServer,
    mcpHttpServer: resolvedMcpHttpServer,
    streamableMcpServer,
    sseMcpServer,
    extensionHost: runtime.extensionHost,
    certificateManager: runtime.certificateManager,
    proxyService: runtime.proxyService,
    requestService: runtime.requestService,
    mockService: runtime.mockService,
    storage: runtime.storage,
    proxyEngine: runtime.proxyEngine,
    runtimeSettings
  };
}
