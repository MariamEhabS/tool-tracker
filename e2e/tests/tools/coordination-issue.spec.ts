import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  mockCoordinationIssueData,
  mockCoordinationIssueMinimal,
  mockAggregation,
  mockAggregationNoEdit as _mockAggregationNoEdit,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Coordination Issues - Section 4.2", () => {
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

  test("displays coordination issue detail with all fields", async ({
    page,
  }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueData]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-001?qrCodeId=test-qr");

    await expect(
      page.locator("text=HVAC Conflict with Structural Beam"),
    ).toBeVisible();
    await expect(page.locator("text=CI-2024-001")).toBeVisible();
    await expect(page.getByText(/open/i).first()).toBeVisible();
    await expect(page.locator("text=Floor 3")).toBeVisible();

    await percySnapshot(page, "Coordination Issue Detail - Full Data");
  });

  test("displays coordination issue with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueMinimal]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-002?qrCodeId=test-qr");

    await expect(page.locator("text=Minor Coordination Issue")).toBeVisible();
    await expect(page.getByText(/closed/i).first()).toBeVisible();

    await percySnapshot(page, "Coordination Issue Detail - Minimal Data");
  });

  test("shows priority with correct styling", async ({ page }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueData]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-001?qrCodeId=test-qr");

    // Wait for page content to load before checking priority
    await expect(page.locator("text=HVAC Conflict")).toBeVisible();
    await expect(page.locator("text=High")).toBeVisible();
  });

  test("shows trade information", async ({ page }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueData]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-001?qrCodeId=test-qr");

    // Wait for page content to load before checking trade
    await expect(page.locator("text=HVAC Conflict")).toBeVisible();
    await expect(page.locator("text=HVAC").first()).toBeVisible();
  });

  test("tabs switch content correctly", async ({ page }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueData]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-001?qrCodeId=test-qr");
    await expect(page.locator("text=HVAC Conflict")).toBeVisible();

    const datesTab = page.getByRole("button", { name: /dates/i });
    if (await datesTab.isVisible()) {
      await datesTab.click();
      await percySnapshot(page, "Coordination Issue - Dates Tab");
    }

    const peopleTab = page.getByRole("button", { name: /people/i });
    if (await peopleTab.isVisible()) {
      await peopleTab.click();
      await expect(page.locator("text=John Smith")).toBeVisible();
      await percySnapshot(page, "Coordination Issue - People Tab");
    }
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/coordination-issues**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockCoordinationIssueData]),
      });
    });

    await page.goto("/tools/coordination-issue/CI-001?qrCodeId=test-qr");
    await expect(page.locator("text=HVAC Conflict")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});
