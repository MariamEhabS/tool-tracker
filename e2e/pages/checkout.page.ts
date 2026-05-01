import { Page, Locator } from "@playwright/test";

/**
 * Page Object for the Checkout (/checkout) route.
 * Handles contact info form, payment section, and order summary.
 */
export class CheckoutPage {
  readonly page: Page;

  // ---- Page Header ----
  readonly pageHeading: Locator;
  readonly stripeSubtitle: Locator;

  // ---- Contact Info ----
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;

  // ---- Payment Section ----
  readonly paymentHeading: Locator;
  readonly secureCheckoutNotice: Locator;
  readonly continueToPaymentButton: Locator;
  readonly cancelButton: Locator;
  readonly errorBanner: Locator;

  // ---- Order Summary ----
  readonly orderSummaryHeading: Locator;
  readonly productName: Locator;
  readonly productDescription: Locator;
  readonly priceDisplay: Locator;
  readonly totalDisplay: Locator;

  // ---- Loading/Error States ----
  readonly loadingSpinner: Locator;
  readonly productErrorBanner: Locator;
  readonly backToSettingsButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page Header
    this.pageHeading = page.getByRole("heading", { name: "Checkout" });
    this.stripeSubtitle = page.getByText("Secure payment powered by Stripe");

    // Contact Info
    this.fullNameInput = page.locator('input[placeholder="Jane Doe"]');
    this.emailInput = page.locator('input[placeholder="jane@example.com"]');

    // Payment Section
    this.paymentHeading = page.getByText("Payment", { exact: true });
    this.secureCheckoutNotice = page.getByText("Secure Checkout").first();
    this.continueToPaymentButton = page.getByRole("button", {
      name: /Continue to Payment/,
    });
    this.cancelButton = page.getByRole("button", { name: /Cancel/ });
    this.errorBanner = page.locator(".bg-red-50.border.border-red-200");

    // Order Summary
    this.orderSummaryHeading = page.getByText("Order summary");
    this.productName = page.locator(".font-medium.text-gray-900.truncate");
    this.productDescription = page.locator(
      ".text-xs.text-gray-500.line-clamp-2",
    );
    this.priceDisplay = page.locator("dt:has-text('Price') + dd");
    this.totalDisplay = page.locator("dt:has-text('Total') + dd");

    // Loading/Error States
    this.loadingSpinner = page.locator(".animate-spin");
    this.productErrorBanner = page.locator(
      ".bg-red-50.border.border-red-200.rounded-lg.p-6",
    );
    this.backToSettingsButton = page.getByRole("button", {
      name: /Back to Settings/,
    });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  async goto(params?: { productId?: string; priceId?: string }) {
    const search = new URLSearchParams();
    if (params?.productId) search.set("productId", params.productId);
    if (params?.priceId) search.set("priceId", params.priceId);
    const qs = search.toString();
    await this.page.goto(`/checkout${qs ? `?${qs}` : ""}`);
  }

  // ============================================================================
  // FORM ACTIONS
  // ============================================================================

  async fillContactInfo(fullName: string, email: string) {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
  }

  async submitCheckout() {
    await this.continueToPaymentButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }
}
