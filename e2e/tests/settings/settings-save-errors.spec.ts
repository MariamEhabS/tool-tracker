import type { Page } from "@playwright/test";
import {
  test,
  expect,
  mockAuthUser,
  mockAuthCompany,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { mockCompanyUsers } from "../../fixtures/test-data";
import type { RouteTracker } from "../../utils/route-tracker";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// HELPERS
// ============================================================================

async function setupSettingsPageMocks(_routeTracker: RouteTracker, page: Page) {
  // All settings page routes as untracked fallbacks.
  // Individual tests add tracked mocks for the error endpoints they test.
  const fallback = (pattern: string, data: unknown) =>
    safeRoute(page, pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  await fallback("**/categories*", { data: [] });
  await fallback("**/categories/classes*", { data: [] });
  await fallback("**/user/*", mockCompanyUsers);
  await fallback("**/storage-stats**", {
    documentStorageUsed: 0,
    qrCodeStorageUsed: 0,
    documentStorageCapacity: 10737418240,
    qrCodeStorageCapacity: 5368709120,
  });
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
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings Save Errors @desktop", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    settingsPage = new SettingsPage(authenticatedPage);
  });

  // ==========================================================================
  // USER PROFILE SAVE ERROR
  // ==========================================================================

  test("profile save 500 shows error toast", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSettingsPageMocks(routeTracker, authenticatedPage);

    // Mock PATCH failure for user profile using safeRoute to handle both GET and PATCH
    await safeRoute(
      authenticatedPage,
      `**/user/${mockAuthUser._id}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Failed to update profile" }),
          });
        } else {
          // Let GET requests through
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockAuthUser),
          });
        }
      },
    );

    await settingsPage.goto();

    // Ensure user section is expanded before interacting with profile fields
    await settingsPage.expandSection("user-settings");
    await expect(settingsPage.userProfileContainer).toBeVisible({
      timeout: 5000,
    });

    // Click Edit
    await settingsPage.editUserProfile();

    // Fill new values
    await settingsPage.fillUserProfile({
      firstName: "Updated",
      lastName: "Failure",
    });

    // Save
    await settingsPage.saveUserProfile();

    // Error toast should appear
    await expect(
      authenticatedPage.locator("text=/fail|error|could not|unable/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ==========================================================================
  // COMPANY INFO SAVE ERROR
  // ==========================================================================

  test("company info save 422 shows validation errors", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSettingsPageMocks(routeTracker, authenticatedPage);

    // Mock PATCH failure for company info (validation error) using safeRoute
    await safeRoute(
      authenticatedPage,
      `**/company/${mockAuthCompany._id}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Company name is required",
              errors: { companyName: "required" },
            }),
          });
        } else {
          // Let GET requests through
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: mockAuthCompany }),
          });
        }
      },
    );

    await settingsPage.goto();

    // Expand company section
    await settingsPage.expandSection("company");

    // Wait for company info to load
    await expect(settingsPage.companyInfoContainer).toBeVisible({
      timeout: 5000,
    });

    // Click Edit
    await settingsPage.editCompanyInfo();

    // Clear company name and try to save
    await settingsPage.inputCompanyName.clear();

    await settingsPage.saveCompanyInfo();

    // Error should be shown
    await expect(
      authenticatedPage.locator("text=/fail|error|required|invalid/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ==========================================================================
  // INVITE USER ERROR (different from duplicate)
  // ==========================================================================

  test("invite user server error shows generic error message", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSettingsPageMocks(routeTracker, authenticatedPage);

    // Mock POST failure for invite user - the endpoint is /user/add-user
    await safeRoute(authenticatedPage, "**/user/add-user", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Could not send invitation" }),
      });
    });

    await settingsPage.goto();

    // Expand users section
    await settingsPage.expandSection("users");

    // Wait for the invite form to be visible
    await expect(settingsPage.inviteEmailInput).toBeVisible({ timeout: 5000 });

    await settingsPage.inviteEmailInput.fill("test@example.com");
    await settingsPage.inviteSubmitButton.click();

    // Error message should appear (toast with error message)
    await expect(
      authenticatedPage.locator("text=/fail|error|could not|unable/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
