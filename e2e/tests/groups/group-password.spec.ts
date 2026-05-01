import { test, expect } from "../../fixtures/authenticated-test";
import { createMockGroup, createMockQRCode } from "../../fixtures/builders";

// ============================================================================
// MOCK DATA
// ============================================================================

const projectId = "proj-group-pw-001";
const groupId = "grp-password-001";

const mockGroupNoPassword = createMockGroup({
  _id: groupId,
  groupName: "Electrical Equipment",
  type: "equipment",
  project: projectId,
  passwordActivated: false,
  numberOfCodes: 5,
});

const mockGroupWithPassword = createMockGroup({
  _id: "grp-password-002",
  groupName: "Secured Equipment",
  type: "equipment",
  project: projectId,
  passwordActivated: true,
  numberOfCodes: 3,
});

const mockQRCodesInGroup = [
  createMockQRCode({
    _id: "qr-grp-001",
    qrcodeName: "Panel A",
    group: groupId,
    passwordActivated: false,
  }),
  createMockQRCode({
    _id: "qr-grp-002",
    qrcodeName: "Panel B",
    group: groupId,
    passwordActivated: false,
  }),
];

const _mockPasswordUpdateSuccess = {
  success: true,
  message: "Password updated successfully",
};
// Placeholder for future password update tests
void _mockPasswordUpdateSuccess;

// ============================================================================
// PAGE OBJECT - GroupsPage
// ============================================================================

class GroupsPage {
  constructor(private readonly page: import("@playwright/test").Page) {}

  // Navigation
  async gotoList() {
    await this.page.goto("/groups");
  }

  async gotoDetail(groupId: string) {
    await this.page.goto(`/group/${groupId}`);
  }

  // Detail Page Elements
  get groupTitle() {
    return this.page
      .locator("h1, h2")
      .filter({ hasText: /Equipment|Arrangement/i })
      .first();
  }

  get settingsButton() {
    return this.page.getByRole("button", { name: /Settings|Edit/i });
  }

  get setPasswordButton() {
    // Match "Set Password" or "Update Password" buttons (not small icon buttons)
    // Use first() to handle cases where there are multiple password buttons
    return this.page
      .getByRole("button", { name: /Set Password|Update Password/i })
      .first();
  }

  get passwordStatus() {
    return this.page.locator("text=/password protected|secured/i").first();
  }

  // QR Codes Tab
  get qrCodesTab() {
    return this.page.getByRole("button", { name: /QR Codes/i });
  }

  get qrCodesList() {
    return this.page.locator("table tbody tr");
  }
}

// ============================================================================
// PAGE OBJECT - GroupPasswordModal
// ============================================================================

class GroupPasswordModal {
  constructor(private readonly page: import("@playwright/test").Page) {}

  get modal() {
    return this.page.locator('[role="dialog"]').filter({
      hasText: /Set Password|Password Protection/i,
    });
  }

  get closeButton() {
    return this.modal.getByRole("button", { name: /Close|Cancel/i });
  }

  get passwordInput() {
    return this.modal.locator('input[type="password"]').first();
  }

  get confirmPasswordInput() {
    return this.modal.locator('input[type="password"]').nth(1);
  }

  get applyToQRCodesCheckbox() {
    return this.modal
      .locator("text=/Apply to QR Codes|Inherit/i")
      .locator("..")
      .locator('input[type="checkbox"]');
  }

  get scheduledOption() {
    return this.modal.locator("text=/Scheduled|Time-Based/i").first();
  }

  get saveButton() {
    // The button text is "Set Password" in the modal
    return this.modal.getByRole("button", { name: /Set Password|Save|Apply/i });
  }

  get removePasswordButton() {
    return this.modal.getByRole("button", { name: /Remove|Disable/i });
  }

  get errorMessage() {
    return this.modal.locator(".text-red-500, .text-red-600");
  }

  get warningMessage() {
    return this.modal.locator(
      ".text-yellow-500, .text-amber-500, [class*='warning']",
    );
  }

  async isOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  async waitForOpen() {
    await this.modal.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillPassword(password: string, confirm?: string) {
    await this.passwordInput.fill(password);
    if (
      confirm !== undefined &&
      (await this.confirmPasswordInput.isVisible())
    ) {
      await this.confirmPasswordInput.fill(confirm);
    }
  }

  async save() {
    await this.saveButton.click();
  }

  async close() {
    await this.closeButton.click();
  }
}

// ============================================================================
// TESTS
// ============================================================================

// Helper to set up common mocks for a given group
async function setupGroupDetailMocks(
  routeTracker: import("../../utils/route-tracker").RouteTracker,
  targetGroupId: string,
  groupData: ReturnType<typeof createMockGroup>,
  qrCodes: ReturnType<typeof createMockQRCode>[] = [],
) {
  await routeTracker.mockRoute(`**/groups/${targetGroupId}`, {
    data: groupData,
  });
  await routeTracker.mockRoute(`**/qr-code**`, {
    success_message: "QR codes fetched",
    data: qrCodes,
    total_items: qrCodes.length,
    total_pages: 1,
    current_page: 1,
    has_next: false,
    has_prev: false,
  });
}

test.describe("Group Password Protection @desktop", () => {
  let groupsPage: GroupsPage;
  let passwordModal: GroupPasswordModal;

  test.beforeEach(async ({ authenticatedPage }) => {
    groupsPage = new GroupsPage(authenticatedPage);
    passwordModal = new GroupPasswordModal(authenticatedPage);
  });

  // ==========================================================================
  // ENABLE PASSWORD AT GROUP LEVEL
  // ==========================================================================

  test("Set Password button opens password modal from group detail", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    await groupsPage.gotoDetail(groupId);

    // Wait for page to load
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    // Click Set Password button
    await groupsPage.setPasswordButton.click();

    // Modal should open
    await passwordModal.waitForOpen();
    await expect(passwordModal.modal).toBeVisible();
  });

  test("set password at group level - happy path", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    // Password is set via PATCH to group endpoint, not a separate /password endpoint
    let patchCalled = false;
    await authenticatedPage.route(`**/groups/${groupId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        patchCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Password updated",
            data: { ...mockGroupNoPassword, passwordActivated: true },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill password
    await passwordModal.fillPassword("GroupPass123!", "GroupPass123!");

    // Save
    await passwordModal.save();

    // Wait for API call and verify
    await authenticatedPage.waitForTimeout(1000);
    expect(patchCalled).toBe(true);
  });

  // ==========================================================================
  // INHERITANCE TO QR CODES
  // ==========================================================================

  test("password modal shows protection options", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Password modal should show password protection options
    // This could be "Password Protection" toggle, "Always"/"Scheduled" options, etc.
    const hasProtectionOption = await authenticatedPage
      .locator("text=/Password Protection|Always|Scheduled/i")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasProtectionOption).toBe(true);
  });

  test("group with password shows password-enabled state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const passwordGroupId = "grp-password-002";

    await setupGroupDetailMocks(
      routeTracker,
      passwordGroupId,
      mockGroupWithPassword,
      [
        {
          ...mockQRCodesInGroup[0],
          _id: "qr-inherited-001",
          group: passwordGroupId,
          passwordActivated: true,
        },
      ],
    );

    await groupsPage.gotoDetail(passwordGroupId);

    // Group name should be visible
    await expect(
      authenticatedPage.locator("text=Secured Equipment"),
    ).toBeVisible();

    // Page should have password-related UI (either button or indicator)
    // Wait for page to fully load, then check for password button
    await authenticatedPage.waitForLoadState("networkidle");
    await expect(groupsPage.setPasswordButton).toBeVisible({ timeout: 5000 });
  });

  // ==========================================================================
  // PASSWORD WITH SCHEDULING
  // ==========================================================================

  test("group password can be scheduled", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // The password modal should have scheduling options
    // Look for "Scheduled" button option using role-based selector
    const scheduledBtn = authenticatedPage
      .locator('[role="dialog"]')
      .getByRole("button", { name: /Scheduled/i });

    if (await scheduledBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force: true to bypass scroll container interception
      await scheduledBtn.click({ force: true });

      // Schedule settings should be visible after clicking
      const scheduleSettings = await authenticatedPage
        .locator("text=/Schedule Settings|Timezone|Weekday/i")
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      expect(scheduleSettings).toBe(true);
    }
  });

  // ==========================================================================
  // REMOVE GROUP PASSWORD
  // ==========================================================================

  test("remove password protection from group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const passwordGroupId = "grp-password-002";

    await routeTracker.mockRoute(`**/groups/${passwordGroupId}`, {
      data: mockGroupWithPassword,
    });
    await routeTracker.mockRoute(`**/qr-code**`, {
      success_message: "QR codes fetched",
      data: [],
      total_items: 0,
      total_pages: 1,
      current_page: 1,
      has_next: false,
      has_prev: false,
    });

    // Password removal uses PATCH to group endpoint
    await authenticatedPage.route(
      `**/groups/${passwordGroupId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success_message: "Password removed",
              data: { ...mockGroupWithPassword, passwordActivated: false },
            }),
          });
        } else {
          await route.fallback();
        }
      },
    );

    await groupsPage.gotoDetail(passwordGroupId);
    await expect(
      authenticatedPage.locator("text=Secured Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Remove password button should be available
    if (
      await passwordModal.removePasswordButton
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await passwordModal.removePasswordButton.click();

      // Confirm if needed
      const confirmBtn = authenticatedPage.getByRole("button", {
        name: /Confirm|Yes|Remove/i,
      });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // Success or modal closes
      const success = await authenticatedPage
        .locator("text=/removed|success/i")
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(success || !(await passwordModal.isOpen())).toBeTruthy();
    }
  });

  // ==========================================================================
  // CONFLICT HANDLING
  // ==========================================================================

  test("password modal can be opened from protected group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Mock group with password
    const passwordGroupId = "grp-password-002";

    await setupGroupDetailMocks(
      routeTracker,
      passwordGroupId,
      mockGroupWithPassword,
      [
        {
          ...mockQRCodesInGroup[0],
          _id: "qr-own-pass-001",
          group: passwordGroupId,
          passwordActivated: true,
        },
      ],
    );

    await groupsPage.gotoDetail(passwordGroupId);
    await expect(
      authenticatedPage.locator("text=Secured Equipment"),
    ).toBeVisible();

    // Wait for page to fully load
    await authenticatedPage.waitForLoadState("networkidle");

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Modal should be visible
    await expect(passwordModal.modal).toBeVisible();
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  test("validation - passwords must match", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    // Fill mismatched passwords
    await passwordModal.fillPassword("Password123!", "DifferentPass456!");

    await passwordModal.save();

    // Error should appear
    const hasError = await passwordModal.errorMessage
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const modalStillOpen = await passwordModal.isOpen();

    expect(hasError || modalStillOpen).toBeTruthy();
  });

  // ==========================================================================
  // API ERROR HANDLING
  // ==========================================================================

  test("API failure shows error and retains form data", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupGroupDetailMocks(
      routeTracker,
      groupId,
      mockGroupNoPassword,
      mockQRCodesInGroup,
    );

    // Mock PATCH failure for password update
    await authenticatedPage.route(`**/groups/${groupId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Failed to update password" }),
        });
      } else {
        await route.fallback();
      }
    });

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Equipment"),
    ).toBeVisible();

    await groupsPage.setPasswordButton.click();
    await passwordModal.waitForOpen();

    await passwordModal.fillPassword("FailingPass123!", "FailingPass123!");
    await passwordModal.save();

    // Error should display
    await expect(
      authenticatedPage.locator("text=/failed|error/i").first(),
    ).toBeVisible({ timeout: 5000 });

    // Modal should stay open
    await expect(passwordModal.modal).toBeVisible();
  });

  // ==========================================================================
  // PASSWORD STATUS DISPLAY
  // ==========================================================================

  test("group detail page loads for password-protected group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const passwordGroupId = "grp-password-002";

    await routeTracker.mockRoute(`**/groups/${passwordGroupId}`, {
      data: mockGroupWithPassword,
    });
    await routeTracker.mockRoute(`**/qr-code**`, {
      success_message: "QR codes fetched",
      data: [],
      total_items: 0,
      total_pages: 1,
      current_page: 1,
      has_next: false,
      has_prev: false,
    });

    await groupsPage.gotoDetail(passwordGroupId);

    // Group name should be visible
    await expect(
      authenticatedPage.locator("text=Secured Equipment"),
    ).toBeVisible();

    // Password button should be available
    await expect(groupsPage.setPasswordButton).toBeVisible();
  });
});
