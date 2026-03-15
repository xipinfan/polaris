import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourceSvgPath = path.join(rootDir, "assets", "brand", "polaris-mark.svg");
const consolePublicDir = path.join(rootDir, "apps", "console", "public");
const extensionPublicDir = path.join(rootDir, "apps", "extension", "public");
const extensionIconsDir = path.join(extensionPublicDir, "icons");

const svgContent = await readFile(sourceSvgPath, "utf8");

await mkdir(consolePublicDir, { recursive: true });
await mkdir(extensionIconsDir, { recursive: true });

await writeFile(path.join(consolePublicDir, "polaris-mark.svg"), svgContent, "utf8");
await writeFile(path.join(consolePublicDir, "favicon.svg"), svgContent, "utf8");
await writeFile(path.join(extensionPublicDir, "polaris-mark.svg"), svgContent, "utf8");

const html = (size) => `<!doctype html>
<html>
  <head>
    <style>
      html, body {
        margin: 0;
        width: ${size}px;
        height: ${size}px;
        overflow: hidden;
        background: transparent;
      }
      body > div,
      body > div > svg {
        width: ${size}px;
        height: ${size}px;
        display: block;
      }
    </style>
  </head>
  <body style="margin:0;background:transparent;overflow:hidden;">
    <div style="width:${size}px;height:${size}px;">${svgContent}</div>
  </body>
</html>`;

const renderWithBrowser = (inputUrl, outputPath, size) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "cmd.exe",
      [
        "/c",
        "npx",
        "playwright",
        "screenshot",
        "--browser",
        "chromium",
        "--wait-for-timeout",
        "300",
        "--viewport-size",
        `${size},${size}`,
        inputUrl,
        outputPath,
      ],
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `Icon export failed with exit code ${code}.`));
    });
  });

const tempDir = await mkdtemp(path.join(os.tmpdir(), "polaris-icon-"));

try {
  const sizes = [16, 32, 48, 128];
  for (const size of sizes) {
    const tempHtmlPath = path.join(tempDir, `icon-${size}.html`);
    await writeFile(tempHtmlPath, html(size), "utf8");
    await renderWithBrowser(
      pathToFileURL(tempHtmlPath).href,
      path.join(extensionIconsDir, `icon-${size}.png`),
      size,
    );
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
