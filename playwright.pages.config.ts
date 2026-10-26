import { defineConfig } from "@playwright/test";
const path =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/travel-plan-central-america";
export default defineConfig({
  testDir: "tests/pages",
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:4173${path}/`,
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run preview:pages",
    url: `http://127.0.0.1:4173${path}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
