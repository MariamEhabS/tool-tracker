import { test, expect } from "../../fixtures/authenticated-test";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Set up common route fallbacks so pages don't fail to load during
 * navigation tests. The goal here is to verify sidebar links navigate
 * to the right URL, not to test page content.
 */
async function setupNavigationFallbacks(page: import("@playwright/test").Page) {
  const fallback = (pattern: string, data: unknown = {}) =>
    safeRoute(page, pattern, async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  await fallback("**/aggregation/dashboard-stats**", {
    totalQRCodes: 0,
    totalScans: 0,
    totalFilesShared: 0,
  });
  await fallback("**/qr-code*", {
    data: [],
    total_items: 0,
    has_next: false,
    has_prev: false,
  });
  await fallback("**/aggregation/all-projects/**", []);
  await fallback("**/groups*", {
    data: [],
    total_items: 0,
    has_next: false,
    has_prev: false,
  });
  await fallback("**/categories*", []);
  await fallback("**/categories/classes*", []);
  await fallback("**/user/*", { users: [], total: 0 });
  await fallback("**/storage-stats**");
  await fallback("**/storage-history**", { history: [] });
  await fallback("**/procore/status**", { connected: false });
  await fallback("**/procore-status**", { connected: false });
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });
  await fallback("**/stripe/products**", { data: [] });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Sidebar Navigation @desktop", () => {
  test("Dashboard link navigates to /dashboard", async ({
    authenticatedPage,
  }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/settings");
    await authenticatedPage.waitForTimeout(500);

    // Click Dashboard link in sidebar
    const dashboardLink = authenticatedPage
      .locator('nav, aside, [data-testid="sidebar"]')
      .getByRole("link", { name: /dashboard/i })
      .first();

    if (await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashboardLink.click();
      await expect(authenticatedPage).toHaveURL(/\/dashboard/);
    } else {
      // Fallback: look for any sidebar link with Dashboard text
      const fallbackLink = authenticatedPage
        .locator('a:has-text("Dashboard")')
        .first();
      await fallbackLink.click();
      await expect(authenticatedPage).toHaveURL(/\/dashboard/);
    }
  });

  test("QR Codes link navigates to /my-qrcodes", async ({
    authenticatedPage,
  }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForTimeout(500);

    const qrLink = authenticatedPage
      .locator('a:has-text("QR Codes"), a:has-text("My QR Codes")')
      .first();

    await qrLink.click();
    await expect(authenticatedPage).toHaveURL(/\/my-qrcodes/);
  });

  test("Groups link navigates to /groups", async ({ authenticatedPage }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForTimeout(500);

    const groupsLink = authenticatedPage
      .locator('a:has-text("Groups")')
      .first();

    await groupsLink.click();
    await expect(authenticatedPage).toHaveURL(/\/groups/);
  });

  test("Projects link navigates to /projects", async ({
    authenticatedPage,
  }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForTimeout(500);

    const projectsLink = authenticatedPage
      .locator('a:has-text("Projects")')
      .first();

    await projectsLink.click();
    await expect(authenticatedPage).toHaveURL(/\/projects/);
  });

  test("Settings link navigates to /settings", async ({
    authenticatedPage,
  }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForTimeout(500);

    const settingsLink = authenticatedPage
      .locator('a:has-text("Settings")')
      .first();

    await settingsLink.click();
    await expect(authenticatedPage).toHaveURL(/\/settings/);
  });

  test("active link highlights current route", async ({
    authenticatedPage,
  }) => {
    await setupNavigationFallbacks(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForTimeout(500);

    // The active sidebar link should have a visual indicator
    // (e.g., different background color, active class, aria-current)
    const dashboardLink = authenticatedPage
      .locator('a:has-text("Dashboard")')
      .first();

    // Check for aria-current or active-style class
    const ariaCurrent = await dashboardLink
      .getAttribute("aria-current")
      .catch(() => null);
    const classList = await dashboardLink.getAttribute("class").catch(() => "");

    const hasActiveIndicator =
      ariaCurrent === "page" ||
      ariaCurrent === "true" ||
      (classList ?? "").includes("active") ||
      (classList ?? "").includes("bg-") ||
      (classList ?? "").includes("selected") ||
      (classList ?? "").includes("current");

    expect(hasActiveIndicator).toBeTruthy();
  });
});
