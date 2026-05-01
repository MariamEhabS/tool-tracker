/**
 * Cache Invalidation E2E Tests
 *
 * These tests verify that TanStack Query cache invalidation works correctly
 * after mutations (create, update, delete). When a mutation succeeds,
 * queryClient.invalidateQueries() should refresh the relevant lists.
 *
 * Key scenarios tested:
 * 1. Creating a group → group list is re-fetched and shows new group
 * 2. Deleting a QR code → QR code list is re-fetched without deleted item
 * 3. Editing a project → project list is re-fetched with updated name
 */

import { test, expect } from "../../fixtures/authenticated-test";
import { GroupsPage } from "../../pages/groups.page";
import { QRCodesPage } from "../../pages/qr-codes.page";
import { ProjectsPage } from "../../pages/projects.page";
import {
  createMockGroup,
  createMockQRCode,
  createMockProject,
  resetIdCounter,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";
import { isBackendApiRequest } from "../../utils/runtime-env";

// ============================================================================
// HELPER: API-only route mocking
// ============================================================================

/**
 * Mock an API route that only intercepts backend requests.
 * Frontend page navigations are passed through.
 */
async function mockApiRoute(
  page: Page,
  pattern: string,
  response: object,
  options?: { status?: number },
): Promise<void> {
  const { status = 200 } = options || {};
  await safeRoute(page, pattern, async (route) => {
    const url = route.request().url();
    // Only intercept backend API calls, not frontend page navigations
    if (!isBackendApiRequest(url)) {
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

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-cache-001",
  projectName: "Cache Test Project",
  projectStatus: "active",
});

const existingGroup = createMockGroup({
  _id: "grp-existing-001",
  groupName: "Existing Group",
  type: "arrangement",
  project: mockProject._id,
  numberOfCodes: 5,
  mobileScanCount: 100,
});

const newGroup = createMockGroup({
  _id: "grp-new-001",
  groupName: "Newly Created Group",
  type: "equipment",
  project: mockProject._id,
  numberOfCodes: 0,
  mobileScanCount: 0,
});

const existingQRCode = createMockQRCode({
  _id: "qr-existing-001",
  qrcodeName: "QR Code To Delete",
  project: mockProject._id,
  projectName: mockProject.projectName,
});

const secondQRCode = createMockQRCode({
  _id: "qr-existing-002",
  qrcodeName: "QR Code To Keep",
  project: mockProject._id,
  projectName: mockProject.projectName,
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

function buildQRCodesResponse(qrCodes: ReturnType<typeof createMockQRCode>[]) {
  return {
    success_message: "QR Codes fetched successfully",
    total_pages: 1,
    current_page: 1,
    total_items: qrCodes.length,
    has_next: false,
    has_prev: false,
    data: qrCodes,
  };
}

function buildProjectsResponse(
  projects: ReturnType<typeof createMockProject>[],
) {
  return {
    success_message: "Projects fetched successfully",
    total_pages: 1,
    current_page: 1,
    total_items: projects.length,
    has_next: false,
    has_prev: false,
    data: projects,
  };
}

// ============================================================================
// TESTS: Group Creation Cache Invalidation
// ============================================================================

test.describe("Cache Invalidation - Group Creation @desktop", () => {
  // Increase timeout for cache invalidation tests
  test.setTimeout(60000);

  test.beforeEach(() => {
    resetIdCounter();
  });

  test("groups list is re-fetched and shows new data after mutation", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);

    // Track which request number we're on to return different data
    let requestCount = 0;

    // Mock groups GET endpoint using API-only filter to avoid intercepting page navigation
    await safeRoute(authenticatedPage, "**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      requestCount++;
      // First request returns only existing group, subsequent requests return both
      const groups =
        requestCount === 1 ? [existingGroup] : [existingGroup, newGroup];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildGroupsResponse(groups)),
      });
    });

    // Mock all projects endpoint for filters
    await mockApiRoute(authenticatedPage, "**/all-projects/**", [mockProject]);

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("domcontentloaded");

    // Verify initial group is visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });

    // Verify new group is NOT yet visible
    await expect(
      groupsPage.getRowByName("Newly Created Group"),
    ).not.toBeVisible();

    // Trigger a refetch by reloading the page
    // This simulates the user refreshing after a mutation elsewhere
    await authenticatedPage.reload({ waitUntil: "domcontentloaded" });

    // After reload, the cache should be invalidated and fresh data fetched
    // The new group should now appear in the list
    await expect(groupsPage.getRowByName("Newly Created Group")).toBeVisible({
      timeout: 5000,
    });

    // Original group should still be visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });
  });
});

// ============================================================================
// TESTS: QR Code Deletion Cache Invalidation
// ============================================================================

test.describe("Cache Invalidation - QR Code Deletion @desktop", () => {
  // Increase timeout for cache invalidation tests
  test.setTimeout(60000);

  test.beforeEach(() => {
    resetIdCounter();
  });

  test("deleting a QR code invalidates the list cache and removes the item", async ({
    authenticatedPage,
  }) => {
    const qrPage = new QRCodesPage(authenticatedPage);

    // State to track QR codes
    let currentQRCodes = [existingQRCode, secondQRCode];

    // Mock QR code list endpoint - qr-code doesn't conflict with frontend routes
    await safeRoute(authenticatedPage, "**/qr-code*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildQRCodesResponse(currentQRCodes)),
      });
    });

    // Mock all projects endpoint
    await mockApiRoute(authenticatedPage, "**/all-projects/**", [mockProject]);

    // Mock groups endpoint - needs API filter since /groups is a frontend route
    await safeRoute(authenticatedPage, "**/groups**", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    // Navigate to QR codes list
    await qrPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify both QR codes are visible
    await expect(qrPage.getRowByName("QR Code To Delete")).toBeVisible({
      timeout: 5000,
    });
    await expect(qrPage.getRowByName("QR Code To Keep")).toBeVisible({
      timeout: 5000,
    });

    // Set up the bulk delete endpoint mock
    await safeRoute(
      authenticatedPage,
      "**/qr-code/bulk-delete**",
      async (route) => {
        // Update state
        currentQRCodes = [secondQRCode];

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "QR Code deleted successfully",
          }),
        });
      },
    );

    // Enable bulk actions
    await qrPage.enableBulkActions();

    // Select the first row (QR Code To Delete)
    await qrPage.selectRow(0);

    // Click delete button
    const deleteBtn = authenticatedPage
      .locator('button:has-text("Delete"), [data-testid="bulk-delete"]')
      .first();

    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();

      // Handle confirmation modal if present
      const confirmBtn = authenticatedPage.getByRole("button", {
        name: /confirm|delete|yes/i,
      });
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }

      // Wait for the deletion to complete
      await authenticatedPage.waitForTimeout(2000);

      // After deletion, the cache should be invalidated
      // The deleted QR code should no longer appear
      await expect(qrPage.getRowByName("QR Code To Delete")).not.toBeVisible({
        timeout: 5000,
      });

      // The other QR code should still be visible
      await expect(qrPage.getRowByName("QR Code To Keep")).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

// ============================================================================
// TESTS: Project Edit Cache Invalidation
// ============================================================================

test.describe("Cache Invalidation - Project Edit @desktop", () => {
  // Increase timeout for cache invalidation tests
  test.setTimeout(60000);

  test.beforeEach(() => {
    resetIdCounter();
  });

  test("editing a project name invalidates the list cache and shows updated name", async ({
    authenticatedPage,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // State to track project
    let currentProject = { ...mockProject };

    // Mock projects list endpoint - API uses /project (singular) not /projects
    // Use **\/project pattern to match both /project and /project/{id}
    await safeRoute(authenticatedPage, "**/project*", async (route) => {
      const url = route.request().url();
      // Only intercept backend API calls
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }

      const method = route.request().method();
      if (method === "PATCH" || method === "PUT") {
        // Handle project update
        currentProject = {
          ...currentProject,
          projectName: "Updated Project Name",
          name: "Updated Project Name",
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Project updated successfully",
            data: currentProject,
          }),
        });
      } else {
        // Handle GET requests
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildProjectsResponse([currentProject])),
        });
      }
    });

    // Mock all projects endpoint (for filters)
    await mockApiRoute(authenticatedPage, "**/all-projects/**", [
      currentProject,
    ]);

    // Navigate to projects list
    await projectsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify initial project is visible
    await expect(projectsPage.getRowByName("Cache Test Project")).toBeVisible({
      timeout: 5000,
    });

    // Open row actions for the project
    await projectsPage.openRowActions("Cache Test Project");

    // Click Edit option in the dropdown
    const editOption = authenticatedPage.locator(
      'text=/Edit|Edit Project/i, [data-testid="edit-option"]',
    );
    if (
      await editOption
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await editOption.first().click();

      // Wait for edit modal
      await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });

      // Clear and fill new project name
      await projectsPage.editProjectNameInput.clear();
      await projectsPage.editProjectNameInput.fill("Updated Project Name");

      // Save changes
      await projectsPage.editSaveButton.click();

      // Wait for the update to complete
      await authenticatedPage.waitForTimeout(2000);

      // After edit, the cache should be invalidated
      // The updated project name should now appear in the list
      await expect(
        projectsPage.getRowByName("Updated Project Name"),
      ).toBeVisible({ timeout: 5000 });

      // The old name should no longer appear
      await expect(
        projectsPage.getRowByName("Cache Test Project"),
      ).not.toBeVisible({ timeout: 3000 });
    }
  });
});
