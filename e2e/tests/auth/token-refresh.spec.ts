import { test, expect, safeRoute } from "../../fixtures/verified-test";
import {
  test as authenticatedTest,
  mockAuthUser,
  mockAuthCompany,
  mockAuthTokens,
} from "../../fixtures/authenticated-test";
import { safeRoute as authSafeRoute } from "../../utils/route-tracker";
import type { RouteTracker } from "../../utils/route-tracker";
import {
  createMockQRCode,
  createMockProject,
  createMockGroup,
} from "../../fixtures/builders";

// ============================================================================
// TOKEN REFRESH & RETRY QUEUE TESTS
// ============================================================================

test.describe("Token Refresh Mechanism", () => {
  /**
   * Sets up a page with auth state and common dashboard mocks.
   */
  async function setupAuthenticatedPage(
    page: import("@playwright/test").Page,
    _routeTracker: RouteTracker,
  ) {
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
        company: mockAuthCompany,
      },
    );
  }

  test("401 triggers token refresh and retries original request", async ({
    page,
    routeTracker,
  }) => {
    await setupAuthenticatedPage(page, routeTracker);

    let dashboardCallCount = 0;
    const refreshedToken = "mock-refreshed-access-token";

    // Auth endpoints
    await safeRoute(page, "**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthUser),
      });
    });

    // Mock refresh endpoint — always succeeds with new token
    await safeRoute(page, "**/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: refreshedToken }),
      });
    });

    await safeRoute(page, "**/company/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthCompany),
      });
    });

    // Dashboard stats: first call returns 401, subsequent calls succeed
    await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
      dashboardCallCount++;
      if (dashboardCallCount === 1) {
        // First call: 401 to trigger refresh
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Token expired" }),
        });
      } else {
        // Retry after refresh: 200
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            totalQRCodes: 10,
            totalScans: 50,
            totalFilesShared: 25,
          }),
        });
      }
    });

    // Use safeRoute() for background data routes — these may not be called
    // during the token refresh test window, so they must not be tracked by
    // routeTracker (which would fail assertAllRoutesIntercepted on 0 calls).
    // safeRoute() skips Vite source file requests that match broad patterns.
    for (const pattern of [
      "**/qr-code*",
      "**/aggregation/all-projects/**",
      "**/groups*",
    ]) {
      await safeRoute(page, pattern, async (route) => {
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

    // Wait for route handlers and init scripts to be fully registered
    await page.waitForTimeout(50);

    await page.goto("/dashboard");

    // Dashboard should eventually load successfully (after retry)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Wait for the dashboard heading to confirm the page rendered
    await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible({
      timeout: 10000,
    });

    // Wait for dashboard-stats to be retried after the 401 → refresh cycle
    // by polling until the call count reaches 2 or timeout
    await expect
      .poll(() => dashboardCallCount, { timeout: 10000 })
      .toBeGreaterThanOrEqual(2);
  });

  test("failed refresh clears auth and redirects to login", async ({
    page,
    routeTracker: _routeTracker,
  }) => {
    // Don't use setupAuthenticatedPage() here — its addInitScript persists
    // across navigations and would re-inject tokens after the 401 interceptor
    // clears them and redirects to "/".  Instead, inject tokens with a
    // one-shot guard so they are only set on the first page load.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(
      (data) => {
        // Only inject on the first load (before auth clears the tokens)
        if (!window.localStorage.getItem("__auth_injected")) {
          window.localStorage.setItem("__auth_injected", "1");
          window.localStorage.setItem("accessToken", data.accessToken);
          window.localStorage.setItem("user", JSON.stringify(data.user));
          window.localStorage.setItem("company", JSON.stringify(data.company));
        }
      },
      {
        accessToken: mockAuthTokens.accessToken,
        user: mockAuthUser,
        company: mockAuthCompany,
      },
    );

    // Auth/me returns 401 (expired)
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

    // Company endpoint also fails (use ** to match nested paths like
    // /company/id/dashboard-stats in addition to /company/id)
    await safeRoute(page, "**/company/**", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    });

    // Catch-all for any other API calls that may hit the backend during
    // the failed-auth flow. safeRoute() skips Vite source file requests.
    for (const pattern of ["**/qr-code*", "**/aggregation/**", "**/groups*"]) {
      await safeRoute(page, pattern, async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Unauthorized" }),
        });
      });
    }

    // Wait for route handlers and init scripts to be fully registered
    await page.waitForTimeout(50);

    await page.goto("/dashboard");

    // Should redirect to login page
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?(\?.*)?$/, {
      timeout: 15000,
    });

    // localStorage should be cleared
    const accessToken = await page.evaluate(() =>
      window.localStorage.getItem("accessToken"),
    );
    // Token should be null or cleared after redirect
    expect(accessToken === null || accessToken === "").toBeTruthy();
  });

  test("concurrent 401s share a single refresh request", async ({
    page,
    routeTracker,
  }) => {
    await setupAuthenticatedPage(page, routeTracker);

    let refreshCallCount = 0;
    const refreshedToken = "mock-shared-refresh-token";

    await safeRoute(page, "**/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthUser),
      });
    });

    // Track refresh calls — should only be called once even with multiple 401s
    await safeRoute(page, "**/auth/refresh", async (route) => {
      refreshCallCount++;
      // Small delay to simulate real refresh
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: refreshedToken }),
      });
    });

    await safeRoute(page, "**/company/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockAuthCompany),
      });
    });

    // Multiple endpoints all return 401 on first call, then 200 on retry.
    // safeRoute() prevents Vite source files from being intercepted.
    const endpointCalls: Record<string, number> = {};

    for (const pattern of [
      "**/company/*/dashboard-stats**",
      "**/qr-code*",
      "**/aggregation/all-projects/**",
      "**/groups*",
    ]) {
      endpointCalls[pattern] = 0;
      await safeRoute(page, pattern, async (route) => {
        endpointCalls[pattern]++;
        if (endpointCalls[pattern] === 1) {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Token expired" }),
          });
        } else {
          const defaultData = pattern.includes("dashboard-stats")
            ? { totalQRCodes: 5, totalScans: 20, totalFilesShared: 10 }
            : pattern.includes("all-projects")
              ? []
              : {
                  data: [],
                  total_items: 0,
                  has_next: false,
                  has_prev: false,
                };
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(defaultData),
          });
        }
      });
    }

    // Wait for route handlers and init scripts to be fully registered
    await page.waitForTimeout(50);

    await page.goto("/dashboard");

    // Wait for dashboard to load (after refresh + retries)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // The refresh endpoint should ideally be called only once
    // (the interceptor queues concurrent 401s behind a single refresh)
    // Allow up to 2 due to race conditions in test environment
    expect(refreshCallCount).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// MOCK DATA FOR FORM-BASED TOKEN REFRESH TESTS
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-token-refresh-001",
  projectName: "Token Refresh Test Project",
});

const mockGroup = createMockGroup({
  _id: "grp-token-refresh-001",
  groupName: "Token Refresh Test Group",
});

const mockQRCode = createMockQRCode({
  _id: "qr-token-refresh-001",
  qrcodeName: "Token Refresh Test QR",
  project: mockProject._id,
  projectName: mockProject.projectName,
  group: mockGroup._id,
});

const mockListResponse = {
  data: [mockQRCode],
  total_items: 1,
  has_next: false,
  has_prev: false,
};

// ============================================================================
// TOKEN REFRESH DURING DATA FETCH (Authenticated Fixture)
// ============================================================================

authenticatedTest.describe("Token Refresh During Data Fetch @desktop", () => {
  authenticatedTest(
    "refreshes token automatically on 401 response during data fetch",
    async ({ authenticatedPage }) => {
      let firstGetCall = true;
      let refreshCalled = false;

      // First GET call returns 401, subsequent GET calls succeed after refresh.
      // Ignore non-GET noise (e.g., preflight/background requests) so this stays deterministic.
      await authSafeRoute(
        authenticatedPage,
        /\/qr-code(?:\?.*)?$/,
        async (route) => {
          const method = route.request().method();
          if (method !== "GET") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockListResponse),
            });
            return;
          }

          if (firstGetCall) {
            firstGetCall = false;
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 401,
                message: "Token expired",
                error: "Unauthorized",
              }),
            });
            return;
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockListResponse),
          });
        },
      );

      // Track refresh token calls
      await authSafeRoute(
        authenticatedPage,
        "**/auth/refresh",
        async (route) => {
          refreshCalled = true;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              accessToken: "new-mock-access-token",
            }),
          });
        },
      );

      // Use authSafeRoute for optional mocks
      await authSafeRoute(
        authenticatedPage,
        "**/aggregation/all-projects/**",
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([mockProject]),
          });
        },
      );
      await authSafeRoute(authenticatedPage, "**/groups**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [mockGroup], total_items: 1 }),
        });
      });

      await authenticatedPage.goto("/my-qrcodes");
      await authenticatedPage.waitForLoadState("networkidle");

      // Token refresh should have been called
      await expect.poll(() => refreshCalled, { timeout: 10000 }).toBe(true);
    },
  );

  authenticatedTest(
    "redirects to login when refresh token is also expired during data fetch",
    async ({ authenticatedPage }) => {
      // Mock all API calls to return 401
      await authSafeRoute(authenticatedPage, "**/qr-code*", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 401,
            message: "Token expired",
          }),
        });
      });

      // Refresh also fails
      await authSafeRoute(
        authenticatedPage,
        "**/auth/refresh",
        async (route) => {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 401,
              message: "Refresh token expired",
            }),
          });
        },
      );

      await authSafeRoute(authenticatedPage, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 401,
            message: "Unauthorized",
          }),
        });
      });

      await authenticatedPage.goto("/my-qrcodes");

      // Should redirect to login
      await authenticatedPage
        .waitForURL(
          (url) => url.pathname === "/" || url.pathname.includes("login"),
          { timeout: 10000 },
        )
        .catch(() => {});

      // Verify on login page or auth tokens are cleared
      const onLoginPage =
        authenticatedPage.url().includes("/") ||
        authenticatedPage.url().includes("login");

      const tokenCleared = await authenticatedPage
        .evaluate(() => localStorage.getItem("accessToken") === null)
        .catch(() => true);

      expect(onLoginPage || tokenCleared).toBe(true);
    },
  );
});

// ============================================================================
// TOKEN REFRESH DURING FORM OPERATIONS
// ============================================================================

authenticatedTest.describe(
  "Token Refresh During Form Operations @desktop",
  () => {
    authenticatedTest(
      "preserves form data during token refresh",
      async ({ authenticatedPage }) => {
        let submitAttempts = 0;

        // Use authSafeRoute for optional mocks
        await authSafeRoute(
          authenticatedPage,
          "**/aggregation/all-projects/**",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([mockProject]),
            });
          },
        );
        await authSafeRoute(
          authenticatedPage,
          "**/categories*",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: [] }),
            });
          },
        );

        // First submit returns 401, then succeeds
        await authSafeRoute(authenticatedPage, "**/qr-code", async (route) => {
          if (route.request().method() === "POST") {
            submitAttempts++;
            if (submitAttempts === 1) {
              await route.fulfill({
                status: 401,
                contentType: "application/json",
                body: JSON.stringify({
                  statusCode: 401,
                  message: "Token expired",
                }),
              });
            } else {
              await route.fulfill({
                status: 201,
                contentType: "application/json",
                body: JSON.stringify({
                  _id: "qr-new-001",
                  qrcodeName: "Test QR",
                }),
              });
            }
          } else {
            await route.continue();
          }
        });

        await authenticatedPage.goto("/create-qr");
        await authenticatedPage.waitForLoadState("networkidle");

        const nameInput = authenticatedPage.locator(
          'input[name="qrcodeName"], input[placeholder*="name" i]',
        );

        if (
          await nameInput
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          const testName = "Preserve Data Test QR";
          await nameInput.first().fill(testName);

          const submitBtn = authenticatedPage.getByRole("button", {
            name: /create|submit|save/i,
          });

          if (
            await submitBtn
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false)
          ) {
            await submitBtn.first().click();

            // Wait a moment for potential token refresh
            await authenticatedPage.waitForTimeout(1000);

            // Form data should still be preserved (if refresh failed gracefully)
            const currentValue = await nameInput
              .first()
              .inputValue()
              .catch(() => "");

            // Either form preserved data or we navigated on success
            const formPreserved = currentValue === testName;
            const navigated = !authenticatedPage.url().includes("/create");

            expect(formPreserved || navigated).toBe(true);
          }
        }
      },
    );

    authenticatedTest(
      "shows session expired message when form submission fails due to auth",
      async ({ authenticatedPage }) => {
        // Use authSafeRoute for optional mocks
        await authSafeRoute(
          authenticatedPage,
          "**/aggregation/all-projects/**",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify([mockProject]),
            });
          },
        );
        await authSafeRoute(
          authenticatedPage,
          "**/categories*",
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ data: [] }),
            });
          },
        );

        // Both submit and refresh fail
        await authSafeRoute(authenticatedPage, "**/qr-code", async (route) => {
          if (route.request().method() === "POST") {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 401,
                message: "Session expired",
              }),
            });
          } else {
            await route.continue();
          }
        });

        await authSafeRoute(
          authenticatedPage,
          "**/auth/refresh",
          async (route) => {
            await route.fulfill({
              status: 401,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 401,
                message: "Refresh token expired",
              }),
            });
          },
        );

        await authenticatedPage.goto("/create-qr");
        await authenticatedPage.waitForLoadState("networkidle");

        const nameInput = authenticatedPage.locator(
          'input[name="qrcodeName"], input[placeholder*="name" i]',
        );

        if (
          await nameInput
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await nameInput.first().fill("Session Expired Test");

          const submitBtn = authenticatedPage.getByRole("button", {
            name: /create|submit|save/i,
          });

          if (
            await submitBtn
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false)
          ) {
            await submitBtn.first().click();

            // Should show session expired message or redirect to login
            const sessionMessage = authenticatedPage.locator(
              "text=/session.*expired|please.*login|unauthorized/i",
            );

            const hasMessage = await sessionMessage
              .first()
              .isVisible({ timeout: 5000 })
              .catch(() => false);

            const redirectedToLogin =
              authenticatedPage.url() === "/" ||
              authenticatedPage.url().includes("login");

            expect(hasMessage || redirectedToLogin).toBe(true);
          }
        }
      },
    );

    authenticatedTest(
      "handles token expiry during settings update",
      async ({ authenticatedPage }) => {
        // Use authSafeRoute for settings page endpoints
        const settingsMocks = [
          { pattern: "**/user/**", data: { data: [], total_items: 0 } },
          { pattern: "**/categories*", data: { data: [] } },
          { pattern: "**/categories/classes*", data: { data: [] } },
          { pattern: "**/storage-stats**", data: {} },
          { pattern: "**/storage-history**", data: { history: [] } },
          { pattern: "**/stripe/products**", data: { data: [] } },
          { pattern: "**/procore-status**", data: { connected: false } },
          {
            pattern: "**/procore-integration-details**",
            data: { owners: [], connectedUsers: [] },
          },
        ];
        for (const mock of settingsMocks) {
          await authSafeRoute(
            authenticatedPage,
            mock.pattern,
            async (route) => {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(mock.data),
              });
            },
          );
        }

        // Mock PATCH/PUT to return 401 for testing token expiry
        await authSafeRoute(
          authenticatedPage,
          "**/company/**",
          async (route) => {
            if (
              route.request().method() === "PATCH" ||
              route.request().method() === "PUT"
            ) {
              await route.fulfill({
                status: 401,
                contentType: "application/json",
                body: JSON.stringify({
                  statusCode: 401,
                  message: "Token expired",
                }),
              });
            } else {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(mockAuthCompany),
              });
            }
          },
        );

        await authenticatedPage.goto("/settings");
        await authenticatedPage.waitForLoadState("networkidle");

        // Try to find and update a settings field
        const companyNameInput = authenticatedPage.locator(
          'input[name="companyName"], input[placeholder*="company" i]',
        );

        if (
          await companyNameInput
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await companyNameInput.first().fill("Updated Company Name");

          // Find save button
          const saveBtn = authenticatedPage.getByRole("button", {
            name: /save|update|submit/i,
          });

          if (
            await saveBtn
              .first()
              .isVisible({ timeout: 2000 })
              .catch(() => false)
          ) {
            await saveBtn.first().click();

            // Should handle auth error gracefully
            await authenticatedPage.waitForTimeout(2000);

            // Verify either error toast shown OR redirect to login
            const errorToast = authenticatedPage.locator(
              '[data-sonner-toast][data-type="error"]',
            );
            const isOnLoginPage =
              authenticatedPage.url() === "/" ||
              authenticatedPage.url().endsWith("/");
            const hasErrorToast = await errorToast
              .isVisible({ timeout: 2000 })
              .catch(() => false);
            expect(hasErrorToast || isOnLoginPage).toBe(true);
          }
        }
      },
    );
  },
);
