import { copyFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyDataDir = path.resolve(__dirname, "../../data");

function getDefaultPolarisHome(): string {
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

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await readFile(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getPolarisHomeDir(): string {
  return getDefaultPolarisHome();
}

export function getPolarisDataPath(...segments: string[]): string {
  return path.join(getPolarisHomeDir(), ...segments);
}

export function getLegacyDataPath(...segments: string[]): string {
  return path.join(legacyDataDir, ...segments);
}

export async function ensurePolarisDir(...segments: string[]): Promise<string> {
  const targetDir = getPolarisDataPath(...segments);
  await mkdir(targetDir, { recursive: true });
  return targetDir;
}

export async function migrateLegacyFile(relativePath: string): Promise<void> {
  const sourcePath = getLegacyDataPath(relativePath);
  const targetPath = getPolarisDataPath(relativePath);

  if (await fileExists(targetPath)) {
    return;
  }

  if (!(await fileExists(sourcePath))) {
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}
