import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3027",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--enable-unsafe-swiftshader"],
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 3027 --strictPort",
    url: "http://127.0.0.1:3027",
    reuseExistingServer: !process.env.CI,
  },
});
