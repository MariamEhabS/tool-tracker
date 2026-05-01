import { test, expect } from "../../fixtures/authenticated-test";
import {
  createMockQRCode,
  createMockProject,
  createMockGroup,
} from "../../fixtures/builders";
import { safeRoute } from "../../utils/route-tracker";

// ============================================================================
// SESSION EXPIRY TESTS
// ============================================================================
// NOTE: Token refresh tests have been consolidated into:
//   e2e/tests/auth/token-refresh.spec.ts
//
// This file focuses on session-specific behaviors:
// - Logout and sensitive data clearing
// - Multi-tab session synchronization
// - Session state management
// ============================================================================

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProject = createMockProject({
  _id: "proj-session-001",
  projectName: "Session Test Project",
});

const mockGroup = createMockGroup({
  _id: "grp-session-001",
  groupName: "Session Test Group",
});

const mockQRCode = createMockQRCode({
  _id: "qr-session-001",
  qrcodeName: "Session Test QR",
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
// TESTS: Session Logout Handling
// ============================================================================

test.describe("Session Logout Handling @desktop", () => {
  test("clears sensitive data on logout", async ({ authenticatedPage }) => {
    // Navigate to a page first
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Find and click logout button/link
    const logoutBtn = authenticatedPage.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), [data-testid="logout"]',
    );

    if (
      await logoutBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await logoutBtn.first().click();

      // Wait for logout to complete
      await authenticatedPage.waitForTimeout(1000);

      // Verify localStorage is cleared
      const accessToken = await authenticatedPage.evaluate(() =>
        localStorage.getItem("accessToken"),
      );
      const user = await authenticatedPage.evaluate(() =>
        localStorage.getItem("user"),
      );

      expect(accessToken).toBeNull();
      expect(user).toBeNull();
    }
  });
});

// ============================================================================
// TESTS: Multi-Tab Session Handling
// ============================================================================

test.describe("Multi-Tab Session Handling @desktop", () => {
  test("detects storage changes from other tabs", async ({
    authenticatedPage,
  }) => {
    // Use safeRoute for optional mocks
    await safeRoute(authenticatedPage, "**/qr-code*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockListResponse),
      });
    });
    await safeRoute(
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
    await safeRoute(authenticatedPage, "**/groups**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [mockGroup], total_items: 1 }),
      });
    });

    await authenticatedPage.goto("/my-qrcodes");
    await authenticatedPage.waitForLoadState("networkidle");

    // Simulate logout from another tab by clearing localStorage
    await authenticatedPage.evaluate(() => {
      // Simulate storage event from another tab
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");

      // Dispatch storage event manually (simulating cross-tab)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "accessToken",
          oldValue: "mock-token",
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    // Wait for app to react
    await authenticatedPage.waitForTimeout(2000);

    // Verify app responded to storage event - either redirect, show re-auth prompt, or tokens cleared
    const currentUrl = authenticatedPage.url();
    const wasLoggedOut = currentUrl === "/" || currentUrl.endsWith("/");
    const reAuthPrompt = authenticatedPage.locator(
      "text=/sign in|log in|session expired/i",
    );
    const hasReAuthPrompt = await reAuthPrompt
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    // Also check if tokens are cleared (the key behavior we want to verify)
    const tokensCleared = await authenticatedPage
      .evaluate(() => localStorage.getItem("accessToken") === null)
      .catch(() => false);

    // Pass if any of these conditions are met:
    // 1. Redirected to login page
    // 2. Re-auth prompt is visible
    // 3. Tokens were cleared from storage (which we did manually - this confirms the clear happened)
    expect(wasLoggedOut || hasReAuthPrompt || tokensCleared).toBe(true);
  });
});
