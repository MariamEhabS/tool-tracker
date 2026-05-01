import { defineConfig, devices } from "@playwright/test";
import { dirname } from "path";
import { fileURLToPath } from "url";
import {
  resolvePlaywrightEnvMode,
  resolvePlaywrightServerEnv,
} from "./playwright.env";

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const envMode = resolvePlaywrightEnvMode("test");
const { baseURL, backendURL, port } = resolvePlaywrightServerEnv(
  frontendRoot,
  envMode,
);
const webServerCommand =
  envMode === "prod-test"
    ? `npm run dev -- --mode prod --port ${port} --strictPort`
    : `npm run dev:test -- --port ${port} --strictPort`;
const webServerEnv = {
  ...process.env,
  FRONTEND_PORT: port,
  PORT: port,
  BASE_URL: baseURL,
  FRONTEND_BASE_URL: baseURL,
  VITE_BACKEND_URL: backendURL,
  PLAYWRIGHT_BACKEND_URL: backendURL,
};

process.env.FRONTEND_PORT = port;
process.env.PORT = port;
process.env.BASE_URL = baseURL;
process.env.FRONTEND_BASE_URL = baseURL;
process.env.VITE_BACKEND_URL = backendURL;
process.env.PLAYWRIGHT_BACKEND_URL = backendURL;

/**
 * Playwright configuration for Taliho mobile web app E2E tests.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e/tests",
  testIgnore: ["e2e/tests/real-backend/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: [["html"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 14 Pro"],
        // Disable video on Mobile Safari due to WebKit video recording issues on Windows
        video: "off",
      },
      grepInvert: /@desktop/,
      // Limit parallel workers for Mobile Safari to prevent timeout issues
      // caused by WebKit resource contention during parallel test execution
      fullyParallel: false,
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
      grepInvert: /@desktop/,
    },
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
      grep: /@desktop/,
    },
  ],
  webServer: {
    command: webServerCommand,
    cwd: frontendRoot,
    env: webServerEnv,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
