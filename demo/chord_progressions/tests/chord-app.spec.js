const { test, expect } = require("@playwright/test");

// Shared function to catch console errors
async function catchConsoleErrors(page, testFn) {
  const errors = [];
  const logs = [];

  // Set up console listeners
  page.on("console", (msg) => {
    const text = msg.text();
    logs.push(`${msg.type()}: ${text}`);

    if (msg.type() === "error" || text.match(/error/i)) {
      errors.push(text);
      console.error(`\x1b[31m${text}\x1b[0m`); // Red color for errors
    } else {
      console.log(`\x1b[2m${text}\x1b[0m`); // Dimmed color for regular logs
    }
  });

  // Execute the test function
  await testFn();

  // Print summary if there were errors
  if (errors.length > 0) {
    console.error("\x1b[31m=== Console Errors ===\x1b[0m");
    errors.forEach(error => console.error(`\x1b[31m${error}\x1b[0m`));
  }

  // Assert no errors occurred
  expect(errors, "No console errors should occur during test").toHaveLength(0);
}

test.describe("Chord Progressions App", () => {
  test.beforeEach(async ({ page }) => {
    // Set a larger viewport to ensure all elements are visible
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to the app and wait for it to load
    await page.goto("/demo/chord_progressions/index.html");
    await page.waitForSelector(".chord-container");

    // Expand the sidebar to ensure controls are visible
    const sidebarTrigger = page.locator(".sidebar-trigger");
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
    }
  });

  test("should load the application without errors", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Check if main elements are present
      await expect(page.locator(".chord-container")).toBeVisible();
      await expect(page.locator(".note-selector")).toBeVisible();
      await expect(page.locator(".scale-selector")).toBeVisible();

      // Wait a bit to catch any initialization errors
      await page.waitForTimeout(1000);
    });
  });

  test("should be able to click chord hexagons", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Wait for chords to be present
      await page.waitForSelector(".chord");

      // Get all chord elements
      const chords = await page.locator(".chord").all();
      expect(chords.length).toBeGreaterThan(0);

      // Click the first chord and verify it becomes active
      await chords[0].click();
      await expect(chords[0]).toHaveClass(/playing/);
    });
  });

  test("should be able to change control values", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Test changing octave control
      const octaveControl = await page.locator("#oscillator-octave");
      await expect(octaveControl).toBeVisible();

      // Get initial value
      const initialValue = await octaveControl.inputValue();

      // Change value
      await octaveControl.fill("1");
      await octaveControl.dispatchEvent("input");

      // Verify value changed
      await expect(octaveControl).toHaveValue("1");
    });
  });

  test("should handle root note changes", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Find root note buttons
      const rootNotes = await page.locator(".note-btn").all();
      expect(rootNotes.length).toBeGreaterThan(0);

      // Test clicking each root note button
      for (const button of rootNotes) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect(button).toHaveClass(/active/);

        // Wait a bit to ensure note change is processed
        await page.waitForTimeout(100);
      }
    });
  });

  test("should handle scale changes", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Find scale buttons
      const scaleButtons = await page.locator(".scale-btn").all();
      expect(scaleButtons.length).toBeGreaterThan(0);

      // Test clicking each scale button
      for (const button of scaleButtons) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect(button).toHaveClass(/active/);

        // Wait a bit to ensure scale change is processed
        await page.waitForTimeout(100);
      }
    });
  });

  test("should handle progression pattern changes", async ({ page }) => {
    await catchConsoleErrors(page, async () => {
      // Find progression pattern buttons
      const progressionButtons = await page.locator(".prog-btn").all();
      expect(progressionButtons.length).toBeGreaterThan(0);

      // Test clicking each progression button
      for (const button of progressionButtons) {
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect(button).toHaveClass(/active/);

        // Wait a bit to ensure progression change is processed
        await page.waitForTimeout(100);

        // Verify chords are still present after pattern change
        const chords = await page.locator(".chord").all();
        expect(chords.length).toBeGreaterThan(0);
      }
    });
  });
});
