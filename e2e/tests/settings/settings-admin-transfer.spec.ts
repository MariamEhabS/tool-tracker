import {
  test,
  expect,
  mockStorageStats,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import {
  mockCompanyUsers,
  mockCompanyUsersApiResponse,
  mockAdminTransferSuccess,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockPMUser = mockCompanyUsers.users[1]; // pm@testcompany.com

// ============================================================================
// HELPER: Setup common fallback mocks for all admin transfer tests
// ============================================================================

async function setupFallbackMocks(page: import("@playwright/test").Page) {
  const fallback = (pattern: string, data: unknown) =>
    safeRoute(page, pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  await fallback("**/user/**", mockCompanyUsersApiResponse);
  await fallback("**/categories*", { data: [] });
  await fallback("**/categories/classes*", { data: [] });
  await fallback("**/storage-stats**", mockStorageStats);
  await fallback("**/procore/status**", { connected: false });
  await fallback("**/procore-status**", { connected: false });
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });
  await fallback("**/activity-log**", { logs: [], total: 0 });
  await fallback("**/storage-history**", { history: [] });
  await fallback("**/stripe/products**", { data: [] });
  await fallback("**/company/*/qr-style**", {
    useStyledQRCodes: false,
    qrStyleConfig: null,
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings - Admin Transfer @desktop", () => {
  test("Transfer Admin button opens transfer modal", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    const transferButton = settingsPage.transferAdminButton;
    await expect(transferButton).toBeVisible({ timeout: 5000 });
    await transferButton.click();

    // Admin transfer modal/panel should appear
    const transferWarning = authenticatedPage.locator(
      '[data-testid="admin-transfer-warning"]',
    );
    await expect(transferWarning).toBeVisible({ timeout: 3000 });
  });

  test("transfer modal shows eligible users with radio buttons", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    // User list should appear
    const userList = authenticatedPage.locator(
      '[data-testid="admin-transfer-user-list"]',
    );
    await expect(userList).toBeVisible({ timeout: 3000 });

    // PM user should be listed (verified, non-admin)
    const pmUserRow = authenticatedPage.locator(
      `[data-testid="admin-transfer-user-${mockPMUser._id}"]`,
    );
    await expect(pmUserRow).toBeVisible();

    // Pending (unverified) user should NOT be listed
    const pendingUserRow = authenticatedPage.locator(
      `[data-testid="admin-transfer-user-user-test-003"]`,
    );
    await expect(pendingUserRow).not.toBeVisible();

    // Radio button for PM user
    const pmRadio = authenticatedPage.locator(
      `[data-testid="admin-transfer-radio-${mockPMUser._id}"]`,
    );
    await expect(pmRadio).toBeVisible();
  });

  test("confirm button is disabled without user selection", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    const confirmButton = authenticatedPage.locator(
      '[data-testid="admin-transfer-confirm"]',
    );
    await expect(confirmButton).toBeVisible({ timeout: 3000 });
    await expect(confirmButton).toBeDisabled();
  });

  test("transfer admin — happy path", async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    // Mock the switch-admin endpoint specifically
    await safeRoute(
      authenticatedPage,
      "**/user/switch-admin/**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAdminTransferSuccess),
        });
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    // Select the PM user
    const pmRadio = authenticatedPage.locator(
      `[data-testid="admin-transfer-radio-${mockPMUser._id}"]`,
    );
    await expect(pmRadio).toBeVisible({ timeout: 3000 });
    await pmRadio.click();

    // Confirm button should now be enabled
    const confirmButton = authenticatedPage.locator(
      '[data-testid="admin-transfer-confirm"]',
    );
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for the transfer operation to complete
    await authenticatedPage.waitForTimeout(500);
  });

  test("transfer admin — cancel closes modal", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    const transferWarning = authenticatedPage.locator(
      '[data-testid="admin-transfer-warning"]',
    );
    await expect(transferWarning).toBeVisible({ timeout: 3000 });

    // Click cancel
    const cancelButton = authenticatedPage.locator(
      '[data-testid="admin-transfer-cancel"]',
    );
    await cancelButton.click();

    // Transfer modal should close
    await expect(transferWarning).not.toBeVisible({ timeout: 5000 });
  });

  test("transfer admin — API failure shows error", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    // Mock the switch-admin endpoint to return an error
    await safeRoute(
      authenticatedPage,
      "**/user/switch-admin/**",
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal server error" }),
        });
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    const pmRadio = authenticatedPage.locator(
      `[data-testid="admin-transfer-radio-${mockPMUser._id}"]`,
    );
    await expect(pmRadio).toBeVisible({ timeout: 3000 });
    await pmRadio.click();

    const confirmButton = authenticatedPage.locator(
      '[data-testid="admin-transfer-confirm"]',
    );
    await confirmButton.click();

    // Error should be displayed
    const errorIndicator = authenticatedPage
      .locator('.text-red-500, .text-red-600, [role="alert"]')
      .or(authenticatedPage.getByText(/error|failed/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test("no eligible users shows empty state", async ({ authenticatedPage }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    // Setup fallback mocks FIRST, then override user endpoint
    // Playwright evaluates routes in LIFO order (last registered takes priority)
    await setupFallbackMocks(authenticatedPage);

    // Override user fallback with only admin user — no one to transfer to
    await safeRoute(authenticatedPage, "**/user/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [mockCompanyUsersApiResponse.data[0]], // admin only
          total_items: 1,
          current_page: 1,
          total_pages: 1,
        }),
      });
    });

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    // Should show "no users" message
    const noUsersMessage = authenticatedPage.locator(
      '[data-testid="admin-transfer-no-users"]',
    );
    await expect(noUsersMessage).toBeVisible({ timeout: 3000 });
  });
});
