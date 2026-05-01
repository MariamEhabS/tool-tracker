import { test, expect } from "../fixtures/verified-test";
import percySnapshot from "../utils/percy";
import { ScannedQRPage } from "../pages/scanned-qr.page";
import {
  mockMultiToolQR,
  mockInspectionData,
  mockPunchListData as _mockPunchListData,
} from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

// Set longer timeout for all tests in this file to accommodate Mobile Safari
test.setTimeout(60000);

test.describe("Category Menu Interactions", () => {
  const waitForPageReady = async (qrPage: ScannedQRPage) => {
    await qrPage.waitForLoad();
  };

  test.describe("Category Selection Flow", () => {
    test("can click on different categories", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      // Mock Inspections data
      await safeRoute(page, "**/procore/inspections**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionData]),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Verify Inspections category is visible and clickable
      const inspectionsButton = qrPage.getCategoryButton("Inspections");
      await expect(inspectionsButton).toBeVisible();

      // Click on Inspections
      await inspectionsButton.click();
      await qrPage.waitForExpandedTool("Inspections");

      // Menu button should appear (to navigate back)
      await expect(qrPage.menuButton).toBeVisible({ timeout: 10000 });
    });

    test("can return to category menu via Menu button", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      // Mock Inspections data
      await safeRoute(page, "**/procore/inspections**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionData]),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Click on a category to expand
      await qrPage.selectCategory("Inspections");
      await qrPage.waitForExpandedTool("Inspections");

      // Menu button should be visible
      await expect(qrPage.menuButton).toBeVisible({ timeout: 10000 });

      // Click Menu button to return to category grid
      await qrPage.menuButton.click();

      // Category grid should be visible again
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 10000 });

      await percySnapshot(page, "Category Menu - Returned from Tool View");
    });

    test("can navigate to Files and Folders", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Files and Folders button should be visible
      await expect(qrPage.filesAndFoldersButton).toBeVisible();

      // Click on Files and Folders
      await qrPage.filesAndFoldersButton.click();

      // Menu button should appear for navigation back
      await expect(qrPage.menuButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("FAB Menu Interactions", () => {
    test("FAB menu shows create options when clicked", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // FAB should be visible (canEditInTaliho is true in mockMultiToolQR)
      await expect(qrPage.fabButton).toBeVisible({ timeout: 10000 });

      // Click FAB to open create menu
      await qrPage.openCreateMenu();

      // All create options should be visible
      await expect(qrPage.createFormOption).toBeVisible();
      await expect(qrPage.createInspectionOption).toBeVisible();
      await expect(qrPage.createPunchListOption).toBeVisible();

      await percySnapshot(page, "Category Menu - FAB Menu Open");
    });

    test("FAB menu closes when clicking outside", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // FAB should be visible
      await expect(qrPage.fabButton).toBeVisible({ timeout: 10000 });

      // Click FAB to open create menu - wait for animation
      await qrPage.openCreateMenu();

      // Click outside the menu (on the QR code name area, which is always visible)
      await qrPage.qrCodeName.click();

      // Create menu should be hidden
      await expect(qrPage.createMenu).not.toBeVisible({ timeout: 5000 });
    });

    test("FAB menu is hidden when not on category grid view", async ({
      page,
    }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      // Mock Inspections data
      await safeRoute(page, "**/procore/inspections**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([mockInspectionData]),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // FAB should be visible on category grid
      await expect(qrPage.fabButton).toBeVisible({ timeout: 10000 });

      // Navigate to a tool view
      await qrPage.selectCategory("Inspections");
      await qrPage.waitForExpandedTool("Inspections");

      // FAB should be hidden when viewing tool data
      await expect(qrPage.fabButton).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Category Badge Display", () => {
    test("category badges show correct counts for each tool", async ({
      page,
    }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Verify each category button exists with correct badge count
      // mockMultiToolQR has: inspection: 12, punch-list: 5, form: 3, drawing: 45

      const inspectionBadge = qrPage.getCategoryBadge("Inspections");
      await expect(inspectionBadge).toBeVisible();
      await expect(inspectionBadge).toContainText("12");

      const punchListBadge = qrPage.getCategoryBadge("Punch List");
      await expect(punchListBadge).toBeVisible();
      await expect(punchListBadge).toContainText("5");

      const formBadge = qrPage.getCategoryBadge("Forms");
      await expect(formBadge).toBeVisible();
      await expect(formBadge).toContainText("3");

      const drawingBadge = qrPage.getCategoryBadge("Drawings");
      await expect(drawingBadge).toBeVisible();
      await expect(drawingBadge).toContainText("45");
    });

    test("Files and Folders badge shows combined count", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // mockMultiToolQR has 3 folders + 2 documents = 5
      const filesFoldersBadge = qrPage.getCategoryBadge("Files and Folders");
      await expect(filesFoldersBadge).toBeVisible();
      await expect(filesFoldersBadge).toContainText("5");
    });
  });

  test.describe("Project Dropdown Interactions", () => {
    test("project dropdown toggles open and closed", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Project dropdown should be visible
      await expect(qrPage.projectDropdown).toBeVisible({ timeout: 10000 });

      // Initially, the address should not be visible (dropdown closed)
      const addressLocator = page.locator("text=123 Main St");

      // Open dropdown
      await qrPage.expandProjectDropdown();
      await expect(qrPage.projectDropdown).toHaveAttribute("open", "");

      // Address should be visible
      await expect(addressLocator).toBeVisible({ timeout: 5000 });

      // Close dropdown by clicking again
      await qrPage.projectDropdown.locator("summary").click();
      await expect(qrPage.projectDropdown).not.toHaveAttribute("open", "");

      // Address should be hidden
      await expect(addressLocator).not.toBeVisible();
    });

    test("project dropdown displays full address details", async ({ page }) => {
      const qrPage = new ScannedQRPage(page);

      await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      });

      await qrPage.goto("test-qr");
      await waitForPageReady(qrPage);

      // Wait for category grid to be visible
      await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

      // Open dropdown
      await qrPage.expandProjectDropdown();
      await expect(qrPage.projectDropdown).toHaveAttribute("open", "");

      // Verify address parts are visible within the dropdown details element
      // mockMultiToolQR project: "123 Main St", "Los Angeles", "CA", "90001"
      const dropdownContent = page.locator("details");
      await expect(dropdownContent.locator("text=123 Main St")).toBeVisible();
      // Use a more specific selector for the city/state/zip line
      await expect(
        dropdownContent.locator("text=Los Angeles, CA 90001"),
      ).toBeVisible();
    });
  });
});
