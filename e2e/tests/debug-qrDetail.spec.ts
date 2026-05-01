import { test, expect } from "../fixtures/authenticated-test";
import { safeRoute } from "../utils/route-tracker";

const qrCodeId = "qr-debug-001";

const mockQRCodeSingle = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Debug Test QR",
    company: "comp-test-001",
    project: "proj-001",
    projectName: "Debug Project",
  },
};

const mockScannedQR = {
  data: {
    _id: qrCodeId,
    qrcodeName: "Debug Test QR",
    type: "folder",
    project: {
      _id: "proj-001",
      projectName: "Debug Project",
    },
    company: {
      _id: "comp-test-001",
      editProcoreItemsAllowed: true,
    },
  },
  procoreTools: [],
  folders: [],
  documents: [],
};

const mockQrProcoreTools = {
  procoreTools: [],
  qrType: "folder",
  procoreCategory: null,
};

test("debug QR detail page loading @desktop", async ({ authenticatedPage }) => {
  let qrDetailCalled = false;
  let scannedCalled = false;

  // Keep this test resilient to optional background requests by using safeRoute
  // and asserting visible UI state instead of strict per-route call counts.
  await safeRoute(
    authenticatedPage,
    `**/qr-code/${qrCodeId}**`,
    async (route) => {
      qrDetailCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockQRCodeSingle),
      });
    },
  );
  await safeRoute(
    authenticatedPage,
    `**/qr-code/scanned/${qrCodeId}**`,
    async (route) => {
      scannedCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScannedQR),
      });
    },
  );
  await safeRoute(
    authenticatedPage,
    `**/qr-code/${qrCodeId}/procore-tools**`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockQrProcoreTools),
      });
    },
  );

  // Also mock the QR image endpoint that might be called
  await safeRoute(
    authenticatedPage,
    `**/qr-code/image/${qrCodeId}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedUrl: null, exists: false }),
      });
    },
  );

  await authenticatedPage.goto(`/qrcode/${qrCodeId}`);
  await authenticatedPage.waitForLoadState("networkidle");
  await expect(authenticatedPage).toHaveURL(new RegExp(`/qrcode/${qrCodeId}`));
  await expect(authenticatedPage.getByText("Debug Test QR")).toBeVisible();
  await expect
    .poll(() => qrDetailCalled || scannedCalled, { timeout: 10000 })
    .toBe(true);
});
