import { test, expect } from "../../fixtures/authenticated-test";
import { GroupsPage } from "../../pages/groups.page";
import {
  createMockGroup,
  createMockProject,
  resetIdCounter,
} from "../../fixtures/builders";
import type { RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-gc-001",
  projectName: "Group Create Project",
  projectStatus: "active",
});

const existingGroups = [
  createMockGroup({
    _id: "grp-existing-001",
    groupName: "Existing Group",
    type: "arrangement",
    project: mockProject._id,
    numberOfCodes: 3,
    mobileScanCount: 42,
  }),
];

function buildGroupsResponse(groups: ReturnType<typeof createMockGroup>[]) {
  return {
    success_message: "Groups fetched successfully",
    total_pages: 1,
    current_page: 1,
    total_items: groups.length,
    has_next: false,
    has_prev: false,
    data: groups.map((g) => ({
      ...g,
      projectArchived: false,
      projectStatusValue: "active",
    })),
  };
}

async function setupListMocks(routeTracker: RouteTracker) {
  // Mock groups list endpoint using a port-agnostic API path matcher.
  await routeTracker.mockRoute(
    "**/groups**",
    buildGroupsResponse(existingGroups),
  );
  // Note: all-projects is already mocked in authenticated-test.ts fixture
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Group Create @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("Create Group button navigates to create flow", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker);
    await groupsPage.gotoList();

    // Wait for the page to load
    await expect(groupsPage.pageTitle).toContainText("Groups");

    // The "Create Group" button should be visible
    await expect(groupsPage.createGroupButton).toBeVisible();

    // Click "Create Group" button - it navigates to /create-qr?step=2&tab=bulk
    await groupsPage.createGroupButton.click();

    // Verify navigation to create QR page with bulk tab
    await expect(authenticatedPage).toHaveURL(
      /\/create-qr.*step=.*2.*tab=bulk/,
    );

    // The create QR page should show the "Create QR Codes" heading (with leading space from icon)
    await expect(
      authenticatedPage.getByRole("heading", { name: /Create QR Codes/ }),
    ).toBeVisible({ timeout: 5000 });

    // Verify bulk options are available (e.g., "Assorted Group" option)
    await expect(
      authenticatedPage.getByRole("heading", { name: "Assorted Group" }),
    ).toBeVisible();
  });

  test("Create Group link is visible for admin users", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker);
    await groupsPage.gotoList();

    // Wait for page to load
    await expect(groupsPage.pageTitle).toContainText("Groups");

    // Create Group button should be visible for admin users (mocked in authenticated-test fixture)
    await expect(groupsPage.createGroupButton).toBeVisible();
  });

  test("Create Group appears in empty state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Mock empty groups list
    await routeTracker.mockRoute("**/groups**", buildGroupsResponse([]));

    const groupsPage = new GroupsPage(authenticatedPage);
    await groupsPage.gotoList();

    // Verify empty state is shown
    await expect(authenticatedPage.locator("text=No Groups yet")).toBeVisible();

    // Create Group action should be available in empty state
    await expect(
      authenticatedPage
        .getByRole("link", { name: "Create Group" })
        .or(authenticatedPage.getByRole("button", { name: "Create Group" }))
        .first(),
    ).toBeVisible();
  });
});
