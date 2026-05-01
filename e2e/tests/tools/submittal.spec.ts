import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockSubmittalData,
  mockSubmittalMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Submittals - Section 4.14", () => {
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

  test("displays submittal detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Structural Steel Shop Drawings"),
    ).toBeVisible();
    await expect(page.locator("text=05-001")).toBeVisible();
    await expect(page.getByText(/pending review/i).first()).toBeVisible();

    await percySnapshot(page, "Submittal Detail - Full Data");
  });

  test("displays submittal with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalMinimal]),
      });
    });

    await page.goto("/tools/submittal/SUB-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Basic Submittal")).toBeVisible();
    await expect(page.getByText(/approved/i).first()).toBeVisible();

    await percySnapshot(page, "Submittal Detail - Minimal Data");
  });

  test("shows submittal number", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=SUB-2024-001")).toBeVisible();
  });

  test("shows revision", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Revision A
    await expect(page.locator("text=A").first()).toBeVisible();
  });

  test("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Shop drawings for structural steel"),
    ).toBeVisible();
  });

  test("shows ball in court", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Ball in court is in the People tab
    const peopleTab = page.getByRole("button", { name: /people/i });
    await peopleTab.click();
    await page.waitForTimeout(300);

    await expect(page.locator("text=Architect")).toBeVisible();
  });

  test("shows responsible contractor", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Responsible contractor is in the People tab
    const peopleTab = page.getByRole("button", { name: /people/i });
    await peopleTab.click();
    await page.waitForTimeout(300);

    await expect(page.locator("text=Steel Contractor")).toBeVisible();
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSubmittalData]),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator("text=Structural Steel Shop Drawings"),
    ).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Submittals - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/submittals**", [
      mockSubmittalMinimal,
    ]);

    await page.goto("/tools/submittal/SUB-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/submittals**",
    ]);

    await assertMockDataVisible(page, mockSubmittalMinimal, ["title"]);

    await assertFieldsNotVisible(page, [
      "Structural Steel Shop Drawings",
      "05-001",
      "SUB-2024-001",
      "Shop drawings for structural steel",
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
    await safeRoute(page, "**/procore/submittals**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/submittal/SUB-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Structural Steel Shop Drawings", "05-001"],
      { timeout: 3000 },
    );
  });
});
