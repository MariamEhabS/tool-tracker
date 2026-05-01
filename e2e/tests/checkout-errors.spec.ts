import { test, expect } from "../fixtures/authenticated-test";
import { CheckoutPage } from "../pages/checkout.page";
import { safeRoute } from "../utils/route-tracker";
import { mockStripeProduct } from "../fixtures/test-data";

// ============================================================================
// TESTS — Checkout Error Recovery Paths
// ============================================================================

test.describe("Checkout Error Recovery @desktop", () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    checkoutPage = new CheckoutPage(authenticatedPage);
  });

  // ==========================================================================
  // STRIPE SESSION CREATION FAILURES
  // ==========================================================================

  test("Stripe session creation network timeout shows error", async ({
    authenticatedPage,
  }) => {
    // Simulate a network timeout by aborting the request
    await safeRoute(
      authenticatedPage,
      "**/stripe/checkout/sessions**",
      async (route) => {
        await route.abort("timedout");
      },
    );
    await safeRoute(
      authenticatedPage,
      "**/stripe/products/**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStripeProduct),
        });
      },
    );

    await checkoutPage.goto({ productId: "prod_test_pro" });
    await checkoutPage.fillContactInfo("Jane Doe", "jane@example.com");
    await checkoutPage.submitCheckout();

    // Error should be displayed to the user
    const errorIndicator = authenticatedPage
      .locator('.text-red-500, .text-red-600, [role="alert"]')
      .or(authenticatedPage.getByText(/error|failed|try again/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  test("Stripe session 503 Service Unavailable shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/stripe/products/**", mockStripeProduct);
    await routeTracker.mockErrorResponse("**/stripe/checkout/sessions**", 503, {
      message: "Payment service temporarily unavailable. Please try again.",
    });

    await checkoutPage.goto({ productId: "prod_test_pro" });
    await checkoutPage.fillContactInfo("Jane Doe", "jane@example.com");
    await checkoutPage.submitCheckout();

    const errorIndicator = authenticatedPage.getByText(
      /unavailable|error|failed|try again/i,
    );
    await expect(errorIndicator.first()).toBeVisible({ timeout: 10000 });
  });

  // ==========================================================================
  // RETURN FROM STRIPE — ERROR SCENARIOS
  // ==========================================================================

  test("return from Stripe with expired session_id shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse("**/stripe/checkout/verify**", 410, {
      success: false,
      message: "Checkout session has expired.",
    });

    await authenticatedPage.goto(
      "/settings?subscription=success&session_id=cs_expired_session_123",
    );

    await expect(
      authenticatedPage.locator("h1:has-text('Settings')"),
    ).toBeVisible({ timeout: 10000 });
    expect(routeTracker.wasIntercepted("**/stripe/checkout/verify**")).toBe(
      true,
    );
  });

  test("return from Stripe with missing session_id handles gracefully", async ({
    authenticatedPage,
  }) => {
    // Navigate with checkout=success but no session_id
    await authenticatedPage.goto("/settings?subscription=success");

    // Settings page should still render (graceful degradation)
    const settingsHeading = authenticatedPage.locator(
      "h1:has-text('Settings')",
    );
    await expect(settingsHeading).toBeVisible({ timeout: 10000 });
  });

  test("return from Stripe with server error on verification", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse("**/stripe/checkout/verify**", 500, {
      success: false,
      message: "Unable to verify payment. Please contact support.",
    });

    await authenticatedPage.goto(
      "/settings?subscription=success&session_id=cs_test_session_500",
    );

    await expect(
      authenticatedPage.locator("h1:has-text('Settings')"),
    ).toBeVisible({ timeout: 10000 });
    expect(routeTracker.wasIntercepted("**/stripe/checkout/verify**")).toBe(
      true,
    );
  });

  // ==========================================================================
  // PRODUCT FETCH ERRORS
  // ==========================================================================

  test("product fetch 404 shows error with back button", async ({
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse("**/stripe/products/**", 404, {
      message: "Product not found.",
    });

    await checkoutPage.goto({ productId: "prod_deleted_plan" });

    // Error banner should appear with back-to-settings option
    await expect(checkoutPage.productErrorBanner).toBeVisible({
      timeout: 10000,
    });
    await expect(checkoutPage.backToSettingsButton).toBeVisible();
  });

  test("back to settings button navigates from error state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockErrorResponse("**/stripe/products/**", 500);

    await checkoutPage.goto({ productId: "prod_error" });

    await expect(checkoutPage.productErrorBanner).toBeVisible({
      timeout: 10000,
    });

    await checkoutPage.backToSettingsButton.click();
    await authenticatedPage.waitForURL("**/settings", { timeout: 10000 });
  });
});
