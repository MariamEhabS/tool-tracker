import { test, expect } from "../fixtures/verified-test";
import percySnapshot from "../utils/percy";
import { ScannedQRPage } from "../pages/scanned-qr.page";
import {
  mockMultiToolQR,
  mockPasswordRequired,
  mockPasswordRequiredByEquipment,
  mockPasswordRequiredByArrangement,
  mockPasswordValid,
  mockPasswordInvalid,
} from "../fixtures/test-data";
import { safeRoute } from "../utils/route-tracker";

test.describe("Password Protection - Section 1.4", () => {
  test("shows password gate when required", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordRequired),
      });
    });

    await qrPage.goto("password-protected-qr");
    await qrPage.waitForLoad();

    await expect(qrPage.passwordInput).toBeVisible();
    await expect(qrPage.accessButton).toBeVisible();
    await expect(qrPage.passwordHeading).toBeVisible();

    await percySnapshot(page, "Password Gate - QR Code Level");
  });

  test("shows requiredBy message for equipment password", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordRequiredByEquipment),
      });
    });

    await qrPage.goto("equipment-protected-qr");
    await qrPage.waitForLoad();

    await expect(qrPage.passwordInput).toBeVisible();
    // Check for protected by message
    await expect(qrPage.passwordProtectedMessage).toBeVisible();

    await percySnapshot(page, "Password Gate - Equipment Level");
  });

  test("shows requiredBy message for arrangement password", async ({
    page,
  }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordRequiredByArrangement),
      });
    });

    await qrPage.goto("arrangement-protected-qr");
    await qrPage.waitForLoad();

    await expect(qrPage.passwordInput).toBeVisible();

    await percySnapshot(page, "Password Gate - Arrangement Level");
  });

  test("shows error for invalid password", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);

    // First call: require password
    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordRequired),
      });
    });

    // Verify call: invalid
    await safeRoute(page, "**/verify-password**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordInvalid),
      });
    });

    await qrPage.goto("test-qr");
    await qrPage.waitForLoad();

    // Enter wrong password
    await qrPage.enterPassword("wrongpassword");

    // Should show error
    await expect(qrPage.passwordError).toBeVisible();
    await expect(qrPage.passwordError).toContainText("Invalid password");

    await percySnapshot(page, "Password Gate - Invalid Password Error");
  });

  test("proceeds after valid password", async ({ page }) => {
    const qrPage = new ScannedQRPage(page);
    let passwordVerified = false;

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      if (!passwordVerified) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPasswordRequired),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockMultiToolQR),
        });
      }
    });

    await safeRoute(page, "**/verify-password**", async (route) => {
      passwordVerified = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordValid),
      });
    });

    await qrPage.goto("protected-qr");
    await qrPage.waitForLoad();
    const verifyPasswordResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/verify-password") &&
        response.request().method() === "POST",
    );

    // Enter correct password
    await qrPage.enterPassword("correctpassword");
    await verifyPasswordResponse;

    // Wait for reload and data display
    await qrPage.waitForLoad();

    // Should now see the category grid
    await expect(qrPage.categoryGrid).toBeVisible();

    await percySnapshot(page, "Password Gate - Success Category View");
  });

  test("password input shows loading state during verification", async ({
    page,
  }) => {
    const qrPage = new ScannedQRPage(page);

    await safeRoute(page, "**/qr-code/scanned/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordRequired),
      });
    });

    // Slow down verification significantly to capture loading state
    await safeRoute(page, "**/verify-password**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPasswordValid),
      });
    });

    await qrPage.goto("test-qr");
    await qrPage.waitForLoad();

    // Fill password without clicking the button yet
    await qrPage.passwordInput.fill("testpass");

    // Click the button and immediately check for disabled state
    await qrPage.accessButton.click();

    // Button should be disabled during loading (wait for it with timeout)
    await expect(qrPage.accessButton).toBeDisabled({ timeout: 1000 });

    await percySnapshot(page, "Password Gate - Loading State");
  });
});
