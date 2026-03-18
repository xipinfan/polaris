import path from "node:path";
import { defineConfig } from "@playwright/test";
import { E2E_POLARIS_HOME } from "./e2e/support/constants";

const isCI = Boolean(process.env.CI);
const consolePort = 5173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  snapshotPathTemplate: ".e2e/visual-baseline/{projectName}/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${consolePort}`,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    viewport: { width: 1600, height: 980 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  globalSetup: path.join(__dirname, "e2e/global-setup.ts"),
  webServer: [
    {
      command: "node scripts/dev/start.mjs",
      url: `http://127.0.0.1:${consolePort}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: {
        ...process.env,
        POLARIS_HOME: E2E_POLARIS_HOME
      }
    }
  ],
  projects: [
    {
      name: "console-chromium",
      testMatch: /e2e[\\/]console[\\/].*\.spec\.ts/
    },
    {
      name: "extension-chromium",
      testMatch: /e2e[\\/]extension[\\/].*\.spec\.ts/
    }
  ]
});
