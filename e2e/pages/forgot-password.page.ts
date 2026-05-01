import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Forgot Password (/forgot-password) route.
 * Multi-step flow: Email → OTP → Password Reset.
 */
export class ForgotPasswordPage {
  readonly page: Page;

  // ---- Step Indicator ----
  readonly stepEmail: Locator;
  readonly stepVerify: Locator;
  readonly stepReset: Locator;

  // ---- Email Step ----
  readonly emailStepHeading: Locator;
  readonly emailInput: Locator;
  readonly sendCodeButton: Locator;
  readonly backToSignInLink: Locator;

  // ---- OTP Step ----
  readonly otpStepHeading: Locator;
  readonly otpInput: Locator;
  readonly verifyButton: Locator;
  readonly resendCodeButton: Locator;
  readonly changeEmailButton: Locator;

  // ---- Password Step ----
  readonly passwordStepHeading: Locator;
  readonly passwordInput: Locator;
  readonly confirmInput: Locator;
  readonly savePasswordButton: Locator;
  readonly backToOtpButton: Locator;

  // ---- Password Requirements ----
  readonly requirementMinLength: Locator;
  readonly requirementUppercase: Locator;
  readonly requirementLowercase: Locator;
  readonly requirementNumber: Locator;

  constructor(page: Page) {
    this.page = page;

    // Step indicators - target the span elements inside the step indicator divs
    // The step indicator structure is: div > span.text-xs (label)
    // Use more specific selectors to avoid matching form labels
    this.stepEmail = page.locator(
      ".flex.items-center.justify-center span.text-xs:has-text('Email')",
    );
    this.stepVerify = page.locator(
      ".flex.items-center.justify-center span.text-xs:has-text('Verify')",
    );
    this.stepReset = page.locator(
      ".flex.items-center.justify-center span.text-xs:has-text('Reset')",
    );

    // Email Step
    this.emailStepHeading = page.getByRole("heading", {
      name: "Forgot password?",
    });
    this.emailInput = page.locator("#email");
    this.sendCodeButton = page.getByRole("button", { name: "Send Code" });
    this.backToSignInLink = page.getByRole("link", {
      name: /Back to Sign In/,
    });

    // OTP Step
    this.otpStepHeading = page.getByRole("heading", { name: "Verify code" });
    this.otpInput = page.locator("#otp");
    this.verifyButton = page.getByRole("button", { name: "Verify" });
    this.resendCodeButton = page.getByRole("button", { name: "Resend Code" });
    this.changeEmailButton = page.getByRole("button", {
      name: /Change email/,
    });

    // Password Step
    this.passwordStepHeading = page.getByRole("heading", {
      name: "Set new password",
    });
    this.passwordInput = page.locator("#password");
    this.confirmInput = page.locator("#confirm");
    this.savePasswordButton = page.getByRole("button", {
      name: "Save Password",
    });
    this.backToOtpButton = page.getByRole("button", { name: /← Back/ });

    // Password Requirements
    this.requirementMinLength = page.getByText("At least 8 characters");
    this.requirementUppercase = page.getByText("One uppercase letter");
    this.requirementLowercase = page.getByText("One lowercase letter");
    this.requirementNumber = page.getByText("One number");
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto() {
    await this.page.goto("/forgot-password");
  }

  // ============================================================================
  // EMAIL STEP ACTIONS
  // ============================================================================

  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  async submitEmail() {
    await this.sendCodeButton.click();
  }

  // ============================================================================
  // OTP STEP ACTIONS
  // ============================================================================

  async fillOtp(code: string) {
    await this.otpInput.fill(code);
  }

  async submitOtp() {
    await this.verifyButton.click();
  }

  // ============================================================================
  // PASSWORD STEP ACTIONS
  // ============================================================================

  async fillPasswords(password: string, confirm: string) {
    await this.passwordInput.fill(password);
    await this.confirmInput.fill(confirm);
  }

  async submitPassword() {
    await this.savePasswordButton.click();
  }
}
