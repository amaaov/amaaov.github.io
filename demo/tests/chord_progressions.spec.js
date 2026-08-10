const { test, expect } = require("@playwright/test");
const { withConsoleGuard } = require("./helpers");

async function startChordApp(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/demo/chord_progressions/index.html");
  await page.waitForSelector(".chord-container");

  const startAudio = page.locator(".start-audio-btn");
  await expect(startAudio).toBeVisible({ timeout: 15_000 });
  await startAudio.click();
  await expect(page.locator(".chord").first()).toBeVisible({ timeout: 15_000 });

  // Expand sidebar for control assertions (toggle listener is late-bound).
  await page.evaluate(() => {
    document.querySelector(".sound-controls")?.classList.remove("collapsed");
  });
}

test.describe("Chord Progressions", () => {
  test.beforeEach(async ({ page }) => {
    await startChordApp(page);
  });

  test("loads synthesizer UI", async ({ page }) => {
    const errors = await withConsoleGuard(page, async () => {
      await expect(page.locator(".chord-container")).toBeVisible();
      await expect(page.locator(".note-selector")).toBeVisible();
      await expect(page.locator(".scale-selector")).toBeVisible();
      await expect(page.locator(".chord").first()).toBeVisible();
    });
    expect(errors).toEqual([]);
  });

  test("activates a chord hexagon", async ({ page }) => {
    const chord = page.locator(".chord").first();
    await chord.click({ force: true });
    await expect(chord).toHaveClass(/playing/);
  });

  test("changes root note selection", async ({ page }) => {
    await page.evaluate(() => {
      const note = document.querySelector('.note-btn[data-note="G"]');
      note?.click();
    });
    await expect(page.locator('.note-btn[data-note="G"]')).toHaveClass(/active/);
  });
});
