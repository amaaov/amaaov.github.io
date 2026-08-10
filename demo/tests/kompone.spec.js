const { test, expect } = require("@playwright/test");
const { withConsoleGuard } = require("./helpers");

test.describe("Kompone", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/scenes/kompone/kompone/index.html");
    await page.waitForFunction(() => window.__KOMPONE__);
  });

  test("loads WebGL canvas without page errors", async ({ page }) => {
    const errors = await withConsoleGuard(page, async () => {
      const canvas = page.locator("#gameCanvas");
      await expect(canvas).toBeVisible();
      const size = await canvas.evaluate((el) => ({ w: el.width, h: el.height }));
      expect(size.w).toBeGreaterThan(0);
      expect(size.h).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.__KOMPONE__.getSnakeLength())).toBe(1);
    });
    expect(errors).toEqual([]);
  });

  test("changes direction from keyboard", async ({ page }) => {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__KOMPONE__.step());
    const direction = await page.evaluate(() => window.__KOMPONE__.getDirection());
    expect(direction).toEqual({ x: 0, y: -1 });
  });

  test("resumes after forced game over", async ({ page }) => {
    await page.evaluate(() => window.__KOMPONE__.forceGameOver());
    expect(await page.evaluate(() => window.__KOMPONE__.isGameOver())).toBe(true);

    await page.keyboard.press("Space");

    await expect.poll(async () => page.evaluate(() => window.__KOMPONE__.isGameOver())).toBe(false);
    await expect.poll(async () => page.evaluate(() => window.__KOMPONE__.getSnakeLength())).toBe(1);
  });
});
