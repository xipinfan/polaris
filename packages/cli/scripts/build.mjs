import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageDir, "../..");
const distDir = path.join(packageDir, "dist");
const runtimeDir = path.join(distDir, "runtime");
const assetsDir = path.join(distDir, "assets");

function getPnpmExecutable() {
  return process.env.npm_execpath
    ? { command: process.execPath, args: [process.env.npm_execpath] }
    : { command: "corepack", args: ["pnpm"] };
}

async function runPnpm(args) {
  const { spawn } = await import("node:child_process");
  const executable = getPnpmExecutable();
  await new Promise((resolve, reject) => {
    const child = spawn(executable.command, [...executable.args, ...args], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pnpm ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function bundleEntry(extraOptions) {
  await build({
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    sourcemap: false,
    splitting: false,
    legalComments: "none",
    logLevel: "info",
    ...extraOptions
  });
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(path.join(assetsDir, "console"), { recursive: true });
  await mkdir(path.join(assetsDir, "extension"), { recursive: true });

  await Promise.all([
    runPnpm(["--filter", "@polaris/console", "build"]),
    runPnpm(["--filter", "@polaris/extension", "build"])
  ]);

  await bundleEntry({
    entryPoints: [path.join(packageDir, "src", "bin.ts")],
    outfile: path.join(distDir, "bin.cjs"),
    banner: {
      js: "#!/usr/bin/env node"
    }
  });

  await Promise.all([
    bundleEntry({
      entryPoints: [path.join(repoRoot, "apps", "core", "src", "app", "daemon.ts")],
      outfile: path.join(runtimeDir, "daemon.cjs")
    }),
    bundleEntry({
      entryPoints: [path.join(repoRoot, "apps", "core", "src", "app", "mcpStdio.ts")],
      outfile: path.join(runtimeDir, "mcp-stdio.cjs")
    })
  ]);

  await writeFile(path.join(distDir, "index.cjs"), "module.exports = {};\n", "utf8");

  await Promise.all([
    cp(path.join(repoRoot, "apps", "console", "dist"), path.join(assetsDir, "console"), { recursive: true }),
    cp(path.join(repoRoot, "apps", "extension", "dist"), path.join(assetsDir, "extension"), { recursive: true })
  ]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
