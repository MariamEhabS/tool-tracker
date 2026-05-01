import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockDrawingData,
  mockDrawingObsolete,
  mockDrawingMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Drawings - Section 4.3", () => {
  test.beforeEach(async ({ page }) => {
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
  });

  test("displays drawing detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDrawingData]),
      });
    });

    await page.goto("/tools/drawing/DWG-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=A-101")).toBeVisible();
    await expect(page.locator("text=Floor Plan Level 1")).toBeVisible();
    await expect(page.locator("text=Architectural")).toBeVisible();

    await percySnapshot(page, "Drawing Detail - Full Data");
  });

  test("shows revision number", async ({ page }) => {
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDrawingData]),
      });
    });

    await page.goto("/tools/drawing/DWG-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Revision 3
    await expect(page.locator("text=3").first()).toBeVisible();
  });

  test("shows obsolete status with styling", async ({ page }) => {
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDrawingObsolete]),
      });
    });

    await page.goto("/tools/drawing/DWG-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Old Site Plan")).toBeVisible();
    // Obsolete drawings should show obsolete indicator
    await expect(page.getByText(/obsolete|yes/i).first()).toBeVisible();

    await percySnapshot(page, "Drawing Detail - Obsolete");
  });

  test("shows drawing set information", async ({ page }) => {
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDrawingData]),
      });
    });

    await page.goto("/tools/drawing/DWG-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Bid Set")).toBeVisible();
  });

  // Skip: Component doesn't have back button - navigation is in parent layout
  test.skip("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDrawingData]),
      });
    });

    await page.goto("/tools/drawing/DWG-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Floor Plan Level 1")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Drawings - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/drawings**", [mockDrawingMinimal]);

    await page.goto("/tools/drawing/DWG-MIN-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/drawings**",
    ]);

    await assertMockDataVisible(page, mockDrawingMinimal, ["title", "number"]);

    await assertFieldsNotVisible(page, ["Floor Plan Level 1", "Architectural"]);
  });

  test("handles API error gracefully", async ({ page }) => {
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregation),
        });
      },
    );
    await safeRoute(page, "**/procore/drawings**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/drawing/DWG-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Floor Plan Level 1", "A-101", "Architectural"],
      { timeout: 3000 },
    );
  });
});
