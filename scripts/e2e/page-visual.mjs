import { spawn } from "node:child_process";
import process from "node:process";

const pageMap = new Map([
  ["home", { file: "e2e/console/navigation.visual.spec.ts", grep: "@home", project: "console-chromium" }],
  ["traffic", { file: "e2e/console/navigation.visual.spec.ts", grep: "@traffic", project: "console-chromium" }],
  ["proxy-forward", { file: "e2e/console/navigation.visual.spec.ts", grep: "@proxy-forward", project: "console-chromium" }],
  ["mock", { file: "e2e/console/navigation.visual.spec.ts", grep: "@mock", project: "console-chromium" }],
  ["debug", { file: "e2e/console/navigation.visual.spec.ts", grep: "@debug", project: "console-chromium" }],
  ["settings", { file: "e2e/console/navigation.visual.spec.ts", grep: "@settings", project: "console-chromium" }],
  ["popup", { file: "e2e/extension/popup.e2e.spec.ts", grep: "popup visual baseline", project: "extension-chromium" }]
]);

function getArgValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (exact) {
    return exact.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")) {
    return process.argv[index + 1];
  }

  return undefined;
}

const page = getArgValue("page");
const update = process.argv.includes("--update") || process.argv.includes("--baseline");

if (!page || !pageMap.has(page)) {
  console.error("Usage: node scripts/e2e/page-visual.mjs --page <home|traffic|proxy-forward|mock|debug|settings|popup> [--update]");
  process.exit(1);
}

const target = pageMap.get(page);
const args = [
  "exec",
  "playwright",
  "test",
  target.file,
  "--project",
  target.project,
  "-g",
  target.grep
];

if (update) {
  args.push("--update-snapshots");
}

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(pnpmCmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
