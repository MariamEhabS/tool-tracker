import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/verified-test";
import {
  mockAuthUser,
  mockAuthCompany,
  mockAuthTrialCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Helper to set up fallback route mocks for pages to load without hanging.
 * These mocks return minimal valid responses so navigation doesn't timeout.
 */
async function setupPageFallbacks(page: Page) {
  const fallback = (pattern: string, data: unknown = {}) =>
    safeRoute(page, pattern, async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

  // Dashboard routes
  await fallback("**/aggregation/dashboard-stats**", {
    totalQRCodes: 0,
    totalScans: 0,
    totalFilesShared: 0,
  });
  await fallback("**/company/*/dashboard-stats**", {
    totalQRCodes: 0,
    totalScans: 0,
    totalFilesShared: 0,
  });

  // QR Code routes
  await fallback("**/qr-code*", {
    data: [],
    total_items: 0,
    has_next: false,
    has_prev: false,
  });

  // Groups routes
  await fallback("**/groups*", {
    data: [],
    total_items: 0,
    has_next: false,
    has_prev: false,
  });

  // Project routes
  await fallback("**/aggregation/all-projects/**", []);

  // Categories
  await fallback("**/categories*", { data: [] });
  await fallback("**/categories/classes*", []);

  // Users
  await fallback("**/user/**", { data: [], total_items: 0 });
  await fallback("**/company/users**", {
    users: [],
    total: 0,
    current_page: 1,
    per_page: 100,
  });

  // Storage
  await fallback("**/storage-stats**", {});
  await fallback("**/storage-history**", { history: [] });

  // Procore
  await fallback("**/procore/status**", { connected: false });
  await fallback("**/procore-status**", { connected: false });
  await fallback("**/procore-integration-details**", {
    owners: [],
    connectedUsers: [],
  });

  // Stripe
  await fallback("**/stripe/products**", { data: [] });
}

async function setupAuthWithCompany(
  page: Page,
  company: typeof mockAuthCompany | typeof mockAuthTrialCompany,
) {
  // Set up auth routes
  await safeRoute(page, "**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockAuthUser),
    });
  });

  await safeRoute(page, "**/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: mockAuthTokens.accessToken }),
    });
  });

  // Company route - use regex to match company ID patterns
  await page.route(
    /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(company),
      });
    },
  );

  // Set up fallback routes for pages to load
  await setupPageFallbacks(page);

  await page.setViewportSize({ width: 1280, height: 720 });

  await page.addInitScript(
    (data) => {
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("user", JSON.stringify(data.user));
      window.localStorage.setItem("company", JSON.stringify(data.company));
    },
    {
      accessToken: mockAuthTokens.accessToken,
      user: mockAuthUser,
      company,
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Trial & Storage Banners @desktop", () => {
  test("trial account shows upgrade banner on dashboard", async ({ page }) => {
    await setupAuthWithCompany(page, mockAuthTrialCompany);

    // Mock dashboard data
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 2,
          totalScans: 5,
          totalFilesShared: 1,
        }),
      });
    });
    await safeRoute(page, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });
    await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/groups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    await page.goto("/dashboard");

    // Trial banner should be visible with upgrade CTA
    await expect(
      page.locator("text=/free trial|trial|upgrade|subscribe/i").first(),
    ).toBeVisible({ timeout: 5000 });

    // Upgrade button should be present
    await expect(
      page
        .locator(
          'button:has-text("Upgrade"), a:has-text("Upgrade"), button:has-text("Subscribe")',
        )
        .first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test("paid account does not show trial banner", async ({ page }) => {
    await setupAuthWithCompany(page, mockAuthCompany);

    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 25,
          totalScans: 100,
          totalFilesShared: 50,
        }),
      });
    });
    await safeRoute(page, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });
    await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/groups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    await page.goto("/dashboard");

    // Wait for dashboard to load
    await page.waitForTimeout(1000);

    // Trial banner should NOT be visible - check for specific trial banner messages
    // The TrialBanner component shows these messages based on subscription state:
    // - "You're on a free trial" (TRIAL_ACTIVE)
    // - "Your free trial ends in" (TRIAL_EXPIRING)
    // - "Your free trial has expired" (TRIAL_EXPIRED)
    const trialBanner = page.locator(
      "text=/You're on a free trial|Your free trial ends in|Your free trial has expired/i",
    );
    await expect(trialBanner.first()).toBeHidden({ timeout: 3000 });
  });

  test("storage warning banner appears when near capacity", async ({
    page,
  }) => {
    // Create a company that's at 95% storage capacity
    // The storage warning threshold is 80%, critical is 90%
    const nearCapacityCompany = {
      ...mockAuthCompany,
      documentStorageUsed: 1020054733, // ~95% of 1073741824 (1 GB)
      documentStorageCapacity: 1073741824,
      qrCodeStorageUsed: 49807360, // ~95% of 52428800 (50 MB)
      qrCodeStorageCapacity: 52428800,
    };

    await setupAuthWithCompany(page, nearCapacityCompany);

    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 25,
          totalScans: 100,
          totalFilesShared: 50,
        }),
      });
    });
    await safeRoute(page, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });
    await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/groups*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          total_items: 0,
          has_next: false,
          has_prev: false,
        }),
      });
    });

    await page.goto("/dashboard");

    // Storage warning banner should be visible - matches actual UI text from StorageWarningBanner.tsx
    // The banner shows: "You're approaching your storage limit" (warning) or "You're almost out of storage" (critical)
    await expect(
      page
        .locator(
          "text=/approaching your storage limit|almost out of storage|GB remaining/i",
        )
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
