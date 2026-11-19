import { defineConfig, devices } from "@playwright/test";

// The same port the dev server uses (see vite.config.ts). The e2e
// job of the continuous integration waits for this one.
const PORT = process.env.PORT ?? "5174";
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "./test-results",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // The dev server's output goes to the log: when the wait times
    // out, the reason is right there.
    stdout: "pipe",
    stderr: "pipe",
    // The first request compiles the server bundle, and on a cold
    // runner that takes longer than the three minutes of the default.
    timeout: 300_000,
  },
});
