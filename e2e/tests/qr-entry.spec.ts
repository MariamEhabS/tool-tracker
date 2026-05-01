import { test, expect } from "../fixtures/verified-test";
import percySnapshot from "../utils/percy";
import { ScannedQRPage } from "../pages/scanned-qr.page";
import {
  mockMultiToolQR,
  mockEmptyQR,
  mock404Error,
  mock500Error,
} from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

test.describe("QR Code Entry - Section 1.1-1.2", () => {
  test("shows splash screen while loading", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // Slow down network to catch loading state
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        body: JSON.stringify(mockMultiToolQR),
      });
    });

    await qrPage.goto("valid-qr-id");

    // Capture loading state - splash should be visible initially
    // Note: This test may be flaky depending on timing
    await percySnapshot(page, "QR Entry - Loading State");
  });

  test("shows 404 error for invalid QR code", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // Mock 404 response
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify(mock404Error),
      });
    });

    await qrPage.goto("invalid-qr-id");

    // Wait for error to display - component shows error state for non-2xx responses
    // Error title may be "QR Code Not Found" or default "Something went wrong"
    // depending on error object structure from the HTTP client
    await expect(qrPage.errorTitle).toBeVisible();
    // Note: Try Again button is only shown for 500 errors in the component, not 404

    await percySnapshot(page, "QR Entry - 404 Error");
  });

  test("shows general error for server failure", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify(mock500Error),
      });
    });

    await qrPage.goto("any-qr-id");

    // Error title may be "Server Error" or default "Something went wrong"
    // depending on error object structure from the HTTP client
    await expect(qrPage.errorTitle).toBeVisible();

    await percySnapshot(page, "QR Entry - Server Error");
  });

  test("Try Again button refetches data", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);
    let shouldSucceed = false;

    // TanStack Query retries failed requests by default (3 retries), so we use
    // a flag-based approach instead of call count to control when to succeed
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      if (shouldSucceed) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      } else {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify(mock500Error),
        });
      }
    });

    await qrPage.goto("test-qr");

    // Wait for error state (after all retries exhaust)
    await expect(qrPage.tryAgainButton).toBeVisible({ timeout: 15000 });

    // Set flag so next request succeeds
    shouldSucceed = true;

    // Click try again
    await qrPage.clickTryAgain();

    // Wait for successful load
    await qrPage.waitForLoad();
    await expect(qrPage.categoryGrid).toBeVisible();
  });

  test("displays QR code name after successful load", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMultiToolQR),
      });
    });

    await qrPage.goto("test-qr");
    await qrPage.waitForLoad();

    await expect(qrPage.qrCodeName).toContainText("Multi-Tool QR");

    await percySnapshot(page, "QR Entry - Successful Load");
  });

  test("shows empty state when no tools or files", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockEmptyQR),
      });
    });

    await qrPage.goto("empty-qr");
    await qrPage.waitForLoad();

    await expect(qrPage.emptyStateMessage).toBeVisible();
    await expect(qrPage.emptyStateMessage).toContainText(
      "Nothing to See Here Yet",
    );

    await percySnapshot(page, "QR Entry - Empty State");
  });
});
