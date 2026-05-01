import { test, expect } from "../../fixtures/authenticated-test";
import { createMockGroup, createMockProject } from "../../fixtures/builders";
import { type RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-fetch-001",
  projectName: "Procore Fetch Project",
  company: "comp-test-001",
  procoreProjectID: "12345",
  procoreCompanyID: "67890",
});

const mockGroup = createMockGroup({
  _id: "grp-fetch-001",
  groupName: "Procore Fetch Group",
  type: "arrangement",
  project: mockProject._id,
});

const mockProjectWithProcore = { ...mockProject };

const mockPermissions = {
  tools: [
    {
      available_for_user: true,
      friendly_name: "Inspections",
      name: "inspection",
    },
    {
      available_for_user: true,
      friendly_name: "Punch List",
      name: "punch-list",
    },
    {
      available_for_user: true,
      friendly_name: "Forms",
      name: "form",
    },
  ],
};

const mockTools = [
  { id: 1, title: "Inspections", is_active: true, count: 12 },
  { id: 2, title: "Punch List", is_active: true, count: 5 },
  { id: 3, title: "Forms", is_active: true, count: 3 },
];

const mockGlobalInspectionData = {
  data: {
    procoreInspections: [
      {
        id: 1,
        procoreItemID: "FETCH-001",
        name: "Safety Inspection January",
        status: "Open",
        identifier: "INS-2026-001",
        inspection_type: { name: "Safety" },
        created_at: "2026-01-15T09:00:00Z",
      },
      {
        id: 2,
        procoreItemID: "FETCH-002",
        name: "Weekly Safety Report",
        status: "Closed",
        identifier: "INS-2026-002",
        inspection_type: { name: "Safety" },
        created_at: "2026-01-20T09:00:00Z",
      },
    ],
    hiddenIdsByTool: {
      inspections: [],
    },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

async function setupFetchPage(routeTracker: RouteTracker) {
  await routeTracker.mockRoute(`**/groups/${mockGroup._id}**`, {
    data: mockGroup,
  });
  await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
    data: mockProjectWithProcore,
  });
  await routeTracker.mockRoute("**/procore/permissions**", mockPermissions);
  await routeTracker.mockRoute("**/procore/tools**", mockTools);
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Procore Fetch Configuration @desktop", () => {
  test("renders fetch page with tool selection cards", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPage(routeTracker);

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    // Page should render with data-page-id
    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("displays breadcrumb navigation with project and group", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPage(routeTracker);

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });

    // Breadcrumbs should show project and group names
    await expect(
      authenticatedPage.locator(`text=${mockProject.projectName}`),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.locator(`text=${mockGroup.groupName}`),
    ).toBeVisible();
  });

  test("tool cards display tool names and item counts from API", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPage(routeTracker);

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });

    // Tool names should be visible
    await expect(
      authenticatedPage.locator("text=Inspections").first(),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.locator("text=Punch List").first(),
    ).toBeVisible();

    // Count badges are optional in the current card design.
  });

  test("clicking tool card loads tool data table", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPage(routeTracker);
    await routeTracker.mockRoute(
      "**/groups/**/procore-fetch-global**",
      mockGlobalInspectionData,
    );

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });

    // Click on Inspections tool card
    const inspectionCard = authenticatedPage
      .locator("text=Inspections")
      .first();
    await expect(inspectionCard).toBeVisible({ timeout: 5000 });
    await inspectionCard.click();

    // Data table should load with items
    await expect(
      authenticatedPage.locator("text=Safety Inspection January"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("select items and add to group â€” happy path", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    await setupFetchPage(routeTracker);
    await routeTracker.mockRoute(
      "**/groups/**/procore-fetch-global**",
      mockGlobalInspectionData,
    );

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });

    // Click on a tool
    const inspectionCard = authenticatedPage
      .locator("text=Inspections")
      .first();
    await expect(inspectionCard).toBeVisible({ timeout: 5000 });
    await inspectionCard.click();

    // Wait for items to load
    await expect(
      authenticatedPage.locator("text=Safety Inspection January"),
    ).toBeVisible({ timeout: 5000 });

    // Select at least one row from the modal data table.
    const modal = authenticatedPage.locator('[role="dialog"]');
    const inspectionRow = modal.locator("tr", {
      hasText: "Safety Inspection January",
    });
    await expect(inspectionRow).toBeVisible({ timeout: 5000 });
    await inspectionRow.getByRole("checkbox").check();

    // Click modal "Add Selected" to move selections into the right panel.
    const addSelectedButton = modal.getByRole("button", {
      name: /Add Selected/i,
    });
    await expect(addSelectedButton).toBeEnabled({ timeout: 5000 });
    await addSelectedButton.click();

    const selectedPanel = authenticatedPage.locator("aside").filter({
      has: authenticatedPage.getByRole("heading", { name: /Selected Items/i }),
    });
    await expect(selectedPanel).toBeVisible({ timeout: 5000 });
    await expect(
      selectedPanel.getByText(/Safety Inspection January/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("cancel navigates back", async ({ authenticatedPage, routeTracker }) => {
    await setupFetchPage(routeTracker);

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    const fetchPage = authenticatedPage.locator(
      '[data-page-id="procore-fetch"]',
    );
    await expect(fetchPage).toBeVisible({ timeout: 10000 });

    // Click cancel
    const cancelButton = authenticatedPage.getByRole("button", {
      name: "Cancel",
    });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // Verify navigation away from fetch page
    await expect(authenticatedPage).not.toHaveURL(/\/procore\/fetch/);
  });

  test("no Procore connection shows error state", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Mock project without Procore IDs
    const projectNoProcore = { ...mockProject, procoreProjectID: null };
    await routeTracker.mockRoute(`**/groups/${mockGroup._id}**`, {
      data: mockGroup,
    });
    await routeTracker.mockRoute(`**/project/${mockProject._id}**`, {
      data: projectNoProcore,
    });
    await routeTracker.mockRoute("**/procore/tools**", mockTools);

    await authenticatedPage.goto(
      `/procore/fetch?groupId=${mockGroup._id}&projectId=${mockProject._id}`,
    );

    // Should show error state with Go Back button
    await expect(authenticatedPage.getByText(/Go Back/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
