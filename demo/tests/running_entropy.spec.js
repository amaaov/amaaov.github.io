const { test, expect } = require("@playwright/test");
const { withConsoleGuard } = require("./helpers");

test.describe("Running Entropy", () => {
  test("initializes WebGL scene and hides loading", async ({ page }) => {
    const errors = await withConsoleGuard(page, async () => {
      await page.goto("/demo/running_entropy/index.html");
      await page.waitForFunction(() => window.__RUNNING_ENTROPY__?.isReady?.(), null, {
        timeout: 15_000,
      });
      await expect(page.locator("#gl-canvas")).toBeVisible();
      await expect(page.locator("#loading")).toHaveClass(/hidden/);
      await expect(page.locator("#error-modal")).toBeHidden();
    });
    expect(errors).toEqual([]);
  });

  test("switches scenes with number keys", async ({ page }) => {
    await page.goto("/demo/running_entropy/index.html");
    await page.waitForFunction(() => window.__RUNNING_ENTROPY__?.isReady?.());

    await page.keyboard.press("2");
    await expect.poll(async () => page.evaluate(() => {
      const app = window.__RUNNING_ENTROPY__.getApp();
      return app?.sceneManager?.getCurrentSceneInfo?.()?.index ?? null;
    })).toBe(1);
  });
});