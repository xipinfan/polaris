import { defaultSettings } from "./config";
import { startServers } from "./server";

startServers()
  .then(() => {
    console.log(
      `Polaris core started on proxy ${defaultSettings.localProxyPort}, api ${defaultSettings.localApiPort}, mcp ${defaultSettings.mcpPort}`
    );
  })
  .catch((error) => {
    console.error("Failed to start Polaris core", error);
    process.exitCode = 1;
  });
