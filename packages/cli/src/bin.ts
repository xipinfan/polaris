#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm } from "node:fs/promises";
import { constants, openSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const corePackageJson = require.resolve("@polaris/core/package.json");
const tsxPackageJson = require.resolve("tsx/package.json");
const corePackageDir = path.dirname(corePackageJson);
const daemonEntry = path.join(corePackageDir, "src", "app", "daemon.ts");
const tsxCli = path.join(path.dirname(tsxPackageJson), "dist", "cli.mjs");

function getPolarisHomeDir(): string {
  if (process.env.POLARIS_HOME) {
    return path.resolve(process.env.POLARIS_HOME);
  }

  if (process.platform === "win32") {
    const baseDir = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(baseDir, "Polaris");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Polaris");
  }

  return path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "polaris");
}

const homeDir = getPolarisHomeDir();
const runDir = path.join(homeDir, "run");
const logsDir = path.join(homeDir, "logs");
const pidFile = path.join(runDir, "polaris.pid");
const stateFile = path.join(runDir, "daemon-state.json");
const stdoutLog = path.join(logsDir, "daemon.stdout.log");
const stderrLog = path.join(logsDir, "daemon.stderr.log");

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readPid(): Promise<number | null> {
  if (!(await fileExists(pidFile))) {
    return null;
  }

  const raw = await readFile(pidFile, "utf8");
  const pid = Number(raw.trim());
  return Number.isInteger(pid) ? pid : null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs = 15000): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await fileExists(stateFile)) {
        const state = JSON.parse(await readFile(stateFile, "utf8"));
        const healthUrl = state?.urls?.health;
        if (typeof healthUrl === "string") {
          const response = await fetch(healthUrl);
          if (response.ok) {
            return true;
          }
        }
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return false;
}

async function startCommand(): Promise<void> {
  const existingPid = await readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(`Polaris is already running (pid ${existingPid})`);
    return;
  }

  await mkdir(runDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });

  const child = spawn(process.execPath, [tsxCli, daemonEntry], {
    detached: true,
    stdio: [
      "ignore",
      openSync(stdoutLog, "a"),
      openSync(stderrLog, "a")
    ],
    env: process.env
  });
  child.unref();

  const healthy = await waitForHealth();
  if (!healthy) {
    throw new Error(`Polaris did not become healthy in time. Check logs: ${stderrLog}`);
  }

  const state = JSON.parse(await readFile(stateFile, "utf8"));
  console.log("Polaris started");
  console.log(`Health: ${state.urls.health}`);
  console.log(`MCP: ${state.urls.mcp}`);
}

async function stopCommand(): Promise<void> {
  const pid = await readPid();
  if (!pid || !isProcessAlive(pid)) {
    await Promise.allSettled([rm(pidFile, { force: true }), rm(stateFile, { force: true })]);
    console.log("Polaris is not running");
    return;
  }

  process.kill(pid, "SIGTERM");
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    if (!isProcessAlive(pid)) {
      await Promise.allSettled([rm(pidFile, { force: true }), rm(stateFile, { force: true })]);
      console.log("Polaris stopped");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out stopping Polaris (pid ${pid})`);
}

async function statusCommand(): Promise<void> {
  const pid = await readPid();
  const alive = pid ? isProcessAlive(pid) : false;
  let health: unknown = null;
  const state = await fileExists(stateFile) ? JSON.parse(await readFile(stateFile, "utf8")) : null;

  try {
    const healthUrl =
      typeof state?.urls?.health === "string" ? state.urls.health : "http://127.0.0.1:9001/api/health";
    const response = await fetch(healthUrl);
    health = response.ok ? await response.json() : null;
  } catch {
    health = null;
  }

  console.log(
    JSON.stringify(
      {
        running: alive,
        pid: alive ? pid : null,
        homeDir,
        state,
        health,
        urls: {
          apiHealth: state?.urls?.health ?? "http://127.0.0.1:9001/api/health",
          mcp: state?.urls?.mcp ?? "http://127.0.0.1:9002/mcp"
        }
      },
      null,
      2
    )
  );
}

async function mcpUrlCommand(): Promise<void> {
  const state = await fileExists(stateFile) ? JSON.parse(await readFile(stateFile, "utf8")) : null;
  console.log(state?.urls?.mcp ?? "http://127.0.0.1:9002/mcp");
}

async function main() {
  const command = process.argv[2] ?? "status";

  switch (command) {
    case "start":
      await startCommand();
      return;
    case "stop":
      await stopCommand();
      return;
    case "status":
      await statusCommand();
      return;
    case "mcp-url":
      await mcpUrlCommand();
      return;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: polaris <start|stop|status|mcp-url>");
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
