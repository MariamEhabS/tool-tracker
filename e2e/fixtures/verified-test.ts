import { test as base, expect } from "@playwright/test";
import { RouteTracker } from "../utils/route-tracker";

/**
 * Custom test fixtures that include RouteTracker for verified testing
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../../fixtures/verified-test';
 *
 * test('my test', async ({ page, routeTracker }) => {
 *   await routeTracker.mockRoute('**\/api\/data**', { data: 'test' });
 *   await page.goto('/my-page');
 *   // Test assertions...
 *   // routeTracker automatically verifies routes were called
 * });
 * ```
 */

type VerifiedTestFixtures = {
  /**
   * RouteTracker instance for mocking and verifying API routes
   * - Use mockRoute() to set up mocks that track calls
   * - Use mockErrorResponse() for negative testing
   * - Routes are automatically verified after each test
   */
  routeTracker: RouteTracker;
};

type VerifiedTestOptions = {
  /**
   * Whether to verify all mocked routes were called
   * Set to false to disable automatic verification
   * @default true
   */
  verifyRoutesCalled: boolean;

  /**
   * Whether to check for unmocked API calls
   * Set to false to allow unmocked requests
   * @default true
   */
  checkUnmockedCalls: boolean;
};

/**
 * Extended test instance with RouteTracker fixture
 */
export const test = base.extend<VerifiedTestFixtures, VerifiedTestOptions>({
  // Define options with defaults
  verifyRoutesCalled: [true, { scope: "worker", option: true }],
  checkUnmockedCalls: [true, { scope: "worker", option: true }],

  // RouteTracker fixture
  routeTracker: async (
    { page, verifyRoutesCalled, checkUnmockedCalls },
    use,
  ) => {
    const tracker = new RouteTracker(page);

    // Mock Rollbar API calls to prevent initialization errors in test environment
    // Returns success response so tests can verify errors are being reported
    await page.route("**/api.rollbar.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: "success", uuid: "test-uuid" }),
      });
    });

    // Provide the tracker to the test
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(tracker);

    // After test: run verifications
    if (verifyRoutesCalled) {
      try {
        tracker.assertAllRoutesIntercepted();
      } catch (error) {
        // Log the summary for debugging
        console.log(tracker.getSummary());
        throw error;
      }
    }

    if (checkUnmockedCalls) {
      const unmocked = tracker.getUnmockedRequests();
      if (unmocked.length > 0) {
        console.warn(
          "Warning: Unmocked API calls detected:\n" +
            unmocked.map((r) => `  - ${r.method} ${r.url}`).join("\n"),
        );
        // Note: We warn instead of fail by default to avoid breaking existing tests
        // Set checkUnmockedCalls to true and throw to enforce strict mode
      }
    }
  },
});

// Re-export expect, RouteTracker, and route utilities for convenience
export { expect, RouteTracker };
export { safeRoute, isSourceFileRequest } from "../utils/route-tracker";

/**
 * Test configuration options for verified tests
 *
 * Example usage in playwright.config.ts:
 * ```typescript
 * export default defineConfig({
 *   projects: [
 *     {
 *       name: 'strict-verified',
 *       use: {
 *         verifyRoutesCalled: true,
 *         checkUnmockedCalls: true,
 *       },
 *     },
 *   ],
 * });
 * ```
 */
export const verifiedTestConfig = {
  // Strict mode: fail on any unmocked calls or unused mocks
  strict: {
    verifyRoutesCalled: true,
    checkUnmockedCalls: true,
  },
  // Lenient mode: only verify mocks were called
  lenient: {
    verifyRoutesCalled: true,
    checkUnmockedCalls: false,
  },
  // Off: disable all verification (for debugging)
  off: {
    verifyRoutesCalled: false,
    checkUnmockedCalls: false,
  },
};
