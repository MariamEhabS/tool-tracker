import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  resolvePlaywrightEnvMode,
  resolvePlaywrightServerEnv,
} from "./playwright.env";

/**
 * Playwright configuration for running E2E tests against a REAL backend.
 *
 * Usage:
 *   npx playwright test --config=playwright.real-backend.config.ts
 *
 * Prerequisites:
 *   1. Backend server running at VITE_BACKEND_URL (default: http://localhost:8100)
 *   2. Frontend dev server running at the configured frontend PORT
 *   3. Test data seeded via: npx tsx e2e/seed/seed-test-data.ts
 *   4. .env.test configured with test credentials and IDs
 */

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const envMode = resolvePlaywrightEnvMode("development");
const { baseURL, backendURL, port } = resolvePlaywrightServerEnv(
  frontendRoot,
  envMode,
);
const webServerCommand =
  envMode === "prod-test"
    ? `npm run dev -- --mode prod --port ${port} --strictPort`
    : `npm run dev -- --port ${port} --strictPort`;
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
 * Real Backend E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Only run tests in the real-backend directory
  testDir: "./e2e/tests/real-backend",

  // Run tests sequentially to avoid race conditions with shared data
  fullyParallel: false,
  workers: 1,

  // CI configuration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  // Test timeout - longer for real backend
  timeout: 60000,

  // Expect timeout - longer for real API responses
  expect: {
    timeout: 15000,
  },

  // Reporters
  reporter: [
    ["html", { outputFolder: "playwright-report/real-backend" }],
    ["json", { outputFile: "test-results/real-backend-results.json" }],
    ["list"],
  ],

  // Global settings
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Extra HTTP headers for real backend
    extraHTTPHeaders: {
      "x-test-source": "playwright-real-backend",
    },
  },

  // Browser projects
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 14 Pro"],
      },
    },
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],

  // Web server configuration
  webServer: [
    {
      // Frontend dev server
      command: webServerCommand,
      cwd: frontendRoot,
      env: webServerEnv,
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],

  // Global setup and teardown
  globalSetup: resolve(frontendRoot, "e2e/seed/global-setup.ts"),
  globalTeardown: resolve(frontendRoot, "e2e/seed/global-teardown.ts"),
});
