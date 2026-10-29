import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3123);

// Uses the Microsoft Edge that ships with Windows (no browser download needed).
// Set E2E_BROWSER_CHANNEL=chrome or chromium on other systems.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Edge"],
    channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
