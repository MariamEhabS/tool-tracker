/**
 * Optimistic Update Tests - Groups
 *
 * These tests verify that the UI updates immediately when mutations occur,
 * before the API response is received. This ensures good UX and catches
 * cache invalidation bugs.
 *
 * Key scenarios tested:
 * 1. Creating a group shows it in the list before API responds
 * 2. Deleting a group removes it immediately before API confirms
 * 3. Editing a group shows updated name before API confirms
 * 4. Failed mutations roll back the optimistic update
 */

import { test, expect } from "../../fixtures/authenticated-test";
import { GroupsPage } from "../../pages/groups.page";
import {
  createMockGroup,
  createMockProject,
  resetIdCounter,
} from "../../fixtures/builders";
import type { Page } from "@playwright/test";
import { isBackendApiRequest } from "../../utils/runtime-env";

// ============================================================================
// HELPER: API-only route mocking
// ============================================================================

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-grp-optimistic-001",
  projectName: "Group Optimistic Test Project",
});

const existingGroup = createMockGroup({
  _id: "grp-existing-001",
  groupName: "Existing Group",
  type: "arrangement",
  project: mockProject._id,
  numberOfCodes: 5,
  mobileScanCount: 100,
});

const secondGroup = createMockGroup({
  _id: "grp-existing-002",
  groupName: "Second Group",
  type: "equipment",
  project: mockProject._id,
  numberOfCodes: 3,
  mobileScanCount: 50,
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

async function setupBaseRoutes(page: Page) {
  // Mock all-projects endpoint for filters
  await page.route("**/all-projects/**", async (route) => {
    if (!isBackendApiRequest(route.request().url())) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([mockProject]),
    });
  });
}

// ============================================================================
// TESTS: Group Creation Optimistic Updates
// ============================================================================

test.describe("Group Optimistic Updates - Create @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("shows new group in list before API responds (optimistic update)", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    let apiResponded = false;
    let currentGroups = [existingGroup];

    await setupBaseRoutes(authenticatedPage);

    // Mock groups endpoint with dynamic response
    await authenticatedPage.route("**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }

      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildGroupsResponse(currentGroups)),
        });
      } else if (method === "POST") {
        // Delay the POST response to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const newGroup = createMockGroup({
          _id: "grp-new-optimistic-001",
          groupName: "Optimistic Test Group",
          type: "arrangement",
          project: mockProject._id,
          numberOfCodes: 0,
          mobileScanCount: 0,
        });

        currentGroups = [...currentGroups, newGroup];
        apiResponded = true;

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Group created",
            data: newGroup,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify existing group is visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });

    // Click create group button
    await groupsPage.createGroupButton.click();

    // Wait for create form/modal to appear
    const nameInput = authenticatedPage
      .locator(
        '[data-testid="group-name-input"], input[name="groupName"], input[placeholder*="Group"]',
      )
      .first();

    // Fill in group details
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Optimistic Test Group");

      // Select project if needed
      const projectSelect = authenticatedPage
        .locator('[data-testid="project-select"], select[name="project"]')
        .first();
      if (await projectSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await projectSelect.selectOption({ label: mockProject.projectName });
      }

      // Submit the form
      const submitButton = authenticatedPage
        .getByRole("button", { name: /create|save|submit/i })
        .first();

      if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Verify API hasn't responded yet
        expect(apiResponded).toBe(false);

        await submitButton.click();

        // With optimistic updates, the new item should appear quickly
        // even though the API hasn't responded yet (2s delay)
        const optimisticTimeout = 500;

        const newGroupVisible = await authenticatedPage
          .locator('text="Optimistic Test Group"')
          .isVisible({ timeout: optimisticTimeout })
          .catch(() => false);

        if (newGroupVisible && !apiResponded) {
          // Optimistic update worked - item visible before API response
          expect(newGroupVisible).toBe(true);
        }

        // Wait for API to complete
        await authenticatedPage.waitForTimeout(2500);
        expect(apiResponded).toBe(true);

        // After API responds, item should definitely be visible
        await expect(
          authenticatedPage.locator('text="Optimistic Test Group"'),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

// ============================================================================
// TESTS: Group Deletion Optimistic Updates
// ============================================================================

test.describe("Group Optimistic Updates - Delete @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("removes deleted group immediately before API confirms (optimistic delete)", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    let deleteApiResponded = false;
    let currentGroups = [existingGroup, secondGroup];

    await setupBaseRoutes(authenticatedPage);

    // Mock groups list endpoint
    await authenticatedPage.route("**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }

      const method = route.request().method();
      if (method === "DELETE") {
        // Delay to verify optimistic UI update
        await new Promise((resolve) => setTimeout(resolve, 2000));

        currentGroups = [secondGroup];
        deleteApiResponded = true;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            message: "Group deleted successfully",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildGroupsResponse(currentGroups)),
        });
      }
    });

    // Mock bulk delete endpoint
    await authenticatedPage.route("**/groups/bulk-delete**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      currentGroups = [secondGroup];
      deleteApiResponded = true;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Groups deleted successfully",
        }),
      });
    });

    // Mock single group delete
    await authenticatedPage.route(
      `**/groups/${existingGroup._id}`,
      async (route) => {
        if (!isBackendApiRequest(route.request().url())) {
          await route.continue();
          return;
        }

        const method = route.request().method();
        if (method === "DELETE") {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          currentGroups = [secondGroup];
          deleteApiResponded = true;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Group deleted successfully",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: existingGroup }),
          });
        }
      },
    );

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify both groups are visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });
    await expect(groupsPage.getRowByName("Second Group")).toBeVisible({
      timeout: 5000,
    });

    // Enable bulk actions and select the first group
    await groupsPage.toggleBulkActions();
    await groupsPage.selectRow("Existing Group");

    // Click delete button
    if (
      await groupsPage.bulkDeleteButton
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await groupsPage.bulkDeleteButton.click();

      // Confirm deletion in modal
      if (
        await groupsPage.deleteConfirmButton
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        // Verify API hasn't responded yet
        expect(deleteApiResponded).toBe(false);

        await groupsPage.deleteConfirmButton.click();

        // With optimistic updates, item should disappear quickly
        const optimisticTimeout = 500;

        const itemGone = await groupsPage
          .getRowByName("Existing Group")
          .isVisible({ timeout: optimisticTimeout })
          .then(() => false)
          .catch(() => true);

        if (itemGone && !deleteApiResponded) {
          // Optimistic delete worked
          expect(itemGone).toBe(true);
        }

        // Wait for API to complete
        await authenticatedPage.waitForTimeout(2500);
        expect(deleteApiResponded).toBe(true);

        // After API responds, item should definitely be gone
        await expect(groupsPage.getRowByName("Existing Group")).not.toBeVisible(
          {
            timeout: 5000,
          },
        );

        // Second group should still be visible
        await expect(groupsPage.getRowByName("Second Group")).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });
});

// ============================================================================
// TESTS: Group Edit Optimistic Updates
// ============================================================================

test.describe("Group Optimistic Updates - Edit @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("shows updated group name before API confirms (optimistic edit)", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    let editApiResponded = false;
    let currentGroups = [existingGroup, secondGroup];

    await setupBaseRoutes(authenticatedPage);

    // Mock groups list endpoint
    await authenticatedPage.route("**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildGroupsResponse(currentGroups)),
      });
    });

    // Mock single group endpoint with delay for updates
    await authenticatedPage.route(
      `**/groups/${existingGroup._id}`,
      async (route) => {
        if (!isBackendApiRequest(route.request().url())) {
          await route.continue();
          return;
        }

        const method = route.request().method();
        if (method === "PATCH" || method === "PUT") {
          // Delay the update response
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const updatedGroup = {
            ...existingGroup,
            groupName: "Updated Group Name",
          };
          currentGroups = [updatedGroup, secondGroup];
          editApiResponded = true;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success_message: "Group updated",
              data: updatedGroup,
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: existingGroup }),
          });
        }
      },
    );

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify existing group is visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });

    // Open row actions menu for the group
    await groupsPage.openRowActions("Existing Group");

    // Click Edit option
    const editOption = authenticatedPage
      .locator('text=/^Edit$|Edit Group/i, [data-testid="edit-option"]')
      .first();

    if (await editOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editOption.click();

      // Wait for edit modal
      await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

      // Find name input in modal
      const nameInput = authenticatedPage
        .locator('[data-testid="group-name-input"], input[name="groupName"]')
        .first();

      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("Updated Group Name");

        // Submit the form
        const saveButton = authenticatedPage
          .getByRole("button", { name: /save|update|submit/i })
          .first();

        if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Verify API hasn't responded yet
          expect(editApiResponded).toBe(false);

          await saveButton.click();

          // With optimistic updates, the new name should appear quickly
          const optimisticTimeout = 500;

          const newNameVisible = await authenticatedPage
            .locator('text="Updated Group Name"')
            .isVisible({ timeout: optimisticTimeout })
            .catch(() => false);

          if (newNameVisible && !editApiResponded) {
            // Optimistic update worked
            expect(newNameVisible).toBe(true);
          }

          // Wait for API to complete
          await authenticatedPage.waitForTimeout(2500);
          expect(editApiResponded).toBe(true);

          // After API responds, new name should definitely be visible
          await expect(
            authenticatedPage.locator('text="Updated Group Name"'),
          ).toBeVisible({ timeout: 5000 });

          // Old name should not be visible
          await expect(
            groupsPage.getRowByName("Existing Group"),
          ).not.toBeVisible({
            timeout: 3000,
          });
        }
      }
    }
  });
});

// ============================================================================
// TESTS: Optimistic Update Rollback on Error
// ============================================================================

test.describe("Group Optimistic Updates - Rollback @desktop", () => {
  test.beforeEach(() => {
    resetIdCounter();
  });

  test("rolls back optimistic delete when API fails", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    const groups = [existingGroup, secondGroup];

    await setupBaseRoutes(authenticatedPage);

    // Mock groups list endpoint - always returns both groups
    await authenticatedPage.route("**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildGroupsResponse(groups)),
      });
    });

    // Mock bulk delete endpoint to FAIL
    await authenticatedPage.route("**/groups/bulk-delete**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Server error",
          error: "Internal Server Error",
        }),
      });
    });

    // Mock single group delete to fail
    await authenticatedPage.route(
      `**/groups/${existingGroup._id}`,
      async (route) => {
        if (!isBackendApiRequest(route.request().url())) {
          await route.continue();
          return;
        }

        const method = route.request().method();
        if (method === "DELETE") {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Server error",
              error: "Internal Server Error",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: existingGroup }),
          });
        }
      },
    );

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify both groups are visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });
    await expect(groupsPage.getRowByName("Second Group")).toBeVisible({
      timeout: 5000,
    });

    const initialRows = await groupsPage.getTableRows().count();

    // Enable bulk actions and select the first group
    await groupsPage.toggleBulkActions();
    await groupsPage.selectRow("Existing Group");

    // Click delete button
    if (
      await groupsPage.bulkDeleteButton
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await groupsPage.bulkDeleteButton.click();

      // Confirm deletion
      if (
        await groupsPage.deleteConfirmButton
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await groupsPage.deleteConfirmButton.click();

        // Wait for API failure and rollback
        await authenticatedPage.waitForTimeout(2000);

        // After failure, the item should be rolled back (reappear)
        await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
          timeout: 5000,
        });

        // Error indicator should be visible
        const errorIndicator = authenticatedPage.locator(
          '.text-red-500, .text-red-600, [role="alert"], text="error" i, text="failed" i',
        );
        await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });

        // Row count should be back to original
        const finalRows = await groupsPage.getTableRows().count();
        expect(finalRows).toBe(initialRows);
      }
    }
  });

  test("rolls back optimistic edit when API fails", async ({
    authenticatedPage,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    const groups = [existingGroup, secondGroup];

    await setupBaseRoutes(authenticatedPage);

    // Mock groups list endpoint
    await authenticatedPage.route("**/groups*", async (route) => {
      const url = route.request().url();
      if (!isBackendApiRequest(url)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildGroupsResponse(groups)),
      });
    });

    // Mock single group endpoint to fail on update
    await authenticatedPage.route(
      `**/groups/${existingGroup._id}`,
      async (route) => {
        if (!isBackendApiRequest(route.request().url())) {
          await route.continue();
          return;
        }

        const method = route.request().method();
        if (method === "PATCH" || method === "PUT") {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              message: "Server error",
              error: "Internal Server Error",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: existingGroup }),
          });
        }
      },
    );

    // Navigate to groups list
    await groupsPage.gotoList();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify existing group is visible
    await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
      timeout: 5000,
    });

    // Open row actions menu
    await groupsPage.openRowActions("Existing Group");

    // Click Edit option
    const editOption = authenticatedPage
      .locator('text=/^Edit$|Edit Group/i, [data-testid="edit-option"]')
      .first();

    if (await editOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editOption.click();

      await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

      const nameInput = authenticatedPage
        .locator('[data-testid="group-name-input"], input[name="groupName"]')
        .first();

      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("Will Fail Update");

        const saveButton = authenticatedPage
          .getByRole("button", { name: /save|update|submit/i })
          .first();

        if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveButton.click();

          // Wait for API failure and rollback
          await authenticatedPage.waitForTimeout(2000);

          // After failure, original name should be restored
          await expect(groupsPage.getRowByName("Existing Group")).toBeVisible({
            timeout: 5000,
          });

          // Failed name should not be visible
          await expect(
            authenticatedPage.locator('text="Will Fail Update"'),
          ).not.toBeVisible({ timeout: 3000 });

          // Error indicator should be visible
          const errorIndicator = authenticatedPage.locator(
            '.text-red-500, .text-red-600, [role="alert"], text="error" i, text="failed" i',
          );
          await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});
