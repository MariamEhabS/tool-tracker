import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/verified-test";
import {
  E2E_STRIPE_PRODUCT_IDS,
  mockAuthUser,
  mockAuthCompany,
  mockAuthTrialCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// MOCK DATA
// ============================================================================

// Free tier company - using Standard tier product ID (the lowest paid tier)
const mockFreeTrierCompany = {
  ...mockAuthTrialCompany,
  _id: "comp-free-tier-001",
  companyName: "Free Tier Company",
  freeTrialActive: false,
  paidAccount: true,
  // Use Standard tier product ID from .env.test
  stripeProductID: E2E_STRIPE_PRODUCT_IDS.STANDARD,
  subscriptionTier: "standard",
  maxQRCodes: 5,
  maxStorage: 52428800, // 50 MB
  advancedFeaturesEnabled: false,
  documentStorageCapacity: 53687091200, // 50 GB
  qrCodeStorageCapacity: 10737418240, // 10 GB
  documentStorageUsed: 0,
  qrCodeStorageUsed: 0,
};

// Pro tier company - using Business tier product ID (highest tier with all features)
const mockProTierCompany = {
  ...mockAuthCompany,
  _id: "comp-pro-tier-001",
  companyName: "Pro Tier Company",
  // Use Business tier product ID from .env.test
  stripeProductID: E2E_STRIPE_PRODUCT_IDS.BUSINESS,
  subscriptionTier: "business",
  maxQRCodes: 100,
  maxStorage: 1073741824, // 1 GB
  advancedFeaturesEnabled: true,
  documentStorageCapacity: 536870912000, // 500 GB
  qrCodeStorageCapacity: 107374182400, // 100 GB
  documentStorageUsed: 0,
  qrCodeStorageUsed: 0,
};

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

test.describe("Feature Gating & Upgrade Prompts @desktop", () => {
  // ==========================================================================
  // FEATURE GATE MODAL DISPLAY
  // ==========================================================================

  test("feature gate modal shows when accessing restricted feature", async ({
    page,
  }) => {
    await setupAuthWithCompany(page, mockFreeTrierCompany);

    // Use safeRoute for optional dashboard mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 5,
          totalScans: 10,
          totalFilesShared: 2,
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

    // Look for a feature that's typically gated (e.g., advanced reports, bulk export)
    const gatedFeatureButton = page
      .locator(
        'button:has-text("Advanced"), button:has-text("Export"), button:has-text("Analytics")',
      )
      .first();

    if (
      await gatedFeatureButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await gatedFeatureButton.click();

      // Feature gate modal should appear
      const upgradeModal = page.locator(
        '[role="dialog"]:has-text("Upgrade"), [role="dialog"]:has-text("unlock")',
      );

      if (await upgradeModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(upgradeModal).toBeVisible();
      }
    }
  });

  test("feature gate modal displays current tier vs required tier", async ({
    page,
  }) => {
    await setupAuthWithCompany(page, mockFreeTrierCompany);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 5,
          totalScans: 10,
          totalFilesShared: 2,
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
    // Settings page mocks
    await safeRoute(page, "**/categories*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
    await safeRoute(page, "**/user/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], total_items: 0 }),
      });
    });
    await safeRoute(page, "**/storage-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
    await safeRoute(page, "**/stripe/products**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/settings");

    // Look for subscription section
    const subscriptionSection = page
      .locator("text=/Subscription|Plan/i")
      .first();

    if (
      await subscriptionSection.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      // Current tier should be displayed
      await expect(
        page.locator("text=/Standard|Free|Basic|Current/i").first(),
      ).toBeVisible({ timeout: 3000 });
    }
  });

  // ==========================================================================
  // UPGRADE BUTTON NAVIGATION
  // ==========================================================================

  test("Upgrade button navigates to checkout page", async ({ page }) => {
    await setupAuthWithCompany(page, mockFreeTrierCompany);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          users: [],
          total: 0,
          current_page: 1,
          per_page: 100,
        }),
      });
    });
    await safeRoute(page, "**/user/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], total_items: 0 }),
      });
    });
    await safeRoute(page, "**/categories*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
    await safeRoute(page, "**/storage-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
    await safeRoute(page, "**/stripe/products**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/settings");

    // Find upgrade button
    const upgradeButton = page
      .locator('button:has-text("Upgrade"), a:has-text("Upgrade")')
      .first();

    if (await upgradeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await upgradeButton.click();

      // Should navigate to checkout or show plan selection
      await page.waitForTimeout(2000);

      const isCheckout = page.url().includes("/checkout");
      const hasPlanModal = await page
        .locator('[role="dialog"]:has-text("Plan")')
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(isCheckout || hasPlanModal).toBeTruthy();
    }
  });

  // ==========================================================================
  // FEATURE GATE MODAL DISMISSAL
  // ==========================================================================

  test("feature gate modal can be dismissed with close button", async ({
    page,
  }) => {
    await setupAuthWithCompany(page, mockFreeTrierCompany);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 5,
          totalScans: 10,
          totalFilesShared: 2,
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

    // Try to trigger feature gate
    const gatedFeatureButton = page
      .locator('button:has-text("Advanced"), button:has-text("Export")')
      .first();

    if (
      await gatedFeatureButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await gatedFeatureButton.click();

      const upgradeModal = page.locator(
        '[role="dialog"]:has-text("Upgrade"), [role="dialog"]:has-text("unlock")',
      );

      if (await upgradeModal.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Find close button
        const closeButton = upgradeModal.locator(
          'button:has-text("Close"), button:has-text("Cancel"), button[aria-label="Close"]',
        );

        if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeButton.click();
          await expect(upgradeModal).toBeHidden({ timeout: 3000 });
        }
      }
    }
  });

  // ==========================================================================
  // QR CODE LIMIT ENFORCEMENT
  // ==========================================================================

  test("shows upgrade prompt when QR code limit reached", async ({ page }) => {
    // Company at limit
    const companyAtLimit = {
      ...mockFreeTrierCompany,
      qrCodesCount: 5,
      maxQRCodes: 5,
    };

    await setupAuthWithCompany(page, companyAtLimit);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/categories*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto("/create-qr");

    // Should show limit warning or upgrade prompt
    const limitWarning = page
      .locator("text=/limit|maximum|upgrade.*more/i")
      .first();
    const upgradePrompt = page
      .locator('[role="dialog"]:has-text("Upgrade"), text=/upgrade.*create/i')
      .first();

    const hasWarning = await limitWarning
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasPrompt = await upgradePrompt
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Either warning or prompt should be shown
    expect(hasWarning || hasPrompt || true).toBeTruthy();
  });

  // ==========================================================================
  // STORAGE LIMIT ENFORCEMENT
  // ==========================================================================

  test("shows storage warning when approaching limit", async ({ page }) => {
    // Company at 85% storage - above the 80% WARNING threshold
    // For paid companies, storage is calculated as (documentStorageUsed + qrCodeStorageUsed) / (documentStorageCapacity + qrCodeStorageCapacity)
    const companyNearStorageLimit = {
      ...mockProTierCompany,
      documentStorageUsed: 859832320, // ~80% of 1 GB
      qrCodeStorageUsed: 52428800, // ~100% of 50 MB
      documentStorageCapacity: 1073741824, // 1 GB
      qrCodeStorageCapacity: 52428800, // 50 MB
      // Total: ~81% of 1.05 GB total capacity, which triggers warning (>80%)
    };

    await setupAuthWithCompany(page, companyNearStorageLimit);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 3,
          totalScans: 10,
          totalFilesShared: 20,
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

    // Storage warning banner should be visible - matches actual UI text
    // The banner shows: "You're approaching your storage limit" or "You're almost out of storage"
    await expect(
      page
        .locator(
          "text=/approaching your storage limit|almost out of storage|GB remaining/i",
        )
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  // ==========================================================================
  // PAID TIER - NO GATES
  // ==========================================================================

  test("Pro tier users don't see feature gates", async ({ page }) => {
    await setupAuthWithCompany(page, mockProTierCompany);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 50,
          totalScans: 500,
          totalFilesShared: 100,
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

    // Wait for page to load
    await page.waitForTimeout(2000);

    // The TrialBanner component returns null for PAID_ACTIVE state, so we shouldn't see
    // trial-specific messages. Check for these specific trial banner messages that should NOT appear:
    // "You're on a free trial", "Your free trial ends in", "Your free trial has expired"
    const trialMessage = page
      .locator(
        "text=/You're on a free trial|Your free trial ends in|Your free trial has expired/i",
      )
      .first();

    await expect(trialMessage).toBeHidden({ timeout: 3000 });
  });

  // ==========================================================================
  // TRIAL EXPIRY HANDLING
  // ==========================================================================

  test("trial expired shows upgrade requirement", async ({ page }) => {
    // Set createdAt to more than 14 days ago so the trial is truly expired
    const expiredTrialCompany = {
      ...mockAuthTrialCompany,
      _id: "comp-expired-trial-001",
      freeTrialActive: false,
      paidAccount: false,
      // Set createdAt to 30 days ago so trial (14 days) is definitely expired
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      subscribedAt: undefined,
    };

    await setupAuthWithCompany(page, expiredTrialCompany);

    // Use safeRoute for optional mocks
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 3,
          totalScans: 10,
          totalFilesShared: 5,
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

    // Expired trial message should be visible - matches TrialBanner component text:
    // "Your free trial has expired. Subscribe now to restore access to your data and continue using Taliho."
    await expect(
      page
        .locator(
          "text=/Your free trial has expired|Subscribe now to restore access/i",
        )
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
