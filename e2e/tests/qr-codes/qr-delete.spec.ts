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
import { safeRoute, type RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-del-001",
  projectName: "Delete Test Project",
});

const mockGroup = createMockGroup({
  _id: "grp-del-001",
  groupName: "Delete Test Group",
});

const qrCodeId = "qr-del-001";

const mockQRCodeSingle = {
  data: createMockQRCode({
    _id: qrCodeId,
    qrcodeName: "Delete Me QR",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "arrangement",
  }),
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Delete Me QR",
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
  procoreTools: [],
  folders: [],
  documents: [],
};

const mockQrProcoreTools = {
  procoreTools: [],
  qrType: "folder",
  procoreCategory: null,
};

// ============================================================================
// HELPERS
// ============================================================================

async function setupQRDetailPage(
  authenticatedPage: import("@playwright/test").Page,
  routeTracker: RouteTracker,
) {
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}**`, mockQRCodeSingle);
  await routeTracker.mockRoute(
    `**/qr-code/scanned/${qrCodeId}**`,
    mockScannedQR,
  );
  await routeTracker.mockRoute(
    `**/qr-code/${qrCodeId}/procore-tools`,
    mockQrProcoreTools,
  );
  // Group route is optional - only called if QR has groupingId/arrangement/equipment
  await safeRoute(
    authenticatedPage,
    `**/groups/${mockGroup._id}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockGroup }),
      });
    },
  );
  await safeRoute(
    authenticatedPage,
    `**/project/${mockAuthCompany._id}/${mockProject._id}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockProject }),
      });
    },
  );
  await safeRoute(
    authenticatedPage,
    `**/qr-code/image/${qrCodeId}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null, exists: false }),
      });
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Delete @desktop", () => {
  test("delete QR code — happy path redirects to list", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupQRDetailPage(authenticatedPage, routeTracker);
    // Mock the DELETE endpoint - the actual API uses DELETE /qr-code/:id (not /qr-code/delete/:id)
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "QR code deleted.",
            }),
          });
        } else {
          await route.fallback();
        }
      },
    );
    // Mock the QR list page data for redirect (use safeRoute since it's only called after redirect)
    await safeRoute(authenticatedPage, "**/qr-code?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    const qrPage = new QRCodesPage(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);

    // Wait for page title (use first() to avoid strict mode violation - title appears in multiple places)
    await expect(
      authenticatedPage.locator("h1:has-text('Delete Me QR')"),
    ).toBeVisible({
      timeout: 5000,
    });

    // Click delete button on the detail page
    await qrPage.clickDelete();

    // Confirmation modal should appear - look for the modal dialog with delete warning
    await expect(
      authenticatedPage.getByRole("heading", { name: "Delete QR Code" }),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      authenticatedPage.getByText(/cannot be undone/i),
    ).toBeVisible();

    // Confirm deletion - click the delete button in the modal
    const confirmDeleteButton = authenticatedPage
      .getByRole("button", { name: "Delete" })
      .last();
    await confirmDeleteButton.click();

    // Should redirect to QR codes list
    await authenticatedPage.waitForURL("**/my-qrcodes", { timeout: 10000 });
  });

  test("delete QR code — cancel keeps on detail page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupQRDetailPage(authenticatedPage, routeTracker);

    const qrPage = new QRCodesPage(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);

    // Wait for page title (use h1 to avoid strict mode violation)
    await expect(
      authenticatedPage.locator("h1:has-text('Delete Me QR')"),
    ).toBeVisible({
      timeout: 5000,
    });

    // Click delete
    await qrPage.clickDelete();

    // Confirmation modal should appear - look for the modal dialog with delete warning
    await expect(
      authenticatedPage.getByRole("heading", { name: "Delete QR Code" }),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      authenticatedPage.getByText(/cannot be undone/i),
    ).toBeVisible();

    // Cancel
    await authenticatedPage.getByRole("button", { name: "Cancel" }).click();

    // Should still be on detail page
    await expect(
      authenticatedPage.locator("h1:has-text('Delete Me QR')"),
    ).toBeVisible();
    await expect(authenticatedPage).toHaveURL(new RegExp(`qrcode/${qrCodeId}`));
  });

  test("delete QR code — API failure shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupQRDetailPage(authenticatedPage, routeTracker);
    // Mock the DELETE endpoint to fail - the actual API uses DELETE /qr-code/:id
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}**`,
      async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Internal server error" }),
          });
        } else {
          await route.fallback();
        }
      },
    );

    const qrPage = new QRCodesPage(authenticatedPage);
    await qrPage.gotoDetail(qrCodeId);

    // Wait for page title (use h1 to avoid strict mode violation)
    await expect(
      authenticatedPage.locator("h1:has-text('Delete Me QR')"),
    ).toBeVisible({
      timeout: 5000,
    });

    await qrPage.clickDelete();

    // Confirmation modal should appear - look for the modal dialog with delete warning
    await expect(
      authenticatedPage.getByRole("heading", { name: "Delete QR Code" }),
    ).toBeVisible({ timeout: 3000 });
    await expect(
      authenticatedPage.getByText(/cannot be undone/i),
    ).toBeVisible();

    const confirmDeleteButton = authenticatedPage
      .getByRole("button", { name: "Delete" })
      .last();
    await confirmDeleteButton.click();

    // Error should appear (toast notification or alert)
    // Look for toast or alert with error messaging
    const errorIndicator = authenticatedPage
      .locator('.text-red-500, .text-red-600, [role="alert"], [role="status"]')
      .or(authenticatedPage.getByText(/error|failed/i));
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });
});
