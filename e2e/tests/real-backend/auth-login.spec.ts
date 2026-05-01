/**
 * Real Backend E2E Tests - Authentication Login Flow
 *
 * These tests run against a real backend server.
 * Prerequisites:
 *   1. Backend running at VITE_BACKEND_URL
 *   2. Test user exists (run seed script)
 *   3. .env.test configured
 */

import { test, expect } from "../../fixtures/real-backend-test";
import { getBackendUrl } from "../../utils/runtime-env";

const BACKEND_URL = getBackendUrl();

test.describe("Authentication - Real Backend", () => {
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
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  });

  test("can login with valid credentials", async ({ page, testUser }) => {
    // Login page is at "/" (root), not "/login"
    await page.goto("/");

    // Fill in login form
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill(testUser.password);

    // Submit
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard|home/, { timeout: 15000 });

    // User should be authenticated
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("accessToken"),
    );
    expect(accessToken).toBeTruthy();
  });

  test("shows error for invalid credentials", async ({ page, testUser }) => {
    // Login page is at "/" (root), not "/login"
    await page.goto("/");

    // Fill in login form with wrong password
    await page.getByLabel(/email/i).fill(testUser.email);
    await page.getByLabel(/password/i).fill("wrongpassword123");

    // Submit
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Error message should appear
    await expect(
      page.locator("text=/invalid|incorrect|failed|error/i").first(),
    ).toBeVisible({ timeout: 10000 });

    // Should stay on login page (root)
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test("redirects authenticated user away from login page", async ({
    authenticatedPage,
  }) => {
    // Navigate to login page (root) while authenticated
    await authenticatedPage.goto("/");

    // Should redirect to dashboard (authenticated users get redirected from login)
    await expect(authenticatedPage).toHaveURL(/dashboard|logged|home/, {
      timeout: 10000,
    });
  });

  test("can logout successfully", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard");

    // Wait for page to load
    await authenticatedPage.waitForLoadState("networkidle");

    // Find and click logout (may be in a menu)
    const userMenu = authenticatedPage.locator(
      '[data-testid="user-menu"], button:has-text("Account"), [aria-label="User menu"]',
    );

    if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenu.click();
    }

    const logoutButton = authenticatedPage.getByRole("button", {
      name: /log out|logout|sign out/i,
    });

    if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutButton.click();

      // Should redirect to login
      await expect(authenticatedPage).toHaveURL(/login/, { timeout: 10000 });

      // Token should be cleared
      const accessToken = await authenticatedPage.evaluate(() =>
        window.localStorage.getItem("accessToken"),
      );
      expect(accessToken).toBeFalsy();
    }
  });
});
