import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockObservationData,
  mockObservationMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Observations - Section 4.9", () => {
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

  test("displays observation detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page, { timeout: 15000 });

    await expect(
      page.getByRole("heading", { name: "Missing Handrail on Stairwell B" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=OB-2024-001")).toBeVisible();
    await expect(page.locator("text=Stairwell B").first()).toBeVisible();

    await percySnapshot(page, "Observation Detail - Full Data");
  });

  test("displays observation with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationMinimal]),
      });
    });

    await page.goto("/tools/observation/OBS-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Minor Observation")).toBeVisible();
    await expect(page.getByText(/closed/i).first()).toBeVisible();

    await percySnapshot(page, "Observation Detail - Minimal Data");
  });

  test("shows status with underscores split", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // ready_for_review should display as "ready for review"
    await expect(page.getByText(/ready.*for.*review/i).first()).toBeVisible();
  });

  test("shows priority", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=High")).toBeVisible();
  });

  test("shows trade information", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Carpentry")).toBeVisible();
  });

  test("shows assignee information", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    const peopleTab = page.getByRole("button", { name: /people/i });
    if (await peopleTab.isVisible()) {
      await peopleTab.click();
      await expect(page.locator("text=Bob Builder")).toBeVisible();
      await percySnapshot(page, "Observation Detail - People Tab");
    }
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockObservationData]),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Missing Handrail")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Observations - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/observations**", [
      mockObservationMinimal,
    ]);

    await page.goto("/tools/observation/OBS-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/observations**",
    ]);

    await assertMockDataVisible(page, mockObservationMinimal, ["name"]);

    await assertFieldsNotVisible(page, [
      "Missing Handrail on Stairwell B",
      "OB-2024-001",
      "Carpentry",
      "Bob Builder",
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
    await safeRoute(page, "**/procore/observations**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/observation/OBS-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Missing Handrail on Stairwell B", "OB-2024-001"],
      { timeout: 3000 },
    );
  });
});
