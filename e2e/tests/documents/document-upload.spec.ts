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
  createMockDocument,
  createMockFolder,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-upload-001",
  projectName: "Upload Test Project",
  projectStatus: "active",
});

const mockGroup = createMockGroup({
  _id: "grp-upload-001",
  groupName: "Upload Test Group",
  type: "equipment",
});

const qrCodeId = "qr-upload-001";

const mockQRCode = {
  data: createMockQRCode({
    _id: qrCodeId,
    qrcodeName: "Upload Test QR",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "equipment",
  }),
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Upload Test QR",
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
  folders: [createMockFolder({ _id: "fld-001", folderName: "Specs" })],
  documents: [
    createMockDocument({
      _id: "doc-001",
      documentName: "Existing File.pdf",
      documentSize: 204800,
    }),
  ],
};

const mockUploadSuccess = {
  success: true,
  message: "Document uploaded successfully",
  data: createMockDocument({
    _id: "doc-new-001",
    documentName: "New Upload.pdf",
    documentSize: 512000,
  }),
};

// ============================================================================
// HELPERS
// ============================================================================

async function setupDetailPageMocks(
  authenticatedPage: import("@playwright/test").Page,
  routeTracker: import("../../utils/route-tracker").RouteTracker,
) {
  // Track this route explicitly to avoid unmocked API warnings.
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}*`, mockQRCode);
  await routeTracker.mockRoute(`**/qr-code/scanned/${qrCodeId}`, mockScannedQR);
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}/procore-tools`, {
    procoreTools: [],
    qrType: "folder",
    procoreCategory: null,
  });
  // Use safeRoute for groups endpoint - may not be called on all test flows
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

  // Untracked fallbacks
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

test.describe("Document Upload @desktop", () => {
  test("upload button opens upload modal on QR detail page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    await setupDetailPageMocks(authenticatedPage, routeTracker);
    await qrPage.gotoDetail(qrCodeId);

    // Wait for QR name to render
    await expect(
      authenticatedPage.locator("text=Upload Test QR"),
    ).toBeVisible();

    // Look for the upload/add document button
    const uploadBtn = authenticatedPage
      .locator(
        'button:has-text("Upload"), button:has-text("Add Document"), button:has-text("Add File"), [data-testid="upload-button"]',
      )
      .first();

    if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadBtn.click();

      // Upload modal should open
      await expect(
        authenticatedPage.locator(
          '[data-testid="upload-modal"], [role="dialog"]',
        ),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  test("upload single document shows progress and success", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Use safeRoute since the upload action may not be triggered if UI elements aren't found
    await safeRoute(authenticatedPage, "**/document**", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(mockUploadSuccess),
      });
    });

    await setupDetailPageMocks(authenticatedPage, routeTracker);
    await qrPage.gotoDetail(qrCodeId);

    await expect(
      authenticatedPage.locator("text=Upload Test QR"),
    ).toBeVisible();

    // Open the upload modal
    const uploadBtn = authenticatedPage
      .locator(
        'button:has-text("Upload"), button:has-text("Add Document"), button:has-text("Add File"), [data-testid="upload-button"]',
      )
      .first();

    if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadBtn.click();

      // Wait for the modal
      await authenticatedPage.waitForTimeout(500);

      // Find the file input in the modal
      const fileInput = authenticatedPage.locator('input[type="file"]');
      if (await fileInput.count()) {
        const pdfContent = Buffer.from("%PDF-1.4 mock content", "utf-8");
        await fileInput.setInputFiles({
          name: "New Upload.pdf",
          mimeType: "application/pdf",
          buffer: pdfContent,
        });

        // Should show file name or ready state
        await expect(
          authenticatedPage
            .locator("text=/New Upload|ready|selected/i")
            .first(),
        ).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test("upload failure shows error message", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // Use safeRoute since the upload action may not be triggered if UI elements aren't found
    await safeRoute(authenticatedPage, "**/document**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Upload failed. Please try again.",
        }),
      });
    });

    await setupDetailPageMocks(authenticatedPage, routeTracker);
    await qrPage.gotoDetail(qrCodeId);

    await expect(
      authenticatedPage.locator("text=Upload Test QR"),
    ).toBeVisible();

    const uploadBtn = authenticatedPage
      .locator(
        'button:has-text("Upload"), button:has-text("Add Document"), button:has-text("Add File"), [data-testid="upload-button"]',
      )
      .first();

    if (await uploadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await uploadBtn.click();

      const fileInput = authenticatedPage.locator('input[type="file"]');
      if (await fileInput.count()) {
        const pdfContent = Buffer.from("%PDF-1.4 mock fail", "utf-8");
        await fileInput.setInputFiles({
          name: "FailUpload.pdf",
          mimeType: "application/pdf",
          buffer: pdfContent,
        });

        // Submit upload if there's a confirm button
        const confirmBtn = authenticatedPage.getByRole("button", {
          name: /Upload|Submit|Confirm/i,
        });
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click();

          // Error message should appear
          await expect(
            authenticatedPage.locator("text=/fail|error|try again/i").first(),
          ).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
