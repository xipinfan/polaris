import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { EXTENSION_DIST_DIR } from "../support/constants";

test.describe.serial("extension popup", () => {
  let context: BrowserContext;
  let extensionId = "";
  let userDataDir = "";

  const openPopup = async (): Promise<Page> => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 430, height: 860 });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    return page;
  };

  test.beforeAll(async () => {
    userDataDir = await mkdtemp(path.join(os.tmpdir(), "polaris-extension-e2e-"));
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_DIST_DIR}`,
        `--load-extension=${EXTENSION_DIST_DIR}`
      ]
    });

    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker");
    }
    extensionId = new URL(serviceWorker.url()).host;
  });

  test.afterAll(async () => {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  });

  test("popup can switch proxy mode", async () => {
    const page = await context.newPage();
    await page.goto("https://example.com/");
    await page.bringToFront();

    const popup = await openPopup();
    await expect(popup.getByTestId("popup-root")).toBeVisible();
    await expect(popup.getByTestId("mode-rules")).toBeEnabled({ timeout: 30_000 });

    await popup.getByTestId("mode-rules").click();
    await expect(popup.getByTestId("popup-message")).toBeVisible();
    await popup.close();
    await page.close();
  });

  test("popup visual baseline", async () => {
    const popup = await openPopup();
    await expect(popup.getByTestId("popup-root")).toBeVisible();
    await expect(popup.getByTestId("popup-root")).toHaveScreenshot("popup-default.png", {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: 0.03
    });
    await popup.close();
  });
});
