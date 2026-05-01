import { Page, Route } from "@playwright/test";

interface RouteEntry {
  count: number;
  lastRequest?: {
    url: string;
    method: string;
    postData: string | null;
  };
}

interface BodyValidationError {
  pattern: string;
  url: string;
  error: string;
}

interface UnmockedRequest {
  url: string;
  method: string;
}

/**
 * Patterns to ignore when detecting unmocked API calls.
 * These are third-party services, dev server artifacts, browser requests,
 * or endpoints that are commonly mocked via page.route() in fixtures.
 */
const IGNORE_PATTERNS = [
  "**/rollbar.com/**",
  "**/*.hot-update.json",
  "**/node_modules/**",
  "**/__vite_ping",
  "**/favicon.ico",
  "**/*.woff",
  "**/*.woff2",
  "**/*.ttf",
  "**/*.eot",
  "**/fonts/**",
  "**/__vite-plugin-**",
  "**/sockjs-node/**",
  "**/ws/**",
  "**/.vite/**",
  // Endpoints commonly mocked via page.route() in authenticated-test.ts fixture
  "**/procore/status**",
  "**/categories/classes**",
  "**/aggregation/all-projects/**",
  "**/procore/inspection-templates**",
  "**/auth/refresh**",
];

/**
 * HTTP methods that should be tracked for unmocked API detection.
 * OPTIONS and HEAD are typically preflight/info requests and not data fetches.
 */
const TRACKED_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * RouteTracker - Tracks API route interceptions to verify mocks are working correctly
 *
 * Features:
 * - Tracks which routes were intercepted and how many times
 * - Detects unmocked API calls that might cause false positives
 * - Supports delayed responses for loading state tests
 * - Provides assertion helpers for verification
 */
export class RouteTracker {
  private page: Page;
  private interceptedRoutes: Map<string, RouteEntry> = new Map();
  private unmockedRequests: UnmockedRequest[] = [];
  private bodyValidationErrors: BodyValidationError[] = [];
  private isListening: boolean = false;

  constructor(page: Page) {
    this.page = page;
    this.setupRequestListener();
  }

  /**
   * Document requests are top-level page navigations and should never be
   * treated as backend API calls for E2E route mocking.
   */
  private isDocumentRequest(request: { resourceType(): string }): boolean {
    return request.resourceType() === "document";
  }

  /**
   * Listen for all requests to detect unmocked API calls
   */
  private setupRequestListener(): void {
    if (this.isListening) return;
    this.isListening = true;

    this.page.on("request", (request) => {
      const url = request.url();
      const method = request.method();

      // Skip top-level navigations (e.g. /groups, /procore/select-company)
      // so they are not reported as unmocked API calls.
      if (this.isDocumentRequest(request)) {
        return;
      }

      // Only track specific HTTP methods (skip OPTIONS, HEAD, etc.)
      if (!TRACKED_HTTP_METHODS.includes(method)) {
        return;
      }

      // Skip ignored patterns (third-party services, dev artifacts)
      if (this.matchesIgnorePattern(url)) {
        return;
      }

      if (this.isApiRequest(url) && !this.isIntercepted(url)) {
        this.unmockedRequests.push({ url, method });
      }
    });
  }

  /**
   * Check if a URL matches any of the ignore patterns
   */
  private matchesIgnorePattern(url: string): boolean {
    for (const pattern of IGNORE_PATTERNS) {
      const cleanPattern = pattern
        .replace(/\*\*/g, "<<GLOBSTAR>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<GLOBSTAR>>/g, ".*");
      const regex = new RegExp(cleanPattern);
      if (regex.test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a URL is a Vite dev server source file request.
   * These should never be intercepted by API mocks — they are JavaScript
   * modules served by Vite, not backend API calls.
   */
  private isSourceFileRequest(url: string): boolean {
    return (
      url.includes("/src/") ||
      url.includes("/node_modules/") ||
      /\.(tsx?|jsx?|css|scss|svg|png|jpg|woff2?|ttf)(\?|$)/.test(url)
    );
  }

  /**
   * Check if a URL is an API request that should be mocked.
   * These patterns match backend API endpoints that tests should intercept.
   */
  private isApiRequest(url: string): boolean {
    if (this.isSourceFileRequest(url)) return false;

    // Skip third-party services that are handled separately (not part of our backend)
    if (url.includes("api.rollbar.com")) return false;

    const apiPatterns = [
      "/api/",
      "/procore/",
      "/aggregation/",
      "/qr-code/",
      "/verify-password",
      "/folder/",
      "/document/",
      "/auth/",
      "/health",
      "/files/",
      "/categories/",
    ];
    return apiPatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Check if a URL matches any of our mocked routes
   */
  private isIntercepted(url: string): boolean {
    for (const pattern of this.interceptedRoutes.keys()) {
      // Convert glob pattern to regex-like matching
      // Use placeholder to avoid ** -> .* -> .[^/]* double-replacement
      const cleanPattern = pattern
        .replace(/\*\*/g, "<<GLOBSTAR>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<GLOBSTAR>>/g, ".*");
      const regex = new RegExp(cleanPattern);
      if (regex.test(url)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mock an API route and track its interceptions
   *
   * @param pattern - Glob pattern for the route (e.g., '**\/procore\/inspections**')
   * @param response - Response data to return (will be JSON stringified)
   * @param options - Optional configuration
   */
  async mockRoute<TBody = Record<string, unknown>>(
    pattern: string,
    response: object | object[],
    options?: {
      status?: number;
      delay?: number;
      contentType?: string;
      validateBody?: (body: TBody) => void;
    },
  ): Promise<void> {
    const {
      status = 200,
      delay = 0,
      contentType = "application/json",
      validateBody,
    } = options || {};

    this.interceptedRoutes.set(pattern, { count: 0 });

    await this.page.route(pattern, async (route) => {
      const request = route.request();

      // Don't intercept Vite dev server source file requests — broad glob
      // patterns like "**/qr-code*" can accidentally match source file URLs
      // (e.g. /src/api/endpoints/qr-codes.ts), replacing JS modules with
      // JSON mock data and breaking the app.
      // Also skip document navigations to avoid returning JSON for frontend
      // routes like /groups or /admin/nfc.
      if (
        this.isDocumentRequest(request) ||
        this.isSourceFileRequest(request.url())
      ) {
        await route.continue();
        return;
      }

      const entry = this.interceptedRoutes.get(pattern)!;
      entry.count++;
      entry.lastRequest = {
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
      };

      if (validateBody) {
        const postData = request.postData();
        if (postData) {
          try {
            const parsedBody = JSON.parse(postData) as TBody;
            validateBody(parsedBody);
          } catch (error) {
            this.bodyValidationErrors.push({
              pattern,
              url: request.url(),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      await route.fulfill({
        status,
        contentType,
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Mock an error response for negative testing
   */
  async mockErrorResponse(
    pattern: string,
    status: number,
    body?: object,
  ): Promise<void> {
    await this.mockRoute(
      pattern,
      body || {
        error: "Error",
        statusCode: status,
        message: `Mock error response with status ${status}`,
      },
      { status },
    );
  }

  /**
   * Get the number of times a route was called
   */
  getCallCount(pattern: string): number {
    return this.interceptedRoutes.get(pattern)?.count || 0;
  }

  /**
   * Check if a route was intercepted at least once
   */
  wasIntercepted(pattern: string): boolean {
    return this.getCallCount(pattern) > 0;
  }

  /**
   * Get the last request data for a route
   */
  getLastRequest(pattern: string): RouteEntry["lastRequest"] | undefined {
    return this.interceptedRoutes.get(pattern)?.lastRequest;
  }

  /**
   * Get all unmocked API requests that were made
   */
  getUnmockedRequests(): UnmockedRequest[] {
    return [...this.unmockedRequests];
  }

  /**
   * Get all unmocked API request URLs (for backwards compatibility)
   */
  getUnmockedRequestUrls(): string[] {
    return this.unmockedRequests.map((r) => r.url);
  }

  /**
   * Get suggested mock patterns for unmocked API calls.
   * This helps developers quickly add the necessary mocks.
   */
  getMissingMocks(): string[] {
    const suggestions: string[] = [];

    for (const { url, method } of this.unmockedRequests) {
      const suggestion = this.suggestMockPattern(url, method);
      if (!suggestions.includes(suggestion)) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Generate a suggested mock pattern for a given URL
   */
  private suggestMockPattern(url: string, method: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Extract path segments and replace IDs with wildcards
      const segments = pathname.split("/").filter(Boolean);
      const patternSegments = segments.map((segment) => {
        // Replace UUIDs, MongoDB ObjectIds, or numeric IDs with wildcards
        if (
          /^[0-9a-f]{24}$/i.test(segment) || // MongoDB ObjectId
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            segment,
          ) || // UUID
          /^\d+$/.test(segment) // Numeric ID
        ) {
          return "*";
        }
        return segment;
      });

      const patternPath = patternSegments.join("/");
      const queryString = urlObj.search ? "**" : "";

      return `// ${method} ${url}\nawait routeTracker.mockRoute("**/${patternPath}${queryString}", { /* response data */ });`;
    } catch {
      // If URL parsing fails, return a simple suggestion
      return `// ${method} ${url}\nawait routeTracker.mockRoute("${url}", { /* response data */ });`;
    }
  }

  /**
   * Get all body validation errors that occurred
   */
  getBodyValidationErrors(): BodyValidationError[] {
    return [...this.bodyValidationErrors];
  }

  /**
   * Assert that no body validation errors occurred
   * Throws an error if any validateBody callback threw
   */
  assertBodyValidations(): void {
    if (this.bodyValidationErrors.length > 0) {
      throw new Error(
        `Request body validation failed for ${this.bodyValidationErrors.length} request(s):\n` +
          this.bodyValidationErrors
            .map(
              (e) =>
                `  - ${e.pattern}\n    URL: ${e.url}\n    Error: ${e.error}`,
            )
            .join("\n"),
      );
    }
  }

  /**
   * Assert that all mocked routes were called at least once
   * Throws an error if any mocked route was never called
   */
  assertAllRoutesIntercepted(): void {
    const uncalledRoutes: string[] = [];
    const calledRoutes: string[] = [];

    for (const [pattern, data] of this.interceptedRoutes) {
      if (data.count === 0) {
        uncalledRoutes.push(pattern);
      } else {
        calledRoutes.push(`${pattern} (${data.count} call(s))`);
      }
    }

    const errors: string[] = [];

    if (uncalledRoutes.length > 0) {
      let message =
        `\n╔══════════════════════════════════════════════════════════════╗\n` +
        `║  MOCKED ROUTES NEVER CALLED                                   ║\n` +
        `╠══════════════════════════════════════════════════════════════╣\n`;

      for (const route of uncalledRoutes) {
        message += `║  ✗ ${route.padEnd(58)}║\n`;
      }

      message +=
        `╠══════════════════════════════════════════════════════════════╣\n` +
        `║  Possible causes:                                             ║\n` +
        `║  • Route pattern doesn't match actual request URL             ║\n` +
        `║  • Component didn't make the expected API call                ║\n` +
        `║  • Test navigation didn't trigger the data fetch              ║\n` +
        `╚══════════════════════════════════════════════════════════════╝\n`;

      if (calledRoutes.length > 0) {
        message += `\nRoutes that WERE called:\n`;
        for (const route of calledRoutes) {
          message += `  ✓ ${route}\n`;
        }
      }

      errors.push(message);
    }

    if (this.bodyValidationErrors.length > 0) {
      errors.push(
        `Request body validation failed for ${this.bodyValidationErrors.length} request(s):\n` +
          this.bodyValidationErrors
            .map(
              (e) =>
                `  - ${e.pattern}\n    URL: ${e.url}\n    Error: ${e.error}`,
            )
            .join("\n"),
      );
    }

    if (errors.length > 0) {
      throw new Error(errors.join("\n\n"));
    }
  }

  /**
   * Assert that no unmocked API calls were made
   * Throws an error if any API request wasn't intercepted
   */
  assertNoUnmockedApiCalls(): void {
    if (this.unmockedRequests.length > 0) {
      const suggestions = this.getMissingMocks();

      let message =
        `\n╔══════════════════════════════════════════════════════════════╗\n` +
        `║  UNMOCKED API CALLS DETECTED                                  ║\n` +
        `╠══════════════════════════════════════════════════════════════╣\n`;

      for (const { url, method } of this.unmockedRequests) {
        const shortUrl =
          url.length > 55 ? "..." + url.slice(-52) : url.padEnd(55);
        message += `║  ${method.padEnd(6)} ${shortUrl} ║\n`;
      }

      message +=
        `╠══════════════════════════════════════════════════════════════╣\n` +
        `║  Risks:                                                       ║\n` +
        `║  • False positives if real API returns expected data          ║\n` +
        `║  • Flaky tests due to network/server state                    ║\n` +
        `╠══════════════════════════════════════════════════════════════╣\n` +
        `║  Suggested mocks to add:                                      ║\n` +
        `╚══════════════════════════════════════════════════════════════╝\n\n`;

      message += suggestions.join("\n\n") + "\n";

      throw new Error(message);
    }
  }

  /**
   * Run all verification assertions
   */
  assertAllVerifications(): void {
    this.assertAllRoutesIntercepted();
    this.assertNoUnmockedApiCalls();
    this.assertBodyValidations();
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.interceptedRoutes.clear();
    this.unmockedRequests = [];
    this.bodyValidationErrors = [];
  }

  /**
   * Get a summary of all route interceptions for debugging
   */
  getSummary(): string {
    const lines: string[] = ["Route Tracker Summary:", ""];

    lines.push("Mocked Routes:");
    for (const [pattern, data] of this.interceptedRoutes) {
      const status = data.count > 0 ? "✓" : "✗";
      lines.push(`  ${status} ${pattern}: ${data.count} call(s)`);
    }

    if (this.unmockedRequests.length > 0) {
      lines.push("");
      lines.push("Unmocked Requests:");
      for (const { url, method } of this.unmockedRequests) {
        lines.push(`  ${method} ${url}`);
      }

      lines.push("");
      lines.push("Suggested Mocks:");
      for (const suggestion of this.getMissingMocks()) {
        lines.push(suggestion);
      }
    }

    if (this.bodyValidationErrors.length > 0) {
      lines.push("");
      lines.push("Body Validation Errors:");
      for (const err of this.bodyValidationErrors) {
        lines.push(`  ${err.pattern} (${err.url}): ${err.error}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Check if there are any issues (unmocked calls, uncalled mocks, validation errors)
   */
  hasIssues(): boolean {
    // Check for unmocked requests
    if (this.unmockedRequests.length > 0) {
      return true;
    }

    // Check for uncalled mocked routes
    for (const [, data] of this.interceptedRoutes) {
      if (data.count === 0) {
        return true;
      }
    }

    // Check for body validation errors
    if (this.bodyValidationErrors.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Get uncalled mocked routes (routes that were set up but never called)
   */
  getUncalledMocks(): string[] {
    const uncalled: string[] = [];
    for (const [pattern, data] of this.interceptedRoutes) {
      if (data.count === 0) {
        uncalled.push(pattern);
      }
    }
    return uncalled;
  }
}

/**
 * Check if a URL is a Vite dev server source file request.
 * Broad glob patterns like `**\/qr-code*` can accidentally match source
 * file URLs served by Vite (e.g. `/src/api/endpoints/qr-codes.ts`).
 * Use this in `page.route()` handlers to skip source files.
 */
export function isSourceFileRequest(url: string): boolean {
  return (
    url.includes("/src/") ||
    url.includes("/node_modules/") ||
    /\.(tsx?|jsx?|css|scss|svg|png|jpg|woff2?|ttf)(\?|$)/.test(url)
  );
}

/**
 * Register a `page.route()` handler that automatically skips Vite source
 * file requests. Without this, broad glob patterns like `**\/qr-code*`
 * intercept source file URLs such as `/src/api/endpoints/qr-codes.ts`,
 * returning JSON instead of JavaScript and breaking the app.
 */
export async function safeRoute(
  page: Page,
  pattern: string | RegExp | ((url: URL) => boolean),
  handler: (route: Route) => Promise<void>,
): Promise<void> {
  await page.route(pattern, async (route) => {
    // Never intercept top-level document navigations with API mocks.
    if (route.request().resourceType() === "document") {
      await route.continue();
      return;
    }
    if (isSourceFileRequest(route.request().url())) {
      await route.continue();
      return;
    }
    await handler(route);
  });
}
