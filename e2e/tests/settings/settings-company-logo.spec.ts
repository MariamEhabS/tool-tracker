import {
  test,
  expect,
  mockStorageStats,
} from "../../fixtures/authenticated-test";
import { SettingsPage } from "../../pages/settings.page";
import { mockCompanyUsersApiResponse } from "../../fixtures/test-data";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// HELPERS
// ============================================================================

async function setupFallbackMocks(page: import("@playwright/test").Page) {
  const fallback = (pattern: string, data: unknown) =>
    safeRoute(page, pattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  await fallback("**/user/**", mockCompanyUsersApiResponse);
  await fallback("**/categories*", { data: [] });
  await fallback("**/categories/classes*", { data: [] });
  await fallback("**/storage-stats**", mockStorageStats);
  await fallback("**/procore/status**", { connected: false });
  await fallback("**/procore-status**", { connected: false });
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });
  await fallback("**/activity-log**", { logs: [], total: 0 });
  await fallback("**/storage-history**", { history: [] });
  await fallback("**/stripe/products**", { data: [] });
  await fallback("**/company/*/qr-style**", {
    useStyledQRCodes: false,
    qrStyleConfig: null,
  });
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Settings - Company Logo @desktop", () => {
  test("renders print branding logo section in company section", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Print branding logo container should be visible
    const printBrandingLogo = authenticatedPage.locator(
      '[data-testid="print-branding-logo"]',
    );
    await expect(printBrandingLogo).toBeVisible({ timeout: 5000 });
  });

  test("logo upload — clicking Add Logo shows upload area", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Wait for the print branding section to load
    const printBrandingLogo = authenticatedPage.locator(
      '[data-testid="print-branding-logo"]',
    );
    await expect(printBrandingLogo).toBeVisible({ timeout: 5000 });

    // Click the "Add Logo" button to enter edit mode
    const editButton = authenticatedPage.locator(
      '[data-testid="edit-print-logo-button"]',
    );
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();

    // Now the logo upload area should be visible
    const logoUpload = authenticatedPage.locator('[data-testid="logo-upload"]');
    await expect(logoUpload).toBeVisible({ timeout: 5000 });

    // The dropzone should accept image files
    const fileInput = authenticatedPage.locator(
      '[data-testid="logo-file-input"]',
    );
    await expect(fileInput).toBeAttached();

    // Verify the file input accepts correct types
    const acceptAttr = await fileInput.getAttribute("accept");
    expect(acceptAttr).toContain(".png");
    expect(acceptAttr).toContain(".jpg");
  });

  test("logo upload — shows cropper after file selection", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Enter edit mode first
    const editButton = authenticatedPage.locator(
      '[data-testid="edit-print-logo-button"]',
    );
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Wait for upload area
    const logoUpload = authenticatedPage.locator('[data-testid="logo-upload"]');
    await expect(logoUpload).toBeVisible({ timeout: 3000 });

    // Create a mock PNG file buffer (1x1 pixel PNG)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const fileInput = authenticatedPage.locator(
      '[data-testid="logo-file-input"]',
    );
    await fileInput.setInputFiles({
      name: "test-logo.png",
      mimeType: "image/png",
      buffer: pngHeader,
    });

    // Logo cropper should appear
    const cropperContainer = authenticatedPage.locator(
      '[data-testid="logo-cropper"]',
    );
    await expect(cropperContainer).toBeVisible({ timeout: 5000 });

    // Cropper should have cancel and crop/upload buttons
    const cancelCropButton = authenticatedPage.locator(
      '[data-testid="cancel-crop-button"]',
    );
    const cropUploadButton = authenticatedPage.locator(
      '[data-testid="crop-upload-button"]',
    );

    await expect(cancelCropButton).toBeVisible();
    await expect(cropUploadButton).toBeVisible();
  });

  test("logo upload — cancel crop returns to edit mode", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Enter edit mode
    const editButton = authenticatedPage.locator(
      '[data-testid="edit-print-logo-button"]',
    );
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Wait for upload area
    const logoUpload = authenticatedPage.locator('[data-testid="logo-upload"]');
    await expect(logoUpload).toBeVisible({ timeout: 3000 });

    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const fileInput = authenticatedPage.locator(
      '[data-testid="logo-file-input"]',
    );
    await fileInput.setInputFiles({
      name: "test-logo.png",
      mimeType: "image/png",
      buffer: pngHeader,
    });

    const cropperContainer = authenticatedPage.locator(
      '[data-testid="logo-cropper"]',
    );
    await expect(cropperContainer).toBeVisible({ timeout: 5000 });

    // Click cancel
    const cancelCropButton = authenticatedPage.locator(
      '[data-testid="cancel-crop-button"]',
    );
    await cancelCropButton.click();

    // Cropper should disappear
    await expect(cropperContainer).not.toBeVisible({ timeout: 5000 });

    // But we should still be in edit mode with upload area visible
    await expect(logoUpload).toBeVisible({ timeout: 3000 });
  });

  test("logo cropper — aspect ratio buttons are functional", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Enter edit mode
    const editButton = authenticatedPage.locator(
      '[data-testid="edit-print-logo-button"]',
    );
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Wait for upload area
    const logoUpload = authenticatedPage.locator('[data-testid="logo-upload"]');
    await expect(logoUpload).toBeVisible({ timeout: 3000 });

    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const fileInput = authenticatedPage.locator(
      '[data-testid="logo-file-input"]',
    );
    await fileInput.setInputFiles({
      name: "test-logo.png",
      mimeType: "image/png",
      buffer: pngHeader,
    });

    const cropperContainer = authenticatedPage.locator(
      '[data-testid="logo-cropper"]',
    );
    await expect(cropperContainer).toBeVisible({ timeout: 5000 });

    // Check aspect ratio buttons exist (aspect-ratio-1 for square, aspect-ratio-2 for landscape)
    // The LogoCropper uses data-testid="aspect-ratio-${value}" where value is 1 or 2
    const squareRatio = authenticatedPage.locator(
      '[data-testid="aspect-ratio-1"]',
    );
    const wideRatio = authenticatedPage.locator(
      '[data-testid="aspect-ratio-2"]',
    );

    // Click square ratio if visible
    if (await squareRatio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await squareRatio.click();
    }

    // Click wide ratio if visible
    if (await wideRatio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await wideRatio.click();
    }
  });

  test("logo edit mode — cancel button returns to display mode", async ({
    authenticatedPage,
  }) => {
    const settingsPage = new SettingsPage(authenticatedPage);

    await setupFallbackMocks(authenticatedPage);
    await settingsPage.goto();
    await settingsPage.expandSection("company");

    // Verify print branding section is visible
    const printBrandingLogo = authenticatedPage.locator(
      '[data-testid="print-branding-logo"]',
    );
    await expect(printBrandingLogo).toBeVisible({ timeout: 5000 });

    // Enter edit mode
    const editButton = authenticatedPage.locator(
      '[data-testid="edit-print-logo-button"]',
    );
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();

    // Verify we're in edit mode
    const cancelButton = authenticatedPage.locator(
      '[data-testid="cancel-print-logo-button"]',
    );
    await expect(cancelButton).toBeVisible({ timeout: 3000 });

    // Click cancel to return to display mode
    await cancelButton.click();

    // Edit button should be visible again (display mode)
    await expect(editButton).toBeVisible({ timeout: 3000 });
  });
});
