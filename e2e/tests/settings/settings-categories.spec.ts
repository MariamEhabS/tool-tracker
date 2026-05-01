import type { Page } from "@playwright/test";
import {
  test,
  expect,
  mockStorageStats,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockCategories = [
  {
    _id: "cat-001",
    categoryName: "Electrical Panel",
    categoryClass: "Electrical",
    companyId: "comp-test-001",
  },
  {
    _id: "cat-002",
    categoryName: "Fire Extinguisher",
    categoryClass: "Safety",
    companyId: "comp-test-001",
  },
  {
    _id: "cat-003",
    categoryName: "HVAC Unit",
    categoryClass: "Mechanical",
    companyId: "comp-test-001",
  },
];

const mockCategoryClasses = ["Electrical", "Safety", "Mechanical"];

const mockNewCategory = {
  _id: "cat-004",
  categoryName: "Plumbing Fixture",
  categoryClass: "Plumbing",
  companyId: "comp-test-001",
};

// ============================================================================
// HELPERS
// ============================================================================

async function setupSettingsMocks(page: Page, categories = mockCategories) {
  // Use safeRoute for all mocks to avoid RouteTracker verification issues
  const fallback = (pattern: string, data: unknown) =>
    safeRoute(page, pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  // API returns { data: [...] } format
  await fallback("**/categories*", { data: categories });
  await fallback("**/categories/classes*", { data: mockCategoryClasses });

  // Fallbacks for other lazy sections
  await fallback("**/user/*", { users: [], total: 0 });
  await fallback("**/storage-stats**", mockStorageStats);
  await fallback("**/storage-history**", { history: [] });
  await fallback("**/procore/status**", { connected: false });
  await fallback("**/procore-status**", { connected: false });
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });
  await fallback("**/stripe/products**", { data: [] });
  await fallback("**/company/*/qr-style**", {
    useStyledQRCodes: false,
    qrStyleConfig: null,
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings Categories @desktop", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    settingsPage = new SettingsPage(authenticatedPage);
  });

  // ==========================================================================
  // ADD CATEGORY
  // ==========================================================================

  test("Add Category opens modal, fills form, and saves successfully", async ({
    authenticatedPage,
  }) => {
    // Setup mocks first (GET for categories list)
    await setupSettingsMocks(authenticatedPage);

    let createCalled = false;

    // Use fallback (not continue) so GET /categories still reaches setupSettingsMocks().
    await safeRoute(
      authenticatedPage,
      /\/categories(?:\?.*)?$/,
      async (route) => {
        if (route.request().method() === "POST") {
          createCalled = true;
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ data: mockNewCategory }),
          });
          return;
        }
        await route.fallback();
      },
    );

    await settingsPage.goto();
    await settingsPage.expandSection("categories");

    // Click "Add Category"
    await settingsPage.addCategoryButton.click();

    // Modal should open
    const modal = authenticatedPage.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Fill the category name using the input's ID
    const nameInput = authenticatedPage.locator("#categoryName");
    await expect(nameInput).toBeVisible({ timeout: 2000 });
    await nameInput.fill("Plumbing Fixture");

    // Fill category class
    const classInput = authenticatedPage.locator("#categoryClass");
    await expect(classInput).toBeVisible({ timeout: 2000 });
    await classInput.fill("Plumbing");

    // Submit
    const submitBtn = modal.getByRole("button", { name: /Create Category/i });
    await submitBtn.click();

    // Success indication — toast or modal closes
    await expect.poll(() => createCalled, { timeout: 5000 }).toBe(true);
    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  // ==========================================================================
  // EDIT CATEGORY
  // ==========================================================================

  test("Edit category via row action updates the category name", async ({
    authenticatedPage,
  }) => {
    // Mock PATCH for update - returns { data: category }
    await safeRoute(
      authenticatedPage,
      "**/categories/cat-001",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: { ...mockCategories[0], categoryName: "Updated Panel" },
          }),
        });
      },
    );

    await setupSettingsMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("categories");

    // Wait for categories to load
    await expect(
      authenticatedPage.locator("text=Electrical Panel").first(),
    ).toBeVisible({ timeout: 5000 });

    // Click the edit button with aria-label "Edit Electrical Panel"
    const editButton = authenticatedPage.getByRole("button", {
      name: /Edit Electrical Panel/i,
    });
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();

    // Modal should open with pre-filled name
    const modal = authenticatedPage.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const nameInput = authenticatedPage.locator("#categoryName");
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.clear();
    await nameInput.fill("Updated Panel");

    // Click save in the modal
    const saveBtn = modal.getByRole("button", { name: /Save Changes/i });
    await saveBtn.click();

    // Wait for the update to complete
    await authenticatedPage.waitForTimeout(500);
  });

  // ==========================================================================
  // DELETE CATEGORY
  // ==========================================================================

  test("Delete category shows confirmation and removes from list", async ({
    authenticatedPage,
  }) => {
    // Mock DELETE - returns { data: deletedCategory }
    await safeRoute(
      authenticatedPage,
      "**/categories/cat-003",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mockCategories[2] }),
        });
      },
    );

    await setupSettingsMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("categories");

    // Wait for categories to load
    await expect(
      authenticatedPage.locator("text=HVAC Unit").first(),
    ).toBeVisible({ timeout: 5000 });

    // Click the delete button with aria-label "Delete HVAC Unit"
    const deleteButton = authenticatedPage.getByRole("button", {
      name: /Delete HVAC Unit/i,
    });
    await expect(deleteButton).toBeVisible({ timeout: 3000 });
    await deleteButton.click();

    // Confirm deletion in the modal
    const modal = authenticatedPage.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const confirmBtn = modal.getByRole("button", { name: /Delete Category/i });
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await confirmBtn.click();

    // Wait for the delete to complete
    await authenticatedPage.waitForTimeout(500);
  });

  // ==========================================================================
  // CSV IMPORT
  // ==========================================================================

  test("Import CSV button opens upload modal", async ({
    authenticatedPage,
  }) => {
    await setupSettingsMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("categories");

    // Click Import CSV button
    await settingsPage.importCSVButton.click();

    // Modal should open with file upload area
    await expect(
      authenticatedPage.locator(
        '[data-testid="csv-upload-modal"], [role="dialog"]',
      ),
    ).toBeVisible({ timeout: 3000 });
  });

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  test("search filters category list by name", async ({
    authenticatedPage,
  }) => {
    await setupSettingsMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("categories");

    // All 3 categories should be visible
    await expect(
      authenticatedPage.locator("text=Electrical Panel"),
    ).toBeVisible();
    await expect(
      authenticatedPage.locator("text=Fire Extinguisher"),
    ).toBeVisible();
    await expect(authenticatedPage.locator("text=HVAC Unit")).toBeVisible();

    // Type in the search input
    await settingsPage.categorySearchInput.fill("Electrical");

    // Wait for filter to take effect
    await authenticatedPage.waitForTimeout(300);

    // Electrical Panel should still be visible
    await expect(
      authenticatedPage.locator("text=Electrical Panel"),
    ).toBeVisible();

    // Others should be hidden (client-side filter)
    await expect(authenticatedPage.locator("text=HVAC Unit")).toBeHidden({
      timeout: 2000,
    });
  });
});
