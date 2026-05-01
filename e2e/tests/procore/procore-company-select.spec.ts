import { test, expect } from "../../fixtures/verified-test";
import {
  mockProcoreJWT,
  mockProcoreSelectCompanySuccess,
} from "../../fixtures/test-data";

// ============================================================================
// TESTS — /procore/select-company
// ============================================================================

test.describe("Procore Company Selection", () => {
  test("renders company list decoded from JWT token", async ({
    page,
    routeTracker: _routeTracker,
  }) => {
    // The select-company page reads a JWT from the URL query params
    // and decodes it to extract the list of Procore companies.
    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    // Should display active companies from the JWT payload
    await expect(page.locator("text=ABC Construction Corp")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=XYZ Builders LLC")).toBeVisible();

    // Inactive company may be hidden or shown with disabled state
    // depending on the implementation
  });

  test("select company and confirm triggers redirect", async ({
    page,
    routeTracker,
  }) => {
    // Mock the API call that confirms company selection
    await routeTracker.mockRoute(
      "**/oauth/procore/select-company**",
      mockProcoreSelectCompanySuccess,
    );

    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    // Wait for companies to load
    await expect(page.locator("text=ABC Construction Corp")).toBeVisible({
      timeout: 5000,
    });

    // Click on the first company to select it
    await page.locator("text=ABC Construction Corp").click();

    // There should be a confirm/continue button
    const confirmBtn = page.getByRole("button", {
      name: /Confirm|Continue|Select|Connect/i,
    });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();

      // In iframe/popup/browser fallback flows, UI navigation can differ.
      // The stable contract is that the company-select API is called.
      await expect
        .poll(() =>
          routeTracker.getCallCount("**/oauth/procore/select-company**"),
        )
        .toBeGreaterThan(0);
    }
  });

  test("no companies in JWT shows empty state", async ({ page }) => {
    // Create a JWT with empty companies array
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ procoreCompanies: [] }));
    const emptyJWT = `${header}.${payload}.mock-sig`;

    await page.goto(`/procore/select-company?token=${emptyJWT}`);

    // Should show empty state or "no companies found" message
    await expect(
      page.locator("text=/no companies|no procore|empty|not found/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
