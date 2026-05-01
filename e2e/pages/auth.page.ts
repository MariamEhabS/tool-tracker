import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Login (/) and Signup (/signup) routes.
 * Provides selectors and helpers for authentication flow E2E tests.
 */
export class AuthPage {
  readonly page: Page;

  // ---- Login Page ----
  readonly loginHeading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly procoreSignInButton: Locator;

  // ---- Signup — Registration Step ----
  readonly createAccountHeading: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly companyInput: Locator;
  readonly continueButton: Locator;
  readonly signInFromSignupLink: Locator;

  // ---- Signup — OTP Step ----
  readonly verifyEmailHeading: Locator;
  readonly otpInput: Locator;
  readonly verifyCodeButton: Locator;
  readonly resendCodeButton: Locator;
  readonly backToRegistrationButton: Locator;

  // ---- Signup — Password Step ----
  readonly setPasswordHeading: Locator;
  readonly confirmPasswordInput: Locator;
  readonly completeSetupButton: Locator;
  readonly passwordMismatchError: Locator;
  readonly requirementMinLength: Locator;
  readonly requirementUppercase: Locator;
  readonly requirementLowercase: Locator;
  readonly requirementNumber: Locator;

  constructor(page: Page) {
    this.page = page;

    // Login
    this.loginHeading = page.getByRole("heading", { name: "Welcome back" });
    this.emailInput = page.locator("#email");
    this.passwordInput = page.locator("#password");
    this.signInButton = page.getByRole("button", {
      name: "Sign In",
      exact: true,
    });
    this.forgotPasswordLink = page.getByRole("link", {
      name: /Forgot your password/,
    });
    this.signUpLink = page.getByRole("link", { name: "Sign up for free" });
    this.procoreSignInButton = page.getByRole("button", {
      name: /Sign in with Procore/,
    });

    // Signup — Registration
    this.createAccountHeading = page.getByRole("heading", {
      name: "Create your account",
    });
    this.firstNameInput = page.locator("#firstName");
    this.lastNameInput = page.locator("#lastName");
    this.companyInput = page.locator("#company");
    this.continueButton = page.getByRole("button", { name: "Continue" });
    this.signInFromSignupLink = page.getByRole("link", { name: "Sign in" });

    // Signup — OTP
    this.verifyEmailHeading = page.getByRole("heading", {
      name: "Verify your email",
    });
    this.otpInput = page.locator("#otp");
    this.verifyCodeButton = page.getByRole("button", { name: "Verify Code" });
    this.resendCodeButton = page.getByRole("button", { name: "Resend Code" });
    this.backToRegistrationButton = page.getByRole("button", {
      name: /Back to Registration/,
    });

    // Signup — Password
    this.setPasswordHeading = page.getByRole("heading", {
      name: "Set your password",
    });
    this.confirmPasswordInput = page.locator("#confirmPassword");
    this.completeSetupButton = page.getByRole("button", {
      name: "Complete Setup",
    });
    this.passwordMismatchError = page.getByText("Passwords do not match");
    this.requirementMinLength = page.getByText("At least 8 characters");
    this.requirementUppercase = page.getByText("One uppercase letter");
    this.requirementLowercase = page.getByText("One lowercase letter");
    this.requirementNumber = page.getByText("One number");
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async gotoLogin() {
    await this.page.goto("/");
  }

  async gotoSignup() {
    await this.page.goto("/signup");
  }

  async gotoSignupStep(step: string, params?: Record<string, string>) {
    const searchParams = new URLSearchParams({ step, ...params });
    await this.page.goto(`/signup?${searchParams.toString()}`);
  }

  // ============================================================================
  // LOGIN ACTIONS
  // ============================================================================

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  // ============================================================================
  // SIGNUP ACTIONS
  // ============================================================================

  async fillRegistration(
    email: string,
    firstName: string,
    lastName: string,
    company: string,
  ) {
    await this.emailInput.fill(email);
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.companyInput.fill(company);
  }

  async submitRegistration() {
    await this.continueButton.click();
  }

  async fillAndSubmitOtp(code: string) {
    await this.otpInput.fill(code);
    await this.verifyCodeButton.click();
  }

  async fillPasswords(password: string, confirmPassword: string) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async submitPassword() {
    await this.completeSetupButton.click();
  }
}
