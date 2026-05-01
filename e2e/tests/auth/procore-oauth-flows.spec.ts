import { test, expect } from "../../fixtures/verified-test";
import { AuthPage } from "../../pages/auth.page";

/**
 * Procore OAuth Flows — Login Page Integration
 *
 * Tests the Procore OAuth popup flow initiated from the login page,
 * as well as error query parameter handling when the backend redirects
 * back with error codes.
 *
 * NOTE: The existing procore-oauth.spec.ts covers the success page and
 * company selection page. These tests cover the popup initiation from
 * the login page and error parameter handling.
 */

test.describe("Procore OAuth Flows @desktop", () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    authPage = new AuthPage(page);
  });

  // ==========================================================================
  // POPUP FLOW
  // ==========================================================================

  test("should open OAuth popup when clicking Sign in with Procore", async ({
    page,
  }) => {
    await authPage.gotoLogin();

    // Verify the Procore sign-in button is visible
    await expect(authPage.procoreSignInButton).toBeVisible();

    // Listen for the popup event before clicking
    const popupPromise = page.waitForEvent("popup");

    // Click "Sign in with Procore" button
    await authPage.procoreSignInButton.click();

    // Capture the popup window
    const popup = await popupPromise;

    // Primary signal: popup opened and OAuth flow entered loading state on the login page.
    await expect.poll(() => !popup.isClosed()).toBeTruthy();
    await expect(
      page.getByRole("button", { name: /Connecting to Procore/i }),
    ).toBeVisible({ timeout: 3000 });

    // Close the popup to clean up
    await popup.close();
  });

  test("should show loading state while Procore OAuth is in progress", async ({
    page,
  }) => {
    await authPage.gotoLogin();

    // Listen for popup before clicking
    const popupPromise = page.waitForEvent("popup");

    await authPage.procoreSignInButton.click();

    const popup = await popupPromise;

    // Button should show loading state: "Connecting to Procore..."
    const connectingButton = page.getByRole("button", {
      name: /Connecting to Procore/i,
    });
    await expect(connectingButton).toBeVisible({ timeout: 2000 });
    await expect(connectingButton).toBeDisabled();

    // Close popup - loading state should reset
    await popup.close();

    // After popup closes, the button should return to normal state
    await expect(authPage.procoreSignInButton).toBeVisible({ timeout: 5000 });
    await expect(authPage.procoreSignInButton).toBeEnabled();
  });

  // ==========================================================================
  // ERROR QUERY PARAMETER HANDLING
  // ==========================================================================

  test("should display error from ?error=invalid_code query parameter", async ({
    page,
  }) => {
    // Navigate to login with error parameter
    await page.goto("/?error=invalid_code");

    // Verify error toast is displayed with the expected message
    await expect(
      page
        .getByText(
          "Procore authentication failed. Please try signing in again.",
        )
        .first(),
    ).toBeVisible({ timeout: 10000 });

    // Login form should still be accessible
    await expect(authPage.loginHeading).toBeVisible();
  });

  test("should display error from ?error=code_expired query parameter", async ({
    page,
  }) => {
    await page.goto("/?error=code_expired");

    // Verify the session expired error message
    await expect(
      page.getByText("Session expired. Please try signing in again.").first(),
    ).toBeVisible({ timeout: 10000 });

    // Login form should still be accessible
    await expect(authPage.loginHeading).toBeVisible();
  });

  test("should display error from ?error=unauthorized query parameter", async ({
    page,
  }) => {
    await page.goto("/?error=unauthorized");

    // Verify the access denied error message
    await expect(
      page
        .getByText("Access denied. Please check your Procore permissions.")
        .first(),
    ).toBeVisible({ timeout: 10000 });

    // Login form should still be accessible
    await expect(authPage.loginHeading).toBeVisible();
  });

  test("should display generic error for unknown error parameter", async ({
    page,
  }) => {
    await page.goto("/?error=something_unknown");

    // Generic error message for unrecognized error codes
    await expect(
      page.getByText("Authentication failed. Please try again.").first(),
    ).toBeVisible({ timeout: 10000 });

    // Login form should still be accessible
    await expect(authPage.loginHeading).toBeVisible();
  });

  test("should clean up URL after displaying error", async ({ page }) => {
    await page.goto("/?error=invalid_code");

    // Wait for the error toast to appear (confirms the error was processed)
    await expect(
      page
        .getByText(
          "Procore authentication failed. Please try signing in again.",
        )
        .first(),
    ).toBeVisible({ timeout: 10000 });

    // URL should be cleaned up (error parameter removed)
    // The component calls window.history.replaceState({}, '', '/') after processing
    await expect
      .poll(() => page.url(), { timeout: 5000 })
      .not.toContain("error=");
  });
});
