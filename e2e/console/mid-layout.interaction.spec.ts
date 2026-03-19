import { expect, test, type Page } from "@playwright/test";

async function waitForVisualStable(page: Page) {
  await expect(page.getByTestId("app-content")).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

async function expectContainerInsideViewport(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) {
    return;
  }
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 1);
}

async function expectContainerNoHorizontalOverflow(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await expect(locator).toBeVisible();
  const overflow = await locator.evaluate((element) => {
    const node = element as HTMLElement;
    return node.scrollWidth - node.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

const widths = [1514, 1366, 1280] as const;
const breakpointEdgeWidths = [
  1602, 1601, 1600, 1599, 1598,
  1402, 1401, 1400, 1399, 1398,
  1282, 1281, 1280, 1279, 1278,
] as const;

for (const width of widths) {
  test(`proxy-forward mid-width actions should not be clipped @w${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 980 } });
    const page = await context.newPage();

    await page.goto("/proxy-forward");
    await waitForVisualStable(page);

    await expectContainerInsideViewport(page, "[class*='overview']");
    await expectContainerInsideViewport(page, "[class*='toolbarCard']");
    await expectContainerInsideViewport(page, "[class*='rulePanel']");
    await context.close();
  });

  test(`mock mid-width actions should not be clipped @w${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 980 } });
    const page = await context.newPage();

    await page.goto("/mock");
    await waitForVisualStable(page);

    await expectContainerInsideViewport(page, "[class*='overview']");
    await expectContainerInsideViewport(page, "[class*='ruleTable']");
    await context.close();
  });
}

for (const width of breakpointEdgeWidths) {
  test(`proxy-forward breakpoint-edge should not overflow @w${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 980 } });
    const page = await context.newPage();

    await page.goto("/proxy-forward");
    await waitForVisualStable(page);

    await expectContainerInsideViewport(page, "[class*='overview']");
    await expectContainerNoHorizontalOverflow(page, "[class*='overview']");
    await expectContainerInsideViewport(page, "[class*='toolbarCard']");
    await expectContainerNoHorizontalOverflow(page, "[class*='rulePanel']");
    await context.close();
  });

  test(`mock breakpoint-edge should not overflow @w${width}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 980 } });
    const page = await context.newPage();

    await page.goto("/mock");
    await waitForVisualStable(page);

    await expectContainerInsideViewport(page, "[class*='overview']");
    await expectContainerNoHorizontalOverflow(page, "[class*='ruleTable']");
    await expectContainerNoHorizontalOverflow(page, "[class*='ruleBlock']");
    await expectContainerNoHorizontalOverflow(page, "[class*='ruleRow']");
    await context.close();
  });
}
