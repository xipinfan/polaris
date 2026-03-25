import type { Server } from "node:net";
import { resolveMcpPackId } from "@polaris/mcp-contracts";
import { createRuntime } from "./runtime";
import { bindServerWithFallback } from "./ports";
import { PolarisMcpStdioServer } from "../modules/mcp/stdioServer";
import { defaultSettings } from "./config";

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
    if (server.listening) {
      resolve();
      return;
    }

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
  const packId = resolveMcpPackId(process.env.POLARIS_MCP_PACK ?? undefined);
  if (process.env.POLARIS_MCP_PACK && !packId) {
    throw new Error(`Unknown MCP pack: ${process.env.POLARIS_MCP_PACK}`);
  }

  const runtime = await createRuntime({ readOnly: true });
  const settings = runtime.proxyService.getSettings();
  const shouldStartProxy = process.env.POLARIS_MCP_START_PROXY === "true";
  let runtimeSettings = settings;
  let proxyServer: Server | undefined;

  if (shouldStartProxy) {
    const proxyBinding = await bindServerWithFallback(
      () => runtime.proxyEngine.createServer(),
      defaultSettings.localProxyPort,
      new Set<number>()
    );
    proxyServer = proxyBinding.server;
    if (proxyBinding.port !== defaultSettings.localProxyPort) {
      runtimeSettings = await runtime.proxyService.setSettings({
        ...settings,
        localProxyPort: proxyBinding.port
      });
    }
  }

  const mcpServer = new PolarisMcpStdioServer(
    runtime.requestService,
    runtime.mockService,
    runtime.proxyService,
    runtime.certificateManager,
    packId
  );

  let shuttingDown = false;
  let parentWatchdog: NodeJS.Timeout | undefined;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (parentWatchdog) {
      clearInterval(parentWatchdog);
      parentWatchdog = undefined;
    }
    await Promise.allSettled([mcpServer.close(), proxyServer ? closeServer(proxyServer) : Promise.resolve()]);
  };

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(130));
  });

  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(143));
  });

  process.stdin.on("close", () => {
    void shutdown().finally(() => process.exit(0));
  });

  process.stdin.on("end", () => {
    void shutdown().finally(() => process.exit(0));
  });

  // Ensure we can observe stdin close/end when running under pipe transport.
  if (!process.stdin.isTTY) {
    process.stdin.resume();
  }

  const initialParentPid = process.ppid;
  parentWatchdog = setInterval(() => {
    if (initialParentPid > 1 && process.ppid === 1) {
      void shutdown().finally(() => process.exit(0));
    }
  }, 3000);

  process.on("exit", () => {
    if (parentWatchdog) {
      clearInterval(parentWatchdog);
      parentWatchdog = undefined;
    }
    proxyServer?.close();
  });

  if (proxyServer) {
    await waitForServer(proxyServer);
  }
  await mcpServer.connect();
  console.error(
    shouldStartProxy
      ? `Polaris MCP stdio server started with local proxy ${runtimeSettings.localProxyPort}${packId ? ` (pack=${packId})` : ""}`
      : `Polaris MCP stdio server started without local proxy${packId ? ` (pack=${packId})` : ""}`
  );
}

main().catch((error) => {
  console.error("Failed to start Polaris MCP stdio server", error);
  process.exitCode = 1;
});
