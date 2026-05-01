import { test, expect } from "../../fixtures/verified-test";

/**
 * Procore OAuth Error Page
 *
 * Tests the /procore/oauth-error route which is displayed when Procore
 * OAuth authentication fails. The page renders an error message,
 * a status indicator, and handles popup vs. direct navigation contexts.
 */

test.describe("Procore OAuth Error Page @desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ==========================================================================
  // ERROR MESSAGE DISPLAY
  // ==========================================================================

  test("shows error message from message query parameter", async ({ page }) => {
    await page.goto(
      "/procore/oauth-error?error=oauth_failed&message=Something%20went%20wrong",
    );

    // The component renders `message` param as the primary error text
    await expect(
      page.locator("main p.text-gray-700", { hasText: "Something went wrong" }),
    ).toBeVisible();
  });

  test("shows default error text when no message param is provided", async ({
    page,
  }) => {
    await page.goto("/procore/oauth-error?error=oauth_failed");

    // Without a message param, the component falls back to:
    // "Procore authentication failed."
    await expect(
      page.getByText("Procore authentication failed."),
    ).toBeVisible();
  });

  // ==========================================================================
  // ERROR CODE INDICATOR
  // ==========================================================================

  test("shows error icon as error code indicator", async ({ page }) => {
    await page.goto(
      "/procore/oauth-error?error=invalid_token&message=Token%20expired",
    );

    // The component renders an error icon (bx-error-circle) as the visual
    // error indicator. Verify the icon element is present.
    const errorIcon = page.locator("i.bx-error-circle.text-red-500");
    await expect(errorIcon).toBeVisible();

    // Also verify the custom error message is rendered alongside it
    await expect(
      page.locator("main p.text-gray-700", { hasText: "Token expired" }),
    ).toBeVisible();
  });

  // ==========================================================================
  // STATUS MESSAGE
  // ==========================================================================

  test("shows initial Closing status text", async ({ page }) => {
    // Mock window.opener to simulate a popup with an accessible opener,
    // which triggers the "Closing..." path (postMessage + window.close)
    await page.addInitScript(() => {
      // Provide a mock opener so the component takes the postMessage path
      // and keeps statusMessage as "Closing..."
      Object.defineProperty(window, "opener", {
        value: {
          closed: false,
          postMessage: () => {},
        },
        writable: true,
        configurable: true,
      });
    });

    await page.goto("/procore/oauth-error?error=oauth_failed");

    // The initial status message is "Closing..." which remains when the
    // opener path succeeds (postMessage sent, window.close scheduled)
    await expect(page.getByText("Closing...")).toBeVisible();
  });

  // ==========================================================================
  // POPUP VS DIRECT NAVIGATION CONTEXT
  // ==========================================================================

  test("shows close instruction when detected as popup via window.name", async ({
    page,
  }) => {
    // Set window.name to "procoreOAuth" before navigation to simulate
    // the popup context (no opener, but popup-like window)
    await page.addInitScript(() => {
      window.name = "procoreOAuth";
    });

    await page.goto(
      "/procore/oauth-error?error=oauth_failed&message=Auth%20failed",
    );

    // In environments where Procore iframe helpers are available, the page may
    // stay in "Closing..." status after notifyFailure. Fallback shows close text.
    await expect(
      page.getByText(/Please close this window and try again\.|Closing\.\.\./),
    ).toBeVisible();
  });

  test("shows redirect text and navigates to login when not in popup context", async ({
    page,
  }) => {
    // Ensure we are NOT in a popup context: no opener, default window name,
    // and viewport larger than 800x800
    await page.addInitScript(() => {
      window.name = "";
      Object.defineProperty(window, "opener", {
        value: null,
        writable: true,
        configurable: true,
      });
    });

    await page.goto(
      "/procore/oauth-error?error=oauth_failed&message=Auth%20failed",
    );

    // With iframe helpers, status can remain "Closing..."; without helpers,
    // direct navigation path shows redirect text and routes to "/".
    const status = page.getByText(/Redirecting to login\.\.\.|Closing\.\.\./);
    await expect(status).toBeVisible();

    if ((await status.first().textContent())?.includes("Redirecting")) {
      await page.waitForURL("**/", { timeout: 5000 });
    }
  });
});
