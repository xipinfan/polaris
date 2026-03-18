import { expect, test, type Page } from "@playwright/test";

const routeCases = [
  { key: "traffic", path: "/traffic" },
  { key: "mock", path: "/mock" },
  { key: "proxy-forward", path: "/proxy-forward" },
] as const;

async function waitForVisualStable(page: Page) {
  await expect(page.getByTestId("app-content")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator(".ant-skeleton")).toHaveCount(0, { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

test.use({ viewport: { width: 860, height: 720 } });

for (const routeCase of routeCases) {
  test(`narrow visual @narrow-${routeCase.key} ${routeCase.path}`, async ({ page }) => {
    await page.goto(routeCase.path);
    await waitForVisualStable(page);

    if (routeCase.key === "traffic") {
      const tableScroll = page.locator("[class*='requestScroll']").first();
      await expect(tableScroll).toBeVisible();

      const overflowState = await tableScroll.evaluate((element) => {
        const node = element as HTMLElement;
        const before = node.scrollLeft;
        node.scrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
        return {
          hasHorizontalOverflow: node.scrollWidth > node.clientWidth + 8,
          moved: node.scrollLeft > before,
        };
      });

      expect(overflowState.hasHorizontalOverflow).toBeTruthy();
      expect(overflowState.moved).toBeTruthy();
    }

    await expect(page).toHaveScreenshot(`${routeCase.key}.narrow.png`, {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: 0.03,
    });
  });
}
