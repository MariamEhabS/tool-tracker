/**
 * XSS Prevention E2E Tests
 *
 * Comprehensive tests to verify Cross-Site Scripting (XSS) vulnerabilities
 * are properly prevented across all user-facing input fields and rendering contexts.
 *
 * Tests cover:
 * - Project name fields (create/edit forms, list rendering, detail views)
 * - QR Code name fields (create/edit forms, list rendering, detail views)
 * - User input fields (profile fields, company name)
 * - Group name fields
 * - API response handling (malicious data, error messages, toasts)
 * - URL parameters (query params, route params, search queries)
 */

import { test, expect, XSS_VECTORS } from "../../fixtures/security-test";
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

/**
 * Extended XSS vectors for comprehensive testing.
 * Includes basic vectors plus additional edge cases.
 */
const EXTENDED_XSS_VECTORS = [
  ...XSS_VECTORS.slice(0, 15), // Use first 15 from the standard set
  // Additional vectors for thorough testing
  "<img src=\"javascript:alert('xss')\">",
  "<iframe src=\"javascript:alert('xss')\"></iframe>",
  "<a href=\"javascript:alert('xss')\">click me</a>",
  '"><img src=x onerror=alert(1)>',
  "';alert(String.fromCharCode(88,83,83))//",
];

/**
 * Helper to set up authenticated state with all necessary mocks
 */
async function setupAuthenticatedState(page: import("@playwright/test").Page) {
  // Auth mocks
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
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("XSS Prevention @security @desktop", () => {
  // ==========================================================================
  // Project Name Field Tests
  // ==========================================================================

  test.describe("Project Name Field", () => {
    test("should escape HTML in project names when creating", async ({
      page,
      securityHelpers: _securityHelpers,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock projects list
      await safeRoute(page, "**/project?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Projects fetched successfully",
            total_pages: 1,
            current_page: 1,
            total_items: 0,
            has_next: false,
            has_prev: false,
            data: [],
          }),
        });
      });

      // Mock project creation - accept any payload, return success with the name
      await safeRoute(page, "**/project", async (route) => {
        if (route.request().method() === "POST") {
          const body = route.request().postData();
          let projectName = "Test Project";
          if (body) {
            try {
              const parsed = JSON.parse(body);
              projectName = parsed.projectName || projectName;
            } catch {
              // ignore parse errors
            }
          }
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              _id: "proj-xss-test-001",
              projectName,
              projectStatus: "active",
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      // Click create project button
      const createButton = page
        .getByRole("button", { name: "Create Project" })
        .first();
      await createButton.click();

      // Wait for modal
      const modal = page
        .locator('[role="dialog"]')
        .filter({ hasText: "Create Project" });
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Test XSS vectors in project name field
      const projectNameInput = modal.getByPlaceholder("Enter project name");

      // Test first 10 XSS vectors
      for (let i = 0; i < 10; i++) {
        const vector = EXTENDED_XSS_VECTORS[i];

        await projectNameInput.fill("");
        await projectNameInput.fill(vector);

        // Wait briefly for any script execution
        await page.waitForTimeout(100);

        // Verify no alert was triggered
        expect(alertTriggered.triggered).toBe(false);

        // Clear for next iteration
        await projectNameInput.fill("");
      }
    });

    test("should not execute script tags in project list", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock projects list with malicious project names
      const maliciousProjects = EXTENDED_XSS_VECTORS.slice(0, 10).map(
        (vector, i) => ({
          _id: `proj-mal-${i}`,
          projectName: vector,
          projectStatus: "active",
          projectAddress: "123 Test St",
          projectCity: "Test City",
          projectState: "CA",
          projectZIP: "90001",
          clientName: `Client ${i}`,
          company: "comp-test-001",
          qrCodesCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      await safeRoute(page, "**/project?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Projects fetched successfully",
            total_pages: 1,
            current_page: 1,
            total_items: maliciousProjects.length,
            has_next: false,
            has_prev: false,
            data: maliciousProjects,
          }),
        });
      });

      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      // Wait for table to render
      await page.waitForTimeout(500);

      // Verify no alerts were triggered while rendering malicious data
      expect(alertTriggered.triggered).toBe(false);

      // Verify the page didn't crash and table is visible
      const table = page.locator("table").first();
      await expect(table).toBeVisible({ timeout: 5000 });
    });

    test("should safely render project names with special characters", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Project with various HTML entities and special chars
      const specialCharProject = {
        _id: "proj-special-001",
        projectName:
          '<script>alert("xss")</script> & "quotes" \'single\' <tag>',
        projectStatus: "active",
        projectAddress: "123 Test St",
        projectCity: "Test City",
        projectState: "CA",
        projectZIP: "90001",
        clientName: "Test Client",
        company: "comp-test-001",
        qrCodesCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await safeRoute(page, "**/project?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Projects fetched successfully",
            total_pages: 1,
            current_page: 1,
            total_items: 1,
            has_next: false,
            has_prev: false,
            data: [specialCharProject],
          }),
        });
      });

      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      // Wait for table to render
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify the project name is displayed as text, not executed
      const pageContent = await page.content();
      expect(pageContent).not.toContain("<script>alert");

      // The script tag should be escaped in the rendered HTML
      // It should appear as text content, not as an actual script element
      const dangerousScripts = await page.evaluate(() => {
        const scripts = document.querySelectorAll("script");
        return Array.from(scripts).filter((s) => s.textContent?.includes("xss"))
          .length;
      });
      expect(dangerousScripts).toBe(0);
    });
  });

  // ==========================================================================
  // QR Code Name Field Tests
  // ==========================================================================

  test.describe("QR Code Name Field", () => {
    test("should escape HTML in QR code names", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock QR codes list
      await safeRoute(page, "**/qr-code?**", async (route) => {
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

      // Mock aggregations
      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");

      // Verify no alerts on initial load
      expect(alertTriggered.triggered).toBe(false);
    });

    test("should safely render QR names in detail view", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      const maliciousQrCode = {
        _id: "qr-xss-001",
        qrCodeName: "<img src=x onerror=\"alert('xss')\">",
        qrCodeDescription: '<script>alert("xss")</script>',
        qrType: "info",
        company: "comp-test-001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await safeRoute(page, "**/qr-code/qr-xss-001**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(maliciousQrCode),
        });
      });

      await safeRoute(page, "**/folder**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], count: 0 }),
        });
      });

      await safeRoute(page, "**/document**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], count: 0 }),
        });
      });

      await safeRoute(page, "**/procore-item**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/qrcode/qr-xss-001");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify no dangerous event handlers in the DOM
      const hasDangerousHandlers = await page.evaluate(() => {
        const elements = document.querySelectorAll("[onerror], [onload]");
        return Array.from(elements).some((el) => {
          const handlers = ["onerror", "onload"];
          return handlers.some((h) => el.getAttribute(h)?.includes("alert"));
        });
      });
      expect(hasDangerousHandlers).toBe(false);
    });

    test("should not execute event handlers in QR list", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock QR codes with malicious event handlers
      const maliciousQrCodes = EXTENDED_XSS_VECTORS.slice(0, 10).map(
        (vector, i) => ({
          _id: `qr-mal-${i}`,
          qrCodeName: vector,
          qrCodeDescription: `Description with ${vector}`,
          qrType: "info",
          company: "comp-test-001",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      await safeRoute(page, "**/qr-code?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: maliciousQrCodes,
            total_items: maliciousQrCodes.length,
            has_next: false,
            has_prev: false,
          }),
        });
      });

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify the page rendered without crashes
      const tableOrEmpty = await page.locator("table, h4").first().isVisible();
      expect(tableOrEmpty).toBe(true);
    });
  });

  // ==========================================================================
  // User Input Fields Tests
  // ==========================================================================

  test.describe("User Input Fields", () => {
    test("should escape HTML in user profile fields (first name, last name)", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock settings page endpoints
      await safeRoute(page, "**/user**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [mockAuthUser], total: 1 }),
        });
      });

      await safeRoute(page, "**/category**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/company/qr-style-config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });

      await safeRoute(page, "**/procore/status**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ connected: false }),
        });
      });

      await safeRoute(page, "**/stripe/products**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      });

      await safeRoute(page, "**/storage-stats**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });

      await safeRoute(page, "**/storage-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ history: [] }),
        });
      });

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Expand user settings section
      const userSettingsToggle = page.locator(
        "#settings-section-user-settings button[aria-expanded]",
      );
      const isExpanded = await userSettingsToggle.getAttribute("aria-expanded");
      if (isExpanded !== "true") {
        await userSettingsToggle.click();
        await page.waitForTimeout(300);
      }

      // Click edit button
      const editButton = page.locator(
        '[data-testid="user-profile"] [data-testid="edit-button"]',
      );
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.waitForTimeout(300);

        // Test XSS in first name field
        const firstNameInput = page.locator('[data-testid="input-first-name"]');
        if (await firstNameInput.isVisible().catch(() => false)) {
          for (let i = 0; i < 10; i++) {
            const vector = EXTENDED_XSS_VECTORS[i];
            await firstNameInput.fill("");
            await firstNameInput.fill(vector);
            await page.waitForTimeout(50);
            expect(alertTriggered.triggered).toBe(false);
          }
        }

        // Test XSS in last name field
        const lastNameInput = page.locator('[data-testid="input-last-name"]');
        if (await lastNameInput.isVisible().catch(() => false)) {
          for (let i = 0; i < 10; i++) {
            const vector = EXTENDED_XSS_VECTORS[i];
            await lastNameInput.fill("");
            await lastNameInput.fill(vector);
            await page.waitForTimeout(50);
            expect(alertTriggered.triggered).toBe(false);
          }
        }
      }

      expect(alertTriggered.triggered).toBe(false);
    });

    test("should escape HTML in company name", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock settings page endpoints
      await safeRoute(page, "**/user**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [mockAuthUser], total: 1 }),
        });
      });

      await safeRoute(page, "**/category**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/company/qr-style-config**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });

      await safeRoute(page, "**/procore/status**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ connected: false }),
        });
      });

      await safeRoute(page, "**/stripe/products**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [] }),
        });
      });

      await safeRoute(page, "**/storage-stats**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      });

      await safeRoute(page, "**/storage-history**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ history: [] }),
        });
      });

      await page.goto("/settings");
      await page.waitForLoadState("networkidle");

      // Expand company section
      const companyToggle = page.locator(
        "#settings-section-company button[aria-expanded]",
      );
      if (await companyToggle.isVisible().catch(() => false)) {
        const isExpanded = await companyToggle.getAttribute("aria-expanded");
        if (isExpanded !== "true") {
          await companyToggle.click();
          await page.waitForTimeout(300);
        }

        // Click edit button for company info
        const companyEditButton = page.locator(
          '[data-testid="company-info"] [data-testid="edit-button"]',
        );
        if (await companyEditButton.isVisible().catch(() => false)) {
          await companyEditButton.click();
          await page.waitForTimeout(300);

          // Test XSS in company name field
          const companyNameInput = page.locator(
            '[data-testid="input-company-name"]',
          );
          if (await companyNameInput.isVisible().catch(() => false)) {
            for (let i = 0; i < 10; i++) {
              const vector = EXTENDED_XSS_VECTORS[i];
              await companyNameInput.fill("");
              await companyNameInput.fill(vector);
              await page.waitForTimeout(50);
              expect(alertTriggered.triggered).toBe(false);
            }
          }
        }
      }

      expect(alertTriggered.triggered).toBe(false);
    });

    test("should escape HTML in group names", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock groups with malicious names
      const maliciousGroups = EXTENDED_XSS_VECTORS.slice(0, 10).map(
        (vector, i) => ({
          _id: `grp-mal-${i}`,
          groupName: vector,
          groupType: "equipment",
          company: "comp-test-001",
          qrCodesCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      await safeRoute(page, "**/groups?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: maliciousGroups,
            total_items: maliciousGroups.length,
            has_next: false,
            has_prev: false,
          }),
        });
      });

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/groups");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify the page rendered
      const tableOrEmpty = await page.locator("table, h4").first().isVisible();
      expect(tableOrEmpty).toBe(true);
    });
  });

  // ==========================================================================
  // API Response Handling Tests
  // ==========================================================================

  test.describe("API Response Handling", () => {
    test("should safely render malicious API response data", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock dashboard stats with malicious data
      await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              qrCodesCount: '<script>alert("xss")</script>',
              qrScansCount: "<img src=x onerror=alert(1)>",
              documentsCount: "normal text",
            },
          }),
        });
      });

      await safeRoute(page, "**/qr-code?**", async (route) => {
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

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);
    });

    test("should not execute scripts from error messages", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock an API error with malicious message
      await safeRoute(page, "**/qr-code?**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 500,
            message: '<script>alert("xss")</script>An error occurred',
            error: '<img src=x onerror="alert(1)">Server Error',
          }),
        });
      });

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);
    });

    test("should escape HTML in toast notifications", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock project list
      await safeRoute(page, "**/project?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Projects fetched successfully",
            total_pages: 1,
            current_page: 1,
            total_items: 0,
            has_next: false,
            has_prev: false,
            data: [],
          }),
        });
      });

      // Mock project creation with error containing XSS
      await safeRoute(page, "**/project", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 400,
              message: '<script>alert("xss")</script>Invalid project name',
              error: "Bad Request",
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto("/projects");
      await page.waitForLoadState("networkidle");

      // Try to create a project to trigger an error toast
      const createButton = page
        .getByRole("button", { name: "Create Project" })
        .first();
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();

        const modal = page
          .locator('[role="dialog"]')
          .filter({ hasText: "Create Project" });
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Fill form and submit
          await modal
            .getByPlaceholder("Enter project name")
            .fill("Test Project");
          await modal.getByPlaceholder("Enter client name").fill("Test Client");
          await modal.getByPlaceholder("123 Main St").fill("123 Test St");
          await modal.getByPlaceholder("Anytown").fill("Test City");
          await modal.getByPlaceholder("CA").fill("CA");
          await modal.getByPlaceholder("90001").fill("90001");

          const submitButton = modal.getByRole("button", {
            name: /Create Project|Creating/,
          });
          if (await submitButton.isEnabled().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(500);
          }
        }
      }

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);
    });
  });

  // ==========================================================================
  // URL Parameters Tests
  // ==========================================================================

  test.describe("URL Parameters", () => {
    test("should not execute XSS in query parameters", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock necessary endpoints
      await safeRoute(page, "**/qr-code?**", async (route) => {
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

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      // Test XSS vectors in query parameters
      for (let i = 0; i < 10; i++) {
        const vector = encodeURIComponent(EXTENDED_XSS_VECTORS[i]);
        await page.goto(`/my-qrcodes?search=${vector}`);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(100);

        // Verify no alerts were triggered
        expect(alertTriggered.triggered).toBe(false);
      }
    });

    test("should sanitize route parameters", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock 404 response for invalid project ID
      await safeRoute(page, "**/project/**", async (route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 404,
            message: "Project not found",
          }),
        });
      });

      // Test XSS vectors in route parameters
      for (let i = 0; i < 10; i++) {
        const vector = encodeURIComponent(EXTENDED_XSS_VECTORS[i]);
        await page.goto(`/project/${vector}`);
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(100);

        // Verify no alerts were triggered
        expect(alertTriggered.triggered).toBe(false);
      }
    });

    test("should escape search query display", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock QR codes list
      await safeRoute(page, "**/qr-code?**", async (route) => {
        const url = new URL(route.request().url());
        const searchParam = url.searchParams.get("search") || "";

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            total_items: 0,
            has_next: false,
            has_prev: false,
            // Include the search term in the response to simulate it being displayed
            searchTerm: searchParam,
          }),
        });
      });

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/my-qrcodes");
      await page.waitForLoadState("networkidle");

      // Find search input and test XSS vectors
      const searchInput = page.getByPlaceholder("Search QR codes...");
      if (await searchInput.isVisible().catch(() => false)) {
        for (let i = 0; i < 10; i++) {
          const vector = EXTENDED_XSS_VECTORS[i];
          await searchInput.fill("");
          await searchInput.fill(vector);
          await page.waitForTimeout(100);

          // Verify no alerts were triggered
          expect(alertTriggered.triggered).toBe(false);
        }
      }
    });
  });

  // ==========================================================================
  // Additional XSS Prevention Tests
  // ==========================================================================

  test.describe("Additional XSS Prevention", () => {
    test("should prevent DOM-based XSS via innerHTML-like patterns", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Mock dashboard
      await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockDashboardStats),
        });
      });

      await safeRoute(page, "**/qr-code?**", async (route) => {
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

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/groups**", async (route) => {
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

      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Verify no dangerous patterns exist in the page
      const hasDangerousPatterns = await page.evaluate(() => {
        // Check for any elements with suspicious inline handlers
        const allElements = document.querySelectorAll("*");
        for (const el of Array.from(allElements)) {
          const attrs = el.getAttributeNames();
          for (const attr of attrs) {
            if (
              attr.startsWith("on") &&
              el.getAttribute(attr)?.includes("alert")
            ) {
              return true;
            }
          }
        }
        return false;
      });

      expect(hasDangerousPatterns).toBe(false);
      expect(alertTriggered.triggered).toBe(false);
    });

    test("should escape SVG-based XSS vectors", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // SVG-specific XSS vectors
      const svgVectors = [
        "<svg onload=\"alert('xss')\">",
        '<svg><script>alert("xss")</script></svg>',
        '<svg><animate onbegin="alert(1)">',
        '<svg><set onbegin="alert(1)">',
        "<svg><foreignObject><script>alert(1)</script></foreignObject></svg>",
      ];

      // Mock groups with SVG XSS vectors
      const maliciousGroups = svgVectors.map((vector, i) => ({
        _id: `grp-svg-${i}`,
        groupName: vector,
        groupType: "equipment",
        company: "comp-test-001",
        qrCodesCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await safeRoute(page, "**/groups?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: maliciousGroups,
            total_items: maliciousGroups.length,
            has_next: false,
            has_prev: false,
          }),
        });
      });

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await page.goto("/groups");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify no malicious SVG elements were created
      const hasMaliciousSvg = await page.evaluate(() => {
        const svgs = document.querySelectorAll("svg[onload], svg[onerror]");
        return svgs.length > 0;
      });
      expect(hasMaliciousSvg).toBe(false);
    });

    test("should handle Unicode and encoded XSS attempts", async ({
      page,
      alertTriggered,
    }) => {
      await setupAuthenticatedState(page);

      // Unicode and encoded XSS vectors
      const encodedVectors = [
        "\\u003cscript\\u003ealert(1)\\u003c/script\\u003e",
        "\u003cscript\u003ealert(1)\u003c/script\u003e",
        "%3Cscript%3Ealert(1)%3C/script%3E",
        "&#60;script&#62;alert(1)&#60;/script&#62;",
        "&lt;script&gt;alert(1)&lt;/script&gt;",
        "\\x3cscript\\x3ealert(1)\\x3c/script\\x3e",
      ];

      // Mock projects with encoded XSS vectors
      const maliciousProjects = encodedVectors.map((vector, i) => ({
        _id: `proj-enc-${i}`,
        projectName: vector,
        projectStatus: "active",
        projectAddress: "123 Test St",
        projectCity: "Test City",
        projectState: "CA",
        projectZIP: "90001",
        clientName: vector,
        company: "comp-test-001",
        qrCodesCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await safeRoute(page, "**/project?**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success_message: "Projects fetched successfully",
            total_pages: 1,
            current_page: 1,
            total_items: maliciousProjects.length,
            has_next: false,
            has_prev: false,
            data: maliciousProjects,
          }),
        });
      });

      await page.goto("/projects");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      // Verify no alerts were triggered
      expect(alertTriggered.triggered).toBe(false);

      // Verify table rendered correctly
      const table = page.locator("table").first();
      await expect(table).toBeVisible({ timeout: 5000 });
    });
  });
});
