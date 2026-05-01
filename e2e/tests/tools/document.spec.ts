import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockDocumentData,
  mockDocumentDeleted,
  mockDocumentMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Documents - Section 4.4", () => {
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

  test("displays document detail with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentData]),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.locator("text=Project Specifications.pdf").first(),
    ).toBeVisible();
    await expect(page.locator("text=pdf").first()).toBeVisible();

    await percySnapshot(page, "Document Detail - Full Data");
  });

  test("shows file path", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentData]),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=/Project/Specs/")).toBeVisible();
  });

  test("shows file size formatted", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentData]),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // 5242880 bytes = 5 MB
    await expect(page.getByText(/5.*mb/i).first()).toBeVisible();
  });

  test("shows active status for non-deleted document", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentData]),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText(/active/i).first()).toBeVisible();
  });

  test("shows deleted status for deleted document", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentDeleted]),
      });
    });

    await page.goto("/tools/document/DOC-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Old Document.pdf").first()).toBeVisible();
    await expect(page.getByText(/deleted/i).first()).toBeVisible();

    await percySnapshot(page, "Document Detail - Deleted Status");
  });

  // Skip: Component doesn't have back button - navigation is in parent layout
  test.skip("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDocumentData]),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator("text=Project Specifications.pdf").first(),
    ).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Documents - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/documents**", [
      mockDocumentMinimal,
    ]);

    await page.goto("/tools/document/DOC-MIN-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/documents**",
    ]);

    await assertMockDataVisible(page, mockDocumentMinimal, ["name"]);

    await assertFieldsNotVisible(page, [
      "Project Specifications.pdf",
      "/Project/Specs/",
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
    await safeRoute(page, "**/procore/documents**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/document/DOC-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(page, ["Project Specifications.pdf"], {
      timeout: 3000,
    });
  });
});
