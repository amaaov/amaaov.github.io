import { test, expect } from "@playwright/test";

test("holding topology fm1 shows a device face with working knobs", async ({ page }) => {
  await page.goto("/demo/holding_topology_fm1/index.html");

  await expect(page.locator("#device")).toBeVisible();
  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("#screen")).toBeVisible();
  await expect(page.locator(".hit.knob")).toHaveCount(8);
  await expect(page.locator(".hit.button")).toHaveCount(14);

  const before = await page.locator("#seed").textContent();
  const play = page.locator('.hit.button[data-control="PLAY"]');
  await play.click();
  await expect.poll(async () => page.locator("#seed").textContent()).not.toBe(before);

  const tempo = page.locator('.hit.knob[data-control="KNOB4"]');
  const box = await tempo.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40);
  await page.mouse.up();
  await expect(page.locator("#status")).toContainText("bpm");
});
