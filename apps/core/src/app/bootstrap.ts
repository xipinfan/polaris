import { startServers } from "./server";

function closeNodeServer(server: { close: (cb: (error?: Error | null) => void) => void }): Promise<void> {
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

async function main() {
  const runtime = await startServers();
  let shuttingDown = false;

  const shutdown = async (exitCode: number) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await Promise.allSettled([
      closeNodeServer(runtime.proxyServer),
      closeNodeServer(runtime.apiServer),
      runtime.mcpHttpServer ? closeNodeServer(runtime.mcpHttpServer) : Promise.resolve(),
      runtime.streamableMcpServer.close(),
      runtime.sseMcpServer.close(),
      runtime.proxyEngine.closeMitmServer(),
      (async () => {
        if (await runtime.systemProxyManager.isEnabled()) {
          await runtime.systemProxyManager.disable();
        }
      })(),
      runtime.storage.flush()
    ]);
    process.exit(exitCode);
  };

  process.on("SIGINT", () => {
    void shutdown(130);
  });

  process.on("SIGTERM", () => {
    void shutdown(143);
  });

  process.stdin.on("close", () => {
    void shutdown(0);
  });

  process.stdin.on("end", () => {
    void shutdown(0);
  });

  if (!process.stdin.isTTY) {
    process.stdin.resume();
  }

  console.log(
    `Polaris core started on proxy ${runtime.runtimeSettings.localProxyPort}, api ${runtime.runtimeSettings.localApiPort}, mcp ${runtime.runtimeSettings.mcpPort}`
  );
}

main().catch((error) => {
  console.error("Failed to start Polaris core", error);
  process.exitCode = 1;
});
