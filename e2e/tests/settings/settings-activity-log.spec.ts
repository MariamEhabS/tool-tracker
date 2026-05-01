import {
  test,
  expect,
  mockAuthCompany,
  RouteTracker,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import {
  mockActivityLogEntries,
  mockActivityLogEmpty,
} from "../../fixtures/test-data";

// ============================================================================
// COMMON SETUP
// ============================================================================

/** Mock the minimum settings-page endpoints needed to load the page */
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

// TODO: Re-enable when Activity Log feature is added back (see settings.lazy.tsx)
test.describe.skip("Settings - Activity Log @desktop", () => {
  test("renders activity log with entries", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    // Verify the activity log container renders
    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Verify entries are displayed
    const activityList = authenticatedPage.locator(
      '[data-testid="activity-list"]',
    );
    await expect(activityList).toBeVisible();

    // Verify first entry shows user name and description
    const firstEntry = authenticatedPage.locator(
      '[data-testid="log-user-log-001"]',
    );
    await expect(firstEntry).toBeVisible();
    await expect(firstEntry).toContainText("Test Admin");

    // Verify timestamp is rendered
    const timestamp = authenticatedPage.locator(
      '[data-testid="log-timestamp-log-001"]',
    );
    await expect(timestamp).toBeVisible();
  });

  test("shows loading state while fetching", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    // Delay the activity log response to capture loading state
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
      { delay: 3000 },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    // Loading spinner should appear
    const loading = authenticatedPage.locator('[data-testid="loading"]');
    await expect(loading).toBeVisible({ timeout: 3000 });
  });

  test("shows empty state when no activities exist", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEmpty,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const emptyState = authenticatedPage.locator('[data-testid="empty"]');
    await expect(emptyState).toBeVisible({ timeout: 5000 });
    await expect(emptyState).toContainText("No activity found");
  });

  test("filters by category", async ({ authenticatedPage, routeTracker }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    // Wait for initial load
    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Select "Security" category filter
    const categorySelect = authenticatedPage.locator(
      '[data-testid="filter-category"]',
    );
    await categorySelect.selectOption("security");

    // The API should be called with the category filter
    // (RouteTracker will verify the mocked route was intercepted)
  });

  test("filters by action type", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Select "Password Changed" action filter
    const actionSelect = authenticatedPage.locator(
      '[data-testid="filter-action"]',
    );
    await actionSelect.selectOption("password_changed");
  });

  test("filters by date range", async ({ authenticatedPage, routeTracker }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Select "Last 7 days" date range
    const dateRangeSelect = authenticatedPage.locator(
      '[data-testid="filter-date-range"]',
    );
    await dateRangeSelect.selectOption("7");
  });

  test("reset filters button clears active filters", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Apply a filter first
    const categorySelect = authenticatedPage.locator(
      '[data-testid="filter-category"]',
    );
    await categorySelect.selectOption("security");

    // Reset button should appear
    const resetButton = authenticatedPage.locator(
      '[data-testid="reset-filters"]',
    );
    await expect(resetButton).toBeVisible({ timeout: 3000 });
    await resetButton.click();

    // Category should be reset to "all"
    await expect(categorySelect).toHaveValue("all");
  });

  test("pagination navigates between pages", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Verify pagination info shows
    const paginationInfo = authenticatedPage.locator(
      '[data-testid="pagination-info"]',
    );
    await expect(paginationInfo).toContainText("Page 1 of 3");

    // Click Next
    const nextButton = authenticatedPage.locator(
      '[data-testid="pagination-next"]',
    );
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
  });

  test("pagination disables Previous on first page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockRoute(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      mockActivityLogEntries,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const activityLog = authenticatedPage.locator(
      '[data-testid="activity-log"]',
    );
    await expect(activityLog).toBeVisible({ timeout: 5000 });

    // Previous button should be disabled on page 1
    const prevButton = authenticatedPage.locator(
      '[data-testid="pagination-prev"]',
    );
    await expect(prevButton).toBeDisabled();
  });

  test("shows error state when API fails", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await mockSettingsEndpoints(routeTracker);
    await routeTracker.mockErrorResponse(
      `**/company/${mockAuthCompany._id}/activity-log**`,
      500,
    );

    await settingsPage.goto();
    await settingsPage.expandSection("activity-log");

    const errorState = authenticatedPage.locator('[data-testid="error"]');
    await expect(errorState).toBeVisible({ timeout: 5000 });
    await expect(errorState).toContainText("Failed to load activity log");
  });
});
