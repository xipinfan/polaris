import path from "node:path";

export const E2E_ROOT_DIR = path.join(process.cwd(), ".e2e");
export const E2E_POLARIS_HOME = path.join(E2E_ROOT_DIR, "polaris-home");
export const EXTENSION_DIST_DIR = path.join(process.cwd(), "apps/extension/dist");
