import { Page, expect } from "@playwright/test";

/**
 * Get a nested value from an object using dot notation
 * @example getNestedValue({ a: { b: 'value' } }, 'a.b') => 'value'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Assert that specific fields from mock data are visible on the page
 *
 * @param page - Playwright page object
 * @param mockData - The mock data object
 * @param fields - Array of field paths (supports dot notation for nested fields)
 *
 * @example
 * await assertMockDataVisible(page, mockInspection, ['name', 'number', 'inspection_type.name']);
 */
export async function assertMockDataVisible(
  page: Page,
  mockData: Record<string, unknown>,
  fields: string[],
): Promise<void> {
  for (const field of fields) {
    const value = getNestedValue(mockData, field);

    if (value === null || value === undefined) {
      continue; // Skip null/undefined values
    }

    if (typeof value === "string" && value.length > 0) {
      await expect(
        page.locator(`text=${value}`).first(),
        `Expected mock field "${field}" with value "${value}" to be visible`,
      ).toBeVisible();
    } else if (typeof value === "number") {
      await expect(
        page.locator(`text=${value}`).first(),
        `Expected mock field "${field}" with value "${value}" to be visible`,
      ).toBeVisible();
    }
  }
}

/**
 * Assert that specific values are NOT visible on the page
 * Useful for testing minimal data scenarios
 *
 * @param page - Playwright page object
 * @param values - Array of string values that should not be visible
 * @param options - Optional configuration
 */
export async function assertFieldsNotVisible(
  page: Page,
  values: string[],
  options?: { timeout?: number },
): Promise<void> {
  const { timeout = 5000 } = options || {};

  for (const value of values) {
    await expect(
      page.locator(`text=${value}`).first(),
      `Expected "${value}" to NOT be visible`,
    ).not.toBeVisible({ timeout });
  }
}

/**
 * Assert that an error state is displayed
 *
 * @param page - Playwright page object
 * @param options - Configuration for error detection
 */
export async function assertErrorStateVisible(
  page: Page,
  options?: {
    errorText?: string;
    hasRetryButton?: boolean;
  },
): Promise<void> {
  const { errorText, hasRetryButton = true } = options || {};

  // Check for common error indicators
  const errorIndicators = [
    page.locator("text=Something went wrong"),
    page.locator("text=Error"),
    page.locator("text=Not Found"),
    page.locator('[data-testid="error-state"]'),
  ];

  let foundError = false;
  for (const indicator of errorIndicators) {
    if (await indicator.isVisible().catch(() => false)) {
      foundError = true;
      break;
    }
  }

  if (!foundError && errorText) {
    await expect(
      page.locator(`text=${errorText}`),
      `Expected error text "${errorText}" to be visible`,
    ).toBeVisible();
  } else if (!foundError) {
    throw new Error("No error state indicator found on page");
  }

  if (hasRetryButton) {
    await expect(
      page.getByRole("button", { name: /try again|retry/i }),
      "Expected retry button to be visible",
    ).toBeVisible();
  }
}

/**
 * Assert that a loading state is displayed
 *
 * @param page - Playwright page object
 */
export async function assertLoadingStateVisible(page: Page): Promise<void> {
  const loadingIndicators = [
    page.locator(".taliho-splash-screen"),
    page.locator('[data-testid="loading"]'),
    page.locator(".animate-spin"),
    page.locator("text=Loading"),
  ];

  let foundLoading = false;
  for (const indicator of loadingIndicators) {
    if (await indicator.isVisible().catch(() => false)) {
      foundLoading = true;
      break;
    }
  }

  if (!foundLoading) {
    throw new Error("No loading state indicator found on page");
  }
}

/**
 * Wait for loading state to disappear
 *
 * @param page - Playwright page object
 * @param options - Configuration
 */
export async function waitForLoadingComplete(
  page: Page,
  options?: { timeout?: number },
): Promise<void> {
  const { timeout = 10000 } = options || {};

  // Wait for splash screen to disappear
  await page
    .locator(".taliho-splash-screen")
    .waitFor({ state: "hidden", timeout })
    .catch(() => {
      // Splash screen might not exist, that's okay
    });

  // Wait for any loading spinners to disappear
  await page
    .locator(".animate-spin")
    .waitFor({ state: "hidden", timeout })
    .catch(() => {
      // Spinner might not exist, that's okay
    });
}

type RouteTrackerLike = {
  getCallCount: (pattern: string) => number;
  getSummary?: () => string;
};

/**
 * Wait until all mocked routes have been called at least once.
 * Helps stabilize tests that can race under full parallel suite load.
 */
export async function waitForMockRoutesCalled(
  routeTracker: RouteTrackerLike,
  patterns: readonly string[],
  options?: { timeout?: number; pollInterval?: number },
): Promise<void> {
  const { timeout = 10000, pollInterval = 100 } = options || {};
  const uniquePatterns = [...new Set(patterns)];
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const uncalled = uniquePatterns.filter(
      (pattern) => routeTracker.getCallCount(pattern) === 0,
    );

    if (uncalled.length === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  const uncalled = uniquePatterns.filter(
    (pattern) => routeTracker.getCallCount(pattern) === 0,
  );
  const summary = routeTracker.getSummary?.();
  const summaryText = summary ? `\n\n${summary}` : "";

  throw new Error(
    `Timed out waiting for mocked routes to be called: ${uncalled.join(", ")}${summaryText}`,
  );
}

/**
 * Assert that a specific tab is active/selected
 *
 * @param page - Playwright page object
 * @param tabName - Name of the tab to check
 */
export async function assertTabActive(
  page: Page,
  tabName: string,
): Promise<void> {
  const tab = page.getByRole("button", { name: new RegExp(tabName, "i") });
  await expect(tab).toBeVisible();

  // Check for active state indicators (common patterns)
  const isActive = await tab.evaluate((el) => {
    return (
      el.classList.contains("active") ||
      el.classList.contains("selected") ||
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("data-active") === "true"
    );
  });

  if (!isActive) {
    // If no explicit active state, check visual indicators
    const hasActiveStyle = await tab.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      // Check for common active indicators like border-bottom or background
      return (
        styles.borderBottomWidth !== "0px" ||
        styles.backgroundColor !== "rgba(0, 0, 0, 0)"
      );
    });

    if (!hasActiveStyle) {
      console.warn(
        `Tab "${tabName}" may not be active - no active indicator found`,
      );
    }
  }
}

/**
 * Click a tab and verify it becomes active
 *
 * @param page - Playwright page object
 * @param tabName - Name of the tab to click
 */
export async function clickTab(page: Page, tabName: string): Promise<void> {
  const tab = page.getByRole("button", { name: new RegExp(tabName, "i") });
  await expect(tab).toBeVisible();
  await tab.click();
  // Give time for any animations
  await page.waitForTimeout(100);
}

/**
 * Assert that an edit button is visible (for permission testing)
 *
 * @param page - Playwright page object
 * @param options - Configuration
 */
export async function assertEditButtonVisible(
  page: Page,
  options?: { shouldBeVisible?: boolean },
): Promise<void> {
  const { shouldBeVisible = true } = options || {};

  const editButton = page.getByRole("button", { name: /edit in taliho/i });

  if (shouldBeVisible) {
    await expect(editButton, "Edit button should be visible").toBeVisible();
  } else {
    await expect(
      editButton,
      "Edit button should NOT be visible",
    ).not.toBeVisible();
  }
}

/**
 * Assert that the back button is visible and functional
 *
 * @param page - Playwright page object
 */
export async function assertBackButtonVisible(page: Page): Promise<void> {
  // Back button is typically the first button with an SVG (chevron icon)
  const backButton = page
    .locator("button")
    .filter({ has: page.locator("svg") })
    .first();
  await expect(backButton, "Back button should be visible").toBeVisible();
}

/**
 * Compare two objects for equality (useful for verifying API responses)
 *
 * @param actual - Actual object
 * @param expected - Expected object
 * @param fields - Specific fields to compare (if not provided, compares all)
 */
export function assertObjectsMatch(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  fields?: string[],
): void {
  const fieldsToCompare = fields || Object.keys(expected);

  for (const field of fieldsToCompare) {
    const actualValue = getNestedValue(actual, field);
    const expectedValue = getNestedValue(expected, field);

    if (actualValue !== expectedValue) {
      throw new Error(
        `Field "${field}" mismatch:\n` +
          `  Expected: ${JSON.stringify(expectedValue)}\n` +
          `  Actual: ${JSON.stringify(actualValue)}`,
      );
    }
  }
}
