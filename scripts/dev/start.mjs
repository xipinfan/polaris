import { spawn } from "node:child_process";

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands = [
  ["--filter", "@polaris/core", "dev"],
  ["--filter", "@polaris/console", "dev"]
];

const children = commands.map((args) =>
  spawn(pnpmCmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  })
);

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(143);
});
