/**
 * Real Backend E2E Tests - QR Code CRUD Operations
 *
 * These tests run against a real backend server.
 * Prerequisites:
 *   1. Backend running at VITE_BACKEND_URL
 *   2. Test data seeded (project exists)
 *   3. .env.test configured with E2E_TEST_PROJECT_ID
 */

import {
  test,
  expect,
  createCleanupFn,
} from "../../fixtures/real-backend-test";
import { getBackendUrl } from "../../utils/runtime-env";

const BACKEND_URL = getBackendUrl();

test.describe("QR Code CRUD - Real Backend", () => {
  // Skip all tests gracefully if backend is not available
  test.beforeAll(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${BACKEND_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        test.skip(true, `Backend not available (status: ${response.status})`);
      }
    } catch (error) {
      test.skip(
        true,
        `Backend not reachable at ${BACKEND_URL}: ${error instanceof Error ? error.message : "connection failed"}`,
      );
    }
  });
  test("can view QR codes list", async ({ authenticatedPage }) => {
    // QR codes list route is "/my-qrcodes"
    await authenticatedPage.goto("/my-qrcodes");

    // Page should load without errors
    await expect(authenticatedPage).toHaveURL(/my-qrcodes/);

    // Wait for data to load
    await authenticatedPage.waitForLoadState("networkidle");

    // Should see either QR codes or empty state
    const hasQRCodes = await authenticatedPage
      .locator("table, [data-testid='qr-list']")
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    const hasEmptyState = await authenticatedPage
      .locator("text=/no qr codes|create your first|get started/i")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasQRCodes || hasEmptyState).toBeTruthy();
  });

  test("can create a new QR code", async ({
    authenticatedPage,
    apiClient,
    authTokens,
  }) => {
    const cleanup = createCleanupFn(apiClient);
    const user = authTokens.user as { companyId?: string; companyID?: string };
    const companyId = user.companyId || user.companyID || "";
    const testQRName = `E2E Test QR ${Date.now()}`;

    try {
      await authenticatedPage.goto("/create-qr");
      await authenticatedPage.waitForLoadState("networkidle");
      await expect(
        authenticatedPage.getByRole("heading", { name: /Create QR Codes/i }),
      ).toBeVisible({ timeout: 10000 });

      await authenticatedPage
        .getByText("Create a Single QR Code", { exact: true })
        .click();
      await expect(
        authenticatedPage.getByText("Taliho", { exact: true }),
      ).toBeVisible({
        timeout: 10000,
      });

      await authenticatedPage
        .getByText("Taliho QR Code", { exact: true })
        .click();

      const nameInput = authenticatedPage
        .locator(
          'input[placeholder*="Enter name" i], input[placeholder*="search" i]',
        )
        .first();
      await nameInput.waitFor({ state: "visible", timeout: 10000 });
      await nameInput.fill(testQRName);

      const createButton = authenticatedPage.getByRole("button", {
        name: /Create & Populate/i,
      });
      const createResponsePromise = authenticatedPage.waitForResponse(
        (response) =>
          response.url().includes("/qr-code") &&
          response.request().method() === "POST" &&
          response.ok(),
      );

      await createButton.click();

      const createResponse = await createResponsePromise;
      const createPayload = (await createResponse.json()) as {
        _id?: string;
        data?: { _id?: string };
      };
      const qrCodeId = createPayload.data?._id || createPayload._id;
      if (qrCodeId && companyId) {
        cleanup.track("qrCode", qrCodeId, { companyId });
      }

      await expect(authenticatedPage).toHaveURL(/\/qrcode\/.+/, {
        timeout: 15000,
      });
      await expect(
        authenticatedPage.getByRole("heading", { name: testQRName }),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await cleanup.cleanup();
    }
  });

  test("can view QR code details", async ({ authenticatedPage }) => {
    const qrCodeId = process.env.E2E_TEST_QR_CODE_ID;

    if (!qrCodeId) {
      test.skip(
        !qrCodeId,
        "E2E_TEST_QR_CODE_ID not configured - run seed script",
      );
      return;
    }

    await authenticatedPage.goto(`/qrcode/${qrCodeId}`);

    // Wait for page to load
    await authenticatedPage.waitForLoadState("networkidle");

    // Should show QR code details
    await expect(
      authenticatedPage.locator("text=/qr code|details|scan/i").first(),
    ).toBeVisible({ timeout: 10000 });

    // QR code image should be visible
    const qrImage = authenticatedPage.locator("img[alt*='QR'], canvas, svg");
    await expect(qrImage.first()).toBeVisible({ timeout: 10000 });
  });

  test("can delete a QR code", async ({
    authenticatedPage,
    apiClient,
    authTokens,
  }) => {
    const cleanup = createCleanupFn(apiClient);
    const user = authTokens.user as { companyId?: string; companyID?: string };
    const companyId = user.companyId || user.companyID || "";
    if (!companyId) {
      test.skip(true, "Authenticated test user is missing company information");
      return;
    }

    const testQRName = `E2E Delete Test ${Date.now()}`;
    const createResult = (await apiClient.createQRCode({
      companyId,
      name: testQRName,
      type: "folder",
    })) as { _id?: string; data?: { _id?: string } };

    const qrCodeId = createResult.data?._id || createResult._id;
    if (!qrCodeId) {
      throw new Error("Failed to create test QR code");
    }
    cleanup.track("qrCode", qrCodeId, { companyId });

    let deleted = false;
    try {
      await authenticatedPage.goto(`/qrcode/${qrCodeId}`);
      await authenticatedPage.waitForLoadState("networkidle");
      await expect(
        authenticatedPage.getByRole("heading", { name: testQRName }),
      ).toBeVisible({ timeout: 10000 });

      await authenticatedPage
        .getByRole("button", { name: /Delete/i })
        .first()
        .click();

      const dialog = authenticatedPage.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole("button", { name: /Delete/i }).click();

      await expect(authenticatedPage).toHaveURL(/my-qrcodes/, {
        timeout: 15000,
      });

      await authenticatedPage.goto(`/qrcode/${qrCodeId}`);
      await expect(
        authenticatedPage.getByRole("heading", { name: /QR Code Not Found/i }),
      ).toBeVisible({ timeout: 10000 });
      deleted = true;
    } finally {
      if (!deleted) {
        await cleanup.cleanup();
      }
    }
  });
});
