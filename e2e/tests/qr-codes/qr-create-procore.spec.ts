import { test, expect } from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import { createMockProject } from "../../fixtures/builders";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProjects = [
  createMockProject({
    _id: "proj-procore-001",
    projectName: "Downtown Tower",
    projectStatus: "active",
    procoreProjectID: "12345",
    procoreCompanyID: "1001",
  }),
  createMockProject({
    _id: "proj-procore-002",
    projectName: "Industrial Complex",
    projectStatus: "active",
  }),
];

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Create - Procore Path @desktop", () => {
  let qrPage: QRCodesPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    qrPage = new QRCodesPage(authenticatedPage);
  });

  // ==========================================================================
  // STEP 1 - QUANTITY SELECTION
  // ==========================================================================

  test("displays Single and Bulk QR creation options", async ({
    routeTracker,
  }) => {
    // Only mock routes that will actually be called
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();

    await expect(qrPage.singleQRCard).toBeVisible();
    await expect(qrPage.bulkCodesCard).toBeVisible();
    await expect(qrPage.createSingleButton).toBeVisible();
    await expect(qrPage.createBulkButton).toBeVisible();
  });

  // ==========================================================================
  // STEP 2 - TYPE SELECTION (PROCORE)
  // ==========================================================================

  test("shows Taliho and Procore sections after selecting single QR", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Both Taliho and Procore sections should be visible
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Procore section header should be visible
    await expect(
      authenticatedPage.locator(
        'div.text-sm.font-semibold:has-text("Procore")',
      ),
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows Location option under Procore", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Location card should be visible with descriptive subtitle
    const locationCard = authenticatedPage.locator('text="Location"');
    await expect(locationCard.first()).toBeVisible({ timeout: 3000 });

    // The subtitle should mention Procore location
    await expect(
      authenticatedPage.locator("text=/Procore location/i"),
    ).toBeVisible({ timeout: 3000 });
  });

  test("shows Tool option under Procore", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Tool card should be visible
    const toolCard = authenticatedPage.locator('text="Tool"');
    await expect(toolCard.first()).toBeVisible({ timeout: 3000 });

    // The subtitle should mention Procore tool
    await expect(authenticatedPage.locator("text=/Procore tool/i")).toBeVisible(
      { timeout: 3000 },
    );
  });

  test("shows Drawing option under Procore", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Drawing card should be visible
    const drawingCard = authenticatedPage.locator('text="Drawing"');
    await expect(drawingCard.first()).toBeVisible({ timeout: 3000 });

    // The subtitle should mention Procore drawing
    await expect(
      authenticatedPage.locator("text=/Procore drawing/i"),
    ).toBeVisible({ timeout: 3000 });
  });

  test("Procore section shows informational tooltip", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // The Procore section should have "Link to Procore entities" description
    await expect(
      authenticatedPage.locator('text="Link to Procore entities."'),
    ).toBeVisible({ timeout: 3000 });
  });

  // ==========================================================================
  // STEP NAVIGATION
  // ==========================================================================

  test("can return to step 1 from step 2", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();
    await qrPage.selectSingleQR();

    // Wait for step 2 to render
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Click back button (chevron left icon in step 2)
    const backButton = authenticatedPage.locator(
      "button:has(i.bx-chevron-left)",
    );
    await expect(backButton.first()).toBeVisible({ timeout: 3000 });
    await backButton.first().click();

    // Should be back at step 1
    await expect(qrPage.createSingleButton).toBeVisible({ timeout: 3000 });
    await expect(qrPage.createBulkButton).toBeVisible({ timeout: 3000 });
  });

  test("step indicators update correctly", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/all-projects/**",
      mockProjects,
    );

    await qrPage.gotoCreate();

    // Step 1 should be current
    await expect(qrPage.stepBadge1).toBeVisible();

    // Select single QR to go to step 2
    await qrPage.selectSingleQR();

    // Wait for step 2
    await expect(
      authenticatedPage.locator('text="Taliho QR Code"'),
    ).toBeVisible({ timeout: 3000 });

    // Step 2 should be current, step 1 should be completed
    await expect(qrPage.stepBadge2).toBeVisible();
  });
});
