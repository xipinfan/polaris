import type { Server } from "node:net";
import { createRuntime } from "./runtime";
import { bindServerWithFallback } from "./ports";
import { PolarisMcpStdioServer } from "../modules/mcp/stdioServer";

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function waitForServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onListening = () => {
      cleanup();
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
  });
}

async function main() {
  const runtime = await createRuntime();
  const settings = runtime.proxyService.getSettings();
  const shouldStartProxy = process.env.POLARIS_MCP_START_PROXY === "false" ? false : true;
  let runtimeSettings = settings;
  let proxyServer: Server | undefined;

  if (shouldStartProxy) {
    const proxyBinding = await bindServerWithFallback(() => runtime.proxyEngine.createServer(), settings.localProxyPort, new Set<number>());
    proxyServer = proxyBinding.server;
    if (proxyBinding.port !== settings.localProxyPort) {
      runtimeSettings = await runtime.proxyService.setSettings({
        ...settings,
        localProxyPort: proxyBinding.port
      });
    }
  }

  const mcpServer = new PolarisMcpStdioServer(runtime.requestService, runtime.mockService, runtime.proxyService);

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await Promise.allSettled([mcpServer.close(), proxyServer ? closeServer(proxyServer) : Promise.resolve()]);
  };

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(130));
  });

  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(143));
  });

  process.on("exit", () => {
    proxyServer?.close();
  });

  if (proxyServer) {
    await waitForServer(proxyServer);
  }
  await mcpServer.connect();
  console.error(
    shouldStartProxy
      ? `Polaris MCP stdio server started with local proxy ${runtimeSettings.localProxyPort}`
      : "Polaris MCP stdio server started without local proxy"
  );
}

main().catch((error) => {
  console.error("Failed to start Polaris MCP stdio server", error);
  process.exitCode = 1;
});
