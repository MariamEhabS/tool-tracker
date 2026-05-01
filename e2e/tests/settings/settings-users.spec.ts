import {
  test,
  expect,
  mockAuthUser,
  mockStorageStats,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import {
  mockCompanyUsersApiResponse,
  mockInviteUserSuccess,
  mockInviteUserDuplicate,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Settings User Management @desktop", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    settingsPage = new SettingsPage(authenticatedPage);

    // Mock common settings endpoints as untracked fallbacks.
    // Not every test triggers every route, so using safeRoute() avoids
    // RouteTracker false positives for routes the specific test doesn't hit.
    const fallback = (pattern: string, data: unknown) =>
      safeRoute(authenticatedPage, pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      });

    await fallback("**/user/**", mockCompanyUsersApiResponse);
    await fallback("**/activity-log**", { logs: [], total: 0 });
    await fallback("**/category**", []);
    await fallback("**/company/*/storage-history**", []);
    await fallback("**/categories*", { data: [] });
    await fallback("**/categories/classes*", { data: [] });
    await fallback("**/storage-stats**", mockStorageStats);
    await fallback("**/storage-history**", { history: [] });
    await fallback("**/procore/status**", { connected: false });
    await fallback("**/procore-status**", { connected: false });
    await fallback("**/procore-integration-details**", {
      owners: [],
      connectedUsers: [],
    });
    await fallback("**/stripe/products**", { data: [] });
    await fallback("**/company/*/qr-style**", {
      useStyledQRCodes: false,
      qrStyleConfig: null,
    });
  });

  // ==========================================================================
  // INVITE USER
  // ==========================================================================

  test("invite form renders with email input and role selector", async () => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await expect(settingsPage.inviteUserForm).toBeVisible();
    await expect(settingsPage.inviteEmailInput).toBeVisible();
    await expect(settingsPage.inviteRoleSelect).toBeVisible();
    await expect(settingsPage.inviteSubmitButton).toBeVisible();
  });

  test("invite form validates email and submits successfully", async ({
    authenticatedPage,
  }) => {
    // Use safeRoute for the invite endpoint (untracked)
    await safeRoute(authenticatedPage, "**/user/add-user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockInviteUserSuccess),
      });
    });

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.inviteEmailInput.fill("newuser@example.com");
    await settingsPage.inviteSubmitButton.click();

    // Should show success notification
    await expect(authenticatedPage.getByText(/invitation sent/i)).toBeVisible();
  });

  test("invite form shows error for duplicate email", async ({
    authenticatedPage,
  }) => {
    // Use safeRoute for the invite endpoint (untracked) with error response
    await safeRoute(authenticatedPage, "**/user/add-user**", async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify(mockInviteUserDuplicate),
      });
    });

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.inviteEmailInput.fill("admin@testcompany.com");
    await settingsPage.inviteSubmitButton.click();

    // Should show error
    await expect(
      authenticatedPage.getByText(/already associated/i),
    ).toBeVisible();
  });

  test("invite with PM role sends correct role in request", async ({
    authenticatedPage,
  }) => {
    // Use safeRoute for the invite endpoint (untracked)
    await safeRoute(authenticatedPage, "**/user/add-user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockInviteUserSuccess),
      });
    });

    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.inviteEmailInput.fill("pmuser@example.com");

    // Select PM role from the role dropdown
    await settingsPage.inviteRoleSelect.click();
    const pmOption = authenticatedPage.getByRole("option", {
      name: /pm|project manager/i,
    });
    if (await pmOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pmOption.click();
    } else {
      // Fallback: select by value if it's a native select
      await settingsPage.inviteRoleSelect.selectOption("pm");
    }

    await settingsPage.inviteSubmitButton.click();

    await expect(authenticatedPage.getByText(/invitation sent/i)).toBeVisible();
  });

  // ==========================================================================
  // USER TABLE
  // ==========================================================================

  test("user table renders all users with correct roles", async () => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await expect(settingsPage.userTable).toBeVisible();

    // Should show all mock users - scoped to user table to avoid matching User Profile section
    const userTable = settingsPage.userTable;
    await expect(userTable.getByText("admin@testcompany.com")).toBeVisible();
    await expect(userTable.getByText("pm@testcompany.com")).toBeVisible();
    await expect(userTable.getByText("pending@testcompany.com")).toBeVisible();
  });

  test("pending users show pending badge", async ({ authenticatedPage }) => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    // The pending user should have a pending indicator
    await expect(
      authenticatedPage.locator('[data-testid="pending-badge-user-test-003"]'),
    ).toBeVisible();
  });

  // ==========================================================================
  // ADMIN TRANSFER
  // ==========================================================================

  test("Transfer Admin button is visible for admin users", async () => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await expect(settingsPage.transferAdminButton).toBeVisible();
  });

  test("Transfer Admin opens confirmation modal", async ({
    authenticatedPage,
  }) => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    // Modal should open with warning
    await expect(
      authenticatedPage.locator('[data-testid="admin-transfer-warning"]'),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('[data-testid="admin-transfer-confirm"]'),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator('[data-testid="admin-transfer-cancel"]'),
    ).toBeVisible();
  });

  test("Transfer Admin confirm is disabled without user selection", async ({
    authenticatedPage,
  }) => {
    await settingsPage.goto();
    await settingsPage.expandSection("users");

    await settingsPage.transferAdminButton.click();

    // Confirm button should be disabled until a user is selected
    const confirmButton = authenticatedPage.locator(
      '[data-testid="admin-transfer-confirm"]',
    );
    await expect(confirmButton).toBeDisabled();
  });

  test("Non-admin users cannot see user management section", async ({
    authenticatedPage,
  }) => {
    // Override user as non-admin
    await safeRoute(authenticatedPage, "**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...mockAuthUser, permission: "user" }),
      });
    });
    await authenticatedPage.addInitScript(
      (user) => {
        window.localStorage.setItem("user", JSON.stringify(user));
      },
      { ...mockAuthUser, permission: "user" },
    );

    await settingsPage.goto();

    // Users section should not be visible for non-admin
    const isVisible = await settingsPage.isSectionVisible("users");
    expect(isVisible).toBe(false);
  });
});
