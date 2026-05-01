import { test, expect } from "../../fixtures/authenticated-test";
import { GroupsPage } from "../../pages/groups.page";
import {
  createMockGroup,
  createMockProject,
  createMockQRCode,
} from "../../fixtures/builders";
import { safeRoute, type RouteTracker } from "../../utils/route-tracker";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProject = createMockProject({
  _id: "proj-detail-001",
  projectName: "Alpha Construction",
  projectStatus: "active",
  archived: false,
});

const mockGroup = createMockGroup({
  _id: "grp-detail-001",
  groupName: "Building Wing A",
  type: "arrangement",
  project: "proj-detail-001",
  numberOfCodes: 3,
  mobileScanCount: 87,
});

const mockQrCodes = [
  createMockQRCode({
    _id: "qr-001",
    qrcodeName: "Lobby Entrance",
    group: "grp-detail-001",
    project: "proj-detail-001",
    mobileScanCount: 42,
    createdAt: "2025-06-10T10:00:00Z",
  }),
  createMockQRCode({
    _id: "qr-002",
    qrcodeName: "Elevator Bay",
    group: "grp-detail-001",
    project: "proj-detail-001",
    mobileScanCount: 30,
    createdAt: "2025-07-05T14:00:00Z",
  }),
  createMockQRCode({
    _id: "qr-003",
    qrcodeName: "Stairwell B",
    group: "grp-detail-001",
    project: "proj-detail-001",
    mobileScanCount: 15,
    createdAt: "2025-08-01T09:00:00Z",
  }),
];

function buildQrListResponse(
  qrCodes: ReturnType<typeof createMockQRCode>[],
  opts: { totalItems?: number } = {},
) {
  return {
    success_message: "QR codes fetched successfully",
    total_pages: 1,
    current_page: 1,
    total_items: opts.totalItems ?? qrCodes.length,
    has_next: false,
    has_prev: false,
    data: qrCodes,
  };
}

// ---------------------------------------------------------------------------
// Common mock setup for the group detail page
// ---------------------------------------------------------------------------

async function setupDetailMocks(
  routeTracker: RouteTracker,
  overrides?: {
    group?: ReturnType<typeof createMockGroup>;
    qrCodes?: ReturnType<typeof createMockQRCode>[];
  },
) {
  const group = overrides?.group ?? mockGroup;
  const qrCodes = overrides?.qrCodes ?? mockQrCodes;

  // Single group
  await routeTracker.mockRoute(`**/groups/${group._id}`, {
    success_message: "Group fetched",
    data: group,
  });

  // QR codes list for this group
  await routeTracker.mockRoute("**/qr-code*", buildQrListResponse(qrCodes));

  // Single project (detail page uses useSingleProject → GET /project/:id?companyId=...)
  await routeTracker.mockRoute("**/project/proj-detail-001**", {
    success_message: "Project fetched",
    data: mockProject,
  });
}

// ===========================================================================
// TESTS
// ===========================================================================

test.describe("Group Detail @desktop", () => {
  // ── Rendering ───────────────────────────────────────────────────────────

  test("renders group info with name, type icon, and project badge", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupDetailMocks(routeTracker);
    await groupsPage.gotoDetail("grp-detail-001");

    // Group name in page title
    await expect(groupsPage.groupName).toContainText("Building Wing A");

    // Project badge should be visible
    await expect(
      authenticatedPage.locator("text=Alpha Construction"),
    ).toBeVisible();
  });

  // ── QR codes list ───────────────────────────────────────────────────────

  test("renders QR codes list within group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupDetailMocks(routeTracker);
    await groupsPage.gotoDetail("grp-detail-001");

    // Verify QR code cards are rendered
    await expect(
      authenticatedPage.locator("text=Lobby Entrance"),
    ).toBeVisible();
    await expect(authenticatedPage.locator("text=Elevator Bay")).toBeVisible();
    await expect(authenticatedPage.locator("text=Stairwell B")).toBeVisible();
  });

  // ── Edit group name ─────────────────────────────────────────────────────

  test("edit group name via Settings menu", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // setupDetailMocks registers **/groups/grp-detail-001 which handles
    // both the initial GET and the subsequent PATCH (same URL pattern).
    await setupDetailMocks(routeTracker);

    await groupsPage.gotoDetail("grp-detail-001");

    // Open Settings combo and click Edit Group (ItemComboBox uses role="menuitem")
    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();

    // Edit modal should appear (target the modal heading, not the menu item span)
    await expect(
      authenticatedPage.getByRole("heading", { name: "Edit Group" }),
    ).toBeVisible();

    // Fill the name field (first text input in the modal)
    const nameInput = authenticatedPage.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill("Building Wing B");

    // Submit the edit modal
    await authenticatedPage
      .getByRole("button", { name: /Save|Confirm|Update/ })
      .click();

    // Verify success toast
    await expect(
      authenticatedPage.locator("text=Group updated successfully"),
    ).toBeVisible();
  });

  // ── Password protection ─────────────────────────────────────────────────

  test("set password button is visible for admin users", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupDetailMocks(routeTracker);
    await groupsPage.gotoDetail("grp-detail-001");

    // Wait for the project data to load (ensures the project mock is called
    // before routeTracker.assertAllRoutesIntercepted runs in afterEach)
    await expect(
      authenticatedPage.locator("text=Alpha Construction"),
    ).toBeVisible();

    // Set Password button should be visible in header actions
    await expect(groupsPage.setPasswordButton).toBeVisible();
  });

  // ── Navigate back ───────────────────────────────────────────────────────

  test("navigates back to groups list via breadcrumb/link", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Mock a 404 to trigger the error state with "Back to Groups" link
    await routeTracker.mockErrorResponse("**/groups/nonexistent-group", 404, {
      message: "Group not found",
    });
    // Note: groups list and all-projects are already mocked in authenticated-test.ts fixture
    // No need to re-mock here

    await groupsPage.gotoDetail("nonexistent-group");

    // The error component should show "Group Not Found"
    await expect(groupsPage.notFoundTitle).toBeVisible();

    // Click "Back to Groups"
    await groupsPage.backToGroupsLink.click();

    // Verify navigation to groups list
    await expect(authenticatedPage).toHaveURL(/\/groups/);
  });

  // ── Error Paths ──────────────────────────────────────────────────────────

  test("group edit save failure shows error toast", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Set up normal detail mocks first, then override the group endpoint
    // to return 500 on PATCH (next request after the initial GET)
    await setupDetailMocks(routeTracker);
    await groupsPage.gotoDetail("grp-detail-001");

    // Wait for page load
    await expect(groupsPage.groupName).toContainText("Building Wing A");

    // Override the group endpoint to fail on next call (PATCH)
    await safeRoute(
      authenticatedPage,
      `**/groups/grp-detail-001`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Failed to update group" }),
          });
        } else {
          await route.continue();
        }
      },
    );

    // Open Settings and click Edit Group
    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();

    await expect(
      authenticatedPage.getByRole("heading", { name: "Edit Group" }),
    ).toBeVisible();

    const nameInput = authenticatedPage.locator('input[type="text"]').first();
    await nameInput.clear();
    await nameInput.fill("Should Fail");

    await authenticatedPage
      .getByRole("button", { name: /Save|Confirm|Update/ })
      .click();

    // Error toast should appear
    await expect(
      authenticatedPage.locator("text=/fail|error|could not|unable/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("QR codes fetch failure shows error state within group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Mock group detail success but QR codes list failure
    await routeTracker.mockRoute(`**/groups/${mockGroup._id}`, {
      success_message: "Group fetched",
      data: mockGroup,
    });
    await routeTracker.mockErrorResponse("**/qr-code*", 500, {
      message: "Failed to fetch QR codes",
    });
    await routeTracker.mockRoute("**/project/proj-detail-001**", {
      success_message: "Project fetched",
      data: mockProject,
    });

    await groupsPage.gotoDetail("grp-detail-001");

    // Group name should still render
    await expect(groupsPage.groupName).toContainText("Building Wing A");

    // QR codes section should show error or empty state
    // The UI shows "No items found" when QR codes fail to load
    await expect(
      authenticatedPage
        .locator("text=/no items found|error|fail|no qr codes/i")
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("password set failure shows error message", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupDetailMocks(routeTracker);

    await groupsPage.gotoDetail("grp-detail-001");

    // Wait for project data
    await expect(
      authenticatedPage.locator("text=Alpha Construction"),
    ).toBeVisible();

    // Override the group endpoint to fail on PATCH requests (password updates use PATCH /groups/:id)
    await safeRoute(
      authenticatedPage,
      `**/groups/grp-detail-001`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Failed to set password" }),
          });
        } else {
          await route.continue();
        }
      },
    );

    // Click Set Password button
    await groupsPage.setPasswordButton.click();

    // Password modal should appear - wait for it explicitly
    const passwordModal = authenticatedPage.locator('[role="dialog"]');
    await expect(passwordModal).toBeVisible({ timeout: 5000 });

    // Fill both password fields (New Password and Confirm Password)
    const newPwInput = authenticatedPage.getByRole("textbox", {
      name: "New Password",
    });
    await expect(newPwInput).toBeVisible({ timeout: 3000 });
    await newPwInput.fill("TestPass123");

    const confirmPwInput = authenticatedPage.getByRole("textbox", {
      name: "Confirm Password",
    });
    await confirmPwInput.fill("TestPass123");

    // Submit the form - click the "Set Password" button in the modal footer
    const saveBtn = authenticatedPage
      .locator('[role="dialog"]')
      .getByRole("button", { name: /Set Password/i });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Error should appear (toast or inline error)
    await expect(
      authenticatedPage.locator("text=/fail|error/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
