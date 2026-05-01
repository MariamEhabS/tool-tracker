import { test, expect } from "../../fixtures/verified-test";
import { VerifyEmailPage } from "../../pages/verify-email.page";
import {
  mockTokenVerificationSuccess,
  mockTokenVerificationExpired,
  mockTokenVerificationInvalid,
  mockTokenVerificationAlreadyUsed,
  mockInvitedSignupComplete,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Email Verification @desktop", () => {
  let verifyEmailPage: VerifyEmailPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    verifyEmailPage = new VerifyEmailPage(page);
  });

  // ==========================================================================
  // TOKEN VERIFICATION
  // ==========================================================================

  test("shows loading state while verifying token", async ({ page }) => {
    // Use a delayed response to catch the loading state
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    // Navigate without waiting for networkidle (we want to catch loading state)
    await page.goto(`/verify-email/mock-valid-token-123`);

    // Should show loading text (within the 3000ms delay window)
    // The component shows "Verifying your invitation..." while isVerifying=true
    await expect(verifyEmailPage.verifyingText).toBeVisible({ timeout: 2000 });
  });

  test("valid token shows account completion form with pre-filled email", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("mock-valid-token-123");

    // Should show the completion form (assertion timeout handles waiting for React render)
    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Company name is inside a span.font-semibold - use a more flexible selector
    await expect(page.getByText("Test Company")).toBeVisible();

    // Email should be pre-filled and read-only
    await expect(verifyEmailPage.emailInput).toHaveValue(
      "invited@testcompany.com",
    );
    await expect(verifyEmailPage.emailInput).toHaveAttribute("readonly", "");

    // Form fields should be visible
    await expect(verifyEmailPage.firstNameInput).toBeVisible();
    await expect(verifyEmailPage.lastNameInput).toBeVisible();
    await expect(verifyEmailPage.passwordInput).toBeVisible();
    await expect(verifyEmailPage.confirmPasswordInput).toBeVisible();
    await expect(verifyEmailPage.completeSetupButton).toBeVisible();
  });

  // ==========================================================================
  // ERROR STATES
  // ==========================================================================

  test("invalid token shows error page with Go to Login link", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationInvalid),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("invalid-token-999");

    // Should show the invalid error state - component shows generic "Invalid Invitation" for all error types
    await expect(
      page.getByRole("heading", { level: 2, name: "Invalid Invitation" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(verifyEmailPage.goToLoginLink).toBeVisible();
  });

  test("expired token shows error message", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationExpired),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("expired-token-456");

    // Component shows generic "Invalid Invitation" for all error types (expired, invalid, etc.)
    // The specific error message is shown via toast notification
    await expect(
      page.getByRole("heading", { level: 2, name: "Invalid Invitation" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(verifyEmailPage.goToLoginLink).toBeVisible();
  });

  test("already-verified token shows message and auto-redirects", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationAlreadyUsed),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("already-used-token-789");

    // Component shows generic "Invalid Invitation" heading and triggers auto-redirect after 2s
    await expect(
      page.getByRole("heading", { level: 2, name: "Invalid Invitation" }),
    ).toBeVisible({ timeout: 10000 });

    // Verify the toast message about already being verified (use .first() as toast may duplicate)
    await expect(
      page.getByText("This invitation has already been used.").first(),
    ).toBeVisible({ timeout: 5000 });

    // The component redirects to /login after 2000ms via window.location.href
    // Use polling to verify the URL changed (avoids net::ERR_ABORTED with hard navigation)
    await expect.poll(() => page.url(), { timeout: 8000 }).toContain("/login");
  });

  // ==========================================================================
  // ACCOUNT COMPLETION
  // ==========================================================================

  test("successful form submission completes signup and redirects", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });
    await safeRoute(
      page,
      "**/auth/complete-invited-signup**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockInvitedSignupComplete),
        });
      },
    );

    // Wait for route handlers to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("mock-valid-token-123");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Fill and submit the form
    await verifyEmailPage.fillAccountForm({
      firstName: "Invited",
      lastName: "User",
      password: "StrongPass123",
      confirmPassword: "StrongPass123",
    });
    await verifyEmailPage.submitForm();

    // Should show success toast
    await expect(page.getByText("Account created successfully!")).toBeVisible({
      timeout: 10000,
    });
  });

  test("password mismatch shows error toast", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("mock-valid-token-123");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    await verifyEmailPage.fillAccountForm({
      password: "StrongPass123",
      confirmPassword: "DifferentPass456",
    });
    await verifyEmailPage.submitForm();

    // Use .first() in case there are multiple toast elements
    await expect(
      page.getByText("Passwords do not match").first(),
    ).toBeVisible();
  });

  test("short password shows validation error", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Wait for route handler to be fully registered
    await page.waitForTimeout(100);

    await verifyEmailPage.goto("mock-valid-token-123");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    await verifyEmailPage.fillAccountForm({
      password: "short",
      confirmPassword: "short",
    });
    await verifyEmailPage.submitForm();

    // The toast message says "Password must be at least 8 characters..."
    // Use a more specific match for the toast
    await expect(
      page.getByText("Password must be at least 8 characters").first(),
    ).toBeVisible();
  });
});
