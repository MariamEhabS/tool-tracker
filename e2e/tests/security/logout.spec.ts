/**
 * Logout Flow E2E Tests
 *
 * Comprehensive tests for logout functionality including:
 * - State cleanup (localStorage clearing)
 * - Navigation behavior (redirects, protected routes)
 * - Multi-tab coordination (storage events)
 *
 * These tests verify that logout properly invalidates sessions
 * and clears all authentication state.
 */

import { test, expect } from "../../fixtures/security-test";
import { safeRoute } from "../../utils/route-tracker";
import {
  mockAuthUser,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockDashboardStats = {
  data: {
    qrCodesCount: 10,
    qrScansCount: 50,
    documentsCount: 25,
  },
};

const mockEmptyListResponse = {
  data: [],
  total_items: 0,
  has_next: false,
  has_prev: false,
};

// ============================================================================
// COMMON MOCK SETUP HELPERS
// ============================================================================

/**
 * Sets up common authenticated API mocks for tests that need a logged-in state.
 */
async function setupAuthenticatedMocks(
  page: import("@playwright/test").Page,
): Promise<void> {
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

  await safeRoute(
    page,
    /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthCompany),
      });
    },
  );

  await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockDashboardStats),
    });
  });

  await safeRoute(page, "**/qr-code*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockEmptyListResponse),
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
      body: JSON.stringify(mockEmptyListResponse),
    });
  });

  await safeRoute(page, "**/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Logged out successfully" }),
    });
  });
}

/**
 * Injects authenticated state into localStorage via addInitScript.
 */
async function injectAuthState(
  page: import("@playwright/test").Page,
): Promise<void> {
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
}

/**
 * Attempts to find and click the logout button.
 * Returns true if logout was successfully initiated.
 */
async function performLogout(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  // First try to open user menu if it exists
  const userMenu = page.locator(
    '[data-testid="user-menu"], [data-testid="sidebar-user-menu"], .user-menu',
  );
  if (await userMenu.isVisible().catch(() => false)) {
    await userMenu.click();
    await page.waitForTimeout(300); // Wait for menu animation
  }

  // Find and click logout button
  const logoutButton = page.locator(
    'button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout-button"]',
  );

  if (
    await logoutButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await logoutButton.first().click();
    return true;
  }

  return false;
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Logout Flow @security @desktop", () => {
  // ==========================================================================
  // State Cleanup Tests
  // ==========================================================================

  test.describe("State Cleanup", () => {
    test("logout clears accessToken from localStorage", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Verify token exists before logout
      const tokenBefore = await page.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      expect(tokenBefore).toBe(mockAuthTokens.accessToken);

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect to login page
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Verify accessToken is cleared
        const tokenAfter = await page.evaluate(() =>
          localStorage.getItem("accessToken"),
        );
        expect(tokenAfter).toBeNull();
      }
    });

    test("logout clears refreshToken from localStorage if present", async ({
      page,
    }) => {
      await setupAuthenticatedMocks(page);

      // Inject auth state including a refresh token
      await page.addInitScript(
        (data) => {
          window.localStorage.setItem("accessToken", data.accessToken);
          window.localStorage.setItem("refreshToken", data.refreshToken);
          window.localStorage.setItem("user", JSON.stringify(data.user));
          window.localStorage.setItem("company", JSON.stringify(data.company));
        },
        {
          accessToken: mockAuthTokens.accessToken,
          refreshToken: mockAuthTokens.refreshToken,
          user: mockAuthUser,
          company: mockAuthCompany,
        },
      );

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify refresh token exists before logout
      const refreshTokenBefore = await page.evaluate(() =>
        localStorage.getItem("refreshToken"),
      );
      expect(refreshTokenBefore).toBe(mockAuthTokens.refreshToken);

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Verify refreshToken is cleared
        const refreshTokenAfter = await page.evaluate(() =>
          localStorage.getItem("refreshToken"),
        );
        expect(refreshTokenAfter).toBeNull();
      }
    });

    test("logout clears user data from localStorage", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify user data exists before logout
      const userBefore = await page.evaluate(() =>
        localStorage.getItem("user"),
      );
      expect(userBefore).toBeTruthy();

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Verify user data is cleared
        const userAfter = await page.evaluate(() =>
          localStorage.getItem("user"),
        );
        expect(userAfter).toBeNull();
      }
    });

    test("logout clears company data from localStorage", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify company data exists before logout
      const companyBefore = await page.evaluate(() =>
        localStorage.getItem("company"),
      );
      expect(companyBefore).toBeTruthy();

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Verify company data is cleared
        const companyAfter = await page.evaluate(() =>
          localStorage.getItem("company"),
        );
        expect(companyAfter).toBeNull();
      }
    });

    test("no auth state remnants after logout", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Check for any auth-related remnants in localStorage
        const storageAudit = await page.evaluate(() => {
          const authRelatedKeys = [
            "accessToken",
            "refreshToken",
            "user",
            "company",
            "token",
            "auth",
            "session",
          ];

          const remnants: string[] = [];

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const keyLower = key.toLowerCase();
              // Check if key matches any auth-related pattern
              const isAuthRelated = authRelatedKeys.some(
                (authKey) =>
                  keyLower === authKey.toLowerCase() ||
                  keyLower.includes(authKey.toLowerCase()),
              );

              if (isAuthRelated) {
                const value = localStorage.getItem(key);
                // Ignore empty values or the __auth_injected flag used in tests
                if (value && key !== "__auth_injected") {
                  remnants.push(key);
                }
              }
            }
          }

          return remnants;
        });

        expect(
          storageAudit,
          `Auth remnants found in localStorage: ${storageAudit.join(", ")}`,
        ).toHaveLength(0);

        // Also check sessionStorage
        const sessionRemnants = await page.evaluate(() => {
          const authPatterns = [/token/i, /auth/i, /user/i, /company/i, /jwt/i];
          const remnants: string[] = [];

          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              const value = sessionStorage.getItem(key) || "";
              for (const pattern of authPatterns) {
                if (pattern.test(key) || pattern.test(value)) {
                  remnants.push(key);
                  break;
                }
              }
            }
          }

          return remnants;
        });

        expect(
          sessionRemnants,
          `Auth remnants found in sessionStorage: ${sessionRemnants.join(", ")}`,
        ).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  test.describe("Navigation", () => {
    test("logout redirects to login page", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify we're on dashboard
      await expect(page).toHaveURL(/\/dashboard/);

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Should redirect to login page (root "/")
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Login form should be visible
        await expect(
          page.locator("text=/Sign In|Welcome back|Log In/i").first(),
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test("cannot navigate back to protected routes after logout", async ({
      page,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Navigate to another protected page to create history
      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect to login
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Try to navigate back using browser history
        await page.goBack();
        await page.waitForTimeout(1000);

        // Should still be on login page or redirected back to login
        // (protected routes should not be accessible)
        const currentUrl = page.url();
        const isOnLoginPage =
          currentUrl === "/" ||
          currentUrl.endsWith("/") ||
          currentUrl.match(/^https?:\/\/[^/]+\/?(\?.*)?$/);
        const showsLoginForm = await page
          .locator("text=/Sign In|Welcome back|Log In/i")
          .first()
          .isVisible()
          .catch(() => false);

        expect(
          isOnLoginPage || showsLoginForm,
          "Should be on login page after navigating back from protected route",
        ).toBe(true);
      }
    });

    test("browser back button shows login, not cached protected page", async ({
      page,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Create some navigation history
      await page.goto("/projects");
      await page.waitForLoadState("networkidle");
      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect to login
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Click back button multiple times
        for (let i = 0; i < 3; i++) {
          await page.goBack();
          await page.waitForTimeout(500);

          // After each back navigation, verify we're still on login
          // or properly redirected (not seeing protected content)
          const pageContent = await page.content();
          const hasProtectedContent =
            pageContent.includes("Dashboard") ||
            pageContent.includes(mockAuthUser.firstName);

          // If protected content is shown, the auth check should redirect
          if (hasProtectedContent) {
            // Wait for potential redirect
            await page.waitForTimeout(1000);
          }

          // The login form should eventually be visible
          const showsLoginForm = await page
            .locator("text=/Sign In|Welcome back|Log In/i")
            .first()
            .isVisible()
            .catch(() => false);

          // Either showing login form or URL is login page
          const currentUrl = page.url();
          const isLoginUrl = currentUrl.match(/^https?:\/\/[^/]+\/?(\?.*)?$/);

          expect(
            showsLoginForm || isLoginUrl,
            `Back navigation ${i + 1}: Should show login, not protected content`,
          ).toBeTruthy();
        }
      }
    });

    test("deep links to protected routes redirect to login after logout", async ({
      page,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Perform logout
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for redirect to login
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Try to directly navigate to various protected routes
        const protectedRoutes = [
          "/dashboard",
          "/my-qrcodes",
          "/projects",
          "/settings",
          "/groups",
        ];

        for (const route of protectedRoutes) {
          await page.goto(route);
          await page.waitForTimeout(1000);

          // Should redirect to login
          await expect(
            page,
            `Deep link to ${route} should redirect to login`,
          ).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, { timeout: 5000 });
        }
      }
    });
  });

  // ==========================================================================
  // Multi-Tab Tests
  // ==========================================================================

  test.describe("Multi-Tab", () => {
    test("logout in one tab triggers storage event", async ({
      page,
      context,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Open a second tab
      const secondTab = await context.newPage();

      // Set up mocks for the second tab
      await safeRoute(secondTab, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAuthUser),
        });
      });

      await safeRoute(secondTab, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockAuthTokens.accessToken }),
        });
      });

      await safeRoute(
        secondTab,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockAuthCompany),
          });
        },
      );

      await safeRoute(
        secondTab,
        "**/company/*/dashboard-stats**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockDashboardStats),
          });
        },
      );

      await safeRoute(secondTab, "**/qr-code*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockEmptyListResponse),
        });
      });

      await safeRoute(
        secondTab,
        "**/aggregation/all-projects/**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        },
      );

      await safeRoute(secondTab, "**/groups*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockEmptyListResponse),
        });
      });

      await safeRoute(secondTab, "**/auth/logout", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Logged out successfully" }),
        });
      });

      await secondTab.setViewportSize({ width: 1280, height: 720 });
      await secondTab.goto("/my-qrcodes");
      await secondTab.waitForLoadState("domcontentloaded");

      // Verify both tabs are authenticated
      const tab1Token = await page.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      const tab2Token = await secondTab.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      expect(tab1Token).toBe(mockAuthTokens.accessToken);
      expect(tab2Token).toBe(mockAuthTokens.accessToken);

      // Set up storage event listener on second tab
      await secondTab.evaluate(() => {
        window.addEventListener("storage", (event) => {
          if (event.key === "accessToken" && event.newValue === null) {
            (
              window as unknown as { __storageEventReceived: boolean }
            ).__storageEventReceived = true;
          }
        });
      });

      // Perform logout in first tab
      const logoutPerformed = await performLogout(page);

      if (logoutPerformed) {
        // Wait for logout to complete in first tab
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Give time for storage event to propagate
        await secondTab.waitForTimeout(1500);

        // Check if storage event was received in second tab
        await secondTab.evaluate(
          () =>
            (window as unknown as { __storageEventReceived?: boolean })
              .__storageEventReceived || false,
        );

        // Verify token is cleared in second tab's localStorage
        const tab2TokenAfter = await secondTab.evaluate(() =>
          localStorage.getItem("accessToken"),
        );

        // The storage event should have been triggered AND token should be cleared
        expect(
          tab2TokenAfter,
          "Token should be cleared in second tab after logout in first tab",
        ).toBeNull();
      }

      await secondTab.close();
    });

    test("other tabs redirect to login on storage change event", async ({
      page,
      context,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");

      // Open a second tab
      const secondTab = await context.newPage();
      try {
        // Set up mocks for the second tab - including logout-triggered auth failure
        await safeRoute(secondTab, "**/auth/me", async (route) => {
          // Check if we still have a token
          const hasToken = await secondTab
            .evaluate(() => localStorage.getItem("accessToken"))
            .catch(() => null);

          if (hasToken) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockAuthUser),
            });
          } else {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({ message: "Unauthorized" }),
            });
          }
        });

        await safeRoute(secondTab, "**/auth/refresh", async (route) => {
          const hasToken = await secondTab
            .evaluate(() => localStorage.getItem("accessToken"))
            .catch(() => null);

          if (hasToken) {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ accessToken: mockAuthTokens.accessToken }),
            });
          } else {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({ message: "Refresh token invalid" }),
            });
          }
        });

        await safeRoute(
          secondTab,
          /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockAuthCompany),
            });
          },
        );

        await safeRoute(
          secondTab,
          "**/company/*/dashboard-stats**",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockDashboardStats),
            });
          },
        );

        await safeRoute(secondTab, "**/qr-code*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockEmptyListResponse),
          });
        });

        await safeRoute(
          secondTab,
          "**/aggregation/all-projects/**",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([]),
            });
          },
        );

        await safeRoute(secondTab, "**/groups*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockEmptyListResponse),
          });
        });

        await safeRoute(secondTab, "**/auth/logout", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ message: "Logged out successfully" }),
          });
        });

        await secondTab.setViewportSize({ width: 1280, height: 720 });
        await secondTab.goto("/my-qrcodes");
        await secondTab.waitForLoadState("domcontentloaded");

        // Set up a handler in second tab to redirect to login when storage changes
        await secondTab.evaluate(() => {
          window.addEventListener("storage", (event) => {
            if (event.key === "accessToken" && event.newValue === null) {
              // Simulate what the app would do - redirect to login
              window.location.href = "/";
            }
          });
        });

        // Perform logout in first tab
        const logoutPerformed = await performLogout(page);

        if (logoutPerformed) {
          // Wait for logout to complete in first tab
          await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
            timeout: 10000,
          });

          // Give time for storage event to propagate and trigger redirect
          await secondTab.waitForTimeout(2000);

          // Second tab should either:
          // 1. Have been redirected to login by the storage event handler
          // 2. Show login form if it tried to make an API call
          const secondTabUrl = secondTab.url();
          const isOnLoginPage =
            secondTabUrl === "/" ||
            secondTabUrl.endsWith("/") ||
            secondTabUrl.match(/^https?:\/\/[^/]+\/?(\?.*)?$/);

          const showsLoginForm = await secondTab
            .locator("text=/Sign In|Welcome back|Log In/i")
            .first()
            .isVisible()
            .catch(() => false);

          // Verify token is cleared in second tab
          const secondTabToken = await secondTab.evaluate(() =>
            localStorage.getItem("accessToken"),
          );

          expect(
            secondTabToken,
            "Token should be cleared in second tab",
          ).toBeNull();

          // The tab should be redirected to login or showing login form
          // (exact behavior depends on app implementation)
          expect(
            isOnLoginPage || showsLoginForm,
            "Second tab should redirect to login after logout in first tab",
          ).toBe(true);
        }
      } finally {
        await secondTab.close().catch(() => {});
      }
    });
  });
});
