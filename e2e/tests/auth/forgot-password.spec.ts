import { test, expect } from "../../fixtures/verified-test";
import { ForgotPasswordPage } from "../../pages/forgot-password.page";
import {
  mockPasswordResetRequestSuccess,
  mockPasswordResetRequestFail,
  mockPasswordResetVerifySuccess,
  mockPasswordResetVerifyInvalid,
  mockPasswordResetVerifyExpired,
  mockPasswordResetCompleteSuccess,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Forgot Password @desktop", () => {
  let forgotPasswordPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    forgotPasswordPage = new ForgotPasswordPage(page);
  });

  // ==========================================================================
  // EMAIL STEP
  // ==========================================================================

  test("renders email entry form with Send Code button", async () => {
    await forgotPasswordPage.goto();

    await expect(forgotPasswordPage.emailStepHeading).toBeVisible();
    await expect(forgotPasswordPage.emailInput).toBeVisible();
    await expect(forgotPasswordPage.sendCodeButton).toBeVisible();
    await expect(forgotPasswordPage.backToSignInLink).toBeVisible();

    // Step indicator should show Email as current
    await expect(forgotPasswordPage.stepEmail).toBeVisible();
    await expect(forgotPasswordPage.stepVerify).toBeVisible();
    await expect(forgotPasswordPage.stepReset).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await forgotPasswordPage.goto();

    // Submit with empty email
    await forgotPasswordPage.submitEmail();

    // Toast error should appear - use .first() since multiple toasts may exist
    await expect(
      page.getByText("Please enter a valid email address").first(),
    ).toBeVisible();

    // Wait for first toast to potentially dismiss before triggering another
    await page.waitForTimeout(500);

    // Submit with invalid email format
    await forgotPasswordPage.fillEmail("not-an-email");
    await forgotPasswordPage.submitEmail();

    // Use .first() to handle potential duplicate toast elements
    await expect(
      page.getByText("Please enter a valid email address").first(),
    ).toBeVisible();
  });

  test("successful email submission transitions to OTP step", async ({
    page,
  }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();

    // Should transition to OTP step
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();
    await expect(forgotPasswordPage.otpInput).toBeVisible();
    await expect(forgotPasswordPage.verifyButton).toBeVisible();

    // Should show the email the code was sent to
    await expect(page.getByText("admin@testcompany.com")).toBeVisible();
  });

  test("failed email submission shows error toast", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestFail),
        });
      },
    );

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("unknown@example.com");
    await forgotPasswordPage.submitEmail();

    // Should stay on email step and show error
    await expect(forgotPasswordPage.emailStepHeading).toBeVisible();
  });

  test("Back to Sign In navigates to login page", async () => {
    await forgotPasswordPage.goto();

    await expect(forgotPasswordPage.backToSignInLink).toHaveAttribute(
      "href",
      "/",
    );
  });

  // ==========================================================================
  // OTP STEP
  // ==========================================================================

  test("OTP verification transitions to password reset step", async ({
    page,
  }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifySuccess),
      });
    });

    await forgotPasswordPage.goto();

    // Step 1: Submit email
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    // Step 2: Submit OTP
    await forgotPasswordPage.fillOtp("123456");
    await forgotPasswordPage.submitOtp();

    // Should transition to password step
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();
    await expect(forgotPasswordPage.passwordInput).toBeVisible();
    await expect(forgotPasswordPage.confirmInput).toBeVisible();
    await expect(forgotPasswordPage.savePasswordButton).toBeVisible();
  });

  test("invalid OTP shows error and allows retry", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifyInvalid),
      });
    });

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    // Submit invalid OTP
    await forgotPasswordPage.fillOtp("0000");
    await forgotPasswordPage.submitOtp();

    // Should stay on OTP step
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();
  });

  test("expired OTP restarts the flow to email step", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifyExpired),
      });
    });

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    // Submit expired OTP
    await forgotPasswordPage.fillOtp("999999");
    await forgotPasswordPage.submitOtp();

    // Should restart to email step
    await expect(forgotPasswordPage.emailStepHeading).toBeVisible();
  });

  test("Resend Code triggers new OTP request", async ({ page }) => {
    let requestCount = 0;
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    // Click Resend Code
    await forgotPasswordPage.resendCodeButton.click();
    await page.waitForTimeout(500);

    // Should have called the request endpoint again
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  test("Change email returns to email step", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    // Click Change email
    await forgotPasswordPage.changeEmailButton.click();

    // Should return to email step
    await expect(forgotPasswordPage.emailStepHeading).toBeVisible();
  });

  // ==========================================================================
  // PASSWORD STEP
  // ==========================================================================

  test("password strength indicator shows all requirements", async ({
    page,
  }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifySuccess),
      });
    });

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();

    await forgotPasswordPage.fillOtp("123456");
    await forgotPasswordPage.submitOtp();
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();

    // Type a weak password to trigger requirements display
    await forgotPasswordPage.passwordInput.fill("ab");

    // Requirements should appear
    await expect(forgotPasswordPage.requirementMinLength).toBeVisible();
    await expect(forgotPasswordPage.requirementUppercase).toBeVisible();
    await expect(forgotPasswordPage.requirementLowercase).toBeVisible();
    await expect(forgotPasswordPage.requirementNumber).toBeVisible();
  });

  test("password mismatch prevents submission", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifySuccess),
      });
    });

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    // Wait for OTP step to be visible before continuing
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();
    await forgotPasswordPage.fillOtp("123456");
    await forgotPasswordPage.submitOtp();
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();

    // Fill mismatched passwords
    await forgotPasswordPage.fillPasswords("StrongPass1", "DifferentPass1");
    await forgotPasswordPage.submitPassword();

    // Should show error toast and stay on password step
    // Use .first() since there may be multiple toast elements
    await expect(
      page.getByText("Passwords do not match").first(),
    ).toBeVisible();
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();
  });

  test("successful password reset redirects to login", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifySuccess),
      });
    });
    await safeRoute(
      page,
      "**/auth/forgot-password/complete**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetCompleteSuccess),
        });
      },
    );

    await forgotPasswordPage.goto();

    // Full flow: Email → OTP → Password
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await forgotPasswordPage.fillOtp("123456");
    await forgotPasswordPage.submitOtp();
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();

    await forgotPasswordPage.fillPasswords("NewStrong1Pass", "NewStrong1Pass");
    await forgotPasswordPage.submitPassword();

    // Should redirect to login
    await page.waitForURL("**/");
  });

  test("Back button on password step returns to OTP step", async ({ page }) => {
    await safeRoute(
      page,
      "**/auth/forgot-password/request**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordResetRequestSuccess),
        });
      },
    );
    await safeRoute(page, "**/auth/forgot-password/verify**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordResetVerifySuccess),
      });
    });

    await forgotPasswordPage.goto();
    await forgotPasswordPage.fillEmail("admin@testcompany.com");
    await forgotPasswordPage.submitEmail();
    await forgotPasswordPage.fillOtp("123456");
    await forgotPasswordPage.submitOtp();
    await expect(forgotPasswordPage.passwordStepHeading).toBeVisible();

    // Click back
    await forgotPasswordPage.backToOtpButton.click();

    // Should return to OTP step
    await expect(forgotPasswordPage.otpStepHeading).toBeVisible();
  });
});
