import { test, expect } from "../../fixtures/authenticated-test";
import { GroupsPage } from "../../pages/groups.page";
import { createMockGroup, createMockProject } from "../../fixtures/builders";
import { safeRoute, type RouteTracker } from "../../utils/route-tracker";

// ---------------------------------------------------------------------------
// Mock data helpers
// ---------------------------------------------------------------------------

const mockProject = createMockProject({
  _id: "proj-001",
  projectName: "Test Project Alpha",
  projectStatus: "active",
  archived: false,
});

function buildGroupsResponse(
  groups: ReturnType<typeof createMockGroup>[],
  opts: { currentPage?: number; totalPages?: number; totalItems?: number } = {},
) {
  return {
    success_message: "Groups fetched successfully",
    total_pages: opts.totalPages ?? 1,
    current_page: opts.currentPage ?? 1,
    total_items: opts.totalItems ?? groups.length,
    has_next: false,
    has_prev: false,
    data: groups.map((g) => ({
      ...g,
      projectArchived: false,
      projectStatusValue: "active",
    })),
  };
}

const mockGroups = [
  createMockGroup({
    _id: "grp-001",
    groupName: "Floor Plan A",
    type: "arrangement",
    project: "proj-001",
    numberOfCodes: 5,
    mobileScanCount: 120,
    createdAt: "2025-06-01T10:00:00Z",
  }),
  createMockGroup({
    _id: "grp-002",
    groupName: "HVAC Equipment",
    type: "equipment",
    project: "proj-001",
    numberOfCodes: 3,
    mobileScanCount: 45,
    createdAt: "2025-07-15T14:00:00Z",
  }),
  createMockGroup({
    _id: "grp-003",
    groupName: "Electrical Panel",
    type: "equipment",
    project: "proj-001",
    numberOfCodes: 8,
    mobileScanCount: 200,
    createdAt: "2025-08-20T08:00:00Z",
  }),
];

// ---------------------------------------------------------------------------
// Helper to set up common route mocks for the groups list page
// ---------------------------------------------------------------------------

async function setupListMocks(
  routeTracker: RouteTracker,
  overrides?: {
    groups?: ReturnType<typeof createMockGroup>[];
    totalItems?: number;
  },
) {
  const groups = overrides?.groups ?? mockGroups;
  const response = buildGroupsResponse(groups, {
    totalItems: overrides?.totalItems,
  });

  // Mock groups endpoint - RouteTracker/safeRoute now skip document navigations
  // so broad API patterns no longer hijack frontend route loads.
  await routeTracker.mockRoute("**/groups**", response);
  await routeTracker.mockRoute("**/aggregation/all-projects/**", [mockProject]);
}

// ===========================================================================
// TESTS
// ===========================================================================

test.describe("Groups List @desktop", () => {
  // ── Rendering ───────────────────────────────────────────────────────────

  test("renders groups list with name, type badge, QR count, and scan count", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker);
    await groupsPage.gotoList();

    // Page title
    await expect(groupsPage.pageTitle).toContainText("Groups");

    // Verify table rows
    const rows = groupsPage.getTableRows();
    await expect(rows).toHaveCount(3);

    // Check first group row content
    const firstRow = groupsPage.getRowByName("Floor Plan A");
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText("5"); // QR codes count
    await expect(firstRow).toContainText("120"); // scans count

    // Check second group row
    const secondRow = groupsPage.getRowByName("HVAC Equipment");
    await expect(secondRow).toBeVisible();
    await expect(secondRow).toContainText("3");
    await expect(secondRow).toContainText("45");
  });

  // ── Type filtering ──────────────────────────────────────────────────────

  test("type filter updates list (client-side filtering)", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Initial load: all groups - filtering happens client-side
    await setupListMocks(routeTracker);

    await groupsPage.gotoList();

    // Verify initial load
    await expect(groupsPage.getTableRows()).toHaveCount(3);

    // Apply type filter — click the FilterComboBox trigger button
    await groupsPage.groupTypeFilter.click();

    // Select "Equipment" from the listbox options
    await authenticatedPage.getByRole("option", { name: "Equipment" }).click();

    // Wait for filtered results (client-side filtering)
    await expect(groupsPage.getTableRows()).toHaveCount(2);
    await expect(groupsPage.getRowByName("HVAC Equipment")).toBeVisible();
    await expect(groupsPage.getRowByName("Electrical Panel")).toBeVisible();
  });

  // ── Search ──────────────────────────────────────────────────────────────

  test("search by name filters results", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Initial load
    await setupListMocks(routeTracker);

    // Filtered response for search query
    const filtered = [mockGroups[0]]; // "Floor Plan A"
    await routeTracker.mockRoute(
      "**/groups*search=floor**",
      buildGroupsResponse(filtered, { totalItems: 1 }),
    );

    await groupsPage.gotoList();
    await expect(groupsPage.getTableRows()).toHaveCount(3);

    // Type in search
    await groupsPage.searchInput.fill("floor");

    // Wait for filtered results
    await expect(groupsPage.getTableRows()).toHaveCount(1);
    await expect(groupsPage.getRowByName("Floor Plan A")).toBeVisible();
  });

  // ── Row navigation ──────────────────────────────────────────────────────

  test("navigate to group detail on row click", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker);

    // Mock detail-page APIs directly on page.route (not routeTracker)
    // because they fire asynchronously after navigation and may not
    // complete before the URL assertion passes.
    await safeRoute(authenticatedPage, "**/groups/grp-001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockGroups[0] }),
      });
    });
    await safeRoute(authenticatedPage, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], total_items: 0 }),
      });
    });
    await safeRoute(authenticatedPage, "**/project/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProject),
      });
    });
    await safeRoute(
      authenticatedPage,
      "**/procore/inspection-templates**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      },
    );

    await groupsPage.gotoList();

    // Click the first row
    await groupsPage.clickRow("Floor Plan A");

    // Verify navigation to detail page
    await expect(authenticatedPage).toHaveURL(/\/group\/grp-001/);
  });

  // ── Bulk delete ─────────────────────────────────────────────────────────

  test("bulk select and delete shows confirmation modal", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Widen viewport so bulk action buttons are visible (hidden below 2xl/1536px)
    await authenticatedPage.setViewportSize({ width: 1536, height: 720 });
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker);
    await groupsPage.gotoList();

    // Enable bulk actions
    await groupsPage.toggleBulkActions();

    // Select first row
    await groupsPage.selectRow("Floor Plan A");

    // Click delete button in bulk actions bar
    await groupsPage.bulkDeleteButton.click();

    // Verify delete confirmation modal appears
    await expect(groupsPage.deleteModal).toBeVisible();
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  test("shows empty state when no groups exist", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    await setupListMocks(routeTracker, { groups: [], totalItems: 0 });
    await groupsPage.gotoList();

    // Verify empty state
    await expect(authenticatedPage.locator("text=No Groups yet")).toBeVisible();
    await expect(
      authenticatedPage.locator(
        "text=Create a group to organize multiple QR codes",
      ),
    ).toBeVisible();

    // "Create Group" action should be visible (both in header and empty state)
    await expect(
      authenticatedPage
        .locator('a:has-text("Create Group"), button:has-text("Create Group")')
        .first(),
    ).toBeVisible();
  });

  test("shows 'No Groups found' empty state when search has no results", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Initial load with groups
    await setupListMocks(routeTracker);

    // Search that returns no results
    await routeTracker.mockRoute(
      "**/groups*search=nonexistent**",
      buildGroupsResponse([], { totalItems: 0 }),
    );

    await groupsPage.gotoList();
    await groupsPage.searchInput.fill("nonexistent");

    await expect(
      authenticatedPage.locator("text=No Groups found"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Try adjusting your search"),
    ).toBeVisible();
  });
});
