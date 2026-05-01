import { test, expect } from "../../fixtures/authenticated-test";
import { ProjectsPage } from "../../pages/projects.page";
import {
  createMockProject,
  createMockQRCode,
  createMockGroup,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// ============================================================================
// MOCK DATA
// ============================================================================

const projectId = "proj-detail-001";

const mockProject = createMockProject({
  _id: projectId,
  projectName: "Downtown Office Tower",
  clientName: "Apex Development Corp",
  projectAddress: "500 Market Street",
  projectCity: "San Francisco",
  projectState: "CA",
  projectZIP: "94105",
  projectStatus: "active",
  qrCodes: 12,
  groups: 3,
  mobileScanCount: 256,
});

const mockProjectArchived = createMockProject({
  _id: "proj-archived-001",
  projectName: "Completed Warehouse",
  projectStatus: "archived",
  archived: true,
});

const mockQRCodesInProject = [
  createMockQRCode({
    _id: "qr-proj-001",
    qrcodeName: "Lobby Panel A",
    project: projectId,
    projectName: mockProject.projectName,
    mobileScanCount: 45,
  }),
  createMockQRCode({
    _id: "qr-proj-002",
    qrcodeName: "Elevator Control Room",
    project: projectId,
    projectName: mockProject.projectName,
    mobileScanCount: 23,
  }),
  createMockQRCode({
    _id: "qr-proj-003",
    qrcodeName: "Roof HVAC Unit",
    project: projectId,
    projectName: mockProject.projectName,
    mobileScanCount: 18,
  }),
];

const mockGroupsInProject = [
  createMockGroup({
    _id: "grp-proj-001",
    groupName: "Floor 1 Equipment",
    type: "equipment",
    project: projectId,
    numberOfCodes: 5,
  }),
  createMockGroup({
    _id: "grp-proj-002",
    groupName: "Electrical Panels",
    type: "arrangement",
    project: projectId,
    numberOfCodes: 4,
  }),
];

const mockQRListResponse = {
  success_message: "Fetched",
  data: mockQRCodesInProject,
  total_items: mockQRCodesInProject.length,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
};

const mockGroupsListResponse = {
  success_message: "Fetched",
  data: mockGroupsInProject,
  total_items: mockGroupsInProject.length,
  total_pages: 1,
  current_page: 1,
  has_next: false,
  has_prev: false,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Wrap project data in the expected API response format.
 */
function buildSingleProjectResponse(project: object) {
  return {
    success_message: "Project fetched successfully",
    data: project,
  };
}

/**
 * Mock project API route with proper resourceType guard to avoid intercepting
 * page navigations. Uses a glob pattern and resourceType check.
 */
async function mockSingleProjectRoute(
  page: Page,
  projectIdToMock: string,
  projectData: object,
  status = 200,
) {
  const response =
    status === 200 ? buildSingleProjectResponse(projectData) : projectData; // Error responses don't need wrapping

  await safeRoute(page, `**/project/${projectIdToMock}**`, async (route) => {
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
 * Mock project list API route (GET /project?companyId=...).
 * Uses a regex to match exactly /project? (list endpoint).
 */
async function mockProjectListRoute(page: Page, response: object) {
  await safeRoute(page, /\/project\?/, async (route) => {
    // Let page navigations through — only intercept API (xhr/fetch) requests
    if (route.request().resourceType() === "document") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Project Detail Page @desktop", () => {
  let projectPage: ProjectsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    projectPage = new ProjectsPage(authenticatedPage);

    // Common mocks for all tests - use correct API patterns:
    // GET /project/{projectId}?companyId=... for single project
    await mockSingleProjectRoute(authenticatedPage, projectId, mockProject);

    // GET /aggregation/project-qrcodes for QR codes in project
    // This request is not guaranteed on error paths, so keep it non-strict.
    await safeRoute(
      authenticatedPage,
      "**/aggregation/project-qrcodes**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockQRListResponse),
        });
      },
    );

    // GET /groups for groups list (fetched lazily when Groups tab is opened)
    await safeRoute(authenticatedPage, "**/groups**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockGroupsListResponse),
      });
    });
  });

  // ==========================================================================
  // RENDERING & METADATA
  // ==========================================================================

  test("renders project name and metadata", async ({ authenticatedPage }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Project name should be visible
    await expect(
      authenticatedPage.locator("text=Downtown Office Tower"),
    ).toBeVisible();

    // Client name should be visible
    await expect(
      authenticatedPage.locator("text=Apex Development Corp"),
    ).toBeVisible();
  });

  test("displays project address", async ({ authenticatedPage }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Address parts should be visible
    await expect(
      authenticatedPage.locator("text=500 Market Street").first(),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=/San Francisco|CA|94105/").first(),
    ).toBeVisible();
  });

  test("shows active status badge for active project", async ({
    authenticatedPage,
  }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Status badge should show "Active" or similar
    await expect(
      authenticatedPage.locator("text=/active/i").first(),
    ).toBeVisible();
  });

  test("shows archived status badge for archived project", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const archivedProjectId = "proj-archived-001";

    // Override the project mock for archived project
    await mockSingleProjectRoute(
      authenticatedPage,
      archivedProjectId,
      mockProjectArchived,
    );
    await routeTracker.mockRoute("**/aggregation/project-qrcodes**", {
      success_message: "Fetched",
      data: [],
      total_items: 0,
      total_pages: 0,
      current_page: 1,
      has_next: false,
      has_prev: false,
    });

    await projectPage.gotoDetail(archivedProjectId);
    await projectPage.waitForDetailLoad();

    await expect(
      authenticatedPage.locator("text=/archived/i").first(),
    ).toBeVisible();
  });

  // ==========================================================================
  // QR CODES TAB
  // ==========================================================================

  test("displays list of QR codes within project", async ({
    authenticatedPage,
  }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // QR Codes should be listed
    await expect(authenticatedPage.locator("text=Lobby Panel A")).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Elevator Control Room"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Roof HVAC Unit"),
    ).toBeVisible();
  });

  test("navigates to QR code detail when clicking QR code row", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Mocks already set up in beforeEach
    await routeTracker.mockRoute(
      "**/aggregation/project-qrcodes**",
      mockQRListResponse,
    );

    // Mock the QR detail page data (add trailing ** to match query params)
    await routeTracker.mockRoute(
      `**/qr-code/${mockQRCodesInProject[0]._id}?**`,
      {
        data: mockQRCodesInProject[0],
      },
    );
    await routeTracker.mockRoute(
      `**/qr-code/scanned/${mockQRCodesInProject[0]._id}**`,
      {
        data: mockQRCodesInProject[0],
        procoreTools: [],
        folders: [],
        documents: [],
      },
    );
    await routeTracker.mockRoute(
      `**/qr-code/${mockQRCodesInProject[0]._id}/procore-tools**`,
      { procoreTools: [], qrType: "folder" },
    );

    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Click on a QR code row (use the link, not the text which may have an overlay)
    const qrRow = authenticatedPage.getByRole("link", {
      name: /Lobby Panel A/i,
    });
    await qrRow.click();

    // Should navigate to QR detail
    await authenticatedPage.waitForURL(
      `**/qrcode/${mockQRCodesInProject[0]._id}**`,
      {
        timeout: 5000,
      },
    );
  });

  test("shows QR code scan counts", async ({ authenticatedPage }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Scan counts should be displayed (45, 23, 18)
    await expect(authenticatedPage.locator("text=45").first()).toBeVisible();
  });

  // ==========================================================================
  // GROUPS TAB
  // ==========================================================================

  test("switches to Groups tab and displays groups", async ({
    authenticatedPage,
  }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Switch to Groups tab
    await projectPage.switchToGroupsTab();

    // Groups should be visible
    await expect(
      authenticatedPage.locator("text=Floor 1 Equipment"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible();
  });

  test("displays group type badges (equipment/arrangement)", async ({
    authenticatedPage,
  }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    await projectPage.switchToGroupsTab();

    // Type badges should be visible
    await expect(
      authenticatedPage.locator("text=/equipment/i").first(),
    ).toBeVisible();
  });

  // ==========================================================================
  // PROJECT STATS
  // ==========================================================================

  test("displays project statistics", async ({ authenticatedPage }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Stats should be visible (total QR codes, scans, groups)
    // Look for stat cards or summary info
    const statsSection = authenticatedPage.locator("text=/12|256|3/");
    await expect(statsSection.first()).toBeVisible();
  });

  // ==========================================================================
  // SETTINGS & EDIT
  // ==========================================================================

  test("Settings button opens dropdown and Edit Project option opens modal", async ({
    authenticatedPage,
  }) => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Click settings button to open dropdown
    await projectPage.settingsButton.click();

    // Wait for dropdown menu to appear
    const dropdownMenu = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    // "Edit Project" option should appear in dropdown
    const editProjectOption = authenticatedPage.getByRole("menuitem", {
      name: "Edit Project",
    });
    await expect(editProjectOption).toBeVisible({ timeout: 3000 });

    // Click the option to open modal
    await editProjectOption.click();

    // Edit modal should open
    await expect(
      authenticatedPage
        .locator('[role="dialog"]')
        .filter({ hasText: /Edit Project|Project Settings/i })
        .first(),
    ).toBeVisible({ timeout: 3000 });
  });

  // ==========================================================================
  // EMPTY STATES
  // ==========================================================================

  test("shows empty state when project has no QR codes", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    // Override with empty QR codes response
    await routeTracker.mockRoute("**/aggregation/project-qrcodes**", {
      success_message: "Fetched",
      data: [],
      total_items: 0,
      total_pages: 0,
      current_page: 1,
      has_next: false,
      has_prev: false,
    });

    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Empty state message should be visible
    await expect(
      authenticatedPage
        .locator("text=/no qr codes|create.*first|get started/i")
        .first(),
    ).toBeVisible();
  });

  test("shows empty state when project has no groups", async ({
    authenticatedPage,
  }) => {
    // Override with empty groups response (fetched lazily)
    await safeRoute(authenticatedPage, "**/groups**", async (route) => {
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
    });

    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    await projectPage.switchToGroupsTab();

    // Empty state for groups
    await expect(
      authenticatedPage
        .locator("text=/no groups|create.*first|get started/i")
        .first(),
    ).toBeVisible();
  });

  // ==========================================================================
  // ERROR STATES
  // ==========================================================================

  test("shows 404 error for non-existent project", async ({
    authenticatedPage,
  }) => {
    const missingProjectId = "proj-nonexistent-999";

    // Mock 404 response for the project endpoint
    await mockSingleProjectRoute(
      authenticatedPage,
      missingProjectId,
      { statusCode: 404, message: "Project not found", error: "Not Found" },
      404,
    );

    await projectPage.gotoDetail(missingProjectId);

    // Error state should appear
    await expect(
      authenticatedPage
        .locator("text=/not found|does not exist|error|something went wrong/i")
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows error state when project fetch fails", async ({
    authenticatedPage,
  }) => {
    const errorProjectId = "proj-error-500";

    // Mock 500 response for the project endpoint
    await mockSingleProjectRoute(
      authenticatedPage,
      errorProjectId,
      {
        statusCode: 500,
        message: "Internal server error",
        error: "Internal Server Error",
      },
      500,
    );

    await projectPage.gotoDetail(errorProjectId);

    // Error state should appear (app shows "Project Not Found" for all fetch errors)
    await expect(
      authenticatedPage
        .locator(
          "text=/not found|error|went wrong|try again|something went wrong/i",
        )
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  // ==========================================================================
  // PERMISSIONS
  // ==========================================================================

  test("Create QR Code button is visible for users with permissions", async () => {
    // Mocks already set up in beforeEach
    await projectPage.gotoDetail(projectId);
    await projectPage.waitForDetailLoad();

    // Create button should be visible
    await expect(projectPage.detailCreateButton).toBeVisible();
  });

  // ==========================================================================
  // NAVIGATION FROM DASHBOARD
  // ==========================================================================

  test("navigates to project detail from projects list", async ({
    authenticatedPage,
  }) => {
    // Mock projects list endpoint (GET /project?companyId=...)
    await mockProjectListRoute(authenticatedPage, {
      success_message: "Projects fetched successfully",
      total_pages: 1,
      current_page: 1,
      total_items: 1,
      has_next: false,
      has_prev: false,
      data: [mockProject],
    });

    // Start at projects list
    await projectPage.gotoList();
    await projectPage.waitForListLoad();

    // Click on project row (use the row link, not the text which may have an overlay)
    await authenticatedPage
      .getByRole("link", { name: /View Downtown Office Tower/i })
      .click();

    // Should navigate to detail page
    await authenticatedPage.waitForURL(`**/project/${projectId}**`, {
      timeout: 5000,
    });

    await expect(
      authenticatedPage.locator("text=Downtown Office Tower"),
    ).toBeVisible();
  });
});
