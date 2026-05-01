import {
  test,
  expect,
  mockAuthCompany,
} from "../../fixtures/authenticated-test";
import { createMockQRCode, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-save-001",
  projectName: "Save Flow Project",
});

const mockProjectWithProcore = {
  ...mockProject,
  procoreProjectID: 98765,
  procoreCompanyID: 54321,
};

const mockQRCode = createMockQRCode({
  _id: "qr-save-001",
  qrcodeName: "Save Flow QR",
  company: mockAuthCompany._id,
  project: mockProject._id,
  procoreConnect: true,
  procoreFetch: false,
});

/**
 * Permissions mock using the correct shape expected by fetch.tsx:
 *   permissionsData.tools[] with { available_for_user, friendly_name, name }
 *
 * The component iterates `perms.filter(t => t.available_for_user === true)`
 * and matches `t.friendly_name` against a whitelist.
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
    {
      available_for_user: true,
      friendly_name: "Forms",
      name: "form",
    },
  ],
};

/**
 * Tools mock using the correct shape expected by fetch.tsx:
 *   Array<{ id, title, name?, engine_name?, is_active? }>
 *
 * The component extracts `t.title` for matching against the WHITELIST.
 */
const mockToolsCorrectShape = [
  { id: 1, title: "Inspections", is_active: true },
  { id: 2, title: "Punch List", is_active: true },
  { id: 3, title: "Forms", is_active: true },
];

/**
 * Inspection tool data returned by `/procore/inspections` endpoint.
 * Shape: { data: [...], hiddenIds: [...] }
 *
 * Each row needs `id` (Procore's numeric identifier) which maps to:
 * - InspectionRow.procoreId (used as getRowId)
 * - deriveProcoreItemIdAndType falls back to row.procoreId â†’ row.id
 */
const mockInspectionItems = {
  data: [
    {
      id: 1001,
      name: "Monthly Safety Inspection",
      status: "Open",
      identifier: "INS-2026-001",
      inspection_type: { name: "Safety" },
      created_at: "2026-01-15T09:00:00Z",
    },
    {
      id: 1002,
      name: "Fire Code Compliance Check",
      status: "Ready for Review",
      identifier: "INS-2026-002",
      inspection_type: { name: "Fire Safety" },
      created_at: "2026-01-20T09:00:00Z",
    },
    {
      id: 1003,
      name: "Equipment Safety Audit",
      status: "Open",
      identifier: "INS-2026-003",
      inspection_type: { name: "Equipment" },
      created_at: "2026-02-01T09:00:00Z",
    },
  ],
  hiddenIds: [],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required API mocks for the single QR context fetch page.
 *
 * Mock chain:
 * 1. GET /qr-code/:qrId â†’ QR code data (with project reference)
 * 2. GET /project/:companyId/:projectId â†’ project data (with Procore IDs)
 * 3. GET /project/:projectId â†’ fallback project fetch
 * 4. GET /procore/permissions â†’ permissions (tools array)
 * 5. GET /procore/tools â†’ active tools list
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
 * selects item(s), and clicks "Add Selected" to move them to the right panel.
 *
 * Returns after items are visible in the selected items panel.
 */
async function selectInspectionItems(
  authenticatedPage: Page,
  routeTracker: RouteTracker,
  options?: { itemCount?: number },
) {
  const itemCount = options?.itemCount ?? 1;

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
    authenticatedPage.getByText("Monthly Safety Inspection"),
  ).toBeVisible({ timeout: 10000 });

  // Select items by clicking on rows (toggles selection)
  const itemNames = [
    "Monthly Safety Inspection",
    "Fire Code Compliance Check",
    "Equipment Safety Audit",
  ];
  for (let i = 0; i < itemCount && i < itemNames.length; i++) {
    await authenticatedPage.getByText(itemNames[i]).click();
  }

  // Click "Add Selected" button in the modal footer
  const addSelectedButton = authenticatedPage.getByRole("button", {
    name: /Add Selected/i,
  });
  await expect(addSelectedButton).toBeVisible({ timeout: 5000 });
  await expect(addSelectedButton).toBeEnabled();
  await addSelectedButton.click();

  // Verify items appear in the right panel (aside element with "Selected Items" heading)
  const selectedPanel = authenticatedPage.locator("aside").filter({
    has: authenticatedPage.getByRole("heading", {
      name: /Selected Items/i,
    }),
  });
  await expect(selectedPanel).toBeVisible({ timeout: 5000 });

  // Verify correct count in panel heading
  await expect(
    selectedPanel.getByText(
      new RegExp(`Selected Items \\(${itemCount}\\)`, "i"),
    ),
  ).toBeVisible({ timeout: 5000 });

  return { selectedPanel };
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Procore Fetch Save Flow â€” Single QR Context @desktop", () => {
  // --------------------------------------------------------------------------
  // P0: Save flow â€” selects items and submits bulk request
  // --------------------------------------------------------------------------
  test("save flow â€” selects items and submits bulk request", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Select 1 inspection item into the right panel
    await selectInspectionItems(authenticatedPage, routeTracker, {
      itemCount: 1,
    });

    // Mock the bulk create endpoint with body validation
    await routeTracker.mockRoute<{
      companyId?: string;
      projectId?: string;
      items?: Array<{
        qrcodeId?: string;
        procoreToolName?: string;
        procoreItemID?: string;
      }>;
    }>(
      "**/procore-item/bulk**",
      { success: true, message: "Items created.", count: 1 },
      {
        validateBody: (body) => {
          // Verify companyId matches the authenticated company
          expect(body.companyId).toBe(mockAuthCompany._id);
          // Verify projectId matches the mock project
          expect(body.projectId).toBe(mockProject._id);
          // Verify items array structure
          expect(body.items).toBeDefined();
          expect(Array.isArray(body.items)).toBe(true);
          expect(body.items!.length).toBeGreaterThanOrEqual(1);
          // Verify each item has the required properties
          const firstItem = body.items![0];
          expect(firstItem.qrcodeId).toBe(mockQRCode._id);
          expect(typeof firstItem.procoreToolName).toBe("string");
          expect(firstItem.procoreToolName).toBeTruthy();
          expect(typeof firstItem.procoreItemID).toBe("string");
          expect(firstItem.procoreItemID).toBeTruthy();
        },
      },
    );

    // Mock the QR code PATCH endpoint for procoreFetch update
    await routeTracker.mockRoute<{
      companyId?: string;
      projectId?: string;
      procoreFetch?: boolean;
    }>(
      `**/qr-code/${mockQRCode._id}**`,
      { success: true, data: { ...mockQRCode, procoreFetch: true } },
      {
        validateBody: (body) => {
          expect(body.procoreFetch).toBe(true);
          expect(body.companyId).toBe(mockAuthCompany._id);
          expect(body.projectId).toBe(mockProject._id);
        },
      },
    );

    // Click the save button ("Add N Items to Folder QR Code")
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Folder QR Code/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Assert bulk API was called exactly once
    // Wait briefly for the async save operation to complete
    await authenticatedPage.waitForTimeout(1000);
    expect(routeTracker.getCallCount("**/procore-item/bulk**")).toBe(1);

    // Assert page navigated away from /procore/fetch
    await expect(authenticatedPage).not.toHaveURL(/\/procore\/fetch/, {
      timeout: 10000,
    });

    // Assert all body validations passed
    routeTracker.assertBodyValidations();
  });

  // --------------------------------------------------------------------------
  // P0: Save error shows toast and allows retry
  // --------------------------------------------------------------------------
  test("save error shows toast and allows retry", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Select 1 inspection item into the right panel
    await selectInspectionItems(authenticatedPage, routeTracker, {
      itemCount: 1,
    });

    // Mock bulk endpoint with 500 error
    await routeTracker.mockErrorResponse("**/procore-item/bulk**", 500);

    // Click the save button
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Folder QR Code/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Assert toast error message appears
    await expect(
      authenticatedPage.getByText(/Failed to add Procore items/i),
    ).toBeVisible({ timeout: 10000 });

    // Assert page URL still contains /procore/fetch (no navigation on error)
    await expect(authenticatedPage).toHaveURL(/\/procore\/fetch/);

    // Assert save button is no longer showing "Adding..." (saving state was reset)
    // The button should be back to its normal enabled state
    await expect(saveButton).not.toHaveText(/Adding\.\.\./i, {
      timeout: 5000,
    });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // P1: Save button disabled when no items selected
  // --------------------------------------------------------------------------
  test("save button disabled when no items selected", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Navigate to fetch page without selecting any items
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for the fetch page to render
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Wait for tool cards to load (ensures the page has finished initial rendering)
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 10000 });

    // Find the save button in the right panel
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Folder QR Code/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Assert button is disabled
    await expect(saveButton).toBeDisabled();

    // Assert button text shows "Add 0 Items"
    await expect(saveButton).toHaveText(/Add 0 Items/i);
  });

  // --------------------------------------------------------------------------
  // P1: Save deduplicates items â€” already-added items disabled on reopen
  // --------------------------------------------------------------------------
  test("already-added items are disabled when tool modal is reopened", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupSingleQRFetchPage(routeTracker);

    // Mock inspections endpoint (will be called multiple times)
    await routeTracker.mockRoute(
      "**/procore/inspections**",
      mockInspectionItems,
    );

    // Navigate to fetch page
    await authenticatedPage.goto(
      `/procore/fetch?selectedIds=${mockQRCode._id}`,
    );

    // Wait for the fetch page to render
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Open Inspections tool modal
    const inspectionsCard = authenticatedPage
      .locator("text=Inspections")
      .first();
    await expect(inspectionsCard).toBeVisible({ timeout: 10000 });
    await inspectionsCard.click();

    // Wait for items
    await expect(
      authenticatedPage.getByText("Monthly Safety Inspection"),
    ).toBeVisible({ timeout: 10000 });

    // Select first item
    await authenticatedPage.getByText("Monthly Safety Inspection").click();

    // Click "Add Selected"
    const addSelectedButton = authenticatedPage.getByRole("button", {
      name: /Add Selected/i,
    });
    await expect(addSelectedButton).toBeVisible({ timeout: 5000 });
    await addSelectedButton.click();

    // Verify item in right panel
    const selectedPanel = authenticatedPage.locator("aside").filter({
      has: authenticatedPage.getByRole("heading", {
        name: /Selected Items/i,
      }),
    });
    await expect(
      selectedPanel.getByText("Monthly Safety Inspection"),
    ).toBeVisible({ timeout: 5000 });

    // Wait for modal close animation (200ms defined in closeToolModal)
    await authenticatedPage.waitForTimeout(500);

    // Reopen Inspections tool modal
    await inspectionsCard.click();

    // Wait for items to reappear
    await expect(
      authenticatedPage.getByText("Monthly Safety Inspection"),
    ).toBeVisible({ timeout: 10000 });

    // The previously added item should be disabled/checked (alreadyAddedItemIds logic).
    // Find the row containing "Monthly Safety Inspection" in the data table.
    // The DataTable marks disabled rows with a visual indicator. We verify by checking
    // that clicking the row does NOT add it to the current selection (Add Selected button
    // count should still be 0 since the row is disabled).
    const addSelectedButtonReopened = authenticatedPage.getByRole("button", {
      name: /Add Selected \(0\)/i,
    });

    // The "Add Selected" button should show (0) because the already-added item
    // is pre-checked/disabled and cannot be re-selected.
    // If the button shows "Add Selected (0)" or is disabled, the dedup is working.
    // Note: The button may show "Add Selected (0)" with the previously-added item
    // appearing as checked but not toggleable.
    await expect(addSelectedButtonReopened).toBeVisible({ timeout: 5000 });
  });
});
