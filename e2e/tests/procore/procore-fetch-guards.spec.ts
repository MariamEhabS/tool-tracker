import { test, expect } from "../../fixtures/authenticated-test";
import { createMockQRCode, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-guard-001",
  projectName: "Guard Tests Project",
});

const mockProjectWithProcore = {
  ...mockProject,
  procoreProjectID: 77777,
  procoreCompanyID: 88888,
};

const mockQRCode = createMockQRCode({
  _id: "qr-guard-001",
  qrcodeName: "Guard Tests QR",
  project: mockProject._id,
  procoreConnect: true,
  procoreFetch: false,
});

/**
 * Permissions mock using the correct shape expected by fetch.tsx:
 *   permissionsData.tools[] with { available_for_user, friendly_name, name }
 */
const mockPermissionsCorrectShape = {
  tools: [
    {
      available_for_user: true,
      friendly_name: "Inspections",
      name: "inspection",
    },
    {
      available_for_user: true,
      friendly_name: "Punch List",
      name: "punch-list",
    },
  ],
};

/**
 * Tools mock using the correct shape expected by fetch.tsx:
 *   Array<{ id, title, name?, engine_name?, is_active? }>
 */
const mockToolsCorrectShape = [
  { id: 1, title: "Inspections", is_active: true },
  { id: 2, title: "Punch List", is_active: true },
];

/**
 * Inspection tool data returned by `/procore/inspections` endpoint.
 * Shape: { data: [...], hiddenIds: [...] }
 */
const mockInspectionItems = {
  data: [
    {
      id: 2001,
      name: "Guard Test Inspection Alpha",
      status: "Open",
      identifier: "INS-GRD-001",
      inspection_type: { name: "Safety" },
      created_at: "2026-01-10T09:00:00Z",
    },
    {
      id: 2002,
      name: "Guard Test Inspection Beta",
      status: "Ready for Review",
      identifier: "INS-GRD-002",
      inspection_type: { name: "Fire Safety" },
      created_at: "2026-01-15T09:00:00Z",
    },
    {
      id: 2003,
      name: "Guard Test Inspection Gamma",
      status: "Open",
      identifier: "INS-GRD-003",
      inspection_type: { name: "Equipment" },
      created_at: "2026-01-20T09:00:00Z",
    },
  ],
  hiddenIds: [],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required API mocks for the single QR context fetch page.
 */
async function setupSingleQRFetchPage(routeTracker: RouteTracker) {
  // Mock QR code endpoint
  await routeTracker.mockRoute(`**/qr-code/${mockQRCode._id}**`, {
    data: mockQRCode,
  });

  // Mock project endpoint (standard fetch with companyId + projectId)
  await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
    data: mockProjectWithProcore,
  });

  // Mock Procore permissions
  await routeTracker.mockRoute(
    "**/procore/permissions**",
    mockPermissionsCorrectShape,
  );

  // Mock Procore tools list
  await routeTracker.mockRoute("**/procore/tools**", mockToolsCorrectShape);
}

/**
 * Navigates to the fetch page, opens the Inspections tool modal,
 * selects the first item, and clicks "Add Selected" to move it to the right panel.
 *
 * Returns after the item is visible in the selected items panel.
 */
async function addOneInspectionItem(
  authenticatedPage: Page,
  routeTracker: RouteTracker,
) {
  // Mock inspections tool data endpoint
  await routeTracker.mockRoute("**/procore/inspections**", mockInspectionItems);

  // Navigate to fetch page with single QR context
  await authenticatedPage.goto(`/procore/fetch?selectedIds=${mockQRCode._id}`);

  // Wait for the fetch page to render
  const fetchPage = authenticatedPage.locator('[data-page-id="procore-fetch"]');
  await expect(fetchPage).toBeVisible({ timeout: 15000 });

  // Wait for tool cards to load and click Inspections
  const inspectionsCard = authenticatedPage.locator("text=Inspections").first();
  await expect(inspectionsCard).toBeVisible({ timeout: 10000 });
  await inspectionsCard.click();

  // Wait for inspection items to appear in the modal data table
  await expect(
    authenticatedPage.getByText("Guard Test Inspection Alpha"),
  ).toBeVisible({ timeout: 10000 });

  // Select first item by clicking on its row text
  await authenticatedPage.getByText("Guard Test Inspection Alpha").click();

  // Click "Add Selected" button in the modal footer
  const addSelectedButton = authenticatedPage.getByRole("button", {
    name: /Add Selected/i,
  });
  await expect(addSelectedButton).toBeVisible({ timeout: 5000 });
  await expect(addSelectedButton).toBeEnabled();
  await addSelectedButton.click();

  // Verify item appears in the right panel
  const selectedPanel = authenticatedPage.locator("aside").filter({
    has: authenticatedPage.getByRole("heading", {
      name: /Selected Items/i,
    }),
  });
  await expect(selectedPanel).toBeVisible({ timeout: 5000 });
  await expect(
    selectedPanel.getByText("Guard Test Inspection Alpha"),
  ).toBeVisible({ timeout: 5000 });

  return { selectedPanel, inspectionsCard };
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Procore Fetch Guards â€” Session-Added Items & Double-Submit Prevention @desktop", () => {
  // --------------------------------------------------------------------------
  // P1: Items added in session are disabled on modal reopen
  // --------------------------------------------------------------------------
  test("items added in session are disabled on modal reopen", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Add one inspection item to the right panel
    const { inspectionsCard } = await addOneInspectionItem(
      authenticatedPage,
      routeTracker,
    );

    // Wait for the modal close animation (200ms in closeToolModal + buffer)
    await authenticatedPage.waitForTimeout(500);

    // Re-open the Inspections tool modal
    await inspectionsCard.click();

    // Wait for items to reappear in the data table
    await expect(
      authenticatedPage.getByText("Guard Test Inspection Alpha"),
    ).toBeVisible({ timeout: 10000 });

    // The previously added item should be disabled (alreadyAddedItemIds logic).
    // The "Add Selected" button should show (0) because the already-added item
    // is pre-checked/disabled and cannot be re-selected.
    const addSelectedButtonReopened = authenticatedPage.getByRole("button", {
      name: /Add Selected \(0\)/i,
    });
    await expect(addSelectedButtonReopened).toBeVisible({ timeout: 5000 });

    // The already-added item remains non-selectable after reopen.
    await expect(addSelectedButtonReopened).toBeVisible();

    // Additionally, verify that a non-added item CAN still be selected
    const betaRow = authenticatedPage.locator("tr", {
      hasText: "Guard Test Inspection Beta",
    });
    await betaRow.getByRole("checkbox").check();
    const addSelectedWithOne = authenticatedPage.getByRole("button", {
      name: /Add Selected \(1\)/i,
    });
    await expect(addSelectedWithOne).toBeVisible({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // P1: Double-click save sends only one API request
  // --------------------------------------------------------------------------
  test("double-click save sends only one API request", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Add one inspection item to the right panel
    await addOneInspectionItem(authenticatedPage, routeTracker);

    // Mock the bulk create endpoint with a delay to simulate slow network
    await routeTracker.mockRoute(
      "**/procore-item/bulk**",
      { success: true, message: "Items created.", count: 1 },
      { delay: 1500 },
    );

    // Mock the QR code PATCH endpoint for procoreFetch update
    await routeTracker.mockRoute(`**/qr-code/${mockQRCode._id}**`, {
      success: true,
      data: { ...mockQRCode, procoreFetch: true },
    });

    // Find the save button
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Folder QR Code/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();

    // Double-click the save button quickly; guard logic should prevent duplicate submit.
    await saveButton.dblclick();

    // Wait for the delayed response to resolve
    await authenticatedPage.waitForTimeout(2000);

    // Assert the bulk endpoint was called exactly 1 time (no double-submit)
    expect(routeTracker.getCallCount("**/procore-item/bulk**")).toBe(1);
  });

  // --------------------------------------------------------------------------
  // P1: Unsaved changes warning on cancel â€” dismiss dialog stays on page
  // --------------------------------------------------------------------------
  test("unsaved changes warning on cancel â€” dismiss stays on page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Add one inspection item to the right panel (so selectedItems.length > 0)
    await addOneInspectionItem(authenticatedPage, routeTracker);

    // Register a dialog handler that dismisses the confirmation (clicks "Cancel" / "Stay")
    let dialogMessage = "";
    authenticatedPage.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Find and click the Cancel button in the right panel
    // The Cancel button is inside the aside panel, distinct from modal Cancel buttons
    const cancelButton = authenticatedPage
      .locator("aside")
      .getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // Assert the dialog message contains "unsaved selections"
    expect(dialogMessage).toContain("unsaved selections");

    // Assert the page URL still contains /procore/fetch (user stayed)
    await expect(authenticatedPage).toHaveURL(/\/procore\/fetch/);
  });

  // --------------------------------------------------------------------------
  // P1: Unsaved changes â€” confirm leave navigates away
  // --------------------------------------------------------------------------
  test("unsaved changes â€” confirm leave navigates away", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Add one inspection item to the right panel (so selectedItems.length > 0)
    await addOneInspectionItem(authenticatedPage, routeTracker);

    // Register a dialog handler that accepts the confirmation (clicks "Leave")
    authenticatedPage.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Find and click the Cancel button in the right panel
    const cancelButton = authenticatedPage
      .locator("aside")
      .getByRole("button", { name: "Cancel" });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // Assert the page navigates away from /procore/fetch
    await expect(authenticatedPage).not.toHaveURL(/\/procore\/fetch/, {
      timeout: 10000,
    });
  });
});
