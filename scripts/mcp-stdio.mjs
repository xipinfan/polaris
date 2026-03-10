import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const tsxCli = path.join(rootDir, "apps/core/node_modules/tsx/dist/cli.mjs");
const entry = path.join(rootDir, "apps/core/src/app/mcpStdio.ts");
const isWatchMode = process.argv.includes("--watch");
const args = [tsxCli];

if (isWatchMode) {
  args.push("watch");
}

args.push(entry);

const child = spawn(process.execPath, args, {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
