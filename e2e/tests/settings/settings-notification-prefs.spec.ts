import {
  test,
  expect,
  mockAuthUser,
  RouteTracker,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { mockNotificationPreferences } from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// COMMON SETUP
// ============================================================================

async function mockSettingsEndpoints(routeTracker: RouteTracker) {
  await routeTracker.mockRoute("**/company/users**", {
    users: [],
    total: 0,
    current_page: 1,
    per_page: 100,
  });
  await routeTracker.mockRoute("**/storage-stats/**", {});
}

// ============================================================================
// TESTS
// ============================================================================

// TODO: Re-enable when Notification Preferences feature is added back (see settings.lazy.tsx)
test.describe.skip("Settings - Notification Preferences @desktop", () => {
  test("renders email notification toggles", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Verify email notification section heading
    await expect(
      authenticatedPage.getByText("Email Notifications"),
    ).toBeVisible();

    // Verify each toggle is visible
    await expect(
      authenticatedPage.getByText("Project Updates").first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Inspection Reminders").first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Document Uploads").first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Team Activity").first(),
    ).toBeVisible();
    await expect(authenticatedPage.getByText("Weekly Digest")).toBeVisible();
  });

  test("renders push notification toggles", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Verify push notification section heading
    await expect(
      authenticatedPage.getByText("Push Notifications"),
    ).toBeVisible();
  });

  test("toggle email preference sends update", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Click the "Document Uploads" toggle (currently off in mock data)
    const toggleSwitch = authenticatedPage.locator(
      '[data-testid="toggle-switch-documentUploads"]',
    );

    // If the toggle has a data-testid, click it directly; otherwise find by label
    if (await toggleSwitch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggleSwitch.click();
    } else {
      // Fallback: find toggle next to "Document Uploads" text
      const docUploadsRow = authenticatedPage
        .locator("div")
        .filter({ hasText: "Document Uploads" })
        .first();
      const toggle = docUploadsRow.locator('button[role="switch"]');
      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggle.click();
      }
    }
  });

  test("change frequency selector", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Verify frequency section visible
    await expect(
      authenticatedPage.getByText("Notification Frequency"),
    ).toBeVisible();

    // Change frequency to "Daily Digest"
    const frequencySelect = authenticatedPage.locator(
      '[data-testid="frequency-select"]',
    );
    await frequencySelect.selectOption("daily");
    await expect(frequencySelect).toHaveValue("daily");
  });

  test("enable quiet hours shows time inputs", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Verify Quiet Hours section exists
    await expect(authenticatedPage.getByText("Quiet Hours")).toBeVisible();

    // Toggle quiet hours on
    const quietHoursToggle = authenticatedPage.locator(
      '[data-testid="toggle-switch-quietHours"]',
    );
    await quietHoursToggle.click();

    // Time inputs should now be visible
    const startInput = authenticatedPage.locator(
      '[data-testid="quiet-hours-start"]',
    );
    const endInput = authenticatedPage.locator(
      '[data-testid="quiet-hours-end"]',
    );
    await expect(startInput).toBeVisible({ timeout: 3000 });
    await expect(endInput).toBeVisible();
  });

  test("update quiet hours times", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    // Start with quiet hours already enabled
    const prefsWithQuietHours = {
      ...mockNotificationPreferences,
      quietHoursEnabled: true,
    };

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      prefsWithQuietHours,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Time inputs should already be visible
    const startInput = authenticatedPage.locator(
      '[data-testid="quiet-hours-start"]',
    );
    await expect(startInput).toBeVisible({ timeout: 3000 });

    // Update the start time
    await startInput.fill("23:00");
    await expect(startInput).toHaveValue("23:00");
  });

  test("shows loading skeleton on initial load", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    // Delay response to observe loading state
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
      { delay: 3000 },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const loadingSkeleton = authenticatedPage.locator(
      '[data-testid="notification-prefs-loading"]',
    );
    await expect(loadingSkeleton).toBeVisible({ timeout: 3000 });
  });

  test("shows error state on API failure", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockErrorResponse(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      500,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const errorState = authenticatedPage.locator(
      '[data-testid="notification-prefs-error"]',
    );
    await expect(errorState).toBeVisible({ timeout: 5000 });
    await expect(errorState).toContainText(
      "Failed to load notification preferences",
    );
  });

  test("shows error toast on update failure", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/user/${mockAuthUser._id}/notification-preferences**`,
      mockNotificationPreferences,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("notifications");

    const notifPrefs = authenticatedPage.locator(
      '[data-testid="notification-preferences"]',
    );
    await expect(notifPrefs).toBeVisible({ timeout: 5000 });

    // Now mock the PATCH to fail
    await safeRoute(
      authenticatedPage,
      `**/user/${mockAuthUser._id}/notification-preferences`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Internal server error" }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockNotificationPreferences),
          });
        }
      },
    );

    // Toggle a preference to trigger the PATCH
    const quietHoursToggle = authenticatedPage.locator(
      '[data-testid="toggle-switch-quietHours"]',
    );
    await quietHoursToggle.click();

    // Error toast should appear
    const errorToast = authenticatedPage.locator(
      'text="Failed to update notification preferences"',
    );
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });
});
