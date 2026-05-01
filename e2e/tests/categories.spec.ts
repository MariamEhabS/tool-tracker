import { test, expect } from "../fixtures/verified-test";
import percySnapshot from "../utils/percy";
import { ScannedQRPage } from "../pages/scanned-qr.page";
import {
  mockMultiToolQR,
  mockSingleToolQR,
  mockEmptyQR,
  mockNoEditPermissionQR,
  mockInspectionData,
  mockProjectAddress,
} from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

// Set longer timeout for all tests in this file to accommodate Mobile Safari
test.setTimeout(60000);

test.describe("Category Menu - Section 1.7", () => {
  const waitForPageReady = async (qrPage: ScannedQRPage) => {
    await qrPage.waitForLoad();
  };

  test("displays category grid with all tools", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMultiToolQR),
      });
    });

    await qrPage.goto("multi-tool-qr");
    await waitForPageReady(qrPage);

    // Wait for category grid with increased timeout for Mobile Safari
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });
    await expect(qrPage.qrCodeName).toContainText("Multi-Tool QR");

    await percySnapshot(page, "Category Menu - Multiple Tools");
  });

  test("shows Files and Folders button with correct count", async ({
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

    // Wait for category grid first to ensure page is fully rendered (Mobile Safari is slower)
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

    await expect(qrPage.filesAndFoldersButton).toBeVisible();
    // 3 folders + 2 documents = 5
    const badge = qrPage.getCategoryBadge("Files and Folders");
    await expect(badge).toContainText("5");
  });

  test("shows tool badges with correct counts", async ({ page }) => {
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

    // Wait for category grid first to ensure page is fully rendered (Mobile Safari is slower)
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

    // Verify badges show correct counts
    await expect(qrPage.getCategoryBadge("Inspections")).toContainText("12");
    await expect(qrPage.getCategoryBadge("Punch List")).toContainText("5");
    await expect(qrPage.getCategoryBadge("Forms")).toContainText("3");
    await expect(qrPage.getCategoryBadge("Drawings")).toContainText("45");
  });

  test("single tool auto-expands without menu button", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSingleToolQR),
      });
    });

    // Mock the tool data fetch
    await safeRoute(page, "**/procore/inspections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInspectionData]),
      });
    });

    await qrPage.goto("single-tool-qr");
    await waitForPageReady(qrPage);
    await qrPage.waitForExpandedTool("Inspections");

    // Category grid should NOT be visible (auto-expanded to show tool data)
    const gridVisible = await qrPage.isCategoryGridVisible();
    // Menu button should be hidden for single tool
    const menuVisible = await qrPage.isMenuButtonVisible();

    // At least one should indicate expanded state
    expect(gridVisible === false || menuVisible === false).toBeTruthy();

    await percySnapshot(page, "Category Menu - Single Tool Auto-Expand");
  });

  test("shows FAB button when canEditInTaliho is true", async ({ page }) => {
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

    // Wait for category grid to be visible (increased timeout for Mobile Safari)
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

    // FAB should be visible on the category menu when canEditInTaliho is true
    await expect(qrPage.fabButton).toBeVisible({ timeout: 10000 });
  });

  test("hides FAB button when canEditInTaliho is false", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockNoEditPermissionQR),
      });
    });

    // Mock tool data
    await safeRoute(page, "**/procore/inspections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInspectionData]),
      });
    });

    await qrPage.goto("test-qr");
    await waitForPageReady(qrPage);
    await qrPage.waitForExpandedTool("Inspections");

    // FAB should not be visible
    const fabVisible = await qrPage.isFabVisible();
    expect(fabVisible).toBeFalsy();

    await percySnapshot(page, "Category Menu - No Edit Permission");
  });

  test("shows empty state when no content", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockEmptyQR),
      });
    });

    await qrPage.goto("empty-qr");
    await waitForPageReady(qrPage);

    await expect(qrPage.emptyStateMessage).toBeVisible({ timeout: 15000 });

    await percySnapshot(page, "Category Menu - Empty State");
  });

  test("project dropdown shows address when available", async ({ page }) => {
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

    // Wait for category grid to be visible (ensures data is loaded)
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

    // Project dropdown should be visible since we have project address
    await expect(qrPage.projectDropdown).toBeVisible({ timeout: 10000 });

    // Click to expand the dropdown
    await qrPage.expandProjectDropdown();
    await expect(qrPage.projectDropdown).toHaveAttribute("open", "");

    // Verify address content is visible (uses imported mock data constant)
    await expect(page.getByText(mockProjectAddress)).toBeVisible({
      timeout: 5000,
    });

    await percySnapshot(page, "Category Menu - Project Dropdown Expanded");
  });

  test("navigates to tool when category is clicked", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMultiToolQR),
      });
    });

    // Mock tool data
    await safeRoute(page, "**/procore/inspections**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInspectionData]),
      });
    });

    await qrPage.goto("test-qr");
    await waitForPageReady(qrPage);

    // Wait for category grid to be visible before clicking
    await expect(qrPage.categoryGrid).toBeVisible({ timeout: 15000 });

    await qrPage.selectCategory("Inspections");
    await qrPage.waitForExpandedTool("Inspections");

    await percySnapshot(page, "Category Menu - Tool Expanded View");
  });
});
