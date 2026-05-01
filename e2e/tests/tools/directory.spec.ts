import { test, expect } from "../../fixtures/verified-test";
import percySnapshot from "../../utils/percy";
import {
  assertMockDataVisible,
  assertFieldsNotVisible,
  waitForLoadingComplete,
  waitForMockRoutesCalled,
} from "../../utils";
import {
  mockDirectoryData,
  mockDirectoryMinimal,
  mockAggregation,
} from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

test.describe("Directory - Section 4.16", () => {
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

  test("displays directory entry with all fields", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=John Smith")).toBeVisible();
    await expect(page.locator("text=Project Manager")).toBeVisible();
    await expect(page.locator("text=ABC Construction")).toBeVisible();

    await percySnapshot(page, "Directory Detail - Full Data");
  });

  test("displays directory entry with minimal data", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryMinimal]),
      });
    });

    await page.goto("/tools/directory/DIR-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=Jane Doe")).toBeVisible();
    await expect(page.locator("text=XYZ Engineering")).toBeVisible();

    await percySnapshot(page, "Directory Detail - Minimal Data");
  });

  test("shows initials circle", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Should show initials (JS for John Smith)
    await expect(page.locator("text=JS").first()).toBeVisible();
  });

  test("shows address information", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("text=123 Construction Way")).toBeVisible();
    await expect(page.locator("text=Los Angeles")).toBeVisible();
  });

  test("shows contact actions", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=John Smith")).toBeVisible();

    // Should have phone/email/sms links
    const phoneLink = page.locator('a[href*="tel:"]');
    const emailLink = page.locator('a[href*="mailto:"]');
    const smsLink = page.locator('a[href*="sms:"]');

    // At least one contact method should be visible
    const hasPhone = await phoneLink.isVisible().catch(() => false);
    const hasEmail = await emailLink.isVisible().catch(() => false);
    const hasSms = await smsLink.isVisible().catch(() => false);

    expect(hasPhone || hasEmail || hasSms).toBeTruthy();
  });

  test("shows phone number in contact link", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Phone number is in href attributes (tel: and sms:), not displayed as text
    const phoneLink = page.locator('a[href="tel:555-123-4567"]');
    await expect(phoneLink).toBeVisible();
  });

  test("shows email address in contact link", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });

    // Email is in mailto: href, not displayed as text
    const emailLink = page.locator(
      'a[href="mailto:john.smith@abcconstruction.com"]',
    );
    await expect(emailLink).toBeVisible();
  });

  test("back button is visible", async ({ page }) => {
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockDirectoryData]),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=John Smith")).toBeVisible();

    const backButton = page.locator("button.menu-button-shadow").first();
    await expect(backButton).toBeVisible();
  });
});

test.describe("Directory - Edge Cases", () => {
  test("displays tool with minimal data and hides optional fields", async ({
    page,
    routeTracker,
  }) => {
    await routeTracker.mockRoute(
      "**/aggregation/qr-company-project**",
      mockAggregation,
    );
    await routeTracker.mockRoute("**/procore/directory**", [
      mockDirectoryMinimal,
    ]);

    await page.goto("/tools/directory/DIR-002?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);
    await waitForMockRoutesCalled(routeTracker, [
      "**/aggregation/qr-company-project**",
      "**/procore/directory**",
    ]);

    await assertMockDataVisible(page, mockDirectoryMinimal, ["name"]);

    await assertFieldsNotVisible(page, [
      "John Smith",
      "123 Construction Way",
      "Los Angeles",
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
    await safeRoute(page, "**/procore/directory**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      });
    });

    await page.goto("/tools/directory/DIR-001?qrCodeId=test-qr", {
      waitUntil: "domcontentloaded",
    });
    await waitForLoadingComplete(page);

    await assertFieldsNotVisible(
      page,
      ["John Smith", "Project Manager", "ABC Construction"],
      { timeout: 3000 },
    );
  });
});
