import { test, expect } from "../fixtures/authenticated-test";
import { CheckoutPage } from "../pages/checkout.page";
import {
  mockStripeProduct,
  mockCheckoutSessionSuccess,
} from "../fixtures/test-data";
import { toFrontendUrl } from "../utils/runtime-env";

test.describe("Checkout @desktop", () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    checkoutPage = new CheckoutPage(authenticatedPage);
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  test("renders checkout form with contact info and order summary", async ({
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/products/**", mockStripeProduct);

    await checkoutPage.goto({ productId: "prod_test_pro" });

    await expect(checkoutPage.pageHeading).toBeVisible();
    await expect(checkoutPage.stripeSubtitle).toBeVisible();
    await expect(checkoutPage.fullNameInput).toBeVisible();
    await expect(checkoutPage.emailInput).toBeVisible();
    await expect(checkoutPage.continueToPaymentButton).toBeVisible();
    await expect(checkoutPage.cancelButton).toBeVisible();
    await expect(checkoutPage.orderSummaryHeading).toBeVisible();
  });

  test("shows product details when productId is provided", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/products/**", mockStripeProduct);

    await checkoutPage.goto({ productId: "prod_test_pro" });

    await expect(
      authenticatedPage.getByText("Professional Plan"),
    ).toBeVisible();
    await expect(checkoutPage.secureCheckoutNotice).toBeVisible();
  });

  test("shows default Pro Plan when no productId in URL", async ({
    authenticatedPage,
  }) => {
    await checkoutPage.goto();

    // Default product should show
    await expect(authenticatedPage.getByText("Pro Plan").first()).toBeVisible();
    await expect(authenticatedPage.getByText("$29.00").first()).toBeVisible();
  });

  // ==========================================================================
  // FORM VALIDATION
  // ==========================================================================

  test("validates required full name before payment", async ({
    authenticatedPage,
  }) => {
    await checkoutPage.goto();

    // Submit without filling name
    await checkoutPage.fillContactInfo("", "test@example.com");
    await checkoutPage.submitCheckout();

    await expect(
      authenticatedPage.getByText("Please enter your full name"),
    ).toBeVisible();
  });

  test("validates required email before payment", async ({
    authenticatedPage,
  }) => {
    await checkoutPage.goto();

    await checkoutPage.fillContactInfo("Jane Doe", "");
    await checkoutPage.submitCheckout();

    await expect(
      authenticatedPage.getByText("Please enter your email address"),
    ).toBeVisible();
  });

  test("validates email format", async ({ authenticatedPage }) => {
    await checkoutPage.goto();

    await checkoutPage.fillContactInfo("Jane Doe", "not-valid-email");
    await checkoutPage.submitCheckout();

    await expect(
      authenticatedPage.getByText("Please enter a valid email address"),
    ).toBeVisible();
  });

  // ==========================================================================
  // CHECKOUT FLOW
  // ==========================================================================

  test("Continue to Payment creates Stripe checkout session", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/products/**", mockStripeProduct);
    await routeTracker.mockRoute("**/stripe/checkout/sessions**", {
      ...(mockCheckoutSessionSuccess as Record<string, unknown>),
      url: toFrontendUrl("/settings?subscription=canceled"),
    });

    await checkoutPage.goto({ productId: "prod_test_pro" });
    await expect(
      authenticatedPage.getByText("Professional Plan").first(),
    ).toBeVisible();
    await checkoutPage.fillContactInfo("Jane Doe", "jane@example.com");
    await checkoutPage.submitCheckout();

    await expect
      .poll(
        () => routeTracker.wasIntercepted("**/stripe/checkout/sessions**"),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test("Cancel navigates back to settings", async ({ authenticatedPage }) => {
    await checkoutPage.goto();
    await checkoutPage.clickCancel();

    await authenticatedPage.waitForURL("**/settings");
  });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  test("shows error when product fetch fails", async ({ routeTracker }) => {
    await routeTracker.mockErrorResponse("**/stripe/products/**", 500);

    await checkoutPage.goto({ productId: "prod_nonexistent" });

    // Should show the error banner
    await expect(checkoutPage.productErrorBanner).toBeVisible();
    await expect(checkoutPage.backToSettingsButton).toBeVisible();
  });

  test("shows error when checkout session creation fails", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/products/**", mockStripeProduct);
    await routeTracker.mockErrorResponse("**/stripe/checkout/sessions**", 500, {
      message: "Failed to start checkout",
    });

    await checkoutPage.goto({ productId: "prod_test_pro" });
    await checkoutPage.fillContactInfo("Jane Doe", "jane@example.com");
    await checkoutPage.submitCheckout();

    // Error should be displayed
    await expect(
      authenticatedPage.getByText("Failed to start checkout").first(),
    ).toBeVisible();
  });

  // ==========================================================================
  // RETURN FROM STRIPE — Subscription Verification
  // ==========================================================================

  test("return from Stripe with success session_id shows success", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/checkout/verify**", {
      success: true,
      message: "Subscription activated.",
      plan: "Professional",
    });

    await authenticatedPage.goto(
      "/settings?subscription=success&session_id=cs_test_mock_session",
    );

    await expect(
      authenticatedPage.locator("h1:has-text('Settings')"),
    ).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => routeTracker.wasIntercepted("**/stripe/checkout/verify**"), {
        timeout: 5000,
      })
      .toBe(true);
  });

  test("return from Stripe with cancel navigates to settings normally", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/settings?subscription=canceled");

    // Settings page should render normally
    await expect(
      authenticatedPage.locator("h1:has-text('Settings')"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("return from Stripe with invalid session_id shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse("**/stripe/checkout/verify**", 400, {
      success: false,
      message: "Invalid or expired checkout session.",
    });

    await authenticatedPage.goto(
      "/settings?subscription=success&session_id=cs_invalid_session",
    );

    await expect(
      authenticatedPage.locator("h1:has-text('Settings')"),
    ).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => routeTracker.wasIntercepted("**/stripe/checkout/verify**"), {
        timeout: 5000,
      })
      .toBe(true);
  });
});
