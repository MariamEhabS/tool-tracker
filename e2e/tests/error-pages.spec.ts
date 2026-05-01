import { test, expect } from "../fixtures/authenticated-test";
import { safeRoute } from "../utils/route-tracker";

// ============================================================================
// TESTS — 404 Not Found Page
// ============================================================================

test.describe("Error Pages @desktop", () => {
  test("404 page renders for unknown route", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/this-route-does-not-exist-at-all");

    // Should show the 404 indicator
    const heading404 = authenticatedPage.getByText("404");
    await expect(heading404).toBeVisible({ timeout: 10000 });

    const notFoundTitle = authenticatedPage.getByText("Page Not Found");
    await expect(notFoundTitle).toBeVisible();
  });

  test("404 page shows descriptive message", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/nonexistent-page-xyz");

    await expect(authenticatedPage.getByText("404")).toBeVisible({
      timeout: 10000,
    });

    await expect(
      authenticatedPage.getByText(
        "The page you're looking for doesn't exist or has been moved.",
      ),
    ).toBeVisible();
  });

  test("404 page has Go to Dashboard link", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/nonexistent-page-xyz");

    await expect(authenticatedPage.getByText("404")).toBeVisible({
      timeout: 10000,
    });

    const dashboardLink = authenticatedPage.getByRole("link", {
      name: "Go to Dashboard",
    });
    await expect(dashboardLink).toBeVisible();
  });

  test("404 page dashboard link navigates to /dashboard", async ({
    authenticatedPage,
  }) => {
    // Mock dashboard endpoints so navigation succeeds
    await safeRoute(
      authenticatedPage,
      "**/aggregation/dashboard-stats**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            totalQRCodes: 0,
            totalScans: 0,
            totalFilesShared: 0,
          }),
        });
      },
    );
    await safeRoute(authenticatedPage, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });
    await safeRoute(
      authenticatedPage,
      "**/aggregation/project-qrcodes**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            total_items: 0,
            has_next: false,
            has_prev: false,
          }),
        });
      },
    );
    await safeRoute(authenticatedPage, "**/groups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    await authenticatedPage.goto("/nonexistent-page-xyz");

    await expect(authenticatedPage.getByText("404")).toBeVisible({
      timeout: 10000,
    });

    const dashboardLink = authenticatedPage.getByRole("link", {
      name: "Go to Dashboard",
    });
    await dashboardLink.click();

    await authenticatedPage.waitForURL("**/dashboard", { timeout: 10000 });
  });

  // ==========================================================================
  // ERROR PAGE — Route-Level Errors
  // ==========================================================================

  test("error page shows project fallback actions", async ({
    authenticatedPage,
  }) => {
    // Force a data-loading error by mocking a required endpoint to 500
    // Navigate to a project detail page that will fail to load
    await safeRoute(authenticatedPage, "**/project/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Server error" }),
      });
    });

    await authenticatedPage.goto("/project/invalid-project-id");

    // Current project fallback page should be visible with navigation actions
    await expect(
      authenticatedPage.getByRole("heading", { name: "Project Not Found" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      authenticatedPage.getByRole("link", { name: "Back to Projects" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("error page has Go to Dashboard link", async ({ authenticatedPage }) => {
    await safeRoute(authenticatedPage, "**/project/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Server error" }),
      });
    });

    await authenticatedPage.goto("/project/invalid-project-id");

    const dashboardLink = authenticatedPage.locator(
      'a:has-text("Go to Dashboard"), button:has-text("Go to Dashboard")',
    );
    await expect(dashboardLink.first()).toBeVisible({ timeout: 10000 });
  });
});
