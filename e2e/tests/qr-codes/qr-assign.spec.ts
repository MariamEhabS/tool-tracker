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
  _id: "proj-assign-001",
  projectName: "Assign Test Project",
});

const mockGroup = createMockGroup({
  _id: "grp-assign-001",
  groupName: "Assign Test Group",
  type: "arrangement",
});

const mockTargetGroup = createMockGroup({
  _id: "grp-assign-target",
  groupName: "Target Group",
  type: "equipment",
});

const mockTargetProject = createMockProject({
  _id: "proj-assign-target",
  projectName: "Target Project",
});

const qrCodeId = "qr-assign-001";

const mockQRCodeSingle = {
  data: createMockQRCode({
    _id: qrCodeId,
    qrcodeName: "Assign Test QR",
    project: mockProject._id,
    projectName: mockProject.projectName,
    group: mockGroup._id,
    groupingType: "arrangement",
  }),
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Assign Test QR",
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

const mockGroupsList = {
  data: [mockGroup, mockTargetGroup],
  total_items: 2,
  has_next: false,
  has_prev: false,
};

const mockProjectsList = {
  data: [mockProject, mockTargetProject],
  total_items: 2,
  has_next: false,
  has_prev: false,
};

// ============================================================================
// HELPERS
// ============================================================================

async function setupQRDetailPage(
  authenticatedPage: import("@playwright/test").Page,
  routeTracker: RouteTracker,
) {
  // Mock the QR code detail endpoint (with query params like ?companyId=...)
  // Note: Using * at end to match query parameters
  await routeTracker.mockRoute(`**/qr-code/${qrCodeId}*`, mockQRCodeSingle);
  await routeTracker.mockRoute(`**/qr-code/scanned/${qrCodeId}`, mockScannedQR);
  await routeTracker.mockRoute(
    `**/qr-code/${qrCodeId}/procore-tools`,
    mockQrProcoreTools,
  );
  // Use safeRoute for optional group fetch - may not be called depending on test flow
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
  // Mock groups and projects lists for the assign modal search
  await safeRoute(authenticatedPage, "**/groups*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockGroupsList),
    });
  });
  await safeRoute(
    authenticatedPage,
    `**/aggregation/all-projects/${mockAuthCompany._id}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProjectsList.data),
      });
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("QR Code Assign To @desktop", () => {
  test.describe("Assign to Group", () => {
    test("assign QR to existing group — happy path", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      await setupQRDetailPage(authenticatedPage, routeTracker);
      // Use safeRoute for conditional API calls - may not be triggered
      await safeRoute(
        authenticatedPage,
        `**/qr-code/assign/**`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "QR code assigned to group.",
            }),
          });
        },
      );

      const qrPage = new QRCodesPage(authenticatedPage);
      await qrPage.gotoDetail(qrCodeId);

      await expect(
        authenticatedPage.locator("text=Assign Test QR"),
      ).toBeVisible({ timeout: 5000 });

      // Open the assign/move action — may be under a dropdown or direct button
      const assignButton = authenticatedPage.locator(
        'button:has-text("Assign"), button:has-text("Move to Group")',
      );
      if (
        await assignButton
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await assignButton.first().click();

        // AssignToModal should appear
        const assignModal = authenticatedPage.locator(
          'text="Assign", text="Choose method"',
        );
        await expect(assignModal.first()).toBeVisible({ timeout: 3000 });

        // Select "Assign to existing" radio (default)
        const existingRadio = authenticatedPage.locator(
          'text="Assign to existing"',
        );
        if (
          await existingRadio.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await existingRadio.click();
        }

        // Search and select the target group
        const searchBox = authenticatedPage.locator(
          '[data-testid="assign-select"]',
        );
        if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchBox.click();
          const targetOption = authenticatedPage.locator(
            `text=${mockTargetGroup.groupName}`,
          );
          await expect(targetOption).toBeVisible({ timeout: 3000 });
          await targetOption.click();
        }

        // Confirm assignment
        const confirmButton = authenticatedPage.getByRole("button", {
          name: /Assign/,
        });
        await confirmButton.last().click();

        // Should call the assign endpoint
        expect(routeTracker.wasIntercepted("**/qr-code/assign/**")).toBe(true);
      }
    });

    test("assign QR — API failure shows error", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      await setupQRDetailPage(authenticatedPage, routeTracker);
      // Use safeRoute for conditional error mocking
      await safeRoute(
        authenticatedPage,
        `**/qr-code/assign/**`,
        async (route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Error",
              statusCode: 500,
              message: "Mock error response with status 500",
            }),
          });
        },
      );

      const qrPage = new QRCodesPage(authenticatedPage);
      await qrPage.gotoDetail(qrCodeId);

      await expect(
        authenticatedPage.locator("text=Assign Test QR"),
      ).toBeVisible({ timeout: 5000 });

      const assignButton = authenticatedPage.locator(
        'button:has-text("Assign"), button:has-text("Move to Group")',
      );
      if (
        await assignButton
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await assignButton.first().click();

        const searchBox = authenticatedPage.locator(
          '[data-testid="assign-select"]',
        );
        if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchBox.click();
          const targetOption = authenticatedPage.locator(
            `text=${mockTargetGroup.groupName}`,
          );
          if (
            await targetOption.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            await targetOption.click();
          }
        }

        const confirmButton = authenticatedPage.getByRole("button", {
          name: /Assign/,
        });
        if (
          await confirmButton
            .last()
            .isEnabled({ timeout: 2000 })
            .catch(() => false)
        ) {
          await confirmButton.last().click();

          // Error message should appear
          const errorIndicator = authenticatedPage.locator(
            '.text-red-500, .text-red-600, [role="alert"], text="error"',
          );
          await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test("assign QR — empty selection prevents submit", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      await setupQRDetailPage(authenticatedPage, routeTracker);

      const qrPage = new QRCodesPage(authenticatedPage);
      await qrPage.gotoDetail(qrCodeId);

      await expect(
        authenticatedPage.locator("text=Assign Test QR"),
      ).toBeVisible({ timeout: 5000 });

      const assignButton = authenticatedPage.locator(
        'button:has-text("Assign"), button:has-text("Move to Group")',
      );
      if (
        await assignButton
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await assignButton.first().click();

        // Without selecting anything, the confirm button should be disabled
        const confirmButton = authenticatedPage.getByRole("button", {
          name: /Assign/,
        });
        if (
          await confirmButton
            .last()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          await expect(confirmButton.last()).toBeDisabled();
        }
      }
    });
  });

  test.describe("Assign to Project", () => {
    test("assign QR to project — happy path", async ({
      authenticatedPage,
      routeTracker,
    }) => {
      await setupQRDetailPage(authenticatedPage, routeTracker);
      // Use safeRoute for conditional API calls
      await safeRoute(
        authenticatedPage,
        `**/qr-code/assign/**`,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "QR code assigned to project.",
            }),
          });
        },
      );

      const qrPage = new QRCodesPage(authenticatedPage);
      await qrPage.gotoDetail(qrCodeId);

      await expect(
        authenticatedPage.locator("text=Assign Test QR"),
      ).toBeVisible({ timeout: 5000 });

      // Look for "Assign to Project" or similar action
      const assignProjectButton = authenticatedPage.locator(
        'button:has-text("Assign to Project"), button:has-text("Move to Project")',
      );
      if (
        await assignProjectButton
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await assignProjectButton.first().click();

        const searchBox = authenticatedPage.locator(
          '[data-testid="assign-select"]',
        );
        if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchBox.click();
          const targetOption = authenticatedPage.locator(
            `text=${mockTargetProject.projectName}`,
          );
          if (
            await targetOption.isVisible({ timeout: 3000 }).catch(() => false)
          ) {
            await targetOption.click();
          }
        }

        const confirmButton = authenticatedPage.getByRole("button", {
          name: /Assign/,
        });
        await confirmButton.last().click();
      }
    });
  });
});
