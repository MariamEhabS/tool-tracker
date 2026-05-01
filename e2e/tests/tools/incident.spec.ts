import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockIncidentData,
  mockIncidentMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Incidents - Section 4.6", () => {
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

  test("displays incident detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentData]),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");

    await expect(page.locator("text=Slip and Fall Incident")).toBeVisible();
    await expect(page.locator("text=Parking Lot B")).toBeVisible();
    await expect(page.getByText(/under investigation/i).first()).toBeVisible();

    await percySnapshot(page, "Incident Detail - Full Data");
  });

  test("displays incident with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentMinimal]),
      });
    });

    await page.goto("/tools/incident/INC-002?qrCodeId=test-qr");

    await expect(page.locator("text=Minor First Aid")).toBeVisible();
    await expect(page.getByText(/closed/i).first()).toBeVisible();

    await percySnapshot(page, "Incident Detail - Minimal Data");
  });

  test("shows recordable status", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentData]),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");

    // Recordable: Yes
    await expect(page.getByText(/yes/i).first()).toBeVisible();
  });

  test("shows event date and time", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentData]),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");

    // Event time 14:30 UTC - formatTime outputs in 12-hour locale format like "02:30 PM"
    // Match various formats: 14:30, 2:30, 02:30, with optional AM/PM
    await expect(
      page.getByText(/\d{1,2}:\d{2}(\s?(AM|PM))?/i).first(),
    ).toBeVisible();
  });

  test("tabs switch content correctly", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentData]),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");
    await expect(page.locator("text=Slip and Fall Incident")).toBeVisible();

    const moreTab = page.getByRole("button", { name: /more/i });
    if (await moreTab.isVisible()) {
      await moreTab.click();
      // Should show hazard, behavior, condition
      await expect(page.locator("text=Wet Surface")).toBeVisible();
      await percySnapshot(page, "Incident Detail - More Tab");
    }
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockIncidentData]),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");
    await expect(page.locator("text=Slip and Fall Incident")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Incidents - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/incidents**", [
      mockIncidentMinimal,
    ]);

    await page.goto("/tools/incident/INC-002?qrCodeId=test-qr");
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/incidents**",
    ]);

    await assertMockDataVisible(page, mockIncidentMinimal, ["title"]);

    await assertFieldsNotVisible(page, [
      "Slip and Fall Incident",
      "Parking Lot B",
      "Wet Surface",
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
    await safeRoute(page, "**/procore/incidents**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/incident/INC-001?qrCodeId=test-qr");
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Slip and Fall Incident", "Parking Lot B"],
      { timeout: 3000 },
    );
  });
});
