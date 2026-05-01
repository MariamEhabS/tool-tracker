import { test, expect, mockAuthCompany } from "../fixtures/authenticated-test";
import { mockStripeAddonSuccess } from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

// The actual endpoint is POST /company/{companyId}/addons
const ADDONS_ENDPOINT_PATTERN = `**/company/${mockAuthCompany._id}/addons`;

test.describe("Storage Success @desktop", () => {
  // ==========================================================================
  // RENDERING
  // ==========================================================================

  test("shows success confirmation with checkmark icon", async ({
    authenticatedPage,
  }) => {
    // Use safeRoute since this endpoint may or may not be called depending on timing
    await safeRoute(
      authenticatedPage,
      ADDONS_ENDPOINT_PATTERN,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStripeAddonSuccess),
        });
      },
    );

    await authenticatedPage.goto(
      "/storage/success?session_id=cs_test_session_123",
    );

    // Should show success state
    await expect(
      authenticatedPage.getByRole("heading", {
        name: "Storage extension confirmed",
      }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Your storage capacity has been increased"),
    ).toBeVisible();
    await expect(authenticatedPage.locator("i.bx-check-circle")).toBeVisible();
  });

  test("Back to Settings navigates to /settings", async ({
    authenticatedPage,
  }) => {
    // Set up mocks for settings page navigation
    const settingsMocks = [
      { pattern: "**/user/**", data: { data: [], total_items: 0 } },
      { pattern: "**/categories*", data: { data: [] } },
      { pattern: "**/categories/classes*", data: { data: [] } },
      { pattern: "**/storage-stats**", data: {} },
      { pattern: "**/storage-history**", data: { history: [] } },
      { pattern: "**/stripe/products**", data: { data: [] } },
      { pattern: "**/procore-status**", data: { connected: false } },
      {
        pattern: "**/procore-integration-details**",
        data: { owners: [], connectedUsers: [] },
      },
    ];
    for (const mock of settingsMocks) {
      await safeRoute(authenticatedPage, mock.pattern, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mock.data),
        });
      });
    }

    await safeRoute(
      authenticatedPage,
      ADDONS_ENDPOINT_PATTERN,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStripeAddonSuccess),
        });
      },
    );

    await authenticatedPage.goto(
      "/storage/success?session_id=cs_test_session_123",
    );

    // Wait for API call to finish before clicking
    await authenticatedPage.waitForTimeout(500);

    const backButton = authenticatedPage.getByRole("button", {
      name: "Back to Settings",
    });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should navigate to settings
    // The component uses window.location.assign, so we check the URL
    await authenticatedPage.waitForURL("**/settings");
  });

  test("registers Stripe session on mount", async ({ authenticatedPage }) => {
    // Create a promise that resolves when the endpoint is called
    let resolveEndpointCalled: (value: boolean) => void;
    const endpointCalledPromise = new Promise<boolean>((resolve) => {
      resolveEndpointCalled = resolve;
    });

    await safeRoute(
      authenticatedPage,
      ADDONS_ENDPOINT_PATTERN,
      async (route) => {
        resolveEndpointCalled(true);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStripeAddonSuccess),
        });
      },
    );

    await authenticatedPage.goto(
      "/storage/success?session_id=cs_test_session_123",
    );

    // Wait for the endpoint to be called (with timeout)
    const wasEndpointCalled = await Promise.race([
      endpointCalledPromise,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
    ]);

    // Should have called the storage addon endpoint
    expect(wasEndpointCalled).toBe(true);
  });

  test("shows Saving state while API call is in progress", async ({
    authenticatedPage,
  }) => {
    // Use a delayed response to catch the saving state
    await safeRoute(
      authenticatedPage,
      ADDONS_ENDPOINT_PATTERN,
      async (route) => {
        // Delay the response to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockStripeAddonSuccess),
        });
      },
    );

    await authenticatedPage.goto(
      "/storage/success?session_id=cs_test_session_123",
    );

    // Button should show Saving state
    await expect(
      authenticatedPage.getByRole("button", { name: "Saving…" }),
    ).toBeVisible();

    // After save completes, should show Back to Settings
    await expect(
      authenticatedPage.getByRole("button", { name: "Back to Settings" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("handles missing session_id gracefully", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/storage/success");

    // Should still show the success page (just won't call API)
    await expect(
      authenticatedPage.getByRole("heading", {
        name: "Storage extension confirmed",
      }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Back to Settings" }),
    ).toBeVisible();
  });
});
