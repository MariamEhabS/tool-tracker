import {
  test,
  expect,
  mockAuthTrialCompany,
  mockCompanyUsers,
  mockStorageStats,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { safeRoute } from "../../utils/route-tracker";

// Mock storage history in the proper backend format
const mockStorageHistoryBackend = {
  success_message: "Storage history fetched",
  data: {
    companyId: "comp-test-001",
    currentUsage: {
      totalUsed: 536870912,
      documentStorageUsed: 536870912,
      qrCodeStorageUsed: 10485760,
      documentStorageCapacity: 10737418240,
      qrCodeStorageCapacity: 5368709120,
    },
    history: [
      {
        date: "2026-01-01",
        totalUsed: 450000000,
        breakdown: {
          documents: 400000000,
          images: 50000000,
          videos: 0,
          other: 0,
        },
        fileCount: 100,
        qrCodeStorageUsed: 8000000,
      },
      {
        date: "2026-01-29",
        totalUsed: 536870912,
        breakdown: {
          documents: 480000000,
          images: 56870912,
          videos: 0,
          other: 0,
        },
        fileCount: 142,
        qrCodeStorageUsed: 10485760,
      },
    ],
  },
};

test.describe("Settings Subscription @desktop", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    settingsPage = new SettingsPage(authenticatedPage);

    // Use untracked fallbacks for settings page routes that may or may not be called
    // depending on the specific test. These are NOT tracked by routeTracker.
    const fallback = (pattern: string, data: unknown) =>
      safeRoute(authenticatedPage, pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      });

    await fallback("**/categories*", { data: [] });
    await fallback("**/categories/classes*", { data: [] });
    await fallback("**/storage-stats**", mockStorageStats);
    await fallback("**/procore/status**", { connected: false });
    await fallback("**/procore-status**", { connected: false });
    await fallback("**/procore-integration-details**", {
      owners: [],
      connectedUsers: [],
    });
    await fallback("**/user**", mockCompanyUsers);
    await fallback("**/activity-log**", { logs: [], total: 0 });
    await fallback("**/storage-history**", mockStorageHistoryBackend);
    await fallback("**/stripe/products**", { data: [] });
    await fallback("**/company/*/qr-style**", {
      useStyledQRCodes: false,
      qrStyleConfig: null,
    });
  });

  // ==========================================================================
  // PAID ACCOUNT
  // ==========================================================================

  test("Manage Subscription button is visible for paid accounts", async () => {
    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    await expect(settingsPage.subscriptionContainer).toBeVisible();
    await expect(settingsPage.tierBadge).toBeVisible();
    await expect(settingsPage.manageSubscriptionButton).toBeVisible();
  });

  test("Manage Subscription calls Stripe billing portal API for paid users", async ({
    authenticatedPage,
  }) => {
    // Mock the Stripe billing portal endpoint
    let billingPortalCalled = false;
    await safeRoute(
      authenticatedPage,
      "**/stripe/billing-portal/sessions**",
      async (route) => {
        billingPortalCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "https://billing.stripe.com/test-portal",
          }),
        });
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    // Click manage subscription - for paid users this calls Stripe billing portal API
    await settingsPage.manageSubscriptionButton.click();

    // Wait for the API call to complete
    await authenticatedPage.waitForTimeout(500);

    // Verify the billing portal API was called
    expect(billingPortalCalled).toBe(true);
  });

  test("trial user Subscribe opens plan selection modal", async ({
    authenticatedPage,
  }) => {
    // Override company mock with trial company
    await safeRoute(authenticatedPage, "**/company/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthTrialCompany),
      });
    });

    // Re-inject trial company into localStorage
    await authenticatedPage.addInitScript((trialCompany) => {
      window.localStorage.setItem("company", JSON.stringify(trialCompany));
    }, mockAuthTrialCompany);

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    // For trial users, click the Subscribe button in the trial banner
    const subscribeButton = authenticatedPage.getByRole("button", {
      name: /Subscribe Now/i,
    });
    await subscribeButton.first().click();

    // Plan selection modal should appear with plan options
    // Use more specific selectors - look for the plan headings or prices
    await expect(authenticatedPage.getByText("Choose Your Plan")).toBeVisible();
    await expect(authenticatedPage.getByText("$29")).toBeVisible(); // Standard price
    await expect(authenticatedPage.getByText("$69")).toBeVisible(); // Professional price
    await expect(authenticatedPage.getByText("$189")).toBeVisible(); // Business price

    // Should show Monthly/Annual toggle
    await expect(
      authenticatedPage.getByRole("button", { name: /Monthly/i }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: /Annual/i }),
    ).toBeVisible();
  });

  test("Add Storage button is visible for paid accounts", async () => {
    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    await expect(settingsPage.addStorageButton).toBeVisible();
  });

  test("Add Storage opens storage add-on modal with quantity selector", async ({
    authenticatedPage,
  }) => {
    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    await settingsPage.addStorageButton.click();

    // Storage add-on modal should show quantity controls
    await expect(
      authenticatedPage.getByText("+50 GB document storage"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("+10 GB QR code storage"),
    ).toBeVisible();
  });

  // ==========================================================================
  // TRIAL ACCOUNT
  // ==========================================================================

  test("trial account shows Subscribe button instead of Manage", async ({
    authenticatedPage,
  }) => {
    // Override company mock with trial company
    await safeRoute(authenticatedPage, "**/company/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthTrialCompany),
      });
    });

    // Re-inject trial company into localStorage
    await authenticatedPage.addInitScript((trialCompany) => {
      window.localStorage.setItem("company", JSON.stringify(trialCompany));
    }, mockAuthTrialCompany);

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    // Trial account should show subscribe button (either in banner or as standalone button)
    // The banner shows "Subscribe Now" button, while the standalone has data-testid="subscribe-button"
    const subscribeButton = authenticatedPage.getByRole("button", {
      name: /Subscribe Now|Subscribe to Continue/i,
    });
    await expect(subscribeButton.first()).toBeVisible();
  });
});
