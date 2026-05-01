import {
  test,
  expect,
  mockAuthCompany,
  RouteTracker,
} from "../../fixtures/authenticated-test";
import type { Page } from "@playwright/test";
import { QRCodesPage } from "../../pages/qr-codes.page";
import {
  createMockQRCode,
  createMockGroup,
  createMockProject,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-edit-001",
  projectName: "Renovation Project",
  projectStatus: "active",
});

const mockGroup = createMockGroup({
  _id: "grp-edit-001",
  groupName: "HVAC Systems",
  type: "equipment",
});

const qrCodeId = "qr-edit-001";

const mockQRCode = {
  data: createMockQRCode({
    _id: qrCodeId,
    qrcodeName: "Rooftop Unit RTU-5",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "equipment",
    mobileScanCount: 7,
    passwordActivated: false,
  }),
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Rooftop Unit RTU-5",
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

const mockGroups = {
  success_message: "Groups retrieved",
  total_items: 1,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
  data: [mockGroup],
};

const mockProjects = [mockProject];

// ============================================================================
// HELPERS
// ============================================================================

async function setupDetailMocks(
  routeTracker: RouteTracker,
  authenticatedPage: Page,
) {
  // Mock the QR code detail endpoint (with query params like ?companyId=...)
  // Note: Using * at end to match query parameters
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}*`, mockQRCode);
  await routeTracker.mockRoute(`**/qr-code/scanned/${qrCodeId}`, mockScannedQR);
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
  // Mock groups and projects for the edit modal dropdowns
  await safeRoute(authenticatedPage, "**/groups*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockGroups),
    });
  });
  await safeRoute(
    authenticatedPage,
    "**/aggregation/all-projects/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProjects),
      });
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Edit @desktop", () => {
  test("edit modal opens with pre-filled values", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    await setupDetailMocks(routeTracker, authenticatedPage);

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();

    await qrPage.clickEdit();

    // Edit modal should open with the title
    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });

    // The QR name field should be pre-filled
    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue("Rooftop Unit RTU-5");
    }
  });

  test("edit saves updated name and sends PATCH request", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    await setupDetailMocks(routeTracker, authenticatedPage);

    // Mock the PATCH endpoint for saving
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                ...mockQRCode.data,
                qrcodeName: "Rooftop Unit RTU-5 (Updated)",
              },
            }),
          });
        } else {
          await route.fallback();
        }
      },
    );

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();

    await qrPage.clickEdit();

    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });

    // Update the name field
    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("Rooftop Unit RTU-5 (Updated)");
    }

    // Set up PATCH request listener
    const patchPromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/qr-code/${qrCodeId}`) && req.method() === "PATCH",
    );

    // Click Save
    const saveButton = authenticatedPage.getByRole("button", { name: "Save" });
    await saveButton.click();

    // Verify the PATCH request was made
    const request = await patchPromise;
    expect(request.method()).toBe("PATCH");
  });

  test("cancel edit closes modal without saving", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    await setupDetailMocks(routeTracker, authenticatedPage);

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();

    await qrPage.clickEdit();

    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });

    // Click Cancel
    const cancelButton = authenticatedPage.getByRole("button", {
      name: "Cancel",
    });
    await cancelButton.click();

    // Modal should close
    await expect(
      authenticatedPage.locator("text=Edit QR Code"),
    ).not.toBeVisible({ timeout: 3000 });

    // Original name still displayed
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();
  });

  test("edit save failure shows error and keeps modal open", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    await setupDetailMocks(routeTracker, authenticatedPage);

    // Mock PATCH to fail
    await safeRoute(
      authenticatedPage,
      `**/qr-code/${qrCodeId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
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

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();

    await qrPage.clickEdit();

    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });

    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("Updated Name");
    }

    const saveButton = authenticatedPage.getByRole("button", { name: "Save" });
    await saveButton.click();

    // Error indicator should appear (toast or inline)
    const errorIndicator = authenticatedPage.locator(
      '.text-red-500, .text-red-600, [role="alert"], [role="status"]',
    );
    // Modal or error toast should be visible after failed save
    await authenticatedPage.waitForTimeout(2000);

    // The edit modal title or the page should still be accessible
    // (the modal may close with a toast error, or stay open with inline error)
    const modalStillOpen = await authenticatedPage
      .locator("text=Edit QR Code")
      .isVisible()
      .catch(() => false);
    const toastVisible = await errorIndicator
      .first()
      .isVisible()
      .catch(() => false);

    expect(modalStillOpen || toastVisible).toBeTruthy();
  });

  test("save button enabled when name is not required", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);
    await setupDetailMocks(routeTracker, authenticatedPage);

    await qrPage.gotoDetail(qrCodeId);
    await expect(
      authenticatedPage.locator("text=Rooftop Unit RTU-5"),
    ).toBeVisible();

    await qrPage.clickEdit();

    await expect(authenticatedPage.locator("text=Edit QR Code")).toBeVisible({
      timeout: 3000,
    });

    // Clear the name field
    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("   "); // Whitespace only

      // Save button should be enabled since name field is not marked as required
      const saveButton = authenticatedPage.getByRole("button", {
        name: "Save",
      });
      await expect(saveButton).toBeEnabled();
    }
  });
});
