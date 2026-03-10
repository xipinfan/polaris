import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSetting } from "@polaris/shared-types";
import { getPolarisHomeDir } from "./paths";
import { startServers } from "./server";

function getRunPaths() {
  const runDir = path.join(getPolarisHomeDir(), "run");
  return {
    runDir,
    pidFile: path.join(runDir, "polaris.pid"),
    stateFile: path.join(runDir, "daemon-state.json")
  };
}

async function writeRunFiles(settings: AppSetting) {
  const { runDir, pidFile, stateFile } = getRunPaths();
  await mkdir(runDir, { recursive: true });
  await writeFile(pidFile, String(process.pid), "utf8");
  await writeFile(
    stateFile,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        ports: {
          proxy: settings.localProxyPort,
          api: settings.localApiPort,
          mcp: settings.mcpPort
        },
        urls: {
          health: `http://127.0.0.1:${settings.localApiPort}/api/health`,
          mcp: `http://127.0.0.1:${settings.mcpPort}/mcp`
        }
      },
      null,
      2
    ),
    "utf8"
  );
}

async function cleanupRunFiles() {
  const { pidFile, stateFile } = getRunPaths();
  await Promise.allSettled([rm(pidFile, { force: true }), rm(stateFile, { force: true })]);
}

async function main() {
  const { runtimeSettings } = await startServers();
  await writeRunFiles(runtimeSettings);
  console.log(
    `Polaris daemon started on proxy ${runtimeSettings.localProxyPort}, api ${runtimeSettings.localApiPort}, mcp ${runtimeSettings.mcpPort}`
  );
}

process.on("SIGINT", () => {
  void cleanupRunFiles().finally(() => process.exit(130));
});

process.on("SIGTERM", () => {
  void cleanupRunFiles().finally(() => process.exit(143));
});

process.on("exit", () => {
  void cleanupRunFiles();
});

main().catch((error) => {
  console.error("Failed to start Polaris daemon", error);
  process.exitCode = 1;
});
