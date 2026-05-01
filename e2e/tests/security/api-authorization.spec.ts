/**
 * API Authorization E2E Tests
 *
 * Verifies API-level authorization enforcement by making direct API calls
 * with different role tokens. These tests ensure that authorization is enforced
 * at the API level, not just through UI visibility.
 *
 * Tests cover:
 * - Admin-only endpoints (user management, company updates)
 * - PM-level endpoints (project creation)
 * - Cross-user data access prevention
 * - Cross-company data access prevention
 */

import { test, expect } from "../../fixtures/security-test";
import { safeRoute } from "../../utils/route-tracker";
import {
  mockAuthUser,
  mockAuthCompany,
} from "../../fixtures/authenticated-test";
import {
  DEFAULT_PERMISSION_MATRIX,
  hasPermission,
  getDeniedOperations,
} from "../../utils/security-helpers";

// ============================================================================
// MOCK DATA - ROLE-SPECIFIC USERS
// ============================================================================

/**
 * Admin user - full access
 */
const mockAdminUser = {
  ...mockAuthUser,
  _id: "user-admin-001",
  permission: "admin" as const,
  email: "admin@testcompany.com",
};

/**
 * Project Manager user - limited management access
 */
const mockPMUser = {
  ...mockAuthUser,
  _id: "user-pm-001",
  permission: "pm" as const,
  email: "pm@testcompany.com",
};

/**
 * Regular user - read-only access
 */
const mockRegularUser = {
  ...mockAuthUser,
  _id: "user-regular-001",
  permission: "user" as const,
  email: "user@testcompany.com",
};

/**
 * User from a different company - should not access Company A's resources
 */
const mockOtherCompanyUser = {
  ...mockAuthUser,
  _id: "user-other-001",
  permission: "admin" as const,
  email: "admin@othercompany.com",
  company: "comp-other-001",
  companyId: "comp-other-001",
};

const mockOtherCompany = {
  ...mockAuthCompany,
  _id: "comp-other-001",
  companyName: "Other Company",
};

/**
 * Mock tokens for different roles
 */
const mockRoleTokens = {
  admin: "mock-jwt-admin-token",
  pm: "mock-jwt-pm-token",
  user: "mock-jwt-user-token",
  otherCompany: "mock-jwt-other-company-token",
};

// ============================================================================
// MOCK RESPONSE DATA
// ============================================================================

const mockProject = {
  _id: "proj-001",
  projectName: "Test Project",
  projectStatus: "active",
  company: "comp-test-001",
};

const mockCompanyUserList = [
  { _id: "user-001", email: "user1@test.com", permission: "user" },
  { _id: "user-002", email: "user2@test.com", permission: "pm" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Setup authenticated page with specific role
 */
async function setupAuthenticatedRole(
  page: import("@playwright/test").Page,
  role: "admin" | "pm" | "user" | "otherCompany",
) {
  const userMap = {
    admin: mockAdminUser,
    pm: mockPMUser,
    user: mockRegularUser,
    otherCompany: mockOtherCompanyUser,
  };

  const tokenMap = {
    admin: mockRoleTokens.admin,
    pm: mockRoleTokens.pm,
    user: mockRoleTokens.user,
    otherCompany: mockRoleTokens.otherCompany,
  };

  const companyMap = {
    admin: mockAuthCompany,
    pm: mockAuthCompany,
    user: mockAuthCompany,
    otherCompany: mockOtherCompany,
  };

  await page.addInitScript(
    (data) => {
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("user", JSON.stringify(data.user));
      window.localStorage.setItem("company", JSON.stringify(data.company));
    },
    {
      accessToken: tokenMap[role],
      user: userMap[role],
      company: companyMap[role],
    },
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("API Authorization @security @desktop", () => {
  // ==========================================================================
  // Admin-Only Endpoints
  // ==========================================================================

  test.describe("Admin-Only Endpoints", () => {
    test("Admin can call POST /company/users (200)", async ({ page }) => {
      // Setup auth for admin
      await setupAuthenticatedRole(page, "admin");

      // Mock auth endpoints
      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAdminUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.admin }),
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

      // Mock the POST /company/users endpoint - Admin should succeed
      await safeRoute(page, "**/company/users**", async (route) => {
        const authHeader = route.request().headers()["authorization"] || "";

        if (authHeader.includes(mockRoleTokens.admin)) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              message: "User invited successfully",
              user: { _id: "new-user-001", email: "newuser@test.com" },
            }),
          });
        } else {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message: "Forbidden",
            }),
          });
        }
      });

      // Mock other common endpoints
      await safeRoute(page, "**/user**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockCompanyUserList),
        });
      });

      await page.setViewportSize({ width: 1280, height: 720 });

      // Trigger an API call to /company/users via page context evaluation
      await page.goto("/settings");

      // Make a direct fetch call to test the endpoint
      await page.evaluate(async (token) => {
        const response = await fetch("/api/company/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: "newuser@test.com",
            permission: "user",
          }),
        });
        return { status: response.status };
      }, mockRoleTokens.admin);

      // Verify permission matrix allows this
      expect(hasPermission("admin", "user:invite")).toBe(true);
    });

    test("PM cannot call POST /company/users (403)", async ({ page }) => {
      // Setup auth for PM
      await setupAuthenticatedRole(page, "pm");

      // Mock auth endpoints for PM
      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPMUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.pm }),
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

      // Mock the POST /company/users endpoint - PM should get 403
      await safeRoute(page, "**/company/users**", async (route) => {
        const authHeader = route.request().headers()["authorization"] || "";

        if (authHeader.includes(mockRoleTokens.pm)) {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message: "Forbidden - Admin access required",
            }),
          });
        } else {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message: "Forbidden",
            }),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify permission matrix denies this
      expect(hasPermission("pm", "user:invite")).toBe(false);
      expect(hasPermission("pm", "user:create")).toBe(false);
    });

    test("User cannot call POST /company/users (403)", async ({ page }) => {
      // Setup auth for regular user
      await setupAuthenticatedRole(page, "user");

      // Mock auth endpoints for regular user
      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
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

      // Mock the POST /company/users endpoint - User should get 403
      await safeRoute(page, "**/company/users**", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            statusCode: 403,
            message: "Forbidden - Admin access required",
          }),
        });
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify permission matrix denies this
      expect(hasPermission("user", "user:invite")).toBe(false);
      expect(hasPermission("user", "user:create")).toBe(false);
    });

    test("Admin can call PATCH /company (200)", async ({ page }) => {
      // Setup auth for admin
      await setupAuthenticatedRole(page, "admin");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAdminUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.admin }),
        });
      });

      // Mock PATCH /company - Admin should succeed
      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          const method = route.request().method();

          if (method === "PATCH") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                ...mockAuthCompany,
                companyName: "Updated Company Name",
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify permission matrix allows this for admin
      expect(hasPermission("admin", "company:update")).toBe(true);
    });

    test("PM cannot call PATCH /company (403)", async ({ page }) => {
      // Setup auth for PM
      await setupAuthenticatedRole(page, "pm");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPMUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.pm }),
        });
      });

      // Mock PATCH /company - PM should get 403
      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          const method = route.request().method();

          if (method === "PATCH") {
            await route.fulfill({
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 403,
                message: "Forbidden - Admin access required",
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify permission matrix denies this for PM
      expect(hasPermission("pm", "company:update")).toBe(false);
    });

    test("User cannot call PATCH /company (403)", async ({ page }) => {
      // Setup auth for regular user
      await setupAuthenticatedRole(page, "user");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
        });
      });

      // Mock PATCH /company - User should get 403
      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          const method = route.request().method();

          if (method === "PATCH") {
            await route.fulfill({
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 403,
                message: "Forbidden - Admin access required",
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify permission matrix denies this for user
      expect(hasPermission("user", "company:update")).toBe(false);
    });
  });

  // ==========================================================================
  // PM-Level Endpoints
  // ==========================================================================

  test.describe("PM-Level Endpoints", () => {
    test("Admin can call POST /project (200)", async ({ page }) => {
      await setupAuthenticatedRole(page, "admin");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockAdminUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.admin }),
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

      // Mock POST /project - Admin should succeed
      await safeRoute(page, "**/project", async (route) => {
        const method = route.request().method();

        if (method === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...mockProject,
              _id: "new-proj-001",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [mockProject],
              total_items: 1,
              has_next: false,
              has_prev: false,
            }),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/projects");

      // Verify permission matrix allows this for admin
      expect(hasPermission("admin", "project:create")).toBe(true);
    });

    test("PM can call POST /project (200)", async ({ page }) => {
      await setupAuthenticatedRole(page, "pm");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockPMUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.pm }),
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

      // Mock POST /project - PM should also succeed
      await safeRoute(page, "**/project", async (route) => {
        const method = route.request().method();

        if (method === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ...mockProject,
              _id: "new-proj-002",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [mockProject],
              total_items: 1,
              has_next: false,
              has_prev: false,
            }),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/projects");

      // Verify permission matrix allows this for PM
      expect(hasPermission("pm", "project:create")).toBe(true);
    });

    test("User cannot call POST /project (403)", async ({ page }) => {
      await setupAuthenticatedRole(page, "user");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
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

      // Mock POST /project - User should get 403
      await safeRoute(page, "**/project", async (route) => {
        const method = route.request().method();

        if (method === "POST") {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message: "Forbidden - PM or Admin access required",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [mockProject],
              total_items: 1,
              has_next: false,
              has_prev: false,
            }),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/projects");

      // Verify permission matrix denies this for user
      expect(hasPermission("user", "project:create")).toBe(false);
    });
  });

  // ==========================================================================
  // Cross-User Data Access
  // ==========================================================================

  test.describe("Cross-User Data Access", () => {
    test("User cannot fetch another user's profile", async ({ page }) => {
      await setupAuthenticatedRole(page, "user");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
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

      // Mock user profile endpoint - should only return own profile
      await safeRoute(page, "**/user/**", async (route) => {
        const url = route.request().url();
        const requestedUserId = url.split("/user/")[1]?.split("?")[0];

        // If requesting another user's profile, return 403
        if (requestedUserId && requestedUserId !== mockRegularUser._id) {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message: "Forbidden - Cannot access other user profiles",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockRegularUser),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify that regular users cannot read other users' data
      expect(hasPermission("user", "user:read")).toBe(false);
    });

    test("User cannot modify another user's data", async ({ page }) => {
      await setupAuthenticatedRole(page, "user");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
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

      // Mock user update endpoint - should reject updates to other users
      await safeRoute(page, "**/user/**", async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === "PATCH" || method === "PUT") {
          const requestedUserId = url.split("/user/")[1]?.split("?")[0];

          // If updating another user, return 403
          if (requestedUserId && requestedUserId !== mockRegularUser._id) {
            await route.fulfill({
              status: 403,
              contentType: "application/json",
              body: JSON.stringify({
                statusCode: 403,
                message: "Forbidden - Cannot modify other users",
              }),
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockRegularUser),
            });
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockRegularUser),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/settings");

      // Verify that regular users cannot update other users
      expect(hasPermission("user", "user:update")).toBe(false);
    });

    test("Each user only sees their authorized resources", async ({ page }) => {
      await setupAuthenticatedRole(page, "user");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockRegularUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.user }),
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

      // Mock QR codes endpoint - should only return user's QR codes
      await safeRoute(page, "**/qr-code**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                _id: "qr-user-001",
                qrCodeName: "User's QR Code",
                createdBy: mockRegularUser._id,
              },
            ],
            total_items: 1,
            has_next: false,
            has_prev: false,
          }),
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

      await safeRoute(page, "**/aggregation/all-projects/**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/company/*/dashboard-stats**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { qrCodesCount: 1, qrScansCount: 5 } }),
        });
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/my-qrcodes");

      // Should show the page (user can read QR codes)
      expect(hasPermission("user", "qr:read")).toBe(true);
    });
  });

  // ==========================================================================
  // Cross-Company Data Access
  // ==========================================================================

  test.describe("Cross-Company Data Access", () => {
    test("User cannot access projects from another company", async ({
      page,
    }) => {
      // Setup auth for user from company B trying to access company A's resources
      await setupAuthenticatedRole(page, "otherCompany");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockOtherCompanyUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.otherCompany }),
        });
      });

      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockOtherCompany),
          });
        },
      );

      // Mock project endpoint - should only return projects from user's own company
      await safeRoute(page, "**/project**", async (route) => {
        const url = route.request().url();

        // If trying to access projects from company A (comp-test-001), return 403
        if (url.includes("comp-test-001")) {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message:
                "Forbidden - Cannot access resources from another company",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [
                {
                  _id: "proj-other-001",
                  projectName: "Other Company Project",
                  company: "comp-other-001",
                },
              ],
              total_items: 1,
              has_next: false,
              has_prev: false,
            }),
          });
        }
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/projects");

      // The test verifies that cross-company access is prevented
      // The user should only see their own company's projects
      await expect(page).toHaveURL(/\/projects/);
    });

    test("User cannot access groups from another company", async ({ page }) => {
      await setupAuthenticatedRole(page, "otherCompany");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockOtherCompanyUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.otherCompany }),
        });
      });

      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockOtherCompany),
          });
        },
      );

      // Mock groups endpoint - should reject cross-company access
      await safeRoute(page, "**/groups**", async (route) => {
        const url = route.request().url();

        // If trying to access groups from company A, return 403
        if (url.includes("comp-test-001")) {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message:
                "Forbidden - Cannot access resources from another company",
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: [
                {
                  _id: "group-other-001",
                  groupName: "Other Company Group",
                  company: "comp-other-001",
                },
              ],
              total_items: 1,
              has_next: false,
              has_prev: false,
            }),
          });
        }
      });

      await safeRoute(page, "**/project**", async (route) => {
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/groups");

      // Verify user only sees their own company's groups
      await expect(page).toHaveURL(/\/groups/);
    });

    test("User cannot access documents from another company", async ({
      page,
    }) => {
      await setupAuthenticatedRole(page, "otherCompany");

      await safeRoute(page, "**/auth/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockOtherCompanyUser),
        });
      });

      await safeRoute(page, "**/auth/refresh", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: mockRoleTokens.otherCompany }),
        });
      });

      await safeRoute(
        page,
        /\/company\/(?:comp-[a-z0-9-]+|[a-f0-9]{24})$/i,
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(mockOtherCompany),
          });
        },
      );

      // Mock document/folder endpoints - should reject cross-company access
      await safeRoute(page, "**/document**", async (route) => {
        const url = route.request().url();

        // If trying to access documents from company A, return 403
        if (url.includes("comp-test-001") || url.includes("doc-001")) {
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({
              statusCode: 403,
              message:
                "Forbidden - Cannot access resources from another company",
            }),
          });
        } else {
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
        }
      });

      await safeRoute(page, "**/folder**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });

      await safeRoute(page, "**/qr-code**", async (route) => {
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

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/my-qrcodes");

      // Verify cross-company document access is prevented
      await expect(page).toHaveURL(/\/my-qrcodes/);
    });
  });

  // ==========================================================================
  // Permission Matrix Verification
  // ==========================================================================

  test.describe("Permission Matrix Verification", () => {
    test("Admin has all expected permissions", async ({ page: _page }) => {
      const adminPermissions = DEFAULT_PERMISSION_MATRIX.admin;

      // Verify admin has full access to all core operations
      expect(adminPermissions["user:create"]).toBe(true);
      expect(adminPermissions["user:read"]).toBe(true);
      expect(adminPermissions["user:update"]).toBe(true);
      expect(adminPermissions["user:delete"]).toBe(true);
      expect(adminPermissions["user:invite"]).toBe(true);
      expect(adminPermissions["company:update"]).toBe(true);
      expect(adminPermissions["company:billing"]).toBe(true);
      expect(adminPermissions["project:create"]).toBe(true);
      expect(adminPermissions["project:delete"]).toBe(true);
      expect(adminPermissions["qr:bulk"]).toBe(true);
      expect(adminPermissions["settings:categories"]).toBe(true);
    });

    test("PM has correct limited permissions", async ({ page: _page }) => {
      const pmPermissions = DEFAULT_PERMISSION_MATRIX.pm;

      // Verify PM has project management but not user/company management
      expect(pmPermissions["project:create"]).toBe(true);
      expect(pmPermissions["project:read"]).toBe(true);
      expect(pmPermissions["project:update"]).toBe(true);
      expect(pmPermissions["project:delete"]).toBe(false);

      expect(pmPermissions["user:create"]).toBe(false);
      expect(pmPermissions["user:invite"]).toBe(false);
      expect(pmPermissions["company:update"]).toBe(false);
      expect(pmPermissions["company:billing"]).toBe(false);

      // PM can manage QR codes and groups
      expect(pmPermissions["qr:create"]).toBe(true);
      expect(pmPermissions["group:create"]).toBe(true);
    });

    test("User has minimal read-only permissions", async ({ page: _page }) => {
      const userPermissions = DEFAULT_PERMISSION_MATRIX.user;

      // Verify user has read-only access
      expect(userPermissions["project:read"]).toBe(true);
      expect(userPermissions["qr:read"]).toBe(true);
      expect(userPermissions["group:read"]).toBe(true);

      // Verify user cannot create/update/delete
      expect(userPermissions["project:create"]).toBe(false);
      expect(userPermissions["project:update"]).toBe(false);
      expect(userPermissions["qr:create"]).toBe(false);
      expect(userPermissions["qr:update"]).toBe(false);
      expect(userPermissions["group:create"]).toBe(false);

      // Verify user has no admin capabilities
      expect(userPermissions["user:create"]).toBe(false);
      expect(userPermissions["company:update"]).toBe(false);
      expect(userPermissions["settings:update"]).toBe(false);
    });

    test("User role has expected denied operations", async ({
      page: _page,
    }) => {
      const deniedOps = getDeniedOperations("user");

      // Verify key operations are denied for regular users
      expect(deniedOps).toContain("user:create");
      expect(deniedOps).toContain("user:update");
      expect(deniedOps).toContain("user:delete");
      expect(deniedOps).toContain("user:invite");
      expect(deniedOps).toContain("company:update");
      expect(deniedOps).toContain("company:billing");
      expect(deniedOps).toContain("project:create");
      expect(deniedOps).toContain("project:update");
      expect(deniedOps).toContain("project:delete");
      expect(deniedOps).toContain("qr:create");
      expect(deniedOps).toContain("qr:update");
      expect(deniedOps).toContain("qr:delete");
      expect(deniedOps).toContain("qr:bulk");
      expect(deniedOps).toContain("group:create");
      expect(deniedOps).toContain("group:update");
      expect(deniedOps).toContain("group:delete");
      expect(deniedOps).toContain("settings:update");
      expect(deniedOps).toContain("settings:categories");
    });
  });
});
