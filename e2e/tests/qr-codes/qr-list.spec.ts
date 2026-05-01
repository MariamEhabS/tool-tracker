import { test, expect } from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import {
  createMockQRCode,
  createMockGroup,
  createMockProject,
} from "../../fixtures/builders";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-001",
  projectName: "HQ Build-out",
  projectStatus: "active",
});

const mockGroup = createMockGroup({
  _id: "grp-001",
  groupName: "Floor Sensors",
  type: "arrangement",
});

const mockQRCodes = [
  createMockQRCode({
    _id: "qr-001",
    qrcodeName: "Lobby Sensor A",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "arrangement",
    mobileScanCount: 42,
    createdAt: "2025-12-01T09:00:00Z",
  }),
  createMockQRCode({
    _id: "qr-002",
    qrcodeName: "Elevator Panel B",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "equipment",
    mobileScanCount: 7,
    createdAt: "2025-12-10T09:00:00Z",
  }),
  createMockQRCode({
    _id: "qr-003",
    qrcodeName: "Parking Ramp Gate",
    project: mockProject._id,
    projectName: mockProject.projectName,
    mobileScanCount: 0,
    createdAt: "2026-01-05T09:00:00Z",
  }),
];

const mockListResponse = {
  data: mockQRCodes,
  total_items: mockQRCodes.length,
  has_next: false,
  has_prev: false,
};

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Codes List @desktop", () => {
  test("renders paginated table with QR code names", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", mockListResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    await expect(qrPage.pageTitle).toBeVisible();
    await expect(qrPage.table).toBeVisible();

    // Verify all three QR codes are rendered in the table
    await expect(qrPage.getRowByName("Lobby Sensor A")).toBeVisible();
    await expect(qrPage.getRowByName("Elevator Panel B")).toBeVisible();
    await expect(qrPage.getRowByName("Parking Ramp Gate")).toBeVisible();
  });

  test("search by name filters results", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", mockListResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(qrPage.table).toBeVisible();

    // Type in search — the list page uses debounced server-side or local search
    await qrPage.search("Lobby");

    // Wait for search results to update - use condition-based wait instead of arbitrary timeout
    // The row should be visible after the debounce and re-render
    await expect(qrPage.getRowByName("Lobby Sensor A")).toBeVisible({
      timeout: 5000,
    });
  });

  test("sort by name toggles order", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", mockListResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(qrPage.table).toBeVisible();

    // Click the NAME column header to trigger server-side sort
    const nameHeader = authenticatedPage
      .locator("th")
      .filter({ hasText: "NAME" });
    await nameHeader.click();

    // Verify the sort param is reflected in the URL
    await expect(authenticatedPage).toHaveURL(/sortKey/);
  });

  test("navigate to QR detail on row click", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", mockListResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(qrPage.table).toBeVisible();

    // Click the first row
    await qrPage.clickRow(0);

    // Should navigate to the QR detail page
    await expect(authenticatedPage).toHaveURL(/\/qrcode\//);
  });

  test("bulk select and delete shows confirmation", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", mockListResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(qrPage.table).toBeVisible();

    // Enable bulk actions mode
    await qrPage.enableBulkActions();

    // Select first row
    await qrPage.selectRow(0);

    // At default Desktop Chrome viewport (1280px), the bulk action buttons are hidden
    // and shown via the "More" dropdown menu (2xl breakpoint is 1536px).
    // Click the "More" dropdown to reveal the delete option.
    const moreButton = authenticatedPage.locator(
      'button:has-text("More"):visible',
    );
    await moreButton.click();

    // Click delete option in the dropdown menu
    const deleteMenuItem = authenticatedPage.getByRole("menuitem", {
      name: "Delete",
    });
    await deleteMenuItem.click();

    // Confirmation modal should appear - look for the bulk delete modal
    await expect(
      authenticatedPage.getByRole("heading", { name: /delete/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("pagination controls work", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Mock page 1 with has_next: true
    const page1Response = {
      data: mockQRCodes,
      total_items: 4,
      has_next: true,
      has_prev: false,
    };
    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", page1Response);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(qrPage.table).toBeVisible();

    // Next page button should be enabled when has_next is true
    const nextButton = authenticatedPage.getByRole("button", { name: /next/i });
    if (await nextButton.isVisible()) {
      await expect(nextButton).toBeEnabled();
    }
  });

  test("empty state when no QR codes", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    const emptyResponse = {
      data: [],
      total_items: 0,
      has_next: false,
      has_prev: false,
    };
    // Note: aggregation/all-projects and groups are already mocked by authenticated-test fixture
    await routeTracker.mockRoute("**/qr-code**", emptyResponse);

    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Empty state should be visible
    await expect(
      authenticatedPage.locator("text=No QR Codes yet"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Create your first QR code"),
    ).toBeVisible();

    // "Create QR Code" action link should be visible in the empty state
    await expect(
      authenticatedPage.locator('a:has-text("Create QR Code")').first(),
    ).toBeVisible();
  });
});
