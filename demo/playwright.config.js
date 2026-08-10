// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:8765",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `python3 -m http.server 8765 --directory "${repoRoot}"`,
    url: "http://127.0.0.1:8765/demo/trainer/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
