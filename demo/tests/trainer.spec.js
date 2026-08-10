const { test, expect } = require("@playwright/test");
const { withConsoleGuard } = require("./helpers");

test.describe("Trainer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/trainer/index.html");
    await page.waitForFunction(() => window.__TRAINER__);
  });

  test("loads circle controls without page errors", async ({ page }) => {
    const errors = await withConsoleGuard(page, async () => {
      await expect(page.locator(".circle-of-fifths")).toBeVisible();
      await expect(page.locator(".trainer-controls")).toBeVisible();
      await expect(page.locator(".note[data-note]")).toHaveCount(12);
      await expect(page.locator(".play-stop")).toHaveText("Play");
    });
    expect(errors).toEqual([]);
  });

  test("scores a correct keyboard answer", async ({ page }) => {
    const errors = await withConsoleGuard(page, async () => {
      await page.evaluate(async () => {
        const api = window.__TRAINER__;
        api.setMode("Fifths");
        api.setInput("Keyboard");
        await api.start();
      });

      await page.waitForFunction(() => window.__TRAINER__.isAwaitingAnswer());

      const result = await page.evaluate(() => {
        const api = window.__TRAINER__;
        return api.submitAnswer(api.getExpectedNote());
      });

      expect(result.score).toBe(1);
      await expect(page.locator(".score-display")).toContainText("+1");
    });
    expect(errors).toEqual([]);
  });

  test("penalizes a wrong answer", async ({ page }) => {
    await page.evaluate(async () => {
      const api = window.__TRAINER__;
      api.setMode("Fifths");
      api.setInput("Keyboard");
      await api.start();
    });
    await page.waitForFunction(() => window.__TRAINER__.isAwaitingAnswer());

    const result = await page.evaluate(() => {
      const api = window.__TRAINER__;
      const expected = api.getExpectedNote();
      const wrong = expected === "C" ? "D" : "C";
      return api.submitAnswer(wrong);
    });

    expect(result.score).toBe(-1);
  });
});
