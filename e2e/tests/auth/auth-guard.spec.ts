import { test, expect, safeRoute } from "../../fixtures/verified-test";
import {
  mockAuthUser,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";

// ============================================================================
// AUTH GUARD — Unauthenticated Redirect & Token Refresh
// ============================================================================

test.describe("Auth Guard", () => {
  test("unauthenticated user visiting /dashboard is redirected to login", async ({
    page,
  }) => {
    // Do NOT inject any auth state — visit protected route directly
    await page.goto("/dashboard");

    // Should redirect to the login page (root "/")
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/);

    // Login heading or sign-in button should be visible
    await expect(
      page.locator("text=/Sign In|Log In|Welcome back/i").first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user visiting /my-qrcodes is redirected to login", async ({
    page,
  }) => {
    await page.goto("/my-qrcodes");

    // Should redirect to login
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/);
  });

  test("authenticated user stays on /dashboard", async ({
    page,
    routeTracker: _routeTracker,
  }) => {
    // Set up auth mocks
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
    await safeRoute(page, "**/company/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthCompany),
      });
    });

    // Inject auth localStorage
    await page.addInitScript(
      (data) => {
        window.localStorage.setItem("accessToken", data.accessToken);
        window.localStorage.setItem("user", JSON.stringify(data.user));
        window.localStorage.setItem("company", JSON.stringify(data.company));
      },
      {
        accessToken: mockAuthTokens.accessToken,
        user: mockAuthUser,
        company: mockAuthCompany,
      },
    );

    await page.setViewportSize({ width: 1280, height: 720 });

    // Mock dashboard-specific endpoints (untracked — this test only verifies
    // the user stays on /dashboard, not that specific API calls are made).
    // safeRoute() prevents broad patterns from intercepting Vite source files.
    const mockData = async (pattern: string, data: unknown) =>
      safeRoute(page, pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(data),
        }),
      );
    await mockData("**/company/*/dashboard-stats**", {
      data: { qrCodesCount: 10, qrScansCount: 50, documentsCount: 25 },
    });
    await mockData("**/qr-code*", {
      data: [],
      total_items: 0,
      has_next: false,
      has_prev: false,
    });
    await mockData("**/aggregation/all-projects/**", []);
    await mockData("**/groups*", {
      data: [],
      total_items: 0,
      has_next: false,
      has_prev: false,
    });

    // Wait for route handlers to be fully registered before navigation
    await page.waitForTimeout(50);

    await page.goto("/dashboard");

    // Should stay on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("expired token with failed refresh redirects to login", async ({
    page,
  }) => {
    // Set up auth/me to return 401 (expired)
    await safeRoute(page, "**/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    });

    // Refresh also fails
    await safeRoute(page, "**/auth/refresh", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Refresh token expired" }),
      });
    });

    // All other API calls return 401 so the interceptor triggers refresh.
    // safeRoute() skips Vite source file requests that match broad patterns.
    for (const pattern of [
      "**/company/**",
      "**/qr-code*",
      "**/aggregation/**",
      "**/groups*",
    ]) {
      await safeRoute(page, pattern, async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Unauthorized" }),
        });
      });
    }

    // Inject stale auth state with one-shot guard — addInitScript persists
    // across navigations, so without this guard the tokens would be
    // re-injected after the 401 interceptor clears them and redirects.
    // Include companyId so the dashboard actually makes API calls
    // (useDashboardStats has `enabled: Boolean(companyId)`).
    await page.addInitScript(() => {
      if (!window.localStorage.getItem("__auth_injected")) {
        window.localStorage.setItem("__auth_injected", "1");
        window.localStorage.setItem("accessToken", "expired-token");
        window.localStorage.setItem(
          "user",
          JSON.stringify({ _id: "x", permission: "admin", companyId: "x" }),
        );
        window.localStorage.setItem(
          "company",
          JSON.stringify({ _id: "x", companyName: "X" }),
        );
      }
    });

    // Wait for route handlers and init scripts to be fully registered
    await page.waitForTimeout(50);

    await page.goto("/dashboard");

    // Should eventually redirect to login
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
      timeout: 10000,
    });
  });
});
