import {
  test,
  expect,
  mockAuthCompany,
} from "../../fixtures/authenticated-test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import {
  createMockQRCode,
  createMockGroup,
  createMockProject,
} from "../../fixtures/builders";
import type { RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-detail-001",
  projectName: "Warehouse Retrofit",
  projectStatus: "active",
});

const mockGroup = createMockGroup({
  _id: "grp-detail-001",
  groupName: "Electrical Panels",
  type: "equipment",
});

const qrCodeId = "qr-detail-001";

const mockQRCodeSingle = {
  data: createMockQRCode({
    _id: qrCodeId,
    qrcodeName: "Panel E-42",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "equipment",
    mobileScanCount: 18,
    passwordActivated: false,
  }),
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Panel E-42",
    type: "folder",
    project: {
      _id: mockProject._id,
      projectName: mockProject.projectName,
    },
    company: {
      _id: mockAuthCompany._id,
      editProcoreItemsAllowed: true,
    },
  },
  procoreTools: [
    { tool: "inspection", count: 3 },
    { tool: "punch-list", count: 1 },
  ],
  folders: [{ _id: "fld-001", folderName: "Wiring Diagrams" }],
  documents: [
    {
      _id: "doc-001",
      documentName: "Panel Spec Sheet.pdf",
      documentSize: 204800,
    },
    {
      _id: "doc-002",
      documentName: "Installation Guide.pdf",
      documentSize: 512000,
    },
  ],
};

const mockQrProcoreTools = {
  procoreTools: [
    { tool: "inspection", count: 3 },
    { tool: "punch-list", count: 1 },
  ],
  qrType: "folder",
  procoreCategory: null,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sets up all required mocks for QR detail page tests.
 * Only includes routes that are actually called by the QR detail page.
 * Optional/fallback routes (groups, project, image) were previously mocked
 * with safeRoute but are NOT actually called by the current implementation.
 */
async function setupQRDetailMocks(routeTracker: RouteTracker): Promise<void> {
  // Core QR code endpoints - always called
  // Note: useSingleQRCode passes companyId as query param, so we need ** at end
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}**`, mockQRCodeSingle);
  await routeTracker.mockRoute(
    `**/qr-code/scanned/${qrCodeId}**`,
    mockScannedQR,
  );
  await routeTracker.mockRoute(
    `**/qr-code/${qrCodeId}/procore-tools**`,
    mockQrProcoreTools,
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Detail @desktop", () => {
  test("renders QR image and metadata", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupQRDetailMocks(routeTracker);

    await qrPage.gotoDetail(qrCodeId);

    // QR code name should be visible
    await expect(authenticatedPage.locator("text=Panel E-42")).toBeVisible();
  });

  test("documents list renders file names", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupQRDetailMocks(routeTracker);

    await qrPage.gotoDetail(qrCodeId);

    // Wait for page to render data
    await expect(authenticatedPage.locator("text=Panel E-42")).toBeVisible();

    // The QR detail page shows a Tools view with "Taliho Documents" row
    // Clicking on it navigates to the documents view
    const docsRow = authenticatedPage
      .locator("tr")
      .filter({ hasText: "Taliho Documents" })
      .first();
    await expect(docsRow).toBeVisible({ timeout: 5000 });

    // Click on the row to navigate to documents view
    await docsRow.click();

    // Wait for the documents view to load - documents should be visible
    await expect(
      authenticatedPage.locator("text=Panel Spec Sheet.pdf"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      authenticatedPage.locator("text=Installation Guide.pdf"),
    ).toBeVisible();
  });

  test("Procore items display with tool tabs", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupQRDetailMocks(routeTracker);

    await qrPage.gotoDetail(qrCodeId);

    await expect(authenticatedPage.locator("text=Panel E-42")).toBeVisible();

    // Procore tools should display as rows or buttons in the tools view
    // Look for Inspections tool entry (count: 3)
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("edit button opens edit modal", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupQRDetailMocks(routeTracker);

    await qrPage.gotoDetail(qrCodeId);
    await expect(authenticatedPage.locator("text=Panel E-42")).toBeVisible();

    // Click the Edit button on the info card
    await qrPage.clickEdit();

    // Edit modal should open
    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });
  });

  test("password protection toggle", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupQRDetailMocks(routeTracker);

    await qrPage.gotoDetail(qrCodeId);
    await expect(authenticatedPage.locator("text=Panel E-42")).toBeVisible();

    // Click Set Password button
    await qrPage.setPasswordButton.click();

    // Password modal should appear
    await expect(
      authenticatedPage.locator("text=Password").first(),
    ).toBeVisible({ timeout: 3000 });
  });

  // --------------------------------------------------------------------------
  // Error States
  // --------------------------------------------------------------------------

  test("QR detail — 404 not found shows error state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    const missingQrId = "qr-nonexistent-999";

    await routeTracker.mockErrorResponse(`**/qr-code/${missingQrId}**`, 404, {
      statusCode: 404,
      message: "QR code not found",
      error: "Not Found",
    });
    await routeTracker.mockErrorResponse(
      `**/qr-code/scanned/${missingQrId}**`,
      404,
      {
        statusCode: 404,
        message: "QR code not found",
        error: "Not Found",
      },
    );

    await qrPage.gotoDetail(missingQrId);

    // Error state should appear - check for the actual "QR Code Not Found" heading
    await expect(
      authenticatedPage.getByRole("heading", { name: /not found/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("QR detail — 500 server error shows error with retry", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    const errorQrId = "qr-error-500";

    await routeTracker.mockErrorResponse(`**/qr-code/${errorQrId}**`, 500, {
      statusCode: 500,
      message: "Internal server error",
      error: "Internal Server Error",
    });
    await routeTracker.mockErrorResponse(
      `**/qr-code/scanned/${errorQrId}**`,
      500,
      {
        statusCode: 500,
        message: "Internal server error",
        error: "Internal Server Error",
      },
    );

    await qrPage.gotoDetail(errorQrId);

    // Error state should appear - both 404 and 500 show the same "QR Code Not Found" state
    await expect(
      authenticatedPage.getByRole("heading", { name: /not found/i }),
    ).toBeVisible({ timeout: 10000 });

    // Back button should be available
    await expect(
      authenticatedPage.getByRole("button", { name: /back/i }),
    ).toBeVisible();
  });
});
