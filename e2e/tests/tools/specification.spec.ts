import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockSpecificationData,
  mockSpecificationMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Specifications - Section 4.13", () => {
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

  test("displays specification detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSpecificationData]),
      });
    });

    await page.goto("/tools/specification/SPEC-001?qrCodeId=test-qr");

    await expect(
      page.locator("text=Structural Steel Framing").first(),
    ).toBeVisible();
    await expect(page.locator("text=05 12 00")).toBeVisible();

    await percySnapshot(page, "Specification Detail - Full Data");
  });

  test("displays specification with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSpecificationMinimal]),
      });
    });

    await page.goto("/tools/specification/SPEC-002?qrCodeId=test-qr");

    await expect(page.locator("text=Cast-in-Place Concrete")).toBeVisible();
    await expect(page.locator("text=03 30 00")).toBeVisible();

    await percySnapshot(page, "Specification Detail - Minimal Data");
  });

  test("shows revision number", async ({ page }) => {
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSpecificationData]),
      });
    });

    await page.goto("/tools/specification/SPEC-001?qrCodeId=test-qr");

    // Revision 2
    await expect(page.locator("text=2").first()).toBeVisible();
  });

  test("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSpecificationData]),
      });
    });

    await page.goto("/tools/specification/SPEC-001?qrCodeId=test-qr");

    await expect(
      page.locator("text=requirements for structural steel framing"),
    ).toBeVisible();
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockSpecificationData]),
      });
    });

    await page.goto("/tools/specification/SPEC-001?qrCodeId=test-qr");
    await expect(
      page.locator("text=Structural Steel Framing").first(),
    ).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Specifications - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/specifications**", [
      mockSpecificationMinimal,
    ]);

    await page.goto("/tools/specification/SPEC-002?qrCodeId=test-qr");
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/specifications**",
    ]);

    await assertMockDataVisible(page, mockSpecificationMinimal, [
      "divisionData.description",
      "divisionData.number",
    ]);

    await assertFieldsNotVisible(page, [
      "Structural Steel Framing",
      "requirements for structural steel framing",
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
    await safeRoute(page, "**/procore/specifications**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/specification/SPEC-001?qrCodeId=test-qr");
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Structural Steel Framing", "05 12 00"],
      { timeout: 3000 },
    );
  });
});
