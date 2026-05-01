/**
 * Security Test Fixture for Playwright E2E Tests
 *
 * Provides a specialized test fixture for security testing that includes:
 * - Security helper utilities as a fixture
 * - Request capturing for token leakage detection
 * - XSS alert monitoring
 * - Convenient security assertions
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../fixtures/security-test';
 *
 * test('should prevent XSS in comment field', async ({ page, securityHelpers }) => {
 *   await page.goto('/comments');
 *   await securityHelpers.testXSSInField(
 *     page,
 *     '[data-testid="comment-input"]',
 *     '[data-testid="submit-comment"]'
 *   );
 * });
 *
 * test('should not leak tokens to third parties', async ({ page, capturedRequests, securityHelpers }) => {
 *   await page.goto('/dashboard');
 *   const thirdPartyRequests = await securityHelpers.getRequestsToThirdParty(page, capturedRequests);
 *   await securityHelpers.verifyNoTokenInRequests(thirdPartyRequests);
 * });
 * ```
 */

import { test as base, expect, Request, Page, Dialog } from "@playwright/test";
import * as securityHelpers from "../utils/security-helpers";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Security test fixture types
 */
type SecurityTestFixtures = {
  /**
   * Security helper utilities module.
   * Contains all XSS, token, redirect, and other security testing functions.
   */
  securityHelpers: typeof securityHelpers;

  /**
   * Array of all requests captured during the test.
   * Automatically populated by the fixture - no setup required.
   * Use with securityHelpers.getRequestsToThirdParty() and
   * securityHelpers.verifyNoTokenInRequests() for token leakage testing.
   */
  capturedRequests: Request[];

  /**
   * Whether any JavaScript alerts were triggered during the test.
   * Automatically monitored - useful for detecting XSS attacks.
   */
  alertTriggered: { triggered: boolean; message: string | null };
};

/**
 * Security test configuration options
 */
type SecurityTestOptions = {
  /**
   * Whether to automatically fail tests if any alerts are triggered.
   * Useful for detecting XSS vulnerabilities.
   * @default false
   */
  failOnAlert: boolean;

  /**
   * Whether to automatically fail tests if tokens are leaked to third parties.
   * @default false
   */
  failOnTokenLeak: boolean;

  /**
   * Custom first-party domains for token leak detection.
   * Defaults to securityHelpers.DEFAULT_FIRST_PARTY_DOMAINS
   */
  firstPartyDomains: string[];
};

// ============================================================================
// FIXTURE DEFINITION
// ============================================================================

/**
 * Extended test instance with security testing fixtures.
 *
 * This fixture provides:
 * - `securityHelpers`: All security testing utilities
 * - `capturedRequests`: Auto-captured HTTP requests
 * - `alertTriggered`: Alert/dialog monitoring
 *
 * @example Basic XSS testing
 * ```typescript
 * test('form field escapes XSS', async ({ page, securityHelpers }) => {
 *   await page.goto('/profile/edit');
 *   await securityHelpers.testXSSInField(
 *     page,
 *     '#name-input',
 *     'button[type="submit"]'
 *   );
 * });
 * ```
 *
 * @example Token leakage testing
 * ```typescript
 * test('tokens not leaked to analytics', async ({ page, capturedRequests, securityHelpers }) => {
 *   await page.goto('/dashboard');
 *   await page.click('button.action');
 *
 *   const thirdPartyRequests = await securityHelpers.getRequestsToThirdParty(
 *     page,
 *     capturedRequests
 *   );
 *   await securityHelpers.verifyNoTokenInRequests(thirdPartyRequests);
 * });
 * ```
 */
export const test = base.extend<SecurityTestFixtures, SecurityTestOptions>({
  // ---- Options with defaults ----
  failOnAlert: [false, { scope: "worker", option: true }],
  failOnTokenLeak: [false, { scope: "worker", option: true }],
  firstPartyDomains: [
    securityHelpers.DEFAULT_FIRST_PARTY_DOMAINS,
    { scope: "worker", option: true },
  ],

  // ---- Security helpers fixture ----
  // eslint-disable-next-line no-empty-pattern
  securityHelpers: async ({}, use) => {
    // Simply provide the security helpers module
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(securityHelpers);
  },

  // ---- Captured requests fixture ----
  capturedRequests: async (
    { page, failOnTokenLeak, firstPartyDomains },
    use,
  ) => {
    const requests: Request[] = [];

    // Capture all requests
    page.on("request", (request) => {
      requests.push(request);
    });

    // Provide requests array to the test
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(requests);

    // After test: optionally verify no token leakage
    if (failOnTokenLeak) {
      const thirdPartyRequests = await securityHelpers.getRequestsToThirdParty(
        page,
        requests,
        firstPartyDomains,
      );

      if (thirdPartyRequests.length > 0) {
        try {
          await securityHelpers.verifyNoTokenInRequests(thirdPartyRequests);
        } catch (error) {
          // Re-throw with additional context
          if (error instanceof Error) {
            throw new Error(
              `[Security Fixture] Token leak detected:\n${error.message}`,
            );
          }
          throw error;
        }
      }
    }
  },

  // ---- Alert monitoring fixture ----
  alertTriggered: async ({ page, failOnAlert }, use) => {
    const alertState = { triggered: false, message: null as string | null };

    // Monitor for dialogs (alerts, confirms, prompts)
    page.on("dialog", async (dialog) => {
      alertState.triggered = true;
      alertState.message = dialog.message();
      await dialog.dismiss();
    });

    // Provide alert state to the test
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(alertState);

    // After test: optionally fail if alert was triggered
    if (failOnAlert && alertState.triggered) {
      throw new Error(
        `[Security Fixture] XSS alert detected: "${alertState.message}"`,
      );
    }
  },
});

// Re-export expect and security helpers for convenience
export { expect };
export { securityHelpers };

// Re-export commonly used constants and types
export {
  XSS_VECTORS,
  URL_XSS_VECTORS,
  OPEN_REDIRECT_VECTORS,
  SQL_INJECTION_VECTORS,
  NOSQL_INJECTION_VECTORS,
  PATH_TRAVERSAL_VECTORS,
  DEFAULT_FIRST_PARTY_DOMAINS,
  DEFAULT_TOKEN_PATTERNS,
  DEFAULT_PERMISSION_MATRIX,
  EXPECTED_SECURITY_HEADERS,
} from "../utils/security-helpers";

export type { RolePermissionMatrix } from "../utils/security-helpers";

// ============================================================================
// TEST CONFIGURATION PRESETS
// ============================================================================

/**
 * Pre-configured options for different security testing modes.
 *
 * @example Use in playwright.config.ts
 * ```typescript
 * import { securityTestConfig } from './e2e/fixtures/security-test';
 *
 * export default defineConfig({
 *   projects: [
 *     {
 *       name: 'security-strict',
 *       use: {
 *         ...securityTestConfig.strict,
 *       },
 *     },
 *   ],
 * });
 * ```
 */
export const securityTestConfig = {
  /**
   * Strict mode: Automatically fail on any security issues detected.
   * Use for CI/CD security testing.
   */
  strict: {
    failOnAlert: true,
    failOnTokenLeak: true,
  },

  /**
   * Lenient mode: Don't auto-fail, let tests handle assertions.
   * Use for development and debugging.
   */
  lenient: {
    failOnAlert: false,
    failOnTokenLeak: false,
  },

  /**
   * XSS-focused mode: Only auto-fail on XSS (alerts).
   */
  xssFocused: {
    failOnAlert: true,
    failOnTokenLeak: false,
  },

  /**
   * Token-focused mode: Only auto-fail on token leakage.
   */
  tokenFocused: {
    failOnAlert: false,
    failOnTokenLeak: true,
  },
};

// ============================================================================
// CONVENIENCE ASSERTION HELPERS
// ============================================================================

/**
 * Assert that a page doesn't have any obvious XSS vulnerabilities.
 * Runs a quick XSS scan on common input fields.
 *
 * @param page - Playwright Page object
 * @param inputSelectors - CSS selectors for inputs to test
 */
export async function assertNoXSSVulnerabilities(
  page: Page,
  inputSelectors: string[],
): Promise<void> {
  let alertTriggered = false;
  let alertMessage = "";

  page.on("dialog", async (dialog: Dialog) => {
    alertTriggered = true;
    alertMessage = dialog.message();
    await dialog.dismiss();
  });

  // Test a subset of XSS vectors for quick scanning
  const quickVectors = securityHelpers.XSS_VECTORS.slice(0, 5);

  for (const selector of inputSelectors) {
    const input = page.locator(selector);

    if (await input.isVisible().catch(() => false)) {
      for (const vector of quickVectors) {
        await input.fill(vector);
        await page.waitForTimeout(50);

        if (alertTriggered) {
          throw new Error(
            `XSS vulnerability in ${selector}: Alert "${alertMessage}" triggered by: ${vector}`,
          );
        }

        await input.fill("");
      }
    }
  }
}

/**
 * Assert that a form has proper CSRF protection.
 *
 * @param page - Playwright Page object
 * @param formSelector - CSS selector for the form
 */
export async function assertCSRFProtection(
  page: Page,
  formSelector: string,
): Promise<void> {
  const hasProtection = await securityHelpers.hasCSRFProtection(
    page,
    formSelector,
  );

  if (!hasProtection) {
    throw new Error(
      `Form ${formSelector} does not have CSRF protection. ` +
        `Expected hidden CSRF token input or meta tag.`,
    );
  }
}

/**
 * Assert that a page has proper security headers.
 *
 * @param response - Playwright Response object
 */
export function assertSecurityHeaders(headers: Record<string, string>): void {
  const { missing, incorrect } = securityHelpers.checkSecurityHeaders(headers);

  if (missing.length > 0 || incorrect.length > 0) {
    const issues: string[] = [];

    if (missing.length > 0) {
      issues.push(`Missing headers: ${missing.join(", ")}`);
    }
    if (incorrect.length > 0) {
      issues.push(`Incorrect headers: ${incorrect.join(", ")}`);
    }

    throw new Error(`Security header issues:\n${issues.join("\n")}`);
  }
}

/**
 * Assert that a redirect URL is safe.
 *
 * @param redirectUrl - The URL to validate
 * @param currentOrigin - Current page origin
 * @param allowedDomains - Additional allowed domains
 */
export function assertSafeRedirect(
  redirectUrl: string,
  currentOrigin: string,
  allowedDomains: string[] = [],
): void {
  const isSafe = securityHelpers.isRedirectSafe(
    redirectUrl,
    allowedDomains,
    currentOrigin,
  );

  if (!isSafe) {
    throw new Error(
      `Unsafe redirect detected: "${redirectUrl}" from origin "${currentOrigin}"`,
    );
  }
}

/**
 * Assert that user role has expected permissions.
 *
 * @param role - User role to check
 * @param expectedOperations - Operations the role should have
 * @param unexpectedOperations - Operations the role should NOT have
 */
export function assertRolePermissions(
  role: keyof securityHelpers.RolePermissionMatrix,
  expectedOperations: string[],
  unexpectedOperations: string[],
): void {
  const errors: string[] = [];

  for (const op of expectedOperations) {
    if (!securityHelpers.hasPermission(role, op)) {
      errors.push(`Role "${role}" should have permission for "${op}"`);
    }
  }

  for (const op of unexpectedOperations) {
    if (securityHelpers.hasPermission(role, op)) {
      errors.push(`Role "${role}" should NOT have permission for "${op}"`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Permission assertion failed:\n${errors.join("\n")}`);
  }
}
