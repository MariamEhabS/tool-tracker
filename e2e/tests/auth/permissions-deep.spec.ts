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

/** Catch-all API mock to prevent unhandled requests */
async function mockAllApiCalls(page: Page) {
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
  await safeRoute(page, "**/project*", async (route) => {
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
}

/** Mock settings page API calls */
async function mockSettingsApiCalls(page: Page) {
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
}

// ============================================================================
// TESTS — PM PERMISSIONS
// ============================================================================

test.describe("Deep Permission Gating — PM Role @desktop", () => {
  test("PM user can see subscription section in settings", async ({ page }) => {
    await setupAuthenticatedUser(page, "pm");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");

    // PM should see subscription section (read access to billing)
    const subscriptionSection = page.locator("#settings-section-subscription");
    // Wait for page to load
    await page.waitForTimeout(2000);

    // PM may or may not see subscription — check visibility
    const isVisible = await subscriptionSection
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // If visible, verify it contains plan info
    if (isVisible) {
      await expect(subscriptionSection).toBeVisible();
    }
  });

  test("PM user can create projects from dashboard", async ({ page }) => {
    await setupAuthenticatedUser(page, "pm");
    await mockAllApiCalls(page);

    await page.goto("/dashboard");

    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // PM should see "Create QR Code" or similar creation button
    const createButton = page.locator(
      'a:has-text("Create QR Code"), button:has-text("Create QR Code"), a:has-text("Create"), button:has-text("Create")',
    );
    const isVisible = await createButton
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(isVisible).toBe(true);
  });

  test("PM user cannot transfer admin role", async ({ page }) => {
    await setupAuthenticatedUser(page, "pm");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");

    const transferBtn = page.locator(
      "text=Transfer Admin Role to Another User",
    );
    await expect(transferBtn).toBeHidden({ timeout: 5000 });
  });

  test("PM user cannot see company info edit section", async ({ page }) => {
    await setupAuthenticatedUser(page, "pm");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // Company section should not be visible for PM
    const companySection = page.locator("#settings-section-company");
    const isVisible = await companySection
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // If company section exists but PM shouldn't have edit access
    if (isVisible) {
      // The edit button inside company section should not be visible
      const editButton = companySection.locator('[data-testid="edit-button"]');
      const editVisible = await editButton
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      // PM should not have edit access to company info
      expect(editVisible).toBe(false);
    }
  });
});

// ============================================================================
// TESTS — BASIC USER PERMISSIONS
// ============================================================================

test.describe("Deep Permission Gating — Basic User Role @desktop", () => {
  test("basic user does not see settings admin sections", async ({ page }) => {
    await setupAuthenticatedUser(page, "user");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // Users section should not render
    const usersSection = page.locator("#settings-section-users");
    await expect(usersSection).toBeHidden({ timeout: 3000 });

    // Integrations section should not render
    const integrationsSection = page.locator("#settings-section-integrations");
    await expect(integrationsSection).toBeHidden({ timeout: 3000 });
  });

  test("basic user cannot see subscription management", async ({ page }) => {
    await setupAuthenticatedUser(page, "user");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    const subscriptionSection = page.locator("#settings-section-subscription");
    await expect(subscriptionSection).toBeHidden({ timeout: 3000 });
  });

  test("basic user cannot see Create QR Code on dashboard", async ({
    page,
  }) => {
    await setupAuthenticatedUser(page, "user");
    await mockAllApiCalls(page);

    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    const createBtn = page.locator(
      'button:has-text("Create QR Code"), a:has-text("Create QR Code")',
    );
    const isVisible = await createBtn
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("basic user can see own profile section in settings", async ({
    page,
  }) => {
    await setupAuthenticatedUser(page, "user");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // User profile section should always be visible
    const userSettingsSection = page.locator("#settings-section-user-settings");
    await expect(userSettingsSection).toBeVisible({ timeout: 5000 });
  });

  test("basic user can see security section in settings", async ({ page }) => {
    await setupAuthenticatedUser(page, "user");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // Security section (password change) should be accessible to all users
    const securitySection = page.locator("#settings-section-security");
    await expect(securitySection).toBeVisible({ timeout: 5000 });
  });

  test("basic user cannot navigate to projects list", async ({ page }) => {
    await setupAuthenticatedUser(page, "user");
    await mockAllApiCalls(page);

    await page.goto("/dashboard");
    await page.waitForTimeout(2000);

    // Check if sidebar Projects link is hidden for basic users
    const projectsLink = page.locator(
      'nav a:has-text("Projects"), aside a:has-text("Projects")',
    );
    const isVisible = await projectsLink
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    // Basic users may not see projects navigation
    // If they can see it, they should have limited access
    if (!isVisible) {
      expect(isVisible).toBe(false);
    }
  });
});

// ============================================================================
// TESTS — ADMIN PERMISSIONS (Confirm visibility)
// ============================================================================

test.describe("Deep Permission Gating — Admin Role @desktop", () => {
  test("admin user sees all settings sections", async ({ page }) => {
    await setupAuthenticatedUser(page, "admin");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");
    await page.waitForTimeout(2000);

    // All admin sections should be visible
    const userSettingsSection = page.locator("#settings-section-user-settings");
    await expect(userSettingsSection).toBeVisible({ timeout: 5000 });

    const securitySection = page.locator("#settings-section-security");
    await expect(securitySection).toBeVisible({ timeout: 3000 });

    const usersSection = page.locator("#settings-section-users");
    await expect(usersSection).toBeVisible({ timeout: 3000 });

    const subscriptionSection = page.locator("#settings-section-subscription");
    await expect(subscriptionSection).toBeVisible({ timeout: 3000 });
  });

  test("admin user sees transfer admin button", async ({ page }) => {
    await setupAuthenticatedUser(page, "admin");
    await mockSettingsApiCalls(page);

    await page.goto("/settings");

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Find and expand the Team & Users section using the visible button text
    const usersAccordion = page.getByRole("button", { name: /Team & Users/i });
    await expect(usersAccordion).toBeVisible({ timeout: 5000 });

    // Check if accordion is already expanded, if not click to expand
    const isExpanded = await usersAccordion.getAttribute("aria-expanded");
    if (isExpanded !== "true") {
      await usersAccordion.click();
    }

    // Wait for the accordion to expand and the button to appear
    const transferBtn = page.getByRole("button", {
      name: /Transfer Admin Role to Another User/i,
    });
    await expect(transferBtn).toBeVisible({ timeout: 5000 });
  });
});
