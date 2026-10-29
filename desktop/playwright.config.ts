import { defineConfig } from "@playwright/test";

// End-to-end tests launch the real Electron app (built output, or the packaged
// exe when CODEFORGE_E2E_EXECUTABLE is set) and drive it like a user would.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
});
