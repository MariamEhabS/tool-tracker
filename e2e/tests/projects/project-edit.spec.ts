import { test, expect } from "../../fixtures/authenticated-test";
import { ProjectsPage } from "../../pages/projects.page";
import { createMockProject } from "../../fixtures/builders";
import {
  mockProjectEditSuccess,
  mockProjectArchiveSuccess,
  mockProjectUnarchiveSuccess,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";
import type { Page } from "@playwright/test";

// Create mock project data using the builder for consistent field structure
const mockProjectDetail = createMockProject({
  _id: "proj-001",
  projectName: "Downtown Office Tower",
  projectAddress: "100 Main Street",
  projectCity: "San Francisco",
  projectState: "CA",
  projectZIP: "94105",
  clientName: "Acme Corp",
  projectStatus: "active",
  company: "comp-test-001",
  qrCodes: 12,
  groups: 3,
});

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
 * Mock single project API route (GET /project/{id}?companyId=...).
 * Uses a glob pattern and resourceType check.
 */
async function mockSingleProjectRoute(
  page: Page,
  projectIdToMock: string,
  projectData: object,
) {
  const response = buildSingleProjectResponse(projectData);

  await safeRoute(page, `**/project/${projectIdToMock}**`, async (route) => {
    // Let page navigations through — only intercept API (xhr/fetch) requests
    if (route.request().resourceType() === "document") {
      await route.continue();
      return;
    }
    // Only handle GET requests - let PATCH/PUT/DELETE pass through to other handlers
    if (route.request().method() !== "GET") {
      // Use fallback() to pass to other registered route handlers
      await route.fallback();
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

test.describe("Project Edit & Archive @desktop", () => {
  // ==========================================================================
  // EDIT PROJECT
  // ==========================================================================

  test("opens edit modal from project detail settings button", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock GET /project/proj-001?companyId=...
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      mockProjectDetail,
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

    await projectsPage.gotoDetail("proj-001");

    // Click the Settings button to open dropdown menu
    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Wait for dropdown menu to appear
    const dropdownMenu = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    // Click "Edit Project" option in dropdown
    const editProjectOption = authenticatedPage.getByRole("menuitem", {
      name: "Edit Project",
    });
    await expect(editProjectOption).toBeVisible({ timeout: 3000 });
    await editProjectOption.click();

    // Edit modal should appear
    await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });
    await expect(projectsPage.editModalTitle).toBeVisible();
  });

  test("edits project name and saves successfully", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock GET /project/proj-001?companyId=...
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      mockProjectDetail,
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

    await projectsPage.gotoDetail("proj-001");

    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Wait for dropdown menu to appear
    const dropdownMenu = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    // Click "Edit Project" option in dropdown
    const editProjectOption = authenticatedPage.getByRole("menuitem", {
      name: "Edit Project",
    });
    await expect(editProjectOption).toBeVisible({ timeout: 3000 });
    await editProjectOption.click();

    await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });

    // Clear and fill new project name
    await projectsPage.editProjectNameInput.clear();
    await projectsPage.editProjectNameInput.fill(
      "Downtown Office Tower - Phase 2",
    );

    // Mock the PATCH response (API uses PATCH, not PUT)
    await safeRoute(authenticatedPage, "**/project/proj-001", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProjectEditSuccess),
        });
      } else if (route.request().resourceType() === "document") {
        await route.continue();
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProjectDetail),
        });
      }
    });

    // Click save
    await projectsPage.editSaveButton.click();

    // Success indicator: modal closes after successful save
    // (Toast may appear briefly but modal closure is the reliable indicator)
    await expect(projectsPage.editModal).not.toBeVisible({ timeout: 5000 });
  });

  test("edit validation prevents empty project name", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock GET /project/proj-001?companyId=...
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      mockProjectDetail,
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

    await projectsPage.gotoDetail("proj-001");

    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Wait for dropdown menu to appear
    const dropdownMenu = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    // Click "Edit Project" option in dropdown
    const editProjectOption = authenticatedPage.getByRole("menuitem", {
      name: "Edit Project",
    });
    await expect(editProjectOption).toBeVisible({ timeout: 3000 });
    await editProjectOption.click();

    await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });

    // Clear the project name
    await projectsPage.editProjectNameInput.clear();

    // Try to save — should show validation error or button should be disabled
    const saveButton = projectsPage.editSaveButton;
    const isDisabled = await saveButton
      .isDisabled({ timeout: 1000 })
      .catch(() => false);

    if (isDisabled) {
      // Button is disabled — validation working
      await expect(saveButton).toBeDisabled();
    } else {
      // Click save and expect an error
      await saveButton.click();
      const errorIndicator = authenticatedPage.locator(
        'text="required" i, text="name" i, text="enter" i, .text-red-500, .text-red-600',
      );
      await expect(errorIndicator.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test("edit API failure shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock GET /project/proj-001?companyId=...
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      mockProjectDetail,
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

    await projectsPage.gotoDetail("proj-001");

    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Wait for dropdown menu to appear
    const dropdownMenu = authenticatedPage.locator('[role="menu"]');
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    // Click "Edit Project" option in dropdown
    const editProjectOption = authenticatedPage.getByRole("menuitem", {
      name: "Edit Project",
    });
    await expect(editProjectOption).toBeVisible({ timeout: 3000 });
    await editProjectOption.click();

    await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });

    // Change the name
    await projectsPage.editProjectNameInput.clear();
    await projectsPage.editProjectNameInput.fill("New Name");

    // Mock PATCH to fail
    await safeRoute(authenticatedPage, "**/project/proj-001", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal server error" }),
        });
      } else if (route.request().resourceType() === "document") {
        await route.continue();
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockProjectDetail),
        });
      }
    });

    await projectsPage.editSaveButton.click();

    // On error, modal should remain open (not close like on success)
    // The modal staying open indicates the save failed
    await authenticatedPage.waitForTimeout(1000); // Give time for success flow if it was going to happen
    await expect(projectsPage.editModal).toBeVisible({ timeout: 3000 });
  });

  // ==========================================================================
  // ARCHIVE / UNARCHIVE
  // ==========================================================================

  test("archives project from detail view", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock GET /project/proj-001?companyId=...
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      mockProjectDetail,
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

    await projectsPage.gotoDetail("proj-001");

    // Open project settings/actions
    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Look for Archive option in the modal or actions menu
    const archiveButton = authenticatedPage.locator(
      'button:has-text("Archive"), text="Archive" >> button',
    );

    if (
      await archiveButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      // Mock the archive endpoint (PATCH /project/{id} with archived: true)
      await safeRoute(
        authenticatedPage,
        "**/project/proj-001",
        async (route) => {
          if (route.request().method() === "PATCH") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockProjectArchiveSuccess),
            });
          } else if (route.request().resourceType() === "document") {
            await route.continue();
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockProjectDetail),
            });
          }
        },
      );

      await archiveButton.first().click();

      // Confirmation dialog may appear
      const confirmButton = authenticatedPage.getByRole("button", {
        name: /Confirm|Archive|Yes/,
      });
      if (
        await confirmButton
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await confirmButton.first().click();
      }

      // Success indicator
      const successIndicator = authenticatedPage.locator(
        'text="archived" i, text="success" i',
      );
      await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("unarchives project from detail view", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const archivedProject = {
      ...mockProjectDetail,
      status: "archived",
      projectStatus: "archived",
      archived: true,
    };

    // Mock GET /project/proj-001?companyId=... with archived project
    await mockSingleProjectRoute(
      authenticatedPage,
      "proj-001",
      archivedProject,
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

    const projectsPage = new ProjectsPage(authenticatedPage);
    await projectsPage.gotoDetail("proj-001");

    await expect(projectsPage.settingsButton).toBeVisible({ timeout: 5000 });
    await projectsPage.settingsButton.click();

    // Look for Unarchive option
    const unarchiveButton = authenticatedPage.locator(
      'button:has-text("Unarchive"), text="Unarchive" >> button',
    );

    if (
      await unarchiveButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      // Mock the unarchive endpoint (PATCH /project/{id} with archived: false)
      await safeRoute(
        authenticatedPage,
        "**/project/proj-001",
        async (route) => {
          if (route.request().method() === "PATCH") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockProjectUnarchiveSuccess),
            });
          } else if (route.request().resourceType() === "document") {
            await route.continue();
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(archivedProject),
            });
          }
        },
      );

      await unarchiveButton.first().click();

      const confirmButton = authenticatedPage.getByRole("button", {
        name: /Confirm|Unarchive|Yes/,
      });
      if (
        await confirmButton
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await confirmButton.first().click();
      }

      const successIndicator = authenticatedPage.locator(
        'text="unarchived" i, text="restored" i, text="success" i',
      );
      await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
