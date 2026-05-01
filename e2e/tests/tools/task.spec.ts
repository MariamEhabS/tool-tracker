import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockTaskData,
  mockTaskMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Tasks - Section 4.15", () => {
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

  test("displays task detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Review Structural Drawings for Level 3"),
    ).toBeVisible();
    await expect(page.locator("text=T-2024-001")).toBeVisible();
    await expect(page.getByText(/in progress/i).first()).toBeVisible();

    await percySnapshot(page, "Task Detail - Full Data");
  });

  test("displays task with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskMinimal]),
      });
    });

    await page.goto("/tools/task/TASK-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Simple Task")).toBeVisible();
    await expect(page.getByText(/completed/i).first()).toBeVisible();

    await percySnapshot(page, "Task Detail - Minimal Data");
  });

  test("shows task category", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Wait for the title to render before asserting detail fields
    await expect(page.locator("text=Review Structural Drawings")).toBeVisible();
    await expect(page.locator("text=Design Review")).toBeVisible();
  });

  test("shows assignee", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Review Structural Drawings")).toBeVisible();
    await expect(page.locator("text=Senior Engineer")).toBeVisible();
  });

  test("shows due date", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Review Structural Drawings")).toBeVisible();
    // Due date January 20
    await expect(page.getByText(/january|jan/i).first()).toBeVisible();
  });

  test("shows description", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Complete review of all structural drawings"),
    ).toBeVisible();
  });

  test("tabs switch content correctly", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Review Structural Drawings")).toBeVisible();

    const peopleTab = page.getByRole("button", { name: /people/i });
    if (await peopleTab.isVisible()) {
      await peopleTab.click();
      // Task component People tab shows empty state message
      await expect(
        page.locator("text=No people available for this task"),
      ).toBeVisible();
      await percySnapshot(page, "Task Detail - People Tab");
    }
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockTaskData]),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Review Structural Drawings")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Tasks - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/tasks**", [mockTaskMinimal]);

    await page.goto("/tools/task/TASK-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/tasks**",
    ]);

    await assertMockDataVisible(page, mockTaskMinimal, ["title"]);

    await assertFieldsNotVisible(page, [
      "Review Structural Drawings for Level 3",
      "T-2024-001",
      "Design Review",
      "Senior Engineer",
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
    await safeRoute(page, "**/procore/tasks**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/task/TASK-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["Review Structural Drawings for Level 3", "T-2024-001"],
      { timeout: 3000 },
    );
  });
});
