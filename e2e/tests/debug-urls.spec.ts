import { test, expect } from "@playwright/test";
import { safeRoute } from "../utils/route-tracker";
import {
  getBackendOrigin,
  getBackendUrl,
  getFrontendBaseUrl,
  isBackendRequestUrl,
} from "../utils/runtime-env";

/**
 * Debug test to capture all network requests made during page navigation.
 * This test does NOT use RouteTracker mocking - it logs actual requests.
 *
 * Purpose: Understand the actual URL patterns used by the app so we can
 * fix mock patterns in other E2E tests.
 *
 * Created by: Task 1 - URL Pattern Investigation
 */

test.describe("URL Pattern Debug", () => {
  const backendUrl = getBackendUrl();
  const backendOrigin = getBackendOrigin();
  const frontendBaseUrl = getFrontendBaseUrl();

  test("captures all network requests on inspection page", async ({ page }) => {
    const requests: Array<{
      url: string;
      method: string;
      resourceType: string;
    }> = [];

    // Listen for ALL requests (not just API)
    page.on("request", (request) => {
      const url = request.url();
      requests.push({
        url: url,
        method: request.method(),
        resourceType: request.resourceType(),
      });
    });

    // Navigate to an inspection page
    // Using a test QR code ID - the page will fail to load data but we'll see the URLs
    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr");

    // Wait a bit for all requests to be made
    await page.waitForTimeout(3000);

    // Log all captured requests
    console.log("\n========================================");
    console.log("CAPTURED NETWORK REQUESTS");
    console.log("========================================\n");

    // Filter for TRUE API requests (to the configured backend origin)
    const backendRequests = requests.filter((r) => isBackendRequestUrl(r.url));

    console.log(`BACKEND API REQUESTS (${backendOrigin}):`);
    console.log("--------------------------------------------");
    if (backendRequests.length === 0) {
      console.log("  (none detected - backend may not be running)");
    } else {
      backendRequests.forEach((r) => {
        console.log(`[${r.method}] ${r.url}`);
      });
    }

    // Filter for XHR/Fetch requests (these are API calls regardless of port)
    const xhrRequests = requests.filter(
      (r) => r.resourceType === "xhr" || r.resourceType === "fetch",
    );

    console.log("\n\nXHR/FETCH REQUESTS:");
    console.log("--------------------");
    xhrRequests.forEach((r) => {
      console.log(`[${r.method}] ${r.url}`);
    });

    // Document requests (page navigation)
    const docRequests = requests.filter((r) => r.resourceType === "document");
    console.log("\n\nDOCUMENT REQUESTS:");
    console.log("-------------------");
    docRequests.forEach((r) => {
      console.log(`[${r.method}] ${r.url}`);
    });

    console.log("\n========================================\n");

    // This test is for debugging - it always passes
    expect(true).toBe(true);
  });

  test("captures requests on dashboard/home page", async ({ page }) => {
    const requests: Array<{
      url: string;
      method: string;
      resourceType: string;
    }> = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        !url.includes(".js") &&
        !url.includes(".css") &&
        !url.includes(".woff") &&
        !url.includes(".png") &&
        !url.includes(".svg") &&
        !url.includes(".ico")
      ) {
        requests.push({
          url: url,
          method: request.method(),
          resourceType: request.resourceType(),
        });
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    console.log("\n========================================");
    console.log("HOME PAGE REQUESTS");
    console.log("========================================\n");

    const apiRequests = requests.filter(
      (r) =>
        r.url.includes("/api/") ||
        r.url.includes("/procore/") ||
        r.url.includes("/aggregation/") ||
        r.url.includes("/auth/") ||
        isBackendRequestUrl(r.url),
    );

    apiRequests.forEach((r) => {
      console.log(`[${r.method}] ${r.url}`);
    });

    console.log("\n========================================\n");

    expect(true).toBe(true);
  });

  test("captures requests with mock routes active", async ({ page }) => {
    const allRequests: Array<{
      url: string;
      method: string;
      resourceType: string;
      wasRouted: boolean;
    }> = [];

    // Set up mock routes similar to the real tests
    let aggregationCalled = false;
    let inspectionCalled = false;

    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        aggregationCalled = true;
        console.log(`\n>>> INTERCEPTED aggregation: ${route.request().url()}`);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              company: { _id: "comp123", editProcoreItemsAllowed: true },
              project: { _id: "proj123", projectName: "Test Project" },
            },
          ]),
        });
      },
    );

    await safeRoute(page, "**/procore/inspection**", async (route) => {
      inspectionCalled = true;
      console.log(`\n>>> INTERCEPTED inspection: ${route.request().url()}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            procoreItemID: "INSP-001",
            name: "Fire Safety Inspection",
            status: "Open",
          },
        ]),
      });
    });

    // Listen for ALL requests
    page.on("request", (request) => {
      allRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        wasRouted: false,
      });
    });

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr");
    await page.waitForTimeout(5000);

    console.log("\n========================================");
    console.log("MOCK ROUTE INTERCEPTION RESULTS");
    console.log("========================================\n");

    console.log(`Aggregation route called: ${aggregationCalled}`);
    console.log(`Inspection route called: ${inspectionCalled}`);

    // Filter for potential API requests
    const apiLike = allRequests.filter(
      (r) =>
        r.resourceType === "xhr" ||
        r.resourceType === "fetch" ||
        isBackendRequestUrl(r.url) ||
        (r.url.includes("/procore/") && !r.url.includes("/src/")) ||
        (r.url.includes("/aggregation/") && !r.url.includes("/src/")),
    );

    console.log("\nXHR/FETCH/API requests made:");
    if (apiLike.length === 0) {
      console.log("  (none detected - app may not be making API calls)");
      console.log("\n  POSSIBLE REASONS:");
      console.log("    - React Query is not triggering fetches");
      console.log("    - The route/component guard is blocking");
      console.log("    - Auth state is preventing API calls");
      console.log("    - Component is not rendering");
    } else {
      apiLike.forEach((r) => {
        console.log(`  [${r.method}] [${r.resourceType}] ${r.url}`);
      });
    }

    console.log(`\nTotal requests: ${allRequests.length}`);

    console.log("\n========================================\n");

    expect(true).toBe(true);
  });

  test("analyzes URL structure patterns", async ({ page: _page }) => {
    /**
     * Based on code analysis, here are the expected URL patterns:
     *
     * The axios instance is configured with:
     * - baseURL: import.meta.env.VITE_BACKEND_URL (e.g., ${backendOrigin})
     *
     * API endpoints make relative requests like:
     * - GET /procore/inspections?qrCodeId=xxx&companyId=xxx&projectId=xxx
     * - GET /aggregation/qr-company-project/{qrCodeId}
     *
     * So the FULL URL will be:
     * - ${backendOrigin}/procore/inspections?qrCodeId=...
     * - ${backendOrigin}/aggregation/qr-company-project/...
     *
     * The current mock patterns like `**\/procore\/inspections**` use glob
     * patterns that should match, but let's verify the exact format.
     */

    console.log("\n========================================");
    console.log("URL PATTERN ANALYSIS (from code)");
    console.log("========================================\n");

    console.log(`VITE_BACKEND_URL: ${backendUrl}`);
    console.log(`Frontend runs on: ${frontendBaseUrl}\n`);

    console.log("Expected API call structure:");
    console.log("  axios.get('/procore/inspections', { params: {...} })");
    console.log(`  => Full URL: ${backendOrigin}/procore/inspections?...\n`);

    console.log("Current mock patterns in tests:");
    console.log("  **/procore/inspections**");
    console.log("  **/aggregation/qr-company-project**\n");

    console.log("These patterns SHOULD match because:");
    console.log(`  ** matches any path segment (including ${backendOrigin})`);
    console.log(`  So **/procore/** matches ${backendOrigin}/procore/...\n`);

    console.log("POTENTIAL ISSUES:");
    console.log(
      "  1. If VITE_BACKEND_URL is not set, axios uses relative URLs",
    );
    console.log(
      `  2. In that case, requests go to ${frontendBaseUrl}/procore/...`,
    );
    console.log("  3. Patterns still match, but Vite may proxy differently\n");

    console.log("CHECKING: Does Vite have a proxy configured?");
    console.log("  Answer from vite.config.ts: NO PROXY CONFIGURED");
    console.log("  Requests go directly to VITE_BACKEND_URL\n");

    expect(true).toBe(true);
  });

  test("check browser console and environment", async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on("pageerror", (err) => {
      consoleErrors.push(`PAGE ERROR: ${err.message}`);
    });

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr");
    await page.waitForTimeout(5000);

    // Try to get the backend URL from the app
    const envInfo = await page.evaluate(() => {
      // Try to access import.meta.env if available
      try {
        const meta = (
          window as unknown as { __VITE_ENV__?: Record<string, unknown> }
        ).__VITE_ENV__;
        return {
          viteEnv: meta,
          windowKeys: Object.keys(window).filter(
            (k) => k.includes("VITE") || k.includes("env"),
          ),
        };
      } catch {
        return { error: "Could not access env" };
      }
    });

    console.log("\n========================================");
    console.log("BROWSER CONSOLE OUTPUT");
    console.log("========================================\n");

    console.log("ERRORS:");
    if (consoleErrors.length === 0) {
      console.log("  (no errors)");
    } else {
      consoleErrors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
      if (consoleErrors.length > 10) {
        console.log(`  ... and ${consoleErrors.length - 10} more errors`);
      }
    }

    console.log("\nENVIRONMENT INFO:", JSON.stringify(envInfo, null, 2));

    console.log("\nRELEVANT LOGS:");
    const relevantLogs = consoleLogs.filter(
      (l) =>
        l.includes("fetch") ||
        l.includes("API") ||
        l.includes("error") ||
        l.includes("Error") ||
        l.includes("localhost") ||
        l.includes("BACKEND"),
    );
    if (relevantLogs.length === 0) {
      console.log("  (none matching criteria)");
    } else {
      relevantLogs.slice(0, 20).forEach((l) => console.log(`  ${l}`));
    }

    console.log("\n========================================\n");

    expect(true).toBe(true);
  });

  test("intercept ALL requests and log backend calls", async ({ page }) => {
    const interceptedUrls: string[] = [];

    // Intercept EVERYTHING
    await safeRoute(page, "**/*", async (route) => {
      const url = route.request().url();
      interceptedUrls.push(url);

      // Check if this is an API request we should mock
      if (isBackendRequestUrl(url)) {
        console.log(`\n>>> BACKEND REQUEST: ${url}`);

        if (url.includes("/aggregation/qr-company-project")) {
          console.log("    -> Returning mock aggregation data");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                company: {
                  _id: "comp123",
                  editProcoreItemsAllowed: true,
                  procoreAccess: { accessToken: "mock", refreshToken: "mock" },
                  procoreCompanyID: 12345,
                },
                project: { _id: "proj123", projectName: "Test Project" },
              },
            ]),
          });
          return;
        }

        if (url.includes("/procore/inspections")) {
          console.log("    -> Returning mock inspection data");
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                procoreItemID: "INSP-001",
                name: "Fire Safety Inspection",
                status: "Open",
              },
            ]),
          });
          return;
        }

        // Unknown API call - let it fail but log it
        console.log("    -> UNKNOWN API CALL - continuing (will fail)");
      }

      await route.continue();
    });

    await page.goto("/tools/inspection/INSP-001?qrCodeId=test-qr");
    await page.waitForTimeout(8000);

    console.log("\n========================================");
    console.log("ALL INTERCEPTED URLs CONTAINING BACKEND PORT");
    console.log("========================================\n");

    const backendUrls = interceptedUrls.filter((u) => isBackendRequestUrl(u));

    if (backendUrls.length === 0) {
      console.log("NO BACKEND REQUESTS DETECTED!");
      console.log("\nThis means the app is NOT making API calls.");
      console.log("The component may be stuck in a loading state or blocked.");
    } else {
      backendUrls.forEach((u) => console.log(u));
    }

    console.log("\n========================================\n");

    expect(true).toBe(true);
  });
});
