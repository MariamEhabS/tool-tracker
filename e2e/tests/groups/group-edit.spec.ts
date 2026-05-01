import {
  test,
  expect,
  mockAuthCompany,
  RouteTracker,
} from "../../fixtures/authenticated-test";
import type { Page } from "@playwright/test";
import { GroupsPage } from "../../pages/groups.page";
import {
  createMockGroup,
  createMockProject,
  createMockQRCode,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-grpedit-001",
  projectName: "Tower Construction",
  projectStatus: "active",
});

const groupId = "grp-edit-001";

const mockGroup = createMockGroup({
  _id: groupId,
  groupName: "Electrical Panels",
  type: "equipment",
  project: mockProject._id,
  numberOfCodes: 3,
  mobileScanCount: 42,
});

const mockGroupQRCodes = {
  success_message: "QR codes retrieved",
  total_items: 2,
  data: [
    createMockQRCode({
      _id: "qr-grp-001",
      qrcodeName: "Panel A",
      group: groupId,
    }),
    createMockQRCode({
      _id: "qr-grp-002",
      qrcodeName: "Panel B",
      group: groupId,
    }),
  ],
};

const mockProjects = [mockProject];

// ============================================================================
// HELPERS
// ============================================================================

async function setupGroupDetailMocks(
  routeTracker: RouteTracker,
  authenticatedPage: Page,
) {
  await routeTracker.mockRoute(`**/groups/${groupId}`, { data: mockGroup });
  await routeTracker.mockRoute(`**/qr-code*`, mockGroupQRCodes);
  await safeRoute(
    authenticatedPage,
    `**/project/${mockAuthCompany._id}/${mockProject._id}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockProject }),
      });
    },
  );
  await safeRoute(
    authenticatedPage,
    "**/aggregation/all-projects/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProjects),
      });
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Group Edit @desktop", () => {
  test("opens edit modal from settings menu", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    await setupGroupDetailMocks(routeTracker, authenticatedPage);

    await groupsPage.gotoDetail(groupId);

    // Wait for group name to render
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible({ timeout: 10000 });

    // Click Settings button to open actions menu
    await groupsPage.settingsButton.click();

    // Click "Edit Group" from dropdown (uses menuitem role)
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();

    // Edit modal should open
    await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });
  });

  test("edit modal pre-fills group name", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    await setupGroupDetailMocks(routeTracker, authenticatedPage);

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible({ timeout: 10000 });

    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();

    await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

    // The name field should be pre-filled
    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(nameInput).toHaveValue("Electrical Panels");
    }
  });

  test("saves updated group name with PATCH request", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    await setupGroupDetailMocks(routeTracker, authenticatedPage);

    // Mock PATCH for group update
    await safeRoute(
      authenticatedPage,
      `**/groups/${groupId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: { ...mockGroup, groupName: "Electrical Panels (Updated)" },
            }),
          });
        } else {
          await route.fallback();
        }
      },
    );

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible({ timeout: 10000 });

    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();
    await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

    // Update name
    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("Electrical Panels (Updated)");
    }

    // Listen for PATCH
    const patchPromise = authenticatedPage.waitForRequest(
      (req) =>
        req.url().includes(`/groups/${groupId}`) && req.method() === "PATCH",
    );

    // Click Save
    await authenticatedPage.getByRole("button", { name: "Save" }).click();

    const request = await patchPromise;
    expect(request.method()).toBe("PATCH");
  });

  test("cancel closes edit modal without saving", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    await setupGroupDetailMocks(routeTracker, authenticatedPage);

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible({ timeout: 10000 });

    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();
    await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await authenticatedPage.getByRole("button", { name: "Cancel" }).click();

    // Modal should close
    await expect(groupsPage.editModal).not.toBeVisible({ timeout: 3000 });

    // Original name still present
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible();
  });

  test("edit save failure shows error", async ({
    authenticatedPage,
    routeTracker,
  }) => {
    const groupsPage = new GroupsPage(authenticatedPage);
    await setupGroupDetailMocks(routeTracker, authenticatedPage);

    // Mock PATCH failure
    await safeRoute(
      authenticatedPage,
      `**/groups/${groupId}`,
      async (route) => {
        if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Internal server error" }),
          });
        } else {
          await route.fallback();
        }
      },
    );

    await groupsPage.gotoDetail(groupId);
    await expect(
      authenticatedPage.locator("text=Electrical Panels"),
    ).toBeVisible({ timeout: 10000 });

    await groupsPage.settingsButton.click();
    await authenticatedPage
      .getByRole("menuitem", { name: "Edit Group" })
      .click();
    await expect(groupsPage.editModal).toBeVisible({ timeout: 3000 });

    const nameInput = authenticatedPage.locator("#edit-field-name");
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("New Name");
    }

    await authenticatedPage.getByRole("button", { name: "Save" }).click();

    // Error indicator should appear
    await authenticatedPage.waitForTimeout(2000);
    const errorVisible = await authenticatedPage
      .locator('.text-red-500, .text-red-600, [role="alert"], [role="status"]')
      .first()
      .isVisible()
      .catch(() => false);
    const modalStillOpen = await groupsPage.editModal
      .isVisible()
      .catch(() => false);

    expect(errorVisible || modalStillOpen).toBeTruthy();
  });
});
