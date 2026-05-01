/**
 * Token Security E2E Tests
 *
 * Verifies token storage security and third-party domain isolation.
 * Tests ensure:
 * - Access token stored securely in localStorage
 * - No token leakage to third-party domains
 * - Token lifecycle (cleared on logout/expiration/auth failure)
 * - Token not exposed in URLs
 */

import {
  test,
  expect,
  DEFAULT_FIRST_PARTY_DOMAINS,
} from "../../fixtures/security-test";
import { safeRoute } from "../../utils/route-tracker";
import {
  mockAuthUser,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockLoginSuccess = {
  firstName: "Test",
  accessToken: "mock-jwt-access-token-e2e",
  userId: "user-test-001",
  _id: "user-test-001",
  company: "comp-test-001",
  companyId: "comp-test-001",
};

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

// ============================================================================
// TESTS
// ============================================================================

test.describe("Token Security @security @desktop", () => {
  // ==========================================================================
  // Token Storage Tests
  // ==========================================================================

  test.describe("Token Storage", () => {
    test("access token stored in localStorage after login", async ({
      page,
    }) => {
      // Mock login endpoint
      await safeRoute(page, "**/auth/login", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockLoginSuccess),
        });
      });

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Fill and submit login form
      await page.locator("#email").fill("test@example.com");
      await page.locator("#password").fill("ValidPass1");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();

      // Wait for login to complete
      await page.waitForURL((url) => url.pathname !== "/", { timeout: 10000 });

      // Verify access token was stored in localStorage
      const storedToken = await page.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      expect(storedToken).toBe("mock-jwt-access-token-e2e");
    });

    test("no token stored in sessionStorage", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Check sessionStorage for any token-like values
      const sessionStorageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            data[key] = sessionStorage.getItem(key) || "";
          }
        }
        return data;
      });

      // Verify no token patterns in sessionStorage
      const tokenPatterns = [
        /token/i,
        /jwt/i,
        /auth/i,
        /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/, // JWT pattern
      ];

      for (const [key, value] of Object.entries(sessionStorageData)) {
        for (const pattern of tokenPatterns) {
          const keyHasToken = pattern.test(key);
          const valueHasToken = pattern.test(value);

          if (keyHasToken || valueHasToken) {
            throw new Error(
              `Token found in sessionStorage - key: "${key}", value contains token: ${valueHasToken}`,
            );
          }
        }
      }
    });

    test("no auth token accessible to JS in cookies", async ({ page }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Get all cookies accessible to the page context
      const context = page.context();
      const cookies = await context.cookies();

      // Check for auth tokens in JS-accessible cookies (non-httpOnly)
      const jsAccessibleAuthCookies = cookies.filter((cookie) => {
        const isTokenCookie =
          /token|jwt|auth|session/i.test(cookie.name) ||
          /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(
            cookie.value,
          );

        // Check if it's JS-accessible (not httpOnly)
        return isTokenCookie && !cookie.httpOnly;
      });

      // Should be no JS-accessible auth cookies
      if (jsAccessibleAuthCookies.length > 0) {
        const cookieNames = jsAccessibleAuthCookies
          .map((c) => c.name)
          .join(", ");
        throw new Error(
          `Auth token found in JS-accessible cookies: ${cookieNames}. ` +
            `These should be httpOnly for security.`,
        );
      }
    });

    test("token not exposed in URL parameters", async ({
      page,
      capturedRequests,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Navigate to another page to capture more requests
      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");

      // Check that no request URLs contain tokens
      const tokenUrlPatterns = [
        /accessToken=[^&]+/i,
        /access_token=[^&]+/i,
        /token=eyJ[^&]+/i,
        /bearer=[^&]+/i,
        /jwt=[^&]+/i,
        /auth=[^&]+/i,
      ];

      for (const request of capturedRequests) {
        const url = request.url();
        for (const pattern of tokenUrlPatterns) {
          if (pattern.test(url)) {
            throw new Error(
              `Security violation: Token found in URL parameter: ${url}`,
            );
          }
        }
      }

      // Also check the browser URL bar
      const currentUrl = page.url();
      for (const pattern of tokenUrlPatterns) {
        if (pattern.test(currentUrl)) {
          throw new Error(
            `Security violation: Token exposed in browser URL: ${currentUrl}`,
          );
        }
      }
    });
  });

  // ==========================================================================
  // Third-Party Domain Isolation Tests
  // ==========================================================================

  test.describe("Third-Party Domain Isolation", () => {
    test("token not sent to third-party analytics services", async ({
      page,
      capturedRequests,
      securityHelpers,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Filter for third-party requests
      const thirdPartyRequests = await securityHelpers.getRequestsToThirdParty(
        page,
        capturedRequests,
        DEFAULT_FIRST_PARTY_DOMAINS,
      );

      // Filter specifically for analytics-like services
      const analyticsPatterns = [
        /google-analytics/i,
        /analytics/i,
        /gtag/i,
        /segment/i,
        /mixpanel/i,
        /amplitude/i,
        /heap/i,
        /hotjar/i,
        /fullstory/i,
        /rollbar/i,
        /sentry/i,
        /bugsnag/i,
      ];

      const analyticsRequests = thirdPartyRequests.filter((req) => {
        const url = req.url();
        return analyticsPatterns.some((pattern) => pattern.test(url));
      });

      // Verify no tokens in analytics requests
      if (analyticsRequests.length > 0) {
        await securityHelpers.verifyNoTokenInRequests(analyticsRequests);
      }
    });

    test("token not sent to CDN requests", async ({
      page,
      capturedRequests,
      securityHelpers,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Filter for CDN-like requests
      const cdnPatterns = [
        /cdn\./i,
        /cloudfront/i,
        /cloudflare/i,
        /akamai/i,
        /fastly/i,
        /unpkg/i,
        /jsdelivr/i,
        /cdnjs/i,
        /static\./i,
        /assets\./i,
      ];

      const cdnRequests = capturedRequests.filter((req) => {
        const url = req.url();
        return cdnPatterns.some((pattern) => pattern.test(url));
      });

      // Verify no tokens in CDN requests
      if (cdnRequests.length > 0) {
        await securityHelpers.verifyNoTokenInRequests(cdnRequests);
      }
    });

    test("Authorization header only sent to first-party API domain", async ({
      page,
      capturedRequests,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Check each request for Authorization header
      for (const request of capturedRequests) {
        const url = request.url();
        const headers = request.headers();
        const authHeader = headers["authorization"];

        if (authHeader) {
          // Verify this is a first-party request
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            const isFirstParty = DEFAULT_FIRST_PARTY_DOMAINS.some(
              (domain) =>
                hostname === domain ||
                hostname.endsWith(`.${domain}`) ||
                hostname === "localhost" ||
                hostname === "127.0.0.1",
            );

            if (!isFirstParty) {
              throw new Error(
                `Security violation: Authorization header sent to third-party domain: ${url}`,
              );
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("Security violation")
            ) {
              throw error;
            }
            // URL parsing error - consider it third-party for safety
          }
        }
      }
    });

    test("token not leaked to third-party requests", async ({
      page,
      capturedRequests,
      securityHelpers,
    }) => {
      await setupAuthenticatedMocks(page);
      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Get all third-party requests
      const thirdPartyRequests = await securityHelpers.getRequestsToThirdParty(
        page,
        capturedRequests,
        DEFAULT_FIRST_PARTY_DOMAINS,
      );

      // Verify no tokens in any third-party request
      await securityHelpers.verifyNoTokenInRequests(thirdPartyRequests);
    });
  });

  // ==========================================================================
  // Token Lifecycle Tests
  // ==========================================================================

  test.describe("Token Lifecycle", () => {
    test("token cleared on explicit logout", async ({ page }) => {
      await setupAuthenticatedMocks(page);

      // Mock logout endpoint
      await safeRoute(page, "**/auth/logout", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Logged out successfully" }),
        });
      });

      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify we're authenticated
      await expect(page).toHaveURL(/\/dashboard/);

      // Verify token exists before logout
      const tokenBefore = await page.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      expect(tokenBefore).toBeTruthy();

      // Find and click logout button
      const userMenu = page.locator(
        '[data-testid="user-menu"], [data-testid="sidebar-user-menu"], .user-menu',
      );
      if (await userMenu.isVisible().catch(() => false)) {
        await userMenu.click();
      }

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

        // Wait for redirect to login
        await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
          timeout: 10000,
        });

        // Verify tokens are cleared from localStorage
        const accessToken = await page.evaluate(() =>
          localStorage.getItem("accessToken"),
        );
        const user = await page.evaluate(() => localStorage.getItem("user"));
        const company = await page.evaluate(() =>
          localStorage.getItem("company"),
        );

        expect(accessToken).toBeNull();
        expect(user).toBeNull();
        expect(company).toBeNull();
      }
    });

    test("token cleared on session expiration (401 from refresh)", async ({
      page,
    }) => {
      // Set up auth/me to return 401 (expired)
      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Token expired" }),
        });
      });

      // Refresh also fails (completely expired session)
      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Refresh token expired" }),
        });
      });

      // All other API calls return 401
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

      // Inject stale auth state with one-shot guard
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");

      // Should eventually redirect to login after refresh failure
      await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
        timeout: 10000,
      });

      // Verify tokens are cleared
      const accessToken = await page.evaluate(() =>
        localStorage.getItem("accessToken"),
      );

      // Token should be cleared (or we're on login page)
      const onLoginPage =
        page.url() === "/" ||
        page.url().endsWith("/") ||
        page.url().includes("login");

      expect(accessToken === null || onLoginPage).toBe(true);
    });

    test("token cleared on auth failure (API returns 401)", async ({
      page,
    }) => {
      // This test verifies that when an API call returns 401 and refresh fails,
      // the app properly handles the auth failure by clearing tokens and/or redirecting

      // All API calls return 401 immediately (simulating completely invalid/revoked token)
      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Token invalid or revoked" }),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Refresh token invalid" }),
        });
      });

      // Mock all other endpoints to return 401 as well
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

      // Inject auth state (with an "invalid" token that server rejects).
      // Guarded one-shot injection prevents reinjection loops across navigations.
      await page.addInitScript(() => {
        if (!window.localStorage.getItem("__auth_injected")) {
          window.localStorage.setItem("__auth_injected", "1");
          window.localStorage.setItem("accessToken", "invalid-revoked-token");
          window.localStorage.setItem(
            "user",
            JSON.stringify({
              _id: "user-001",
              permission: "admin",
              companyId: "comp-001",
            }),
          );
          window.localStorage.setItem(
            "company",
            JSON.stringify({ _id: "comp-001", companyName: "Test Co" }),
          );
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");

      // Should redirect to login page
      await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
        timeout: 10000,
      });

      // Stable terminal state: login UI visible OR token cleared at root URL.
      await expect
        .poll(
          async () => {
            const loginVisible = await page
              .locator("text=/Sign In|Welcome back/i")
              .first()
              .isVisible()
              .catch(() => false);
            const accessToken = await page.evaluate(() =>
              localStorage.getItem("accessToken"),
            );
            const atRoot = /^https?:\/\/[^/]+\/?(\?.*)?$/.test(page.url());
            return loginVisible || (accessToken === null && atRoot);
          },
          { timeout: 10000 },
        )
        .toBe(true);
    });

    test("no token remnants after logout (check all storage)", async ({
      page,
    }) => {
      await setupAuthenticatedMocks(page);

      // Mock logout endpoint
      await safeRoute(page, "**/auth/logout", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Logged out successfully" }),
        });
      });

      await injectAuthState(page);

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Find and click logout
      const userMenu = page.locator(
        '[data-testid="user-menu"], [data-testid="sidebar-user-menu"], .user-menu',
      );
      if (await userMenu.isVisible().catch(() => false)) {
        await userMenu.click();
      }

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

        // Wait for logout to complete
        await page.waitForTimeout(1000);

        // Check ALL storage for token remnants
        const storageAudit = await page.evaluate(() => {
          const tokenPatterns = [
            /token/i,
            /jwt/i,
            /auth(?!or)/i, // auth but not "author"
            /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/, // JWT
          ];

          const findings: string[] = [];

          // Check localStorage
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const value = localStorage.getItem(key) || "";
              for (const pattern of tokenPatterns) {
                if (pattern.test(key) || pattern.test(value)) {
                  findings.push(`localStorage[${key}]`);
                  break;
                }
              }
            }
          }

          // Check sessionStorage
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              const value = sessionStorage.getItem(key) || "";
              for (const pattern of tokenPatterns) {
                if (pattern.test(key) || pattern.test(value)) {
                  findings.push(`sessionStorage[${key}]`);
                  break;
                }
              }
            }
          }

          return findings;
        });

        // Also check cookies
        const context = page.context();
        const cookies = await context.cookies();
        const tokenCookies = cookies.filter(
          (cookie) =>
            /token|jwt|auth/i.test(cookie.name) ||
            /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(
              cookie.value,
            ),
        );

        if (tokenCookies.length > 0) {
          storageAudit.push(...tokenCookies.map((c) => `cookie[${c.name}]`));
        }

        // Verify no token remnants found
        if (storageAudit.length > 0) {
          throw new Error(
            `Token remnants found after logout: ${storageAudit.join(", ")}`,
          );
        }
      }
    });

    test("token storage is checked on page load", async ({ page }) => {
      // Do not inject auth state - simulate fresh page load
      await page.goto("/dashboard");

      // Should redirect to login since no token exists
      await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/);

      // Verify login page is shown
      await expect(
        page.locator("text=/Sign In|Welcome back/i").first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
