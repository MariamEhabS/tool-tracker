import { test as verifiedTest, expect, RouteTracker } from "./verified-test";
import type { Page } from "@playwright/test";
import {
  mockGroups,
  mockCategories,
  mockCompanyUsers,
  mockDashboardStats,
  mockActivityLog,
  mockStorageStats,
  mockStripeProducts,
  mockStorageHistory,
} from "./test-data";
import { getE2EStripeProductIds } from "../utils/e2e-env";

// Re-export commonly used mock data for convenient test imports
export {
  mockGroups,
  mockCategories,
  mockCompanyUsers,
  mockDashboardStats,
  mockActivityLog,
  mockStorageStats,
  mockStripeProducts,
  mockStorageHistory,
};

// ============================================================================
// MOCK AUTH DATA
// ============================================================================

/**
 * Mock authenticated user with admin permissions.
 * Tests can import this to reference user data in assertions.
 */
export const mockAuthUser = {
  _id: "user-test-001",
  firstName: "Test",
  lastName: "Admin",
  email: "admin@testcompany.com",
  permission: "admin" as const,
  isVerified: true,
  company: "comp-test-001",
  companyId: "comp-test-001",
};

// Keep product IDs aligned with .env.test to avoid paid users being
// misclassified as trial users during tier detection.
export const E2E_STRIPE_PRODUCT_IDS = getE2EStripeProductIds();

/**
 * Mock company data for authenticated tests.
 * Represents a paid account with Procore integration enabled (Business tier).
 *
 * NOTE: stripeProductID must match a valid product ID from .env.test
 * (VITE_STRIPE_PRODUCT_ID_BUSINESS) for tier determination to work correctly.
 */
export const mockAuthCompany = {
  _id: "comp-test-001",
  companyName: "Test Company",
  companyAddress: "456 Test Ave",
  companyCity: "San Francisco",
  companyState: "CA",
  companyZIP: "94102",
  companyWebsite: "https://testcompany.com",
  companyIndustry: "Construction",
  companyLogo: "",
  companyLogoAWSId: "",
  companyLogoAWSKey: "",
  procoreAccess: { refreshToken: "", somethingElse: "" },
  procoreCompanyID: 0,
  freeTrialActive: false,
  paidAccount: true,
  subscriptionCanceled: false,
  stripeCustomerID: "cus_test123",
  stripeSubscriptionID: "sub_test123",
  // Use the actual Business tier product ID from .env.test for proper tier determination
  stripeProductID: E2E_STRIPE_PRODUCT_IDS.BUSINESS,
  deactivated: false,
  // NOTE: companyData must be undefined/null, not empty object {}
  // The companySlice reducer checks `if (payload.companyData)` and if truthy,
  // spreads companyData instead of the full payload. An empty {} is truthy!
  companyData: undefined,
  editProcoreItemsAllowed: true,
  qrCodesCount: 25,
  documentsCount: 100,
  qrCodeStorageUsed: 5242880,
  documentStorageUsed: 104857600,
  qrCodeStorageCapacity: 52428800,
  documentStorageCapacity: 1073741824,
  // Add timestamps to indicate this is an established paid account
  // Without createdAt, trial calculations may behave unexpectedly
  createdAt: "2024-01-01T00:00:00.000Z",
  subscribedAt: "2024-01-15T00:00:00.000Z",
};

/**
 * Mock company variant: free trial account.
 * Use this in tests that need to verify trial-specific UI (banners, upgrade prompts, etc.).
 * Trial is set to start recently (today minus 5 days) so it appears active with ~9 days remaining.
 */
export const mockAuthTrialCompany = {
  ...mockAuthCompany,
  _id: "comp-trial-001",
  companyName: "Trial Company",
  freeTrialActive: true,
  paidAccount: false,
  stripeCustomerID: "",
  stripeSubscriptionID: "",
  stripeProductID: "",
  // Set createdAt to a recent date so trial is active (14-day trial period)
  createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  subscribedAt: undefined,
};

/**
 * Mock JWT tokens for authenticated tests.
 */
export const mockAuthTokens = {
  accessToken: "mock-jwt-access-token-for-e2e-testing",
  refreshToken: "mock-jwt-refresh-token-for-e2e-testing",
};

// ============================================================================
// AUTHENTICATED TEST FIXTURE
// ============================================================================

type AuthenticatedTestFixtures = {
  /**
   * A Playwright Page pre-configured with:
   * - Desktop viewport (1280x720)
   * - localStorage populated with mock JWT tokens, user, and company data
   * - Auth API endpoints mocked (GET /auth/me, POST /auth/refresh, GET /company/*)
   *
   * Usage:
   * ```typescript
   * import { test, expect, mockAuthUser } from '../fixtures/authenticated-test';
   *
   * test.describe('Dashboard @desktop', () => {
   *   test('renders stats', async ({ authenticatedPage, routeTracker }) => {
   *     await routeTracker.mockRoute('** /dashboard-stats**', mockStats);
   *     await authenticatedPage.goto('/dashboard');
   *     // assertions...
   *   });
   * });
   * ```
   */
  authenticatedPage: Page;
};

/**
 * Extended test instance with authenticated page fixture.
 *
 * Provides both `authenticatedPage` (from this fixture) and `routeTracker`
 * (from the verified-test base). Tests use `routeTracker` for page-specific
 * API mocks and `authenticatedPage` for navigation and interaction.
 */
export const test = verifiedTest.extend<AuthenticatedTestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // ---- Auth API mocks ----
    // These are mocked directly on page.route() (not via routeTracker) because
    // they are infrastructure routes that may or may not be called depending
    // on the specific test. Using routeTracker would cause verification
    // failures for tests that don't trigger these endpoints.

    await page.route("**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthUser),
      });
    });

    await page.route("**/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: mockAuthTokens.accessToken }),
      });
    });

    // Procore fetch/access gate endpoint used by /procore/fetch and related flows.
    // Default to an active, connected Business-tier integration so tests can
    // focus on page-specific behavior and override this per-test when needed.
    await page.route(
      /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})\/procore-integration-details(?:\?.*)?$/i,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            connected: true,
            connectedUsers: [],
            syncHealth: "healthy",
            accessStatus: {
              allowed: true,
              reason: "paid_subscription",
            },
          }),
        });
      },
    );

    // Match company details endpoint: /company/{companyId} where companyId looks like
    // "comp-test-001" or a MongoDB ObjectId. This pattern avoids intercepting nested
    // company routes like /company/users or /company/qr-style-config which need
    // to be mocked individually by tests.
    await page.route(
      /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAuthCompany),
        });
      },
    );

    // Common background endpoints used across many authenticated screens.
    // Keep lightweight defaults so tests only need to override when behavior
    // under test depends on these responses.
    await page.route("**/aggregation/all-projects/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            _id: "proj-test-001",
            projectName: "Test Project",
            projectStatus: "active",
            archived: false,
            qrCodes: 0,
          },
        ]),
      });
    });

    await page.route("**/procore/inspection-templates**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // ---- Desktop viewport ----
    await page.setViewportSize({ width: 1280, height: 720 });

    // ---- localStorage injection ----
    // addInitScript runs before any page JavaScript on each navigation,
    // ensuring auth state is present when the React app initializes.
    await page.addInitScript(
      (data) => {
        window.localStorage.setItem("accessToken", data.accessToken);
        window.localStorage.setItem("user", JSON.stringify(data.user));
        window.localStorage.setItem("company", JSON.stringify(data.company));
      },
      {
        accessToken: mockAuthTokens.accessToken,
        user: mockAuthUser,
        company: mockAuthCompany,
      },
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

// Re-export expect and RouteTracker for convenience
export { expect, RouteTracker };
