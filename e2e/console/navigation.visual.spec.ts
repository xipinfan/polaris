import { expect, test, type Page } from "@playwright/test";
import { resolveApiPort } from "../support/polaris";

const routeCases = [
  { key: "home", path: "/", snapshot: "home.png" },
  { key: "traffic", path: "/traffic", snapshot: "traffic.png" },
  { key: "proxy-forward", path: "/proxy-forward", snapshot: "proxy-forward.png" },
  { key: "mock", path: "/mock", snapshot: "mock.png" },
  { key: "debug", path: "/debug", snapshot: "debug.png" },
  { key: "settings", path: "/settings", snapshot: "settings.png" }
];

async function waitForVisualStable(page: Page) {
  await expect(page.getByTestId("app-content")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(".ant-skeleton")).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

test.beforeAll(async () => {
  await resolveApiPort();
});

for (const routeCase of routeCases) {
  test(`visual @${routeCase.key} ${routeCase.path}`, async ({ page }) => {
    await page.goto(routeCase.path);
    await waitForVisualStable(page);

    await expect(page).toHaveScreenshot(routeCase.snapshot, {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: 0.03
    });
  });
}
