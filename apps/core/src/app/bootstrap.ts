import { startServers } from "./server";

startServers()
  .then(({ runtimeSettings }) => {
    console.log(
      `Polaris core started on proxy ${runtimeSettings.localProxyPort}, api ${runtimeSettings.localApiPort}, mcp ${runtimeSettings.mcpPort}`
    );
  })
  .catch((error) => {
    console.error("Failed to start Polaris core", error);
    process.exitCode = 1;
  });
