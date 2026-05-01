import { test, expect } from "../../fixtures/authenticated-test";
import { createMockGroup, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-grpsave-001",
  projectName: "Group Save Flow Project",
});

const mockProjectWithProcore = {
  ...mockProject,
  procoreProjectID: 77777,
  procoreCompanyID: 88888,
};

const mockGroup = createMockGroup({
  _id: "grp-grpsave-001",
  groupName: "Group Save Test Group",
  type: "arrangement",
  project: mockProject._id,
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
 * Global tool data returned by `/groups/<groupId>/procore-fetch-global?tool=inspection`.
 *
 * Shape: { data: { procoreInspections: [...], qrcodes: [...], hiddenIdsByTool: {} } }
 *
 * Each inspection row needs `id` (Procore's numeric identifier) which maps to:
 * - InspectionRow.procoreId (used as getRowId)
 * - deriveProcoreItemIdAndType falls back to row.procoreId -> row.id
 */
const mockGlobalToolData = {
  data: {
    procoreInspections: [
      {
        id: 1,
        procoreItemID: "FETCH-001",
        name: "Safety Inspection January",
        status: "Open",
        identifier: "INS-2026-G01",
        inspection_type: { name: "Safety" },
        created_at: "2026-01-15T09:00:00Z",
      },
      {
        id: 2,
        procoreItemID: "FETCH-002",
        name: "Weekly Safety Report",
        status: "Closed",
        identifier: "INS-2026-G02",
        inspection_type: { name: "Safety" },
        created_at: "2026-01-20T09:00:00Z",
      },
    ],
    qrcodes: [
      { _id: "qr-grp-001", qrcodeName: "QR Alpha" },
      { _id: "qr-grp-002", qrcodeName: "QR Beta" },
      { _id: "qr-grp-003", qrcodeName: "QR Gamma" },
    ],
    hiddenIdsByTool: {},
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required API mocks for the group context fetch page.
 *
 * Mock chain:
 * 1. GET /groups/:groupId â†’ group data (with project reference)
 * 2. GET /project/:companyId/:projectId â†’ project data (with Procore IDs)
 * 3. GET /project/:projectId â†’ fallback project fetch
 * 4. GET /procore/permissions â†’ permissions (tools array)
 * 5. GET /procore/tools â†’ active tools list
 */
async function setupGroupFetchPage(routeTracker: RouteTracker) {
  // Mock group endpoint â€” group data includes a project reference
  await routeTracker.mockRoute(`**/groups/${mockGroup._id}**`, {
    data: mockGroup,
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
 * Navigates to the group fetch page, opens the Inspections tool modal,
 * selects item(s), and clicks "Add Selected" to move them to the right panel.
 *
 * Returns after items are visible in the selected items panel.
 */
async function selectGroupInspectionItems(
  authenticatedPage: Page,
  routeTracker: RouteTracker,
  options?: { itemCount?: number },
) {
  const itemCount = options?.itemCount ?? 1;

  // Mock global fetch tool data endpoint
  await routeTracker.mockRoute(
    `**/groups/${mockGroup._id}/procore-fetch-global**`,
    mockGlobalToolData,
  );

  // Navigate to fetch page with group context
  await authenticatedPage.goto(`/procore/fetch?groupId=${mockGroup._id}`);

  // Wait for the fetch page to render
  const fetchPage = authenticatedPage.locator('[data-page-id="procore-fetch"]');
  await expect(fetchPage).toBeVisible({ timeout: 15000 });

  // Wait for tool cards to load and click Inspections
  const inspectionsCard = authenticatedPage.locator("text=Inspections").first();
  await expect(inspectionsCard).toBeVisible({ timeout: 10000 });
  await inspectionsCard.click();

  // Wait for inspection items to appear in the modal data table
  await expect(
    authenticatedPage.getByText("Safety Inspection January"),
  ).toBeVisible({ timeout: 10000 });

  // Select items by clicking on rows (toggles selection)
  const itemNames = ["Safety Inspection January", "Weekly Safety Report"];
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

test.describe("Procore Fetch Save Flow â€” Group Context @desktop", () => {
  // --------------------------------------------------------------------------
  // P0: Group save creates bulk items for all QR codes
  // --------------------------------------------------------------------------
  test("group save creates bulk items for all QR codes", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupFetchPage(routeTracker);

    // Select 1 inspection item into the right panel
    await selectGroupInspectionItems(authenticatedPage, routeTracker, {
      itemCount: 1,
    });

    // Mock the bulk create endpoint with body validation
    // 1 item x 3 QR codes = 3 bulk entries
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
      { success: true, message: "Items created.", count: 3 },
      {
        validateBody: (body) => {
          // Verify items array structure
          expect(body.items).toBeDefined();
          expect(Array.isArray(body.items)).toBe(true);
          // 1 selected item x 3 QR codes = 3 bulk entries
          expect(body.items!.length).toBe(3);

          // Verify all 3 QR code IDs are present in the items
          const qrIdsInItems = body.items!.map((item) => item.qrcodeId);
          expect(qrIdsInItems).toContain("qr-grp-001");
          expect(qrIdsInItems).toContain("qr-grp-002");
          expect(qrIdsInItems).toContain("qr-grp-003");

          // Verify all items have the same procoreToolName and procoreItemID
          const toolNames = new Set(
            body.items!.map((item) => item.procoreToolName),
          );
          const itemIds = new Set(
            body.items!.map((item) => item.procoreItemID),
          );
          expect(toolNames.size).toBe(1);
          expect(itemIds.size).toBe(1);

          // Verify each item has required properties
          for (const item of body.items!) {
            expect(typeof item.procoreToolName).toBe("string");
            expect(item.procoreToolName).toBeTruthy();
            expect(typeof item.procoreItemID).toBe("string");
            expect(item.procoreItemID).toBeTruthy();
          }
        },
      },
    );

    // Mock the QR code PATCH endpoint for procoreFetch update
    // This will be called 3 times (once for each QR code in the group)
    await routeTracker.mockRoute(`**/qr-code/**`, {
      success: true,
      data: { procoreFetch: true },
    });

    // Click the save button ("Add N Items to Group")
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Group/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for the async save operation to complete
    await authenticatedPage.waitForTimeout(1000);

    // Assert bulk API was called exactly once
    expect(routeTracker.getCallCount("**/procore-item/bulk**")).toBe(1);

    // Assert page navigated away from /procore/fetch
    await expect(authenticatedPage).not.toHaveURL(/\/procore\/fetch/, {
      timeout: 10000,
    });

    // Assert all body validations passed
    routeTracker.assertBodyValidations();
  });

  // --------------------------------------------------------------------------
  // P0: Group save with 2 items x 3 QR codes = 6 bulk entries
  // --------------------------------------------------------------------------
  test("group save with 2 items x 3 QR codes = 6 bulk entries", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupFetchPage(routeTracker);

    // Select 2 inspection items into the right panel
    await selectGroupInspectionItems(authenticatedPage, routeTracker, {
      itemCount: 2,
    });

    // Mock the bulk create endpoint with body validation
    // 2 items x 3 QR codes = 6 bulk entries
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
      { success: true, message: "Items created.", count: 6 },
      {
        validateBody: (body) => {
          // Verify items array structure
          expect(body.items).toBeDefined();
          expect(Array.isArray(body.items)).toBe(true);
          // 2 selected items x 3 QR codes = 6 bulk entries
          expect(body.items!.length).toBe(6);

          // Verify each QR code ID appears exactly twice in the items array
          const qrIdCounts: Record<string, number> = {};
          for (const item of body.items!) {
            const qrId = item.qrcodeId!;
            qrIdCounts[qrId] = (qrIdCounts[qrId] || 0) + 1;
          }
          expect(qrIdCounts["qr-grp-001"]).toBe(2);
          expect(qrIdCounts["qr-grp-002"]).toBe(2);
          expect(qrIdCounts["qr-grp-003"]).toBe(2);

          // Verify each item has required properties
          for (const item of body.items!) {
            expect(typeof item.qrcodeId).toBe("string");
            expect(item.qrcodeId).toBeTruthy();
            expect(typeof item.procoreToolName).toBe("string");
            expect(item.procoreToolName).toBeTruthy();
            expect(typeof item.procoreItemID).toBe("string");
            expect(item.procoreItemID).toBeTruthy();
          }
        },
      },
    );

    // Mock the QR code PATCH endpoint for procoreFetch update
    await routeTracker.mockRoute(`**/qr-code/**`, {
      success: true,
      data: { procoreFetch: true },
    });

    // Click the save button ("Add N Items to Group")
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Group/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for the async save operation to complete
    await authenticatedPage.waitForTimeout(1000);

    // Assert bulk API was called exactly once
    expect(routeTracker.getCallCount("**/procore-item/bulk**")).toBe(1);

    // Assert page navigated away from /procore/fetch
    await expect(authenticatedPage).not.toHaveURL(/\/procore\/fetch/, {
      timeout: 10000,
    });

    // Assert all body validations passed
    routeTracker.assertBodyValidations();
  });

  // --------------------------------------------------------------------------
  // P1: Group save button shows "Add N Items to Group"
  // --------------------------------------------------------------------------
  test("group save button shows 'Add N Items to Group'", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupFetchPage(routeTracker);

    // Navigate to fetch page with group context
    await authenticatedPage.goto(`/procore/fetch?groupId=${mockGroup._id}`);

    // Wait for the fetch page to render
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 15000 });

    // Wait for tool cards to load (ensures the page has finished initial rendering)
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 10000 });

    // Find the save button in the right panel â€” should contain "to Group"
    const saveButton = authenticatedPage.getByRole("button", {
      name: /Add \d+ Items? to Group/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    // Verify the button text contains "to Group" (not "to Folder QR Code")
    await expect(saveButton).toHaveText(/to Group/i);

    // Verify the button text does NOT contain "to Folder QR Code"
    await expect(saveButton).not.toHaveText(/to Folder QR Code/i);
  });
});
