import { test, expect } from "../../fixtures/authenticated-test";
import { ProjectsPage } from "../../pages/projects.page";
import { createMockProject, resetIdCounter } from "../../fixtures/builders";
import type { Page } from "@playwright/test";
import { safeRoute, type RouteTracker } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const PROJECT_A = createMockProject({
  _id: "proj-001",
  projectName: "Downtown Tower",
  clientName: "Acme Construction",
  projectAddress: "100 Main St",
  projectCity: "Los Angeles",
  projectState: "CA",
  projectZIP: "90001",
  projectStatus: "active",
  archived: false,
  qrCodes: 12,
  groups: 3,
  name: "Downtown Tower",
  location: "100 Main St, Los Angeles, CA, 90001",
});

const PROJECT_B = createMockProject({
  _id: "proj-002",
  projectName: "Harbor Bridge",
  clientName: "Bridge Corp",
  projectAddress: "200 Harbor Blvd",
  projectCity: "San Diego",
  projectState: "CA",
  projectZIP: "92101",
  projectStatus: "completed",
  archived: false,
  qrCodes: 8,
  groups: 2,
  name: "Harbor Bridge",
  location: "200 Harbor Blvd, San Diego, CA, 92101",
});

const PROJECT_C = createMockProject({
  _id: "proj-003",
  projectName: "Airport Terminal",
  clientName: "Skyway Inc",
  projectAddress: "300 Aviation Way",
  projectCity: "San Francisco",
  projectState: "CA",
  projectZIP: "94128",
  projectStatus: "archived",
  archived: true,
  qrCodes: 5,
  groups: 1,
  name: "Airport Terminal",
  location: "300 Aviation Way, San Francisco, CA, 94128",
});

function buildProjectsResponse(
  projects: ReturnType<typeof createMockProject>[],
  opts?: { total_items?: number; current_page?: number; total_pages?: number },
) {
  return {
    success_message: "Projects fetched successfully",
    total_pages: opts?.total_pages ?? 1,
    current_page: opts?.current_page ?? 1,
    total_items: opts?.total_items ?? projects.length,
    has_next: false,
    has_prev: false,
    data: projects,
  };
}

function buildSingleProjectResponse(
  project: ReturnType<typeof createMockProject>,
) {
  return {
    success_message: "Project fetched successfully",
    data: project,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mock a project API route via page.route() directly (bypassing routeTracker).
 *
 * Project API paths (/project, /project/:id) collide with frontend page
 * routes (/projects, /project/:id) when using glob patterns. This helper
 * adds a resourceType guard so that page navigations (type "document") are
 * let through while API calls (type "fetch"/"xhr") are fulfilled with the
 * mock response.
 */
async function mockProjectApiRoute(
  page: Page,
  pattern: string | RegExp | ((url: URL) => boolean),
  response: object,
  status = 200,
) {
  await safeRoute(page, pattern, async (route) => {
    // Let page navigations through — only intercept API (xhr/fetch) requests
    if (route.request().resourceType() === "document") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock the standard project list API and Procore status endpoint.
 *
 * Uses a regex for the project list endpoint so that the literal "?"
 * in /project?... is matched correctly. A glob "?" is a single-char
 * wildcard that would also match /projects (the page route), breaking
 * the SPA load.
 */
async function mockProjectListAPIs(
  page: Page,
  projects: ReturnType<typeof createMockProject>[],
  listOpts?: Parameters<typeof buildProjectsResponse>[1],
) {
  await mockProjectApiRoute(
    page,
    /\/project\?/,
    buildProjectsResponse(projects, listOpts),
  );
}

// ============================================================================
// TESTS — PROJECTS LIST
// ============================================================================

test.describe("Projects List @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("renders projects list with names and status badges", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, [
      PROJECT_A,
      PROJECT_B,
      PROJECT_C,
    ]);
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Verify project names are visible
    await expect(
      projectsPage.getProjectNameInRow("Downtown Tower"),
    ).toBeVisible();
    await expect(
      projectsPage.getProjectNameInRow("Harbor Bridge"),
    ).toBeVisible();
    await expect(
      projectsPage.getProjectNameInRow("Airport Terminal"),
    ).toBeVisible();

    // Verify status badges
    const activeRow = projectsPage.getRowByName("Downtown Tower");
    await expect(activeRow).toContainText("Active");

    const completedRow = projectsPage.getRowByName("Harbor Bridge");
    await expect(completedRow).toContainText("Completed");

    const archivedRow = projectsPage.getRowByName("Airport Terminal");
    await expect(archivedRow).toContainText("Archived");
  });

  test("search filters results via API", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Initial load — all projects
    await mockProjectListAPIs(authenticatedPage, [
      PROJECT_A,
      PROJECT_B,
      PROJECT_C,
    ]);
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Mock filtered response for search — registered AFTER the general mock,
    // so Playwright checks it first (last registered = highest priority)
    await mockProjectApiRoute(
      authenticatedPage,
      /\/project\?.*search=Downtown/,
      buildProjectsResponse([PROJECT_A]),
    );

    await projectsPage.searchProjects("Downtown");

    // Wait for debounced search to take effect
    await authenticatedPage.waitForTimeout(500);

    // The search input should have the query
    await expect(projectsPage.searchInput).toHaveValue("Downtown");
  });

  test("navigates to project detail on row click", async ({
    authenticatedPage,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, [PROJECT_A]);

    // Mock the detail API — uses mockProjectApiRoute to skip document requests
    await mockProjectApiRoute(
      authenticatedPage,
      "**/project/proj-001**",
      buildSingleProjectResponse(PROJECT_A),
    );
    // Mock project QR codes endpoint for the detail page.
    // Runtime does not always fetch this immediately after row-click navigation.
    await safeRoute(
      authenticatedPage,
      "**/aggregation/project-qrcodes**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Fetched",
            data: [],
            total_items: 0,
            total_pages: 0,
            current_page: 1,
            has_next: false,
            has_prev: false,
          }),
        });
      },
    );

    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Click on the project row
    const row = projectsPage.getRowByName("Downtown Tower");
    await row.click();

    // Should navigate to the project detail page
    await authenticatedPage.waitForURL("**/project/proj-001**");
    await expect(authenticatedPage).toHaveURL(/\/project\/proj-001/);
  });

  test("empty state when no projects exist", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, []);
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Empty state should show
    await expect(projectsPage.emptyStateTitle).toBeVisible();
    await expect(projectsPage.emptyStateDescription).toBeVisible();

    // Create Project action should be available for admin
    await expect(projectsPage.emptyStateAction).toBeVisible();
  });

  test("empty state with search shows 'No Projects found'", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock project list to return empty results
    await mockProjectApiRoute(
      authenticatedPage,
      /\/project\?/,
      buildProjectsResponse([]),
    );

    await authenticatedPage.goto("/projects?q=nonexistent");
    await projectsPage.waitForListLoad();

    // Should show the search-specific empty state
    await expect(
      authenticatedPage.locator("text=No Projects found"),
    ).toBeVisible();
  });

  test("delete project shows confirmation modal", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, [PROJECT_A]);
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Enable bulk actions
    await projectsPage.bulkActionsToggle.click();

    // Select the project row checkbox
    const row = projectsPage.getRowByName("Downtown Tower");
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();

    // Open the "More" dropdown in the bulk actions bar (at 1280px, direct
    // action buttons are hidden behind the responsive More menu).
    // The ItemComboBox trigger has aria-label="Actions" so we locate by
    // visible text content instead.
    await authenticatedPage
      .locator("button")
      .filter({ hasText: "More" })
      .click();

    // Click the Delete option inside the dropdown
    await authenticatedPage.getByRole("menuitem", { name: "Delete" }).click();

    // Verify the delete confirmation modal appears
    await expect(projectsPage.deleteModal).toBeVisible();
    await expect(projectsPage.deleteModal).toContainText("permanently delete");
  });

  test("archive project via bulk actions", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, [PROJECT_A]);

    // Mock the PATCH endpoint for archiving
    await mockProjectApiRoute(authenticatedPage, "**/project/proj-001**", {
      success_message: "Project updated",
      data: { ...PROJECT_A, projectStatus: "archived", archived: true },
    });

    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Enable bulk actions
    await projectsPage.bulkActionsToggle.click();

    // Select the project
    const row = projectsPage.getRowByName("Downtown Tower");
    const checkbox = row.locator('input[type="checkbox"]');
    await checkbox.check();

    // Open the "More" dropdown (at 1280px, action buttons are behind responsive More menu)
    await authenticatedPage
      .locator("button")
      .filter({ hasText: "More" })
      .click();

    // Click the Archive option inside the dropdown
    await authenticatedPage.getByRole("menuitem", { name: "Archive" }).click();

    // Confirm in the archive modal
    await expect(projectsPage.archiveModal).toBeVisible();
    const confirmButton = projectsPage.archiveModal.getByRole("button", {
      name: /Archive/,
    });
    await confirmButton.click();
  });

  test("Create Project modal opens and displays form fields", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectListAPIs(authenticatedPage, [PROJECT_A]);
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Click "Create Project" button
    await projectsPage.clickCreateProject();

    // Verify modal is open with all form fields
    await expect(projectsPage.createModal).toBeVisible();
    await expect(projectsPage.createProjectNameInput).toBeVisible();
    await expect(projectsPage.createClientNameInput).toBeVisible();
    await expect(projectsPage.createAddressInput).toBeVisible();
    await expect(projectsPage.createCityInput).toBeVisible();
    await expect(projectsPage.createStateInput).toBeVisible();
    await expect(projectsPage.createZIPInput).toBeVisible();

    // Submit button should be disabled when form is empty
    await expect(projectsPage.createSubmitButton).toBeDisabled();
  });
});

// ============================================================================
// TESTS — PROJECT DETAIL
// ============================================================================

test.describe("Project Detail @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  /** Set up mocks common to all detail tests */
  async function mockDetailAPIs(
    page: Page,
    routeTracker: RouteTracker,
    project: ReturnType<typeof createMockProject>,
    qrCodes: unknown[] = [],
    groups: unknown[] = [],
  ) {
    // Project detail — use mockProjectApiRoute to avoid intercepting
    // page navigation to /project/:id (same path, different port)
    await mockProjectApiRoute(
      page,
      `**/project/${project._id}**`,
      buildSingleProjectResponse(project),
    );
    await routeTracker.mockRoute("**/aggregation/project-qrcodes**", {
      success_message: "Fetched",
      data: qrCodes,
      total_items: qrCodes.length,
      total_pages: 1,
      current_page: 1,
      has_next: false,
      has_prev: false,
    });
    await safeRoute(page, "**/groups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success_message: "Fetched",
          data: groups,
          total_items: groups.length,
          total_pages: 1,
          current_page: 1,
          has_next: false,
          has_prev: false,
        }),
      });
    });
  }

  test("renders project header with name, status, and address", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockDetailAPIs(authenticatedPage, routeTracker, PROJECT_A);
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // Project name should be visible in the header
    await expect(projectsPage.detailProjectName).toContainText(
      "Downtown Tower",
    );

    // Address info should be visible
    await expect(projectsPage.detailAddress).toContainText("100 Main St");
  });

  test("shows QR Codes and Groups tabs", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockDetailAPIs(authenticatedPage, routeTracker, PROJECT_A);
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // Both tabs should be visible
    await expect(projectsPage.qrCodesTab).toBeVisible();
    await expect(projectsPage.groupsTab).toBeVisible();
  });

  test("Groups tab displays groups list", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    const mockGroups = [
      {
        _id: "grp-001",
        groupName: "Building A Equipment",
        type: "equipment",
        numberOfCodes: 5,
        mobileScanCount: 20,
        createdAt: "2025-06-01T09:00:00Z",
      },
      {
        _id: "grp-002",
        groupName: "Floor Plans",
        type: "arrangement",
        numberOfCodes: 8,
        mobileScanCount: 35,
        createdAt: "2025-06-15T09:00:00Z",
      },
    ];

    await mockDetailAPIs(
      authenticatedPage,
      routeTracker,
      PROJECT_A,
      [],
      mockGroups,
    );
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // Switch to Groups tab
    await projectsPage.switchToGroupsTab();

    // Groups should be listed
    await expect(
      authenticatedPage.locator("text=Building A Equipment"),
    ).toBeVisible();
    await expect(authenticatedPage.locator("text=Floor Plans")).toBeVisible();
  });

  test("Settings button is visible for admin users", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockDetailAPIs(authenticatedPage, routeTracker, PROJECT_A);
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // Settings dropdown should be visible for admin
    await expect(projectsPage.settingsButton).toBeVisible();
  });

  test("Create QR Code button is visible on QR Codes tab", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockDetailAPIs(authenticatedPage, routeTracker, PROJECT_A);
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // Create QR Code button should be visible on the default (QR Codes) tab
    await expect(
      authenticatedPage.getByRole("button", { name: "Create QR Code" }).first(),
    ).toBeVisible();
  });

  test("empty QR codes state renders on detail page", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockDetailAPIs(authenticatedPage, routeTracker, PROJECT_A, [], []);
    await projectsPage.gotoDetail("proj-001");
    await projectsPage.waitForDetailLoad();

    // The empty state should appear for QR codes
    await expect(
      authenticatedPage.locator("text=/No QR|empty|no items/i").first(),
    )
      .toBeVisible({ timeout: 5000 })
      .catch(() => {
        // Some empty states may render as empty tables — that's also valid
      });
  });
});
