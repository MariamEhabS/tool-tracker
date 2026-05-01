import { test, expect } from "../../fixtures/authenticated-test";
import {
  createMockQRCode,
  createMockProject,
  createMockGroup,
} from "../../fixtures/builders";

// Mock data for Procore fetch page
const mockProject = createMockProject({
  _id: "proj-fetch-001",
  projectName: "Fetch Test Project",
  company: "comp-test-001",
  procoreProjectID: "12345",
  procoreCompanyID: "67890",
});

const mockQRCode = createMockQRCode({
  _id: "qr-fetch-001",
  qrcodeName: "Fetch Test QR",
  company: "comp-test-001",
  project: mockProject._id,
  procoreConnect: true,
  procoreFetch: true,
});

const mockGroup = createMockGroup({
  _id: "grp-fetch-001",
  groupName: "Fetch Test Group",
  company: "comp-test-001",
  project: mockProject._id,
});

const mockPermissions = {
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

const mockTools = [
  { id: 1, title: "Inspections", is_active: true },
  { id: 2, title: "Punch List", is_active: true },
  { id: 3, title: "Forms", is_active: true },
];

const mockProcoreToolData = [
  {
    procoreItemID: "PI-001",
    name: "Safety Inspection Q1",
    status: "Open",
    created_at: "2025-01-15T09:00:00Z",
  },
  {
    procoreItemID: "PI-002",
    name: "Quality Check February",
    status: "Ready for Review",
    created_at: "2025-02-01T09:00:00Z",
  },
];

test.describe("Procore Fetch @desktop", () => {
  // ==========================================================================
  // SINGLE QR CONTEXT
  // ==========================================================================

  test("renders tool cards grid based on project Procore tools", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/qr-code/qr-fetch-001**", {
      data: mockQRCode,
    });
    await routeTracker.mockRoute("**/project/**", mockProject);
    await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
    await routeTracker.mockRoute("**/procore/tools**", mockTools);

    await authenticatedPage.goto("/procore/fetch?selectedIds=qr-fetch-001");

    // Should show tool cards
    await expect(authenticatedPage.getByText("Inspections")).toBeVisible();
    await expect(authenticatedPage.getByText("Punch List")).toBeVisible();
    await expect(authenticatedPage.getByText("Forms")).toBeVisible();
  });

  test("clicking tool card opens data table modal", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/qr-code/qr-fetch-001**", {
      data: mockQRCode,
    });
    await routeTracker.mockRoute("**/project/**", mockProject);
    await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
    await routeTracker.mockRoute("**/procore/tools**", mockTools);
    await routeTracker.mockRoute(
      "**/procore/inspections**",
      mockProcoreToolData,
    );

    await authenticatedPage.goto("/procore/fetch?selectedIds=qr-fetch-001");

    // Click on Inspections card
    await authenticatedPage.getByText("Inspections").click();

    // Modal should open with tool data
    await expect(
      authenticatedPage.getByText("Safety Inspection Q1"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("Quality Check February"),
    ).toBeVisible();
  });

  test("selecting rows and clicking Add Selected moves items to right panel", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/qr-code/qr-fetch-001**", {
      data: mockQRCode,
    });
    await routeTracker.mockRoute("**/project/**", mockProject);
    await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
    await routeTracker.mockRoute("**/procore/tools**", mockTools);
    await routeTracker.mockRoute(
      "**/procore/inspections**",
      mockProcoreToolData,
    );

    await authenticatedPage.goto("/procore/fetch?selectedIds=qr-fetch-001");

    // Open Inspections
    await authenticatedPage.getByText("Inspections").click();
    await expect(
      authenticatedPage.getByText("Safety Inspection Q1"),
    ).toBeVisible();

    // Select a row
    await authenticatedPage.getByText("Safety Inspection Q1").click();

    // Click Add Selected - button must be visible
    const addButton = authenticatedPage.getByRole("button", {
      name: /Add Selected/i,
    });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Item should appear in the selected items panel (aside element) on the right
    // Verify correct placement by locating the aside that contains the "Selected Items" heading
    const selectedPanel = authenticatedPage.locator("aside").filter({
      has: authenticatedPage.getByRole("heading", { name: /Selected Items/i }),
    });
    await expect(selectedPanel).toBeVisible({ timeout: 5000 });
    await expect(selectedPanel.getByText("Safety Inspection Q1")).toBeVisible({
      timeout: 5000,
    });

    // Verify the panel heading reflects that at least one item is selected.
    await expect(
      selectedPanel.getByText(/Selected Items \([1-9]\d*\)/i),
    ).toBeVisible({
      timeout: 5000,
    });
  });

  // ==========================================================================
  // ERROR STATES
  // ==========================================================================

  test("shows error state when no entry point (missing QR/group)", async ({
    authenticatedPage,
  }) => {
    // Navigate without selectedIds or groupId
    await authenticatedPage.goto("/procore/fetch");

    // Should show the specific error heading for missing entry point
    await expect(
      authenticatedPage.getByText(/No QR Code or Group Selected/i),
    ).toBeVisible({ timeout: 5000 });

    // Should also show the Go Back action button
    await expect(authenticatedPage.getByText(/Go Back/i)).toBeVisible();
  });

  test("No Procore Tools Available shown when project has no tools", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await routeTracker.mockRoute("**/qr-code/qr-fetch-001**", {
      data: mockQRCode,
    });
    await routeTracker.mockRoute("**/project/**", mockProject);
    await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
    // useProcoreTools returns a plain array, so mock an empty array for "no tools"
    await routeTracker.mockRoute("**/procore/tools**", []);

    await authenticatedPage.goto("/procore/fetch?selectedIds=qr-fetch-001");

    await expect(
      authenticatedPage.getByText(/No Procore Tools Available/i),
    ).toBeVisible();
  });

  // ==========================================================================
  // GROUP CONTEXT (GLOBAL FETCH)
  // ==========================================================================

  test("renders tool cards in group fetch context", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Fixed: Use plural "groups" to match actual API endpoint /groups/:groupId
    await routeTracker.mockRoute("**/groups/grp-fetch-001**", {
      data: mockGroup,
    });
    await routeTracker.mockRoute("**/project/**", mockProject);
    await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
    await routeTracker.mockRoute("**/procore/tools**", mockTools);

    await authenticatedPage.goto("/procore/fetch?groupId=grp-fetch-001");

    // Should show tool cards
    await expect(authenticatedPage.getByText("Inspections")).toBeVisible();
    await expect(authenticatedPage.getByText("Punch List")).toBeVisible();
  });
});
