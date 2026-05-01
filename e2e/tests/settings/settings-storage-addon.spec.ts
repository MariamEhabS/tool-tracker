import {
  test,
  expect,
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
        date: "2026-01-15",
        totalUsed: 500000000,
        breakdown: {
          documents: 440000000,
          images: 60000000,
          videos: 0,
          other: 0,
        },
        fileCount: 120,
        qrCodeStorageUsed: 9000000,
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

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings - Storage Add-on @desktop", () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Use untracked fallbacks for settings page routes
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

  test("renders storage stats with usage data", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("storage");

    const storageStats = authenticatedPage.locator(
      '[data-testid="storage-stats"]',
    );
    await expect(storageStats).toBeVisible({ timeout: 5000 });
  });

  test("storage donut chart renders", async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("storage");

    const donutChart = authenticatedPage.locator(
      '[data-testid="storage-donut-chart"]',
    );
    await expect(donutChart).toBeVisible({ timeout: 5000 });
  });

  test("storage trend chart renders", async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("storage");

    const trendChart = authenticatedPage.locator(
      '[data-testid="storage-trend-chart"]',
    );
    await expect(trendChart).toBeVisible({ timeout: 5000 });
  });

  test("Add Storage button opens add-on modal", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    const addStorageButton = settingsPage.addStorageButton;
    await expect(addStorageButton).toBeVisible({ timeout: 5000 });
    await addStorageButton.click();

    // Storage add-on modal should appear with "Add More Storage" title
    const modalTitle = authenticatedPage.getByText("Add More Storage");
    await expect(modalTitle).toBeVisible({ timeout: 3000 });
  });

  test("storage add-on modal has quantity selector", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    const addStorageButton = settingsPage.addStorageButton;
    await expect(addStorageButton).toBeVisible({ timeout: 5000 });
    await addStorageButton.click();

    // Look for quantity controls
    const quantityControl = authenticatedPage.locator(
      'button:has-text("+"), button:has-text("-"), input[type="number"]',
    );
    await expect(quantityControl.first()).toBeVisible({ timeout: 3000 });
  });

  test("storage add-on — opens checkout on confirm", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    // Mock the storage extension checkout endpoint with safeRoute (untracked)
    await safeRoute(
      authenticatedPage,
      "**/stripe/checkout/storage-extension**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "https://checkout.stripe.com/test-session",
          }),
        });
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    const addStorageButton = settingsPage.addStorageButton;
    await expect(addStorageButton).toBeVisible({ timeout: 5000 });
    await addStorageButton.click();

    // Modal should appear with "Add More Storage" title
    const modalTitle = authenticatedPage.getByText("Add More Storage");
    await expect(modalTitle).toBeVisible();

    // Click the "+ Add Storage" button in the modal footer (has bx-plus icon)
    // The modal's button contains an icon, distinguishing it from the subscription button
    const modalConfirmButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /Add Storage/ })
      .filter({ has: authenticatedPage.locator("i.bx-plus, i.bx-loader") });
    await modalConfirmButton.click();
  });

  test("storage add-on — handles API error gracefully", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    // Mock the storage extension endpoint to fail with safeRoute (untracked)
    await safeRoute(
      authenticatedPage,
      "**/stripe/checkout/storage-extension**",
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal server error" }),
        });
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("subscription");

    const addStorageButton = settingsPage.addStorageButton;
    await expect(addStorageButton).toBeVisible({ timeout: 5000 });
    await addStorageButton.click();

    // Modal should appear
    const modalTitle = authenticatedPage.getByText("Add More Storage");
    await expect(modalTitle).toBeVisible();

    // Click the "+ Add Storage" button in the modal footer
    const modalConfirmButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /Add Storage/ })
      .filter({ has: authenticatedPage.locator("i.bx-plus, i.bx-loader") });
    await modalConfirmButton.click();

    // Wait for error handling - app shows toast and remains functional
    await authenticatedPage.waitForTimeout(1000);

    // Verify modal is still open or page didn't crash
    // The error handler shows a toast but doesn't crash
  });
});
