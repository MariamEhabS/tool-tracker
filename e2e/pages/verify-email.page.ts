import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Verify Email (/verify-email/:token) route.
 * Handles token verification and invited user account completion.
 */
export class VerifyEmailPage {
  readonly page: Page;

  // ---- Loading State ----
  readonly loadingSpinner: Locator;
  readonly verifyingText: Locator;

  // ---- Error States ----
  readonly errorTitle: Locator;
  readonly errorMessage: Locator;
  readonly goToLoginLink: Locator;
  readonly contactAdminLink: Locator;

  // ---- Account Completion Form ----
  readonly completeAccountHeading: Locator;
  readonly companyNameDisplay: Locator;
  readonly emailInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly completeSetupButton: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // Loading - the component uses a div with animate-spin class for the spinner
    this.loadingSpinner = page.locator(".animate-spin");
    // Use .first() as the text appears in both sidebar and main content
    this.verifyingText = page.getByText("Verifying your invitation...").first();

    // Error States - the component renders h1 inside .max-w-md.w-full.bg-white
    // Error title is inside the card container
    this.errorTitle = page.locator(
      ".max-w-md.w-full.bg-white h1.text-2xl.font-bold",
    );
    this.errorMessage = page.locator(
      ".max-w-md.w-full.bg-white p.text-gray-600",
    );
    this.goToLoginLink = page.getByRole("link", { name: "Go to Login" });
    this.contactAdminLink = page.getByRole("link", {
      name: "Contact Administrator",
    });

    // Account Completion Form
    this.completeAccountHeading = page.getByRole("heading", {
      name: "Complete Your Account",
    });
    // Company name is inside a span.font-semibold within the header paragraph
    this.companyNameDisplay = page.locator("span.font-semibold").first();
    // Email input is read-only - look for the specific input in the email section
    this.emailInput = page.locator('input[type="email"][readonly]');
    // Use label-based selectors for more reliable matching
    this.firstNameInput = page.getByLabel("First Name");
    this.lastNameInput = page.getByLabel("Last Name");
    // Password fields - the labels include "Password"
    this.passwordInput = page.getByLabel("Password", { exact: true });
    this.confirmPasswordInput = page.getByLabel("Confirm Password");
    this.completeSetupButton = page.getByRole("button", {
      name: "Complete Setup",
    });
    this.loginLink = page.getByRole("link", { name: /Log in|Sign in/ });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto(token: string) {
    await this.page.goto(`/verify-email/${token}`);
  }

  // ============================================================================
  // FORM ACTIONS
  // ============================================================================

  async fillAccountForm(data: {
    firstName?: string;
    lastName?: string;
    password: string;
    confirmPassword: string;
  }) {
    if (data.firstName) await this.firstNameInput.fill(data.firstName);
    if (data.lastName) await this.lastNameInput.fill(data.lastName);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);
  }

  async submitForm() {
    await this.completeSetupButton.click();
  }
}
