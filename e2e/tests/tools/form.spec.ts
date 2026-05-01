import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockFormData,
  mockFormMinimal,
  mockAggregation,
  mockAggregationNoEdit,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Forms - Section 4.5", () => {
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

  test("displays form detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");

    await expect(page.locator("text=Daily Safety Report")).toBeVisible();
    await expect(page.locator("text=Safety Checklist Template")).toBeVisible();

    await percySnapshot(page, "Form Detail - Full Data");
  });

  test("shows created by information", async ({ page }) => {
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");

    await expect(page.locator("text=Site Manager")).toBeVisible();
  });

  test("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");

    await expect(
      page.locator("text=Daily safety inspection form"),
    ).toBeVisible();
  });

  test("shows Edit in Taliho button when permitted", async ({ page }) => {
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");
    await expect(page.locator("text=Daily Safety Report")).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit in taliho/i });
    await expect(editButton).toBeVisible();
  });

  test("hides Edit button when not permitted", async ({ page }) => {
    await safeRoute(
      page,
      "**/aggregation/qr-company-project**",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAggregationNoEdit),
        });
      },
    );

    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");
    await expect(page.locator("text=Daily Safety Report")).toBeVisible();

    const editButton = page.getByRole("button", { name: /edit in taliho/i });
    await expect(editButton).not.toBeVisible();

    await percySnapshot(page, "Form Detail - No Edit Permission");
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockFormData]),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");
    await expect(page.locator("text=Daily Safety Report")).toBeVisible();

    const backButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Forms - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/forms**", [mockFormMinimal]);

    await page.goto("/tools/form/FORM-MIN-001?qrCodeId=test-qr");
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/forms**",
    ]);

    await assertMockDataVisible(page, mockFormMinimal, ["name"]);

    await assertFieldsNotVisible(page, [
      "Daily Safety Report",
      "Safety Checklist Template",
      "Site Manager",
      "Daily safety inspection form",
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
    await safeRoute(page, "**/procore/forms**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/form/FORM-001?qrCodeId=test-qr");
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Daily Safety Report", "Safety Checklist Template"],
      { timeout: 3000 },
    );
  });
});
