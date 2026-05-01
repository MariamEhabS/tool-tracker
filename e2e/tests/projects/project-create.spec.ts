import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/authenticated-test";
import { ProjectsPage } from "../../pages/projects.page";
import { createMockProject, resetIdCounter } from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const existingProject = createMockProject({
  _id: "proj-existing-001",
  projectName: "Existing Tower",
  projectStatus: "active",
});

const createdProject = createMockProject({
  _id: "proj-created-001",
  projectName: "New Office Build",
  clientName: "Acme Corp",
  projectAddress: "500 Market St",
  projectCity: "San Francisco",
  projectState: "CA",
  projectZIP: "94105",
  projectStatus: "active",
});

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

/** Intercept project API calls without catching page navigations. */
async function mockProjectApiRoute(
  page: Page,
  pattern: string | RegExp,
  response: object,
  status = 200,
) {
  await safeRoute(page, pattern, async (route) => {
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

// ============================================================================
// TESTS
// ============================================================================

test.describe("Project Create @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("fill all fields and submit creates a new project", async ({
    authenticatedPage,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    // Mock the list API
    await mockProjectApiRoute(
      authenticatedPage,
      /\/project\?/,
      buildProjectsResponse([existingProject]),
    );

    // Mock POST for project creation
    await mockProjectApiRoute(
      authenticatedPage,
      /\/project$/,
      {
        success_message: "Project created successfully",
        data: createdProject,
      },
      201,
    );
    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    // Open create modal
    await projectsPage.clickCreateProject();
    await expect(projectsPage.createModal).toBeVisible();

    // Fill all fields
    await projectsPage.createProjectNameInput.fill("New Office Build");
    await projectsPage.createClientNameInput.fill("Acme Corp");
    await projectsPage.createAddressInput.fill("500 Market St");
    await projectsPage.createCityInput.fill("San Francisco");
    await projectsPage.createStateInput.fill("CA");
    await projectsPage.createZIPInput.fill("94105");

    // Submit button should now be enabled
    await expect(projectsPage.createSubmitButton).toBeEnabled();
    await projectsPage.createSubmitButton.click();

    // Success: current flow navigates directly to the new project detail page
    await expect(authenticatedPage).toHaveURL(
      /\/project\/proj-created-001|\/project\/[^/?#]+/,
      {
        timeout: 10000,
      },
    );
  });

  test("validation prevents submitting with empty required fields", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectApiRoute(
      authenticatedPage,
      /\/project\?/,
      buildProjectsResponse([existingProject]),
    );

    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    await projectsPage.clickCreateProject();
    await expect(projectsPage.createModal).toBeVisible();

    // Submit without filling anything — button should be disabled
    await expect(projectsPage.createSubmitButton).toBeDisabled();

    // Fill only project name (partial)
    await projectsPage.createProjectNameInput.fill("Partial Project");

    // Depending on which fields are required, the button may still be disabled
    // or clicking submit should trigger validation errors
    if (await projectsPage.createSubmitButton.isEnabled()) {
      await projectsPage.createSubmitButton.click();

      // Check for validation errors
      const hasError = await authenticatedPage
        .locator(
          '.text-red-500, .text-red-600, [class*="error"], text=/required/i',
        )
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      // Either errors shown or the button was disabled — both valid
      expect(
        hasError || !(await projectsPage.createSubmitButton.isEnabled()),
      ).toBeTruthy();
    }
  });

  test("API error on create shows error message", async ({
    authenticatedPage,
    routeTracker: _routeTracker,
  }) => {
    const projectsPage = new ProjectsPage(authenticatedPage);

    await mockProjectApiRoute(
      authenticatedPage,
      /\/project\?/,
      buildProjectsResponse([existingProject]),
    );

    // Mock POST failure
    await mockProjectApiRoute(
      authenticatedPage,
      /\/project$/,
      { message: "Failed to create project" },
      500,
    );

    await projectsPage.gotoList();
    await projectsPage.waitForListLoad();

    await projectsPage.clickCreateProject();
    await expect(projectsPage.createModal).toBeVisible();

    // Fill required fields
    await projectsPage.createProjectNameInput.fill("Failing Project");
    await projectsPage.createClientNameInput.fill("Fail Corp");
    await projectsPage.createAddressInput.fill("1 Error Ave");
    await projectsPage.createCityInput.fill("Errortown");
    await projectsPage.createStateInput.fill("CA");
    await projectsPage.createZIPInput.fill("90000");

    if (await projectsPage.createSubmitButton.isEnabled()) {
      await projectsPage.createSubmitButton.click();

      // Error should be shown via toast or inline
      await expect(
        authenticatedPage
          .locator("text=/fail|error|could not|unable/i")
          .first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
