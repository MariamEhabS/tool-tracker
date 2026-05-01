import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  mockPunchListData,
  mockPunchListOverdue,
  mockPunchListResolved,
  mockAggregation,
  mockAggregationNoEdit,
} from "../../fixtures/test-data";

test.describe("Punch Lists - Section 4.11", () => {
  test("displays punch list detail with all fields", async ({
    page,
    routeTracker,
  }) => {
    // Mock the aggregation endpoint
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Wait for data to load
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();
    await expect(page.locator("text=Main Lobby")).toBeVisible();
    await expect(page.locator("text=Medium")).toBeVisible();

    await percySnapshot(page, "Punch List Detail - Full Data");
  });

  test("shows overdue styling for past due items", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListOverdue,
    ]);

    await page.goto("/tools/punch-list/PL-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Overdue punch item")).toBeVisible();

    // Due date should be visible (red styling verified visually via Percy)
    await expect(page.locator("text=January")).toBeVisible();

    await percySnapshot(page, "Punch List Detail - Overdue Item");
  });

  test("displays resolved status correctly", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListResolved,
    ]);

    await page.goto("/tools/punch-list/PL-003?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Completed punch item")).toBeVisible();
    // Status displays as "Closed" based on workflow_status
    await expect(page.getByText(/closed/i)).toBeVisible();

    await percySnapshot(page, "Punch List Detail - Resolved Status");
  });

  test("shows open status correctly", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Status displays based on workflow_status ("open")
    await expect(page.getByText(/open/i).first()).toBeVisible();

    await percySnapshot(page, "Punch List Detail - Open Status");
  });

  test("tabs switch content correctly", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Test Dates tab
    const datesTab = page.getByRole("button", { name: /dates/i });
    if (await datesTab.isVisible()) {
      await datesTab.click();
      await percySnapshot(page, "Punch List Detail - Dates Tab");
    }

    // Test People tab
    const peopleTab = page.getByRole("button", { name: /people/i });
    if (await peopleTab.isVisible()) {
      await peopleTab.click();
      await percySnapshot(page, "Punch List Detail - People Tab");
    }
  });

  test("shows Edit in Taliho button when permitted", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Look for edit button
    const editButton = page.getByRole("button", { name: /edit in taliho/i });
    await expect(editButton).toBeVisible();
  });

  test("hides Edit button when not permitted", async ({
    page,
    routeTracker,
  }) => {
    // Override with no-edit aggregation
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregationNoEdit,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Edit button should not be visible
    const editButton = page.getByRole("button", { name: /edit in taliho/i });
    await expect(editButton).not.toBeVisible();

    await percySnapshot(page, "Punch List Detail - No Edit Permission");
  });

  test("shows assignments in view modal", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Click View Assignments button
    const viewAssignmentsButton = page.getByRole("button", {
      name: /view assignments/i,
    });
    await viewAssignmentsButton.click();
    await page.waitForTimeout(500);

    // Should show assignment status
    await expect(page.getByText(/work required/i)).toBeVisible();

    await percySnapshot(page, "Punch List Detail - View Assignments Modal");
  });

  test("displays ball in court information", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Ball in court is in the People tab, not More tab
    const peopleTab = page.getByRole("button", { name: /people/i });
    await peopleTab.click();
    await page.waitForTimeout(300); // Wait for tab content to render

    // Ball in court should show
    await expect(page.locator("text=Paint Contractor")).toBeVisible();
  });

  test("displays punch item type", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Click More tab to see punch item type
    const moreTab = page.getByRole("button", { name: /more/i });
    await moreTab.click();

    // Punch item type should show
    await expect(page.locator("text=Finishes")).toBeVisible();
  });

  test("back button is visible", async ({ page, routeTracker }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );

    await routeTracker.mockRoute("**/procore/punch-list**", [
      mockPunchListData,
    ]);

    await page.goto("/tools/punch-list/PL-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Touch up paint in lobby")).toBeVisible();

    // Look for back button
    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});
