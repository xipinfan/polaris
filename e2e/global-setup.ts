import { execSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { E2E_POLARIS_HOME, E2E_ROOT_DIR } from "./support/constants";

async function globalSetup(): Promise<void> {
  await mkdir(E2E_ROOT_DIR, { recursive: true });
  await rm(E2E_POLARIS_HOME, { recursive: true, force: true });
  await mkdir(E2E_POLARIS_HOME, { recursive: true });
  await mkdir(path.join(E2E_ROOT_DIR, "visual-baseline"), { recursive: true });

  execSync("corepack pnpm --filter @polaris/extension build", {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}

export default globalSetup;
