import { test, expect } from "../../fixtures/verified-test";
import { AuthPage } from "../../pages/auth.page";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockSignupSuccess = {
  success: true,
  message: "Verification code sent to your email",
};

const mockSignupInvalidEmail = {
  success: false,
  message: "Please enter a valid email address",
};

const mockSignupDuplicateEmail = {
  success: false,
  message: "An account with this email already exists",
};

// ============================================================================
// TESTS
// ============================================================================

test.describe("Signup @desktop", () => {
  test("renders signup form with all required fields", async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.gotoSignup();

    await expect(authPage.createAccountHeading).toBeVisible();
    await expect(authPage.emailInput).toBeVisible();
    await expect(authPage.firstNameInput).toBeVisible();
    await expect(authPage.lastNameInput).toBeVisible();
    await expect(authPage.companyInput).toBeVisible();
    await expect(authPage.continueButton).toBeVisible();
    await expect(authPage.signInFromSignupLink).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    const authPage = new AuthPage(page);

    // The signup button uses onClick (not form onSubmit), so browser validation
    // is bypassed. The backend validates the email and returns success: false.
    await safeRoute(page, "**/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSignupInvalidEmail),
      });
    });

    await authPage.gotoSignup();
    await authPage.fillRegistration("not-an-email", "Test", "User", "Test Co");
    await authPage.submitRegistration();

    // Component checks response.data.success → false → toast.error(message)
    await expect(
      page.getByText("Please enter a valid email address"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows password requirements enforcement", async ({ page }) => {
    const authPage = new AuthPage(page);

    // Navigate directly to password step via URL params
    await authPage.gotoSignupStep("password", {
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      company: "Test Co",
    });

    await expect(authPage.setPasswordHeading).toBeVisible();

    // Type a weak password to trigger the requirements display
    await authPage.passwordInput.fill("ab");

    // All requirement indicators should be visible
    await expect(authPage.requirementMinLength).toBeVisible();
    await expect(authPage.requirementUppercase).toBeVisible();
    await expect(authPage.requirementLowercase).toBeVisible();
    await expect(authPage.requirementNumber).toBeVisible();

    // Weak password — requirements should show as unmet (circle icon, not check-circle)
    // The icon changes from bx-circle (unmet) to bx-check-circle (met)
    await expect(authPage.requirementMinLength.locator("i")).toHaveClass(
      /bx-circle/,
    );
    await expect(authPage.requirementUppercase.locator("i")).toHaveClass(
      /bx-circle/,
    );

    // Type a strong password that meets all requirements
    await authPage.passwordInput.fill("StrongPass1");

    // All requirements should now show as met (check-circle icon)
    await expect(authPage.requirementMinLength.locator("i")).toHaveClass(
      /bx-check-circle/,
    );
    await expect(authPage.requirementUppercase.locator("i")).toHaveClass(
      /bx-check-circle/,
    );
    await expect(authPage.requirementLowercase.locator("i")).toHaveClass(
      /bx-check-circle/,
    );
    await expect(authPage.requirementNumber.locator("i")).toHaveClass(
      /bx-check-circle/,
    );

    // Test password mismatch error
    await authPage.confirmPasswordInput.fill("DifferentPass1");
    await expect(authPage.passwordMismatchError).toBeVisible();
  });

  test("shows duplicate email error", async ({ page }) => {
    const authPage = new AuthPage(page);

    // Backend returns 200 with success: false for duplicate emails.
    // The component displays the error via toast.error().
    await safeRoute(page, "**/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSignupDuplicateEmail),
      });
    });

    await authPage.gotoSignup();
    await authPage.fillRegistration(
      "existing@example.com",
      "Test",
      "User",
      "Test Co",
    );
    await authPage.submitRegistration();

    await expect(
      page.getByText("An account with this email already exists"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("successful signup transitions to OTP verification step", async ({
    page,
  }) => {
    const authPage = new AuthPage(page);

    // Mock successful registration — backend sends OTP email
    await safeRoute(page, "**/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSignupSuccess),
      });
    });

    await authPage.gotoSignup();
    await authPage.fillRegistration(
      "new@example.com",
      "Test",
      "User",
      "Test Co",
    );
    await authPage.submitRegistration();

    // Component sets currentStep to "otp" — OTP verification UI should appear
    await expect(authPage.verifyEmailHeading).toBeVisible({ timeout: 10000 });
    await expect(authPage.otpInput).toBeVisible();
    await expect(authPage.verifyCodeButton).toBeVisible();
    await expect(authPage.resendCodeButton).toBeVisible();
  });
});
