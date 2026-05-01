// DEPRECATED: Moved to e2e/tests/security/permissions.spec.ts
// This file is kept for reference only. Please use the consolidated file instead.
// DO NOT ADD NEW TESTS TO THIS FILE.

import { Page } from "@playwright/test";
import { test, expect, safeRoute } from "../../fixtures/verified-test";
import {
  mockAuthUser,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Set up an authenticated page with a specific permission level.
 * Replicates the authenticatedPage fixture but with configurable permissions.
 */
async function setupAuthenticatedUser(
  page: Page,
  permission: "admin" | "pm" | "user",
) {
  const user = { ...mockAuthUser, permission };

  await safeRoute(page, "**/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await safeRoute(page, "**/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: mockAuthTokens.accessToken }),
    });
  });

  await safeRoute(page, "**/company/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockAuthCompany),
    });
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await page.addInitScript(
    (data) => {
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("user", JSON.stringify(data.user));
      window.localStorage.setItem("company", JSON.stringify(data.company));
    },
    {
      accessToken: mockAuthTokens.accessToken,
      user,
      company: mockAuthCompany,
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Permission-Based UI @desktop", () => {
  test("PM user cannot see admin transfer button in settings", async ({
    page,
    routeTracker: _routeTracker,
  }) => {
    await setupAuthenticatedUser(page, "pm");

    // Mock settings page endpoints
    await safeRoute(page, "**/user/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ users: [], total: 0 }),
      });
    });
    await safeRoute(page, "**/categories*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/categories/classes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await safeRoute(page, "**/storage-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });
    await safeRoute(page, "**/storage-history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ history: [] }),
      });
    });
    await safeRoute(page, "**/stripe/products**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });
    await safeRoute(page, "**/procore/status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connected: false }),
      });
    });
    await safeRoute(page, "**/procore-status**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ connected: false }),
      });
    });
    await safeRoute(page, "**/procore-integration-details**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ owners: [], connectedUsers: [] }),
      });
    });

    await page.goto("/settings");

    // The "Transfer Admin Role" button should NOT be visible for PM users
    const transferBtn = page.locator(
      "text=Transfer Admin Role to Another User",
    );
    await expect(transferBtn).toBeHidden({ timeout: 5000 });
  });

  test("PM user does not see user management invite form", async ({ page }) => {
    await setupAuthenticatedUser(page, "pm");

    // Basic endpoint mocks
    await safeRoute(page, "**/*", async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/settings");

    // Users section with invite form should not be visible
    const usersSection = page.locator("#settings-section-users");
    const isVisible = await usersSection
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // For PM users, the section either doesn't render or lacks the invite form
    if (isVisible) {
      const inviteForm = page.locator('[data-testid="invite-user-form"]');
      await expect(inviteForm).toBeHidden({ timeout: 2000 });
    }
  });

  test("regular user does not see Create QR Code button on dashboard", async ({
    page,
    routeTracker: _routeTracker,
  }) => {
    await setupAuthenticatedUser(page, "user");

    // Mock dashboard endpoints
    await safeRoute(page, "**/aggregation/dashboard-stats**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalQRCodes: 5,
          totalScans: 10,
          totalFilesShared: 3,
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

    // Wait for dashboard to render
    await page.waitForTimeout(1000);

    // "Create QR Code" button should NOT be visible for regular users
    const createBtn = page.locator(
      'button:has-text("Create QR Code"), a:has-text("Create QR Code")',
    );
    const isVisible = await createBtn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("regular user does not see settings admin sections", async ({
    page,
  }) => {
    await setupAuthenticatedUser(page, "user");

    // Catch-all mock for API calls
    await safeRoute(page, "**/*", async (route) => {
      if (route.request().resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.goto("/settings");
    await page.waitForTimeout(1000);

    // Admin-only sections should not be visible for regular user
    const usersSection = page.locator("#settings-section-users");
    await expect(usersSection).toBeHidden({ timeout: 3000 });

    const integrationsSection = page.locator("#settings-section-integrations");
    await expect(integrationsSection).toBeHidden({ timeout: 3000 });
  });
});
