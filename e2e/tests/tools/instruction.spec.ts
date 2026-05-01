import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockInstructionData,
  mockInstructionMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Instructions - Section 4.8", () => {
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

  test("displays instruction detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Concrete Pour Procedure Update"),
    ).toBeVisible();
    await expect(page.locator("text=INS-2024-001")).toBeVisible();
    await expect(page.getByText(/open/i).first()).toBeVisible();

    await percySnapshot(page, "Instruction Detail - Full Data");
  });

  test("displays instruction with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionMinimal]),
      });
    });

    await page.goto("/tools/instruction/INST-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Basic Instruction")).toBeVisible();
    await expect(page.getByText(/closed/i).first()).toBeVisible();

    await percySnapshot(page, "Instruction Detail - Minimal Data");
  });

  test("shows instruction from information", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Project Manager")).toBeVisible();
  });

  test("shows attention list", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Concrete Team")).toBeVisible();
    await expect(page.locator("text=QA Inspector")).toBeVisible();
  });

  test("shows instruction type", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Procedure").first()).toBeVisible();
  });

  test("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Follow these updated steps")).toBeVisible();
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockInstructionData]),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator("text=Concrete Pour Procedure Update"),
    ).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Instructions - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/instructions**", [
      mockInstructionMinimal,
    ]);

    await page.goto("/tools/instruction/INST-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/instructions**",
    ]);

    await assertMockDataVisible(page, mockInstructionMinimal, ["title"]);

    await assertFieldsNotVisible(page, [
      "Concrete Pour Procedure Update",
      "INS-2024-001",
      "Concrete Team",
      "Follow these updated steps",
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
    await safeRoute(page, "**/procore/instructions**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/instruction/INST-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Concrete Pour Procedure Update", "INS-2024-001"],
      { timeout: 3000 },
    );
  });
});
