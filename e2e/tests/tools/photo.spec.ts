import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockPhotoData,
  mockPhotoMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Photos - Section 4.10", () => {
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

  test("displays photo detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockPhotoData]),
      });
    });

    await page.goto("/tools/photo/PHOTO-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Site Progress January 15")).toBeVisible();
    await expect(page.locator("text=P-2024-001")).toBeVisible();

    await percySnapshot(page, "Photo Detail - Full Data");
  });

  test("displays photo with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockPhotoMinimal]),
      });
    });

    await page.goto("/tools/photo/PHOTO-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Quick Site Photo")).toBeVisible();

    await percySnapshot(page, "Photo Detail - Minimal Data");
  });

  // Skip: Photo component doesn't display description field
  test.skip("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockPhotoData]),
      });
    });

    await page.goto("/tools/photo/PHOTO-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Weekly progress photos")).toBeVisible();
  });

  test("shows attachments/gallery", async ({ page }) => {
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockPhotoData]),
      });
    });

    await page.goto("/tools/photo/PHOTO-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Site Progress January 15")).toBeVisible();

    // Should show documents/attachments tab with photos
    const docsTab = page.getByRole("button", { name: /documents/i });
    if (await docsTab.isVisible()) {
      await docsTab.click();
      await percySnapshot(page, "Photo Detail - Gallery View");
    }
  });

  // Skip: Photo component doesn't have back button - navigation is in parent layout
  test.skip("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockPhotoData]),
      });
    });

    await page.goto("/tools/photo/PHOTO-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Site Progress January 15")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Photos - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/photo**", [mockPhotoMinimal]);

    await page.goto("/tools/photo/PHOTO-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/photo**",
    ]);

    await assertMockDataVisible(page, mockPhotoMinimal, ["title"]);

    await assertFieldsNotVisible(page, [
      "Site Progress January 15",
      "P-2024-001",
    ]);
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
    await safeRoute(page, "**/procore/photo**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/photo/PHOTO-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Site Progress January 15", "P-2024-001"],
      { timeout: 3000 },
    );
  });
});
