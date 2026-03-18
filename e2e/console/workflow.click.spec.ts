import { expect, test } from "@playwright/test";
import { resolveApiPort } from "../support/polaris";

test("sidebar navigation works across main pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-nav")).toBeVisible();

  await page.getByTestId("nav-traffic").click();
  await expect(page).toHaveURL(/\/traffic/);

  await page.getByTestId("nav-proxy-forward").click();
  await expect(page).toHaveURL(/\/proxy-forward/);

  await page.getByTestId("nav-mock").click();
  await expect(page).toHaveURL(/\/mock/);

  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL(/\/settings/);
});

test("debug page can send a request and show status", async ({ page }) => {
  const apiPort = await resolveApiPort();
  await page.goto("/debug");
  await expect(page.getByTestId("debug-request-form")).toBeVisible();
  await expect(page.getByTestId("debug-response-empty")).toBeVisible();

  await page.getByTestId("debug-method-select").selectOption("GET");
  await page.getByTestId("debug-url-input").fill(`http://127.0.0.1:${apiPort}/api/health`);
  await page.getByTestId("debug-send-button").click();

  await expect(page.getByTestId("debug-response-status")).toContainText("200");
});
