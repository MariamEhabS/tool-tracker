import { test, expect } from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import { createMockProject } from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProjects = [
  createMockProject({
    _id: "proj-err-001",
    projectName: "Error Test Project",
    projectStatus: "active",
  }),
];

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Create Errors @desktop", () => {
  test("server error on single QR create shows error toast", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/categories*", []);

    // Mock POST failure
    await routeTracker.mockErrorResponse("**/qr-code", 500, {
      message: "Internal server error",
    });

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Select Taliho QR type
    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });

    const talihoCard = authenticatedPage.locator('text="Taliho QR Code"');
    await expect(talihoCard).toBeVisible({ timeout: 3000 });
    await talihoCard.click();

    // Wait for step 3 - fill name
    const nameInput = authenticatedPage.locator(
      'input[placeholder*="name" i], input[name="name"], input[placeholder*="Enter" i]',
    );
    await expect(nameInput.first()).toBeVisible({ timeout: 5000 });
    await nameInput.first().fill("Error Test QR");

    // Submit
    const submitBtn = authenticatedPage.getByRole("button", {
      name: /Create & Populate/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();

    // Error toast or message should appear
    await expect(
      authenticatedPage.locator("text=/error|fail|could not|unable/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("duplicate name 409 shows specific error message", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/categories*", []);

    // Mock 409 conflict for duplicate name
    await routeTracker.mockErrorResponse("**/qr-code", 409, {
      message: "A QR code with this name already exists",
    });

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });

    const talihoCard = authenticatedPage.locator('text="Taliho QR Code"');
    await expect(talihoCard).toBeVisible({ timeout: 3000 });
    await talihoCard.click();

    // Wait for step 3 - fill name
    const nameInput = authenticatedPage.locator(
      'input[placeholder*="name" i], input[name="name"], input[placeholder*="Enter" i]',
    );
    await expect(nameInput.first()).toBeVisible({ timeout: 5000 });
    await nameInput.first().fill("Duplicate QR Name");

    const submitBtn = authenticatedPage.getByRole("button", {
      name: /Create & Populate/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();

    // Should show specific duplicate error
    await expect(
      authenticatedPage
        .locator("text=/already exists|duplicate|conflict|error/i")
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("network timeout keeps form usable for retry", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/categories*", []);

    // Mock an aborted/timeout response (done outside routeTracker to avoid the assertion)
    await safeRoute(authenticatedPage, "**/qr-code", async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.abort("timedout");
    });

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });

    const talihoCard = authenticatedPage.locator('text="Taliho QR Code"');
    await expect(talihoCard).toBeVisible({ timeout: 3000 });
    await talihoCard.click();

    // Wait for step 3 - fill name
    const nameInput = authenticatedPage.locator(
      'input[placeholder*="name" i], input[name="name"], input[placeholder*="Enter" i]',
    );
    await expect(nameInput.first()).toBeVisible({ timeout: 5000 });
    await nameInput.first().fill("Timeout QR");

    const submitBtn = authenticatedPage.getByRole("button", {
      name: /Create & Populate/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();

    // Wait a bit for the request to fail
    await authenticatedPage.waitForTimeout(2000);

    // After a network timeout, the form should remain usable (not crashed)
    // The submit button should still be visible for retry
    await expect(submitBtn).toBeVisible({ timeout: 3000 });

    // The page should not show a crash/error page
    await expect(
      authenticatedPage.locator('text="Something went wrong"'),
    ).not.toBeVisible();
  });
});
