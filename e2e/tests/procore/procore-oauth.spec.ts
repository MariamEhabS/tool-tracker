import { test, expect } from "../../fixtures/verified-test";
import {
  mockProcoreJWT,
  mockProcoreSelectCompanySuccess,
} from "../../fixtures/test-data";

test.describe("Procore OAuth @desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ==========================================================================
  // OAUTH SUCCESS PAGE
  // ==========================================================================

  test("OAuth success page shows success message", async ({ page }) => {
    await page.goto("/procore/oauth-success?userId=user-test-001");

    await expect(page.getByText("Procore Login Success!")).toBeVisible();
    await expect(page.getByText(/Redirecting/)).toBeVisible();
  });

  test("missing userId redirects to home page", async ({ page }) => {
    await page.goto("/procore/oauth-success");

    // Should redirect to home/login
    await page.waitForURL("**/");
  });

  // ==========================================================================
  // SELECT COMPANY PAGE
  // ==========================================================================

  test("company selection renders company list from JWT token", async ({
    page,
  }) => {
    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    // Should show the header
    await expect(
      page.getByRole("heading", { name: "Select Your Company" }),
    ).toBeVisible();
    await expect(
      page.getByText("You have access to multiple Procore companies"),
    ).toBeVisible();

    // Should list all companies from the token
    await expect(page.getByText("ABC Construction Corp")).toBeVisible();
    await expect(page.getByText("XYZ Builders LLC")).toBeVisible();
    await expect(page.getByText("Old Inactive Co")).toBeVisible();

    // Inactive company should show badge
    const inactiveCompanyCard = page.getByRole("button", {
      name: /Old Inactive Co/i,
    });
    await expect(
      inactiveCompanyCard.locator("span", { hasText: "Inactive" }),
    ).toBeVisible();
  });

  test("selecting company and clicking Continue submits selection", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/oauth/procore/select-company**",
      mockProcoreSelectCompanySuccess,
    );

    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    // Click on first company
    await page.getByText("ABC Construction Corp").click();

    // Continue button should be enabled
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    // Wait for async submit to avoid race under heavy parallel load.
    await expect
      .poll(
        () => routeTracker.wasIntercepted("**/oauth/procore/select-company**"),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test("Continue is disabled without company selection", async ({ page }) => {
    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();
  });

  test("invalid token shows Session Expired error with Return to Login", async ({
    page,
  }) => {
    // Pass a malformed token
    await page.goto("/procore/select-company?token=invalid-not-jwt");

    await expect(
      page.getByRole("heading", { name: "Session Expired" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Return to Login" }),
    ).toBeVisible();
  });

  test("missing token shows error state", async ({ page }) => {
    await page.goto("/procore/select-company");

    // Should show error state
    await expect(
      page.getByRole("heading", { name: "Session Expired" }),
    ).toBeVisible();
  });

  test("Cancel navigates back to login", async ({ page }) => {
    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    const cancelButton = page.getByRole("button", { name: "Cancel" });
    await cancelButton.click();

    await expect
      .poll(() => page.url())
      .toMatch(/procore\.com|chrome-error:\/\/chromewebdata\//);
  });

  test("API error on company selection shows error message", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse(
      "**/oauth/procore/select-company**",
      500,
      { message: "Failed to select company. Please try again." },
    );

    await page.goto(`/procore/select-company?token=${mockProcoreJWT}`);

    await page.getByText("ABC Construction Corp").click();
    await page.getByRole("button", { name: "Continue" }).click();

    // Should show error inline
    await expect(
      page.locator("div.bg-red-50").filter({
        hasText: "Failed to select company",
      }),
    ).toBeVisible();
  });
});
