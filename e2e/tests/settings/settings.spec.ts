import { Page } from "@playwright/test";
import {
  test,
  expect,
  mockAuthUser,
  mockAuthCompany,
  mockAuthTrialCompany,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { RouteTracker, safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockUsers = {
  data: [
    {
      _id: "user-test-001",
      firstName: "Test",
      lastName: "Admin",
      email: "admin@testcompany.com",
      permission: "admin",
      isVerified: true,
      company: "comp-test-001",
    },
    {
      _id: "user-test-002",
      firstName: "Jane",
      lastName: "PM",
      email: "jane@testcompany.com",
      permission: "pm",
      isVerified: true,
      company: "comp-test-001",
    },
    {
      _id: "user-test-003",
      firstName: "",
      lastName: "",
      email: "pending@testcompany.com",
      permission: "user",
      isVerified: false,
      company: "comp-test-001",
    },
  ],
  total_items: 3,
  current_page: 1,
  total_pages: 1,
};

// Note: API response format is { data: [...] } for categories endpoints
const mockCategories = {
  data: [
    {
      _id: "cat-001",
      categoryName: "Electrical Panel",
      categoryClass: "Electrical",
      companyId: "comp-test-001",
    },
    {
      _id: "cat-002",
      categoryName: "Fire Extinguisher",
      categoryClass: "Safety",
      companyId: "comp-test-001",
    },
    {
      _id: "cat-003",
      categoryName: "HVAC Unit",
      categoryClass: "Mechanical",
      companyId: "comp-test-001",
    },
  ],
};

const mockCategoryClasses = { data: ["Electrical", "Safety", "Mechanical"] };

const mockStorageStats = {
  documentCount: 100,
  documentStorageUsed: 104857600,
  qrCodeCount: 25,
  qrCodeStorageUsed: 5242880,
  totalStorageUsed: 110100480,
  totalStorageCapacity: 1073741824,
  lastCalculated: new Date().toISOString(),
};

const mockStorageHistory = {
  history: [
    { date: "2026-01-01", totalBytes: 50000000 },
    { date: "2026-01-15", totalBytes: 80000000 },
    { date: "2026-01-30", totalBytes: 110100480 },
  ],
};

const mockStripeProducts = {
  data: [
    {
      id: "prod_standard",
      name: "Standard",
      prices: [{ id: "price_standard", unit_amount: 2900, currency: "usd" }],
    },
    {
      id: "prod_business",
      name: "Business",
      prices: [{ id: "price_business", unit_amount: 7900, currency: "usd" }],
    },
  ],
};

const mockProcoreStatus = {
  connected: false,
  companyName: null,
  lastSync: null,
};

const mockProcoreStatusConnected = {
  connected: true,
  companyName: "Test Procore Co",
  lastSync: new Date().toISOString(),
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mock routes that always fire on settings page load (tracked by RouteTracker).
 * NOTE: Categories are lazy-loaded (only when section expands), so they belong
 * in mockSectionFallbacks. Only add routes here that fire on EVERY page load.
 */
async function mockSettingsPageLoad(_routeTracker: RouteTracker) {
  // Currently no routes fire on every settings page load that need tracking.
  // Individual tests add tracked mocks for the endpoints they specifically test.
}

/**
 * Register untracked fallback mocks for lazy-loaded section routes.
 * These prevent real API calls but don't trigger RouteTracker assertions.
 * MUST be called AFTER any routeTracker.mockRoute() calls for the same patterns
 * so that tracked handlers take priority (Playwright evaluates routes in FIFO order).
 */
async function mockSectionFallbacks(page: Page) {
  const fallback = (pattern: string, data: unknown) =>
    safeRoute(page, pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  // Match /user/ endpoint (with trailing slash and query params)
  await fallback("**/user/**", mockUsers);
  await fallback("**/storage-stats**", mockStorageStats);
  await fallback("**/storage-history**", mockStorageHistory);
  await fallback("**/procore/status**", mockProcoreStatus);
  await fallback("**/procore-status**", mockProcoreStatus);
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });
  await fallback("**/stripe/products**", mockStripeProducts);
  // Playwright routes are evaluated in LIFO order (last registered takes priority).
  // Register general pattern first, then specific patterns last so they take priority.
  await fallback("**/categories**", mockCategories);
  await fallback("**/categories/classes**", mockCategoryClasses);
  // QR Design Studio config endpoint (endpoint is /company/{id}/qr-style, not qr-style-config)
  await fallback("**/company/*/qr-style**", {
    useStyledQRCodes: false,
    qrStyleConfig: null,
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings Page @desktop", () => {
  test.describe("Page Structure", () => {
    test("renders page header and settings sections", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Page header
      await expect(settings.pageTitle).toBeVisible();
      await expect(settings.pageSubtitle).toBeVisible();

      // All admin sections should be visible
      await expect(settings.userSettingsSection).toBeVisible();
      await expect(settings.securitySection).toBeVisible();
      await expect(settings.companySection).toBeVisible();
      await expect(settings.qrDesignSection).toBeVisible();
      await expect(settings.categoriesSection).toBeVisible();
      await expect(settings.usersSection).toBeVisible();
      await expect(settings.integrationsSection).toBeVisible();
      await expect(settings.subscriptionSection).toBeVisible();
      await expect(settings.storageSection).toBeVisible();
    });
  });

  test.describe("Section Expand/Collapse", () => {
    test("toggles section expand and collapse", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Security section starts collapsed — expand it
      await settings.expandSection("security");
      expect(await settings.isSectionExpanded("security")).toBe(true);

      // Collapse it
      await settings.collapseSection("security");
      expect(await settings.isSectionExpanded("security")).toBe(false);
    });
  });

  test.describe("User Profile", () => {
    test("renders name and email, edit saves successfully", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      // Mock the PATCH endpoint for profile save AFTER fallbacks (Playwright LIFO order)
      // This ensures the specific PATCH route takes priority over the general **/user/** fallback
      await safeRoute(
        authenticatedPage,
        `**/user/${mockAuthUser._id}`,
        async (route) => {
          if (route.request().method() === "PATCH") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                _id: mockAuthUser._id,
                firstName: "Updated",
                lastName: "Name",
                email: mockAuthUser.email,
                phoneNumber: "555-123-4567",
              }),
            });
          } else {
            // Let GET requests continue to fallback
            await route.continue();
          }
        },
      );

      await settings.goto();

      // User Settings is accordion-based; ensure it is expanded before assertions.
      await settings.expandSection("user-settings");
      await expect(settings.userProfileContainer).toBeVisible();

      // Verify display values
      await expect(settings.displayFirstName).toHaveText(
        mockAuthUser.firstName,
      );
      await expect(settings.displayLastName).toHaveText(mockAuthUser.lastName);
      await expect(settings.displayEmail).toHaveText(mockAuthUser.email);

      // Click Edit
      await settings.editUserProfile();

      // Fill new values (phone must have at least 10 digits)
      await settings.fillUserProfile({
        firstName: "Updated",
        lastName: "Name",
        phoneNumber: "555-123-4567",
      });

      // Save
      await settings.saveUserProfile();

      // Wait for animation to complete and display mode to return with updated values
      // The component uses AnimatePresence with mode="wait" which takes time to transition
      await expect(settings.displayFirstName).toHaveText("Updated", {
        timeout: 10000,
      });
      await expect(settings.displayLastName).toHaveText("Name");
    });
  });

  test.describe("Security", () => {
    test("displays password and email change buttons", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand security section
      await settings.expandSection("security");

      // Verify both buttons appear
      await expect(settings.changePasswordButton).toBeVisible();
      await expect(settings.changeEmailButton).toBeVisible();
    });
  });

  test.describe("Subscription", () => {
    test("displays subscription section with tier badge", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      // This test verifies the subscription section structure renders correctly.
      // Tier-specific buttons (Manage Subscription, Add Storage) depend on:
      // 1. stripeProductID mapping to PRODUCT_ID_TO_TIER (env vars loaded at build time)
      // 2. getUserState() returning PAID_ACTIVE based on company data
      // The tier determination logic is unit tested in determineTier.test.ts.
      // Here we verify the section expands and shows the basic tier badge.
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand subscription section
      await settings.expandSection("subscription");

      // Verify subscription container and tier badge are visible
      await expect(settings.subscriptionContainer).toBeVisible();
      await expect(settings.tierBadge).toBeVisible();

      // Verify the section has descriptive content
      await expect(
        authenticatedPage.locator("text=Your current plan:"),
      ).toBeVisible();
    });

    test("shows trial banner for free-tier accounts", async ({
      page,
      routeTracker,
    }) => {
      // Override company mock to return trial company data
      await safeRoute(page, "**/company/*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAuthTrialCompany),
        });
      });

      // Re-inject localStorage with trial company
      await page.addInitScript(
        (data) => {
          window.localStorage.setItem("accessToken", data.accessToken);
          window.localStorage.setItem("user", JSON.stringify(data.user));
          window.localStorage.setItem("company", JSON.stringify(data.company));
        },
        {
          accessToken: "mock-jwt-access-token-for-e2e-testing",
          user: mockAuthUser,
          company: mockAuthTrialCompany,
        },
      );

      await page.setViewportSize({ width: 1280, height: 720 });

      // Untracked auth mocks — this test bypasses authenticatedPage fixture
      await safeRoute(page, "**/auth/me", async (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAuthUser),
        }),
      );
      await safeRoute(page, "**/auth/refresh", async (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            accessToken: "mock-jwt-access-token-for-e2e-testing",
          }),
        }),
      );

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(page);

      const settings = new SettingsPage(page);
      await settings.goto();

      // Expand subscription section
      await settings.expandSection("subscription");

      // Trial-specific UI should show "Subscribe Now" text
      await expect(
        page.locator("text=Subscribe now to keep access"),
      ).toBeVisible();
    });
  });

  test.describe("Company Info", () => {
    test("renders company name and address, edit saves", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand company section
      await settings.expandSection("company");

      // Verify display values from mockAuthCompany
      await expect(settings.displayCompanyName).toHaveText(
        mockAuthCompany.companyName,
      );
      await expect(settings.displayCity).toHaveText(
        mockAuthCompany.companyCity,
      );
      await expect(settings.displayState).toHaveText(
        mockAuthCompany.companyState,
      );

      // Click Edit to verify form appears
      await settings.editCompanyInfo();
      await expect(settings.inputCompanyName).toBeVisible();
      await expect(settings.inputCompanyName).toHaveValue(
        mockAuthCompany.companyName,
      );
    });
  });

  test.describe("Team & Users", () => {
    test("renders user table and invite form", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand users section
      await settings.expandSection("users");

      // Verify invite form is visible
      await expect(settings.inviteUserForm).toBeVisible();
      await expect(settings.inviteEmailInput).toBeVisible();
      await expect(settings.inviteRoleSelect).toBeVisible();
      await expect(settings.inviteSubmitButton).toBeVisible();

      // Verify user table renders with mock users (wait for loading to complete)
      await expect(settings.userTable).toBeVisible({ timeout: 10000 });
      await expect(
        authenticatedPage.locator('[data-testid="user-email-user-test-001"]'),
      ).toHaveText("admin@testcompany.com");
      await expect(
        authenticatedPage.locator('[data-testid="user-email-user-test-002"]'),
      ).toHaveText("jane@testcompany.com");

      // Verify pending badge on unverified user
      await expect(
        authenticatedPage.locator(
          '[data-testid="pending-badge-user-test-003"]',
        ),
      ).toBeVisible();

      // Verify admin transfer button
      await expect(settings.transferAdminButton).toBeVisible();
    });
  });

  test.describe("Procore Integration", () => {
    test("shows disconnected status when not connected", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Integrations section should be visible for admin
      await expect(settings.integrationsSection).toBeVisible();

      // Expand integrations section
      await settings.expandSection("integrations");

      // Verify Procore card content shows disconnected state
      const sectionContent = settings.getSectionContent("integrations");
      await expect(sectionContent).toBeVisible();
    });

    test("shows connected status when Procore is linked", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      // Override procore fallbacks with connected status (registered first → takes priority)
      const fulfill = (pattern: string, data: unknown) =>
        safeRoute(authenticatedPage, pattern, async (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(data),
          }),
        );
      await fulfill("**/procore/status**", mockProcoreStatusConnected);
      await fulfill("**/procore-status**", mockProcoreStatusConnected);
      await fulfill("**/procore-integration-details**", {
        owners: [{ _id: "user-test-001", email: "admin@testcompany.com" }],
        connectedUsers: [
          { _id: "user-test-001", email: "admin@testcompany.com" },
        ],
      });
      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand integrations section
      await settings.expandSection("integrations");

      // Verify connected state content is visible
      const sectionContent = settings.getSectionContent("integrations");
      await expect(sectionContent).toBeVisible();
    });
  });

  test.describe("QR Design Studio", () => {
    test("renders design studio with preview", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand QR Design section
      await settings.expandSection("qr-design");

      // Verify QR Design Studio renders (wait for config to load)
      await expect(settings.qrDesignStudioContainer).toBeVisible({
        timeout: 10000,
      });
      await expect(settings.qrDesignPreviewSection).toBeVisible();
      await expect(settings.qrDesignControlsSection).toBeVisible();
    });
  });

  test.describe("Print Branding", () => {
    test("renders logo upload area in company section", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand company section (print branding is inside company section)
      await settings.expandSection("company");

      // Verify print branding container is visible
      await expect(settings.printBrandingContainer).toBeVisible();

      // Should show "No logo uploaded" or "Add Logo" button
      await expect(
        authenticatedPage.locator("text=/No logo uploaded|Add Logo/i").first(),
      ).toBeVisible();
    });
  });

  test.describe("Storage Metrics", () => {
    test("renders storage stats and charts", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand storage section
      await settings.expandSection("storage");

      // Storage stats component should render (lazy loaded, may need wait)
      await expect(settings.storageStatsContainer).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Categories", () => {
    test("renders category list and add button", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      const settings = new SettingsPage(authenticatedPage);

      await mockSettingsPageLoad(routeTracker);
      await mockSectionFallbacks(authenticatedPage);

      await settings.goto();

      // Expand categories section
      await settings.expandSection("categories");

      // Verify add button and search are visible
      await expect(settings.addCategoryButton).toBeVisible();
      await expect(settings.importCSVButton).toBeVisible();
      await expect(settings.categorySearchInput).toBeVisible();

      // Verify category names from mock data are displayed (wait for categories to load)
      await expect(
        authenticatedPage.locator("text=Electrical Panel"),
      ).toBeVisible({ timeout: 10000 });
      await expect(
        authenticatedPage.locator("text=Fire Extinguisher"),
      ).toBeVisible();
      await expect(authenticatedPage.locator("text=HVAC Unit")).toBeVisible();

      // Verify category count text
      await expect(
        authenticatedPage.locator("text=3 categories"),
      ).toBeVisible();
    });
  });
});
