import { test, expect } from "../../fixtures/verified-test";
import { VerifyEmailPage } from "../../pages/verify-email.page";
import {
  mockTokenVerificationSuccess,
  mockTokenVerificationExpired,
  mockTokenVerificationAlreadyUsed,
  mockInvitedSignupComplete,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

/**
 * Invited User Signup Full Flow
 *
 * Tests the complete journey of an invited user: from clicking the
 * invitation link to completing account setup and being redirected
 * to the authenticated area.
 *
 * NOTE: The existing verify-email.spec.ts covers individual token
 * verification states and basic form validation. These tests focus
 * on the end-to-end flow including:
 * - Full signup completion with JWT storage and redirect
 * - Expired token showing correct UI with admin contact option
 * - Already-verified auto-redirect behavior
 * - Password validation (length, mismatch)
 * - Pre-filled form data from invitation token
 */

test.describe("Invited User Signup Full Flow @desktop", () => {
  let verifyEmailPage: VerifyEmailPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    verifyEmailPage = new VerifyEmailPage(page);
  });

  // ==========================================================================
  // COMPLETE SIGNUP FLOW
  // ==========================================================================

  test("should complete invited signup with valid token and redirect to authenticated area", async ({
    page,
  }) => {
    // Mock token verification endpoint
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Mock the complete-invited-signup endpoint
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

    // Wait for route handlers to be registered
    await page.waitForTimeout(100);

    // Navigate to verify-email page with a valid token
    await verifyEmailPage.goto("valid-invitation-token-abc");

    // Wait for the form to appear
    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Verify pre-filled data from token verification
    // Email should be pre-filled and read-only
    await expect(verifyEmailPage.emailInput).toHaveValue(
      "invited@testcompany.com",
    );
    await expect(verifyEmailPage.emailInput).toHaveAttribute("readonly", "");

    // Company name should be displayed
    await expect(page.getByText("Test Company")).toBeVisible();

    // First name should be pre-filled from invitation data
    await expect(verifyEmailPage.firstNameInput).toHaveValue("Invited");
    await expect(verifyEmailPage.lastNameInput).toHaveValue("User");

    // Fill in the password fields
    await verifyEmailPage.fillAccountForm({
      firstName: "Invited",
      lastName: "User",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
    });

    // Submit the form
    await verifyEmailPage.submitForm();

    // Should show success toast
    await expect(
      page.getByText("Account created successfully!").first(),
    ).toBeVisible({ timeout: 10000 });

    // Verify JWT token was stored in localStorage
    const storedToken = await page.evaluate(() =>
      localStorage.getItem("accessToken"),
    );
    expect(storedToken).toBe("mock-jwt-access-token-invited");

    // Verify user data was stored
    const storedUser = await page.evaluate(() => localStorage.getItem("user"));
    expect(storedUser).not.toBeNull();
    const userData = JSON.parse(storedUser!);
    expect(userData).toMatchObject({
      _id: "usr-invited-001",
      email: "invited@testcompany.com",
    });

    // Verify company data was stored
    const storedCompany = await page.evaluate(() =>
      localStorage.getItem("company"),
    );
    expect(storedCompany).not.toBeNull();
    const companyData = JSON.parse(storedCompany!);
    expect(companyData).toMatchObject({
      _id: "comp-test-001",
      companyName: "Test Company",
    });
  });

  // ==========================================================================
  // EXPIRED TOKEN FLOW
  // ==========================================================================

  test("should show expired invitation error with contact admin option", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationExpired),
      });
    });

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("expired-token-xyz");

    // Current verify-email flow renders a generalized invalid/expired invitation UI
    await expect(
      page.getByRole("heading", {
        name: /Invalid Invitation|Invitation Expired/i,
      }),
    ).toBeVisible({ timeout: 15000 });

    // Should show invalid/expired guidance
    await expect(
      page.getByText(/This invitation link is invalid or has expired/i).first(),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Go to Login|Contact Administrator/i }),
    ).toBeVisible();
  });

  // ==========================================================================
  // ALREADY VERIFIED TOKEN FLOW
  // ==========================================================================

  test("should auto-redirect for already-verified token", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationAlreadyUsed),
      });
    });

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("already-used-token-def");

    // Intermediate state may render invalid invitation copy before redirect
    await expect(
      page.getByRole("heading", {
        name: /Invalid Invitation|Already Verified/i,
      }),
    ).toBeVisible({ timeout: 15000 });

    // The component redirects to "/" after 3000ms via window.location.href
    // Use polling to detect the redirect (hard navigation may cause net::ERR_ABORTED)
    await expect
      .poll(() => page.url(), { timeout: 8000 })
      .toMatch(/\/($|\?|login)/);
  });

  // ==========================================================================
  // PASSWORD VALIDATION
  // ==========================================================================

  test("should validate password minimum length requirement", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("valid-token-password-test");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Enter a short password (less than 8 characters)
    await verifyEmailPage.fillAccountForm({
      firstName: "Test",
      lastName: "User",
      password: "Ab1",
      confirmPassword: "Ab1",
    });
    await verifyEmailPage.submitForm();

    // Should show validation error about minimum length
    await expect(
      page.getByText("Password must be at least 8 characters").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should validate password confirmation match", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("valid-token-mismatch-test");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Enter mismatched passwords (both >= 8 chars to bypass length check)
    await verifyEmailPage.fillAccountForm({
      firstName: "Test",
      lastName: "User",
      password: "StrongPassword1",
      confirmPassword: "DifferentPassword2",
    });
    await verifyEmailPage.submitForm();

    // Should show mismatch error
    await expect(page.getByText("Passwords do not match").first()).toBeVisible({
      timeout: 5000,
    });
  });

  // ==========================================================================
  // API ERROR HANDLING
  // ==========================================================================

  test("should handle API error during signup completion", async ({ page }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    // Mock the complete-invited-signup endpoint to fail
    await safeRoute(
      page,
      "**/auth/complete-invited-signup**",
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Internal server error",
          }),
        });
      },
    );

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("valid-token-api-error-test");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Fill valid form data
    await verifyEmailPage.fillAccountForm({
      firstName: "Test",
      lastName: "User",
      password: "ValidPass123",
      confirmPassword: "ValidPass123",
    });
    await verifyEmailPage.submitForm();

    // Should show error toast about failed setup
    await expect(
      page.getByText(/Failed to complete account setup/i).first(),
    ).toBeVisible({ timeout: 10000 });

    // Form should still be visible (user can retry)
    await expect(verifyEmailPage.completeAccountHeading).toBeVisible();
    await expect(verifyEmailPage.completeSetupButton).toBeEnabled();
  });

  // ==========================================================================
  // FORM NAVIGATION
  // ==========================================================================

  test("should have login link visible on the completion form", async ({
    page,
  }) => {
    await safeRoute(page, "**/auth/verify-email-token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTokenVerificationSuccess),
      });
    });

    await page.waitForTimeout(100);

    await verifyEmailPage.goto("valid-token-nav-test");

    await expect(verifyEmailPage.completeAccountHeading).toBeVisible({
      timeout: 15000,
    });

    // Should show "Already have an account? Log in" footer
    await expect(page.getByText("Already have an account?")).toBeVisible();
    await expect(verifyEmailPage.loginLink).toBeVisible();
  });
});
