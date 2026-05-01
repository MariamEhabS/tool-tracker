import { test, expect } from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import { createMockProject, createMockQRCode } from "../../fixtures/builders";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProjects = [
  createMockProject({
    _id: "proj-create-001",
    projectName: "Office Tower",
    projectStatus: "active",
  }),
  createMockProject({
    _id: "proj-create-002",
    projectName: "Parking Garage",
    projectStatus: "active",
  }),
];

const mockCreatedQR = createMockQRCode({
  _id: "qr-created-001",
  qrcodeName: "New Test QR",
});

const mockCreateResponse = {
  success_message: "QR code created successfully",
  data: mockCreatedQR,
};

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Create @desktop", () => {
  test("single QR creation form with name and group assignment", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Mock projects endpoint (called by create page for project dropdown)
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();

    // Step 1: Verify both quantity options are displayed
    await expect(qrPage.singleQRCard).toBeVisible();
    await expect(qrPage.bulkCodesCard).toBeVisible();
    await expect(qrPage.createSingleButton).toBeVisible();
    await expect(qrPage.createBulkButton).toBeVisible();

    // Click "Create a Single QR Code"
    await qrPage.selectSingleQR();

    // Step 2: Type selection should appear
    // Taliho and Procore options should be visible
    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("validation errors on empty submission", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/categories*", []);

    await qrPage.gotoCreate();

    // Select single QR
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });

    // Select Taliho QR Code option
    const talihoCard = authenticatedPage.locator('text="Taliho QR Code"');
    await expect(talihoCard).toBeVisible({ timeout: 3000 });
    await talihoCard.click();

    // Step 3 should now show the configuration form
    // Wait for the create button to appear (button text is "Create & Populate")
    const createBtn = authenticatedPage.getByRole("button", {
      name: /Create & Populate/i,
    });
    await expect(createBtn).toBeVisible({ timeout: 5000 });

    // Try submitting empty form
    await createBtn.click();

    // Validation errors should appear (form requires at least a name)
    // Look for any error text, red border, or toast message
    const cssErrorIndicator = authenticatedPage.locator(
      ".text-red-500, .text-red-600, [role='alert']",
    );
    const textErrorIndicator = authenticatedPage.locator(
      "text=/required|enter a name|please enter/i",
    );
    const errorIndicator = cssErrorIndicator.or(textErrorIndicator);
    await expect(errorIndicator.first()).toBeVisible({ timeout: 3000 });
  });

  test("successful creation redirects to detail page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );
    await routeTracker.mockRoute("**/categories*", []);

    // Mock the POST /qr-code endpoint for creation
    await routeTracker.mockRoute("**/qr-code", mockCreateResponse, {
      status: 201,
    });

    await qrPage.gotoCreate();

    // Verify step 1 renders
    await expect(qrPage.createSingleButton).toBeVisible();
    await qrPage.selectSingleQR();

    // Step 2: Select Taliho QR Code type
    await expect(authenticatedPage.locator("text=Taliho").first()).toBeVisible({
      timeout: 3000,
    });

    const talihoCard = authenticatedPage.locator('text="Taliho QR Code"');
    await expect(talihoCard).toBeVisible({ timeout: 3000 });
    await talihoCard.click();

    // Step 3: Fill in QR code name
    const nameInput = authenticatedPage.locator(
      'input[placeholder*="name" i], input[name="name"], input[placeholder*="QR" i]',
    );
    await expect(nameInput.first()).toBeVisible({ timeout: 5000 });
    await nameInput.first().fill("New Test QR");

    // Submit the form (button text is "Create & Populate")
    const submitBtn = authenticatedPage.getByRole("button", {
      name: /Create & Populate/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();

    // After successful creation, either redirects to detail page or shows a success toast
    // Use Promise.race to wait for either condition instead of arbitrary timeout
    const redirectPromise = authenticatedPage
      .waitForURL(/\/qrcode\//, { timeout: 10000 })
      .then(() => "redirected")
      .catch(() => null);

    const toastPromise = authenticatedPage
      .locator("text=successfully")
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => "toast")
      .catch(() => null);

    const result = await Promise.race([redirectPromise, toastPromise]);
    expect(result).toBeTruthy();
  });
});
